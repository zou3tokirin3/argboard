import assert from "node:assert/strict";
import { test } from "node:test";
import { connectRoom } from "../../ui/sync-client.ts";
import { createEmptyProject } from "../../ui/project.ts";
import { applyOp, queueOps } from "../../ui/sync.ts";
import { parseMessage, sequenceOps } from "../../src/room-protocol.ts";

// Manual delivery models separate browsers without any network or timers.
test("WebSocket hello/push/ack, offline reload, and project switch cancellation", () => {
  const originals = Object.fromEntries(["WebSocket", "location", "addEventListener", "removeEventListener"].map(k => [k, globalThis[k]]));
  const sockets = [], log = [], listeners = new Map(), messages = [];
  class Socket {
    static OPEN = 1;
    readyState = 1;
    incoming = [];
    constructor(url) { this.url = url; sockets.push(this); }
    send(raw) {
      messages.push(JSON.parse(raw));
      const m = parseMessage(raw);
      if (m.t === "hello") {
        this.incoming.push({ t: "ops", ops: log.filter(o => o.seq > m.since) }, { t: "ops", ops: [] });
      } else {
        const rows = sequenceOps(m.ops, log.length, oid => log.find(o => o.oid === oid));
        for (const row of rows) if (!log.some(o => o.oid === row.oid)) log.push(row);
        for (const s of sockets) if (s.readyState === 1) s.incoming.push({ t: "ops", ops: rows });
      }
    }
    close() { this.readyState = 3; this.onclose?.(); }
    open() { this.onopen(); }
    deliver() {
      while (this.incoming.length) this.onmessage?.({ data: JSON.stringify(this.incoming.shift()) });
    }
  }
  const empty = () => ({ ...createEmptyProject("shared", 1), share: { room: "a".repeat(22), seq: 0, pending: [] } });
  let a = empty(), b = empty(), statusA;
  const controllers = [];
  const attach = (get, set, status = () => {}) => {
    const c = connectRoom(get, set, status); controllers.push(c); sockets.at(-1).open(); return c;
  };
  const edit = (p, op, oid) => queueOps(p, applyOp(p, op), op => ({ oid, op }));
  try {
    Object.assign(globalThis, { WebSocket: Socket, location: { origin: "https://example.test", protocol: "https:" }, addEventListener: (k, f) => { listeners.set(f, k); }, removeEventListener: (k, f) => listeners.delete(f) });
    const ca = attach(() => a, p => a = p, s => statusA = s), sa = sockets.at(-1);
    const cb = attach(() => b, p => b = p), sb = sockets.at(-1);
    sa.deliver(); sb.deliver();
    assert.equal(sa.url.href, "wss://example.test/api/rooms/" + "a".repeat(22));
    assert.deepEqual(messages[0], { t: "hello", since: 0 });
    assert.equal(statusA, "接続中");
    a = edit(a, { k: "card", id: "x", v: { id: "x", title: "x", foundAt: 1 } }, "a:1");
    ca.flush(); sa.deliver(); sb.deliver();
    assert.equal(b.cards[0].title, "x");
    assert.equal(a.share.pending.length, 0);
    ca.close();
    a = edit(a, { k: "cf", id: "x", f: "body", v: "offline" }, "a:2");
    a = JSON.parse(JSON.stringify(a)); // IndexedDB round trip, including pending.
    b = edit(b, { k: "cf", id: "x", f: "title", v: "online" }, "b:1");
    cb.flush(); sb.deliver();
    const reloaded = attach(() => a, p => a = p), sr = sockets.at(-1);
    assert.deepEqual(messages.at(-1), { t: "hello", since: 1 });
    sr.deliver(); sb.deliver();
    assert.equal(a.cards[0].title, "online");
    assert.equal(a.cards[0].body, "offline");
    assert.deepEqual(a.cards, b.cards);
    assert.equal(a.share.pending.length, 0);
    const before = structuredClone(a);
    reloaded.close();
    sr.incoming.push({ t: "ops", ops: [{ seq: 999, oid: "late:1", op: { k: "name", v: "late" } }] });
    sr.deliver();
    assert.deepEqual(a, before);
  } finally {
    for (const c of controllers) c.close();
    assert.equal(listeners.size, 0);
    for (const [key, value] of Object.entries(originals)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
});
