import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../../src/worker.ts";

test("room routing validates id, same-host Origin, and Upgrade; assets stay intact", async () => {
  let forwarded = 0, assets = 0;
  const room = "a".repeat(22);
  const env = {
    ASSETS: { fetch: async () => { assets++; return new Response("asset"); } },
    ROOMS: { idFromName: id => { assert.equal(id, room); return id; }, get: id => ({ fetch: async () => { forwarded++; return new Response(id); } }) },
  };
  const request = (path, headers = {}) => worker.fetch(new Request(`https://example.test${path}`, { headers }), env);
  assert.equal((await request("/api/rooms/bad", { Upgrade: "websocket" })).status, 400);
  assert.equal((await request(`/api/rooms/${room}`)).status, 426);
  assert.equal((await request(`/api/rooms/${room}`, { Upgrade: "websocket", Origin: "https://evil.test" })).status, 403);
  assert.equal((await request(`/api/rooms/${room}`, { Upgrade: "websocket", Origin: "null" })).status, 403);
  assert.equal((await request(`/api/rooms/${room}`, { Upgrade: "websocket", Origin: "https://example.test" })).status, 200);
  assert.equal((await request(`/api/rooms/${room}`, { Upgrade: "WebSocket" })).status, 200);
  assert.equal(forwarded, 2);
  assert.equal(await (await request("/board")).text(), "asset");
  assert.equal(assets, 1);
  assert.equal((await request("/api/ogp")).status, 200);
  assert.equal(assets, 1);
});
