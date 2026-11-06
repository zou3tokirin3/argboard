import assert from "node:assert/strict";
import { test } from "node:test";
import { BoardRoom } from "../../src/room.ts";

for (const count of [0, 500, 1001]) test(`DO hello sends batches of at most 500 then an empty completion frame (${count})`, () => {
  const rows = Array.from({ length: count }, (_, i) => ({ seq: i + 1, oid: `a:${i}`, body: JSON.stringify({ k: "name", v: `name ${i}` }) }));
  const ctx = { storage: { sql: { exec(query, since) {
    if (query.startsWith("CREATE")) return [];
    assert.equal(query, "SELECT * FROM ops WHERE seq > ? ORDER BY seq");
    return rows.filter(r => r.seq > since);
  } } } };
  const room = new BoardRoom(ctx);
  for (const since of [0, count]) {
    const frames = [];
    room.webSocketMessage({ send: raw => frames.push(JSON.parse(raw)) }, JSON.stringify({ t: "hello", since }));
    const expected = rows.filter(r => r.seq > since).map(r => ({ seq: r.seq, oid: r.oid, op: JSON.parse(r.body) }));
    assert.deepEqual(frames.at(-1), { t: "ops", ops: [] });
    assert.ok(frames.slice(0, -1).every(f => f.t === "ops" && f.ops.length > 0 && f.ops.length <= 500));
    assert.equal(frames.length, Math.ceil(expected.length / 500) + 1);
    assert.deepEqual(frames.flatMap(f => f.ops), expected);
  }
});
