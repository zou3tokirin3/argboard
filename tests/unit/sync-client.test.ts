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

/** Queue deliveries until explicitly drained, so neither editor sees the other's edit early. */
function withPeers(run) {
  const keys = ["WebSocket", "location", "addEventListener", "removeEventListener"];
  const originals = Object.fromEntries(keys.map(k => [k, globalThis[k]]));
  const sockets = [], log = [], messages = [], controllers = [];
  class Socket {
    static OPEN = 1;
    readyState = 1;
    incoming = [];
    constructor() { sockets.push(this); }
    send(raw) {
      const m = parseMessage(raw);
      messages.push(m);
      if (m.t === "hello") {
        const rows = log.filter(o => o.seq > m.since);
        for (let i = 0; i < rows.length; i += 500) this.incoming.push({ t: "ops", ops: rows.slice(i, i + 500) });
        this.incoming.push({ t: "ops", ops: [] });
      } else {
        const rows = sequenceOps(m.ops, log.length, oid => log.find(o => o.oid === oid));
        for (const row of rows) if (!log.some(o => o.oid === row.oid)) log.push(row);
        for (const s of sockets) if (s.readyState === 1) s.incoming.push({ t: "ops", ops: rows });
      }
    }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  const drain = () => {
    while (sockets.some(s => s.readyState === 1 && s.incoming.length)) {
      for (const s of sockets) if (s.readyState === 1 && s.incoming.length) {
        s.onmessage?.({ data: JSON.stringify(s.incoming.shift()) });
      }
    }
  };
  const peer = id => {
    const p = {
      value: { ...createEmptyProject("shared", 1), share: { room: "a".repeat(22), seq: 0, pending: [] } },
      count: 0,
      connect() {
        this.controller = connectRoom(() => this.value, value => { this.value = value; }, () => {});
        controllers.push(this.controller);
        sockets.at(-1).onopen();
      },
      edit(op) {
        this.value = queueOps(this.value, applyOp(this.value, op), op => ({ oid: `${id}:${++this.count}`, op }));
      },
    };
    return p;
  };
  try {
    Object.assign(globalThis, { WebSocket: Socket, location: { origin: "https://example.test", protocol: "https:" }, addEventListener() {}, removeEventListener() {} });
    const a = peer("a"), b = peer("b");
    a.connect(); b.connect(); drain();
    run({ a, b, drain, log, messages });
  } finally {
    for (const c of controllers) c.close();
    for (const [key, value] of Object.entries(originals)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
}

const seed = (a, b, drain) => {
  a.edit({ k: "card", id: "x", v: { id: "x", title: "initial", foundAt: 1 } });
  a.controller.flush(); drain();
  assert.deepEqual(a.value.cards, b.value.cards);
};
const converged = (a, b) => {
  assert.deepEqual(a.value.cards, b.value.cards);
  assert.equal(a.value.share.seq, b.value.share.seq);
  assert.deepEqual(a.value.share.pending, []);
  assert.deepEqual(b.value.share.pending, []);
};

test("both peers edit offline and converge after both reconnect", () => withPeers(({ a, b, drain }) => {
  seed(a, b, drain);
  a.controller.close(); b.controller.close();
  a.edit({ k: "cf", id: "x", f: "title", v: "offline A" });
  b.edit({ k: "cf", id: "x", f: "body", v: "offline B" });
  // Both sockets reconnect before either receives catch-up.
  a.connect(); b.connect(); drain();
  converged(a, b);
  assert.equal(a.value.cards[0].title, "offline A");
  assert.equal(a.value.cards[0].body, "offline B");
}));

for (const deleteFirst of [true, false]) test(`concurrent deletion/update converge (delete first=${deleteFirst})`, () => withPeers(({ a, b, drain }) => {
  seed(a, b, drain);
  a.edit({ k: "card", id: "x", v: null });
  b.edit({ k: "cf", id: "x", f: "title", v: "updated" });
  const peers = deleteFirst ? [a, b] : [b, a];
  for (const p of peers) p.controller.flush();
  drain();
  converged(a, b);
  assert.deepEqual(a.value.cards, []);
}));

for (const aFirst of [true, false]) test(`online same-field edits converge to server's last write (A first=${aFirst})`, () => withPeers(({ a, b, drain, log }) => {
  seed(a, b, drain);
  a.edit({ k: "cf", id: "x", f: "title", v: "A" });
  b.edit({ k: "cf", id: "x", f: "title", v: "B" });
  for (const p of aFirst ? [a, b] : [b, a]) p.controller.flush();
  drain();
  converged(a, b);
  assert.equal(a.value.cards[0].title, aFirst ? "B" : "A");
  assert.equal(a.value.cards[0].title, log.at(-1).op.v);
}));

for (const count of [0, 500, 1001]) test(`pending push batches at most 500 operations (${count})`, () => withPeers(({ a, b, drain, messages }) => {
  for (let i = 0; i < count; i++) a.edit({ k: "name", v: `name ${i}` });
  a.controller.flush();
  a.controller.flush(); // Already sent pending operations must not be sent twice.
  const pushes = messages.filter(m => m.t === "push");
  assert.deepEqual(pushes.map(m => m.ops.length), count === 0 ? [] : count === 500 ? [500] : [500, 500, 1]);
  assert.deepEqual(pushes.flatMap(m => m.ops), a.value.share.pending);
  drain();
  assert.equal(a.value.name, b.value.name);
  assert.deepEqual(a.value.share.pending, []);
}));

test("push batches also respect the existing 256 KiB UTF-8 message limit", () => withPeers(({ a, b, drain, messages }) => {
  for (let i = 0; i < 20; i++) a.edit({ k: "name", v: `${i}${"あ".repeat(19990)}` });
  a.controller.flush();
  const pushes = messages.filter(m => m.t === "push");
  assert.ok(pushes.length > 1);
  assert.ok(pushes.every(m => new TextEncoder().encode(JSON.stringify(m)).length <= 256 * 1024));
  assert.deepEqual(pushes.flatMap(m => m.ops), a.value.share.pending);
  drain();
  assert.equal(a.value.name, b.value.name);
  assert.deepEqual(a.value.share.pending, []);
}));
