import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMessage, sequenceOps } from "../../src/room-protocol.ts";
import { createEmptyProject } from "../../ui/project.ts";
import { applyOp, diffOps, queueOps, randomRoom, receiveOps, roomValid, stripForShare } from "../../ui/sync.ts";

export class MemoryRoom {
  log = [];
  push(ops) {
    const message = parseMessage(JSON.stringify({ t: "push", ops }));
    assert.equal(message.t, "push");
    const rows = sequenceOps(message.ops, this.log.length, oid => this.log.find(o => o.oid === oid));
    for (const row of rows) if (!this.log.some(o => o.oid === row.oid)) this.log.push(row);
    return rows;
  }
}
const shared = () => ({ ...createEmptyProject("shared", 1), share: { room: "a".repeat(22), seq: 0, pending: [] } });
const card = id => ({ id, title: id, foundAt: 1 });
class Client {
  base = shared();
  p = structuredClone(this.base);
  count = 0;
  constructor(id) { this.id = id; }
  edit(op) { this.p = queueOps(this.p, applyOp(this.p, op), op => ({ oid: `${this.id}:${++this.count}`, op })); }
  receive(ops) { [this.base, this.p] = receiveOps(this.base, this.p, ops); }
}
const content = p => ({ name: p.name, cards: p.cards, links: p.links, positions: p.boards[0].positions, cardIds: p.boards[0].cardIds });
function exchange(server, a, b, sender) {
  const rows = server.push(sender.p.share.pending);
  a.receive(rows); b.receive(rows);
  assert.deepEqual(content(a.p), content(b.p));
}

test("two clients relay card creation/fields/placement/removal and link lifecycle", () => {
  const server = new MemoryRoom(), a = new Client("a"), b = new Client("b");
  const steps = [
    { k: "name", v: "renamed" },
    { k: "card", id: "a", v: card("a") },
    { k: "card", id: "b", v: card("b") },
    { k: "cf", id: "a", f: "title", v: "edited" },
    { k: "cf", id: "a", f: "tags", v: ["tag"] },
    { k: "cf", id: "a", f: "tags", v: null },
    { k: "pos", id: "a", v: { x: 10, y: 20 } },
    { k: "pos", id: "a", v: { x: 90, y: 80 } },
    { k: "link", id: "l", v: { id: "l", from: "a", to: "b", kind: "connects", createdAt: 1 } },
    { k: "link", id: "l", v: { id: "l", from: "b", to: "a", label: "why", kind: "contradicts", createdAt: 1 } },
    { k: "link", id: "l", v: null },
    { k: "pos", id: "a", v: null },
    { k: "card", id: "a", v: null },
  ];
  steps.forEach((op, i) => { const sender = i % 2 ? a : b; sender.edit(op); exchange(server, a, b, sender); });
  assert.equal(a.p.cards.length, 1);
  assert.equal(a.p.links.length, 0);
  assert.deepEqual(a.p.boards[0].positions, {});
});

test("offline pending rebases against confirmed state; same field is server-order LWW", () => {
  const server = new MemoryRoom(), a = new Client("a"), b = new Client("b");
  a.edit({ k: "card", id: "x", v: card("x") });
  a.edit({ k: "card", id: "y", v: card("y") });
  exchange(server, a, b, a);
  a.edit({ k: "cf", id: "x", f: "title", v: "offline title" });
  a.edit({ k: "cf", id: "x", f: "body", v: "offline body" });
  const offlineDisk = structuredClone(a.p);
  b.edit({ k: "cf", id: "x", f: "title", v: "online title" });
  b.edit({ k: "cf", id: "y", f: "body", v: "other card" });
  b.receive(server.push(b.p.share.pending));
  a.receive(server.log.filter(o => o.seq > a.p.share.seq));
  assert.equal(a.p.cards.find(c => c.id === "x").title, "offline title");
  exchange(server, a, b, a);
  assert.equal(b.p.cards.find(c => c.id === "x").body, "offline body");
  assert.equal(b.p.cards.find(c => c.id === "y").body, "other card");
  assert.equal(a.p.share.pending.length, 0);
  // Reload with pending: rebuild confirmed state from history, then resend duplicate oids.
  const empty = shared();
  const [, restored] = receiveOps(empty, { ...offlineDisk, share: { ...offlineDisk.share, seq: 0 } }, server.log);
  assert.deepEqual(content(restored), content(b.p));
  assert.equal(restored.share.pending.length, 0);
});

test("pending card creation does not overwrite later remote fields on ack", () => {
  const server = new MemoryRoom(), a = new Client("a"), b = new Client("b");
  a.edit({ k: "card", id: "x", v: card("x") });
  const birth = server.push(a.p.share.pending);
  b.receive(birth);
  b.edit({ k: "cf", id: "x", f: "body", v: "keep me" });
  const edit = server.push(b.p.share.pending);
  a.receive([...birth, ...edit]); b.receive(edit);
  assert.deepEqual(content(a.p), content(b.p));
  assert.equal(a.p.cards[0].body, "keep me");
});

test("nonshared projects create no pending operations or sends", () => {
  const p = createEmptyProject("private");
  let sends = 0;
  const next = queueOps(p, { ...p, name: "local" }, () => { sends++; throw Error("unexpected send"); });
  assert.equal(sends, 0);
  assert.equal(next.share, undefined);
});

test("sharing strips image/events/ui/viewport, while receiver remains a valid image-free card", () => {
  const p = shared();
  const image = { ...p, cards: [{ ...card("img"), image: "private-media" }], events: [], boards: [{ ...p.boards[0], viewport: { x: 1, y: 2, zoom: 3 } }] };
  const ops = diffOps(p, image);
  assert.ok(!JSON.stringify(ops).includes("image"));
  assert.deepEqual(diffOps(image, { ...image, cards: [{ ...image.cards[0], image: "new-media" }] }), []);
  const remote = ops.reduce(applyOp, p);
  assert.equal(remote.cards[0].title, "img");
  assert.equal(remote.cards[0].image, undefined);
  const stripped = JSON.stringify(stripForShare(image));
  for (const key of ["events", "viewport", "ui", "share", "image"]) assert.ok(!stripped.includes(`"${key}"`));
  const server = new MemoryRoom();
  const rows = server.push([{ oid: "s:1", op: { k: "card", id: "img", v: image.cards[0] } }]);
  assert.equal(rows[0].op.v.image, undefined);
});

test("validation: room entropy/format, bytes, kinds, field types, duplicate oid and atomic room cap", () => {
  assert.ok(roomValid(randomRoom()));
  for (const room of ["", "a".repeat(21), "a".repeat(65), "../" + "a".repeat(22), "a".repeat(21) + "+"]) assert.ok(!roomValid(room));
  for (const raw of [" ".repeat(262145), '"' + "あ".repeat(90000) + '"', "no-json", "null", new ArrayBuffer(1)]) assert.throws(() => parseMessage(raw));
  const push = op => JSON.stringify({ t: "push", ops: [{ oid: "o:1", op }] });
  for (const op of [
    { k: "wat", id: "x", v: null }, { k: "name", v: "x".repeat(20001) },
    { k: "pos", id: "x", v: { x: "2", y: 1 } },
    { k: "cf", id: "x", f: "image", v: "blob" },
    { k: "cf", id: "x", f: "__proto__", v: null },
    { k: "card", id: "x", v: { ...card("x"), foundAt: "bad" } },
    { k: "card", id: "__proto__", v: card("__proto__") },
    { k: "link", id: "l", v: { id: "l", from: "a", to: "b", kind: "bad", createdAt: 1 } },
  ]) assert.throws(() => parseMessage(push(op)));
  assert.throws(() => parseMessage(JSON.stringify({ t: "push", ops: Array(501).fill({ oid: "x", op: { k: "name", v: "x" } }) })));
  assert.throws(() => parseMessage(JSON.stringify({ t: "push", ops: [{ oid: "x".repeat(101), op: { k: "name", v: "x" } }] })));
  const server = new MemoryRoom(), batch = [{ oid: "s:1", op: { k: "name", v: "one" } }];
  const first = server.push(batch);
  assert.deepEqual(server.push([...batch, ...batch]), [...first, ...first]);
  assert.equal(server.log.length, 1);
  assert.equal(sequenceOps(batch, 50000, () => first[0]).length, 1);
  assert.throws(() => sequenceOps([{ oid: "new", op: { k: "name", v: "full" } }], 50000, () => undefined));
  assert.throws(() => sequenceOps([...batch, { oid: "s:2", op: { k: "name", v: "two" } }], 0, () => undefined, 1));
});

test("set ops are idempotent and keep input immutable; personal state survives receive", () => {
  let p = shared();
  p.boards.push({ id: "private", name: "private", positions: {}, cardIds: [] });
  for (const op of [
    { k: "card", id: "x", v: card("x") },
    { k: "cf", id: "x", f: "body", v: "body" },
    { k: "pos", id: "x", v: { x: 1, y: 2 } },
    { k: "link", id: "l", v: { id: "l", from: "x", to: "x", kind: "connects", createdAt: 1 } },
    { k: "name", v: "name" }, { k: "cf", id: "absent", f: "body", v: "no resurrection" },
  ]) {
    const snapshot = structuredClone(p), next = applyOp(p, op);
    assert.deepEqual(p, snapshot);
    assert.deepEqual(applyOp(next, op), next);
    p = next;
  }
  const local = structuredClone(p);
  local.boards[0].viewport = { x: 99, y: 88, zoom: 2 };
  local.boards[1].name = "personal change";
  local.events = [{ type: "project_opened", at: 42 }];
  const [, merged] = receiveOps(p, local, [{ seq: 1, oid: "z:1", op: { k: "name", v: "remote" } }]);
  assert.deepEqual(merged.boards, local.boards);
  assert.deepEqual(merged.events, local.events);
  assert.deepEqual(merged.ui, local.ui);
});
