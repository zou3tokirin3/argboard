import assert from "node:assert/strict";
import { test } from "node:test";
import { store } from "../../ui/db.ts";
import { createEmptyProject } from "../../ui/project.ts";
import * as state from "../../ui/state.ts";
import { parseZip, projectJsonFromZip } from "../../ui/media.ts";

test("state persists offline pending including finished drag; private project never opens socket", async () => {
  const saved = new Map();
  const a = createEmptyProject("private"), b = createEmptyProject("shared");
  b.share = { room: "a".repeat(22), seq: 0, pending: [] };
  b.cards = [{ id: "x", title: "x", foundAt: 1 }];
  saved.set(a.id, a); saved.set(b.id, b);
  let opens = 0;
  const oldSocket = globalThis.WebSocket, oldLocation = globalThis.location;
  globalThis.location = { origin: "https://example.test", protocol: "https:" };
  // No location means no browser connection, but private persist is verified independently too.
  globalThis.WebSocket = class { constructor() { opens++; throw Error("no connection expected"); } };
  state.installStoreForTests({ ...store, loadProject: async id => saved.get(id), saveProject: async p => { saved.set(p.id, structuredClone(p)); } });
  try {
    await state.switchProject(a.id);
    await state.renameProject("still private");
    assert.equal(state.project.value.share, undefined);
    assert.equal(opens, 0);
    globalThis.WebSocket = undefined;
    await state.switchProject(b.id);
    await state.updateCard("x", { title: "offline edit" });
    state.moveCardOnBoardLocal("x", 12, 34);
    await state.commitCardPlacement("x");
    await state.flushSave();
    const disk = saved.get(b.id);
    assert.ok(disk.share.pending.some(o => o.op.k === "cf" && o.op.v === "offline edit"));
    assert.ok(disk.share.pending.some(o => o.op.k === "pos" && o.op.v.x === 12));
    await state.switchProject(a.id);
    await state.switchProject(b.id);
    assert.deepEqual(state.project.value.share.pending, disk.share.pending);
    await state.importProjectFromText(JSON.stringify(disk));
    assert.equal(state.project.value.share, undefined);
  } finally {
    await state.flushSave(); state.installStoreForTests(store); globalThis.WebSocket = oldSocket;
    if (oldLocation === undefined) delete globalThis.location; else globalThis.location = oldLocation;
  }
});

test("exported ZIP project.json omits room and pending but retains local image references", async () => {
  const p = createEmptyProject("export");
  p.share = { room: "a".repeat(22), seq: 7, pending: [{ oid: "a:1", op: { k: "name", v: "private" } }] };
  p.cards = [{ id: "x", title: "x", foundAt: 1, image: "local-media" }];
  state.project.value = p;
  let blob;
  const originals = { document: globalThis.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  Object.assign(globalThis, { document: { createElement: () => ({ click() {} }) } });
  URL.createObjectURL = value => { blob = value; return "blob:test"; };
  URL.revokeObjectURL = () => {};
  state.installStoreForTests({ ...store, getMedia: async () => null });
  try {
    await state.exportProject();
    const json = JSON.parse(projectJsonFromZip(parseZip(new Uint8Array(await blob.arrayBuffer()))));
    assert.equal(json.share, undefined);
    assert.equal(json.cards[0].image, "local-media");
  } finally {
    state.installStoreForTests(store);
    URL.createObjectURL = originals.create; URL.revokeObjectURL = originals.revoke;
    if (originals.document === undefined) delete globalThis.document; else globalThis.document = originals.document;
  }
});

test("join invitation reuses a local room, otherwise creates one, and removes hash", async () => {
  const local = createEmptyProject("local room");
  local.share = { room: "j".repeat(22), seq: 3, pending: [] };
  const saved = new Map([[local.id, local]]);
  const originals = Object.fromEntries(["location", "history", "WebSocket"].map(k => [k, globalThis[k]]));
  let cleared = 0;
  Object.assign(globalThis, {
    WebSocket: undefined,
    location: { hash: "#join=" + local.share.room, pathname: "/", search: "" },
    history: { replaceState(a, b, url) { assert.equal(url, "/"); cleared++; globalThis.location.hash = ""; } },
  });
  state.installStoreForTests({ ...store,
    listProjects: async () => [...saved.values()].map(p => ({ id: p.id, name: p.name, cardCount: 0, updatedAt: 1 })),
    loadProject: async id => saved.get(id), saveProject: async p => { saved.set(p.id, structuredClone(p)); },
  });
  try {
    await state.initialize(); await state.flushSave();
    assert.equal(state.project.value.id, local.id);
    assert.equal(saved.size, 1);
    // The app is already open on a private board; hashchange uses joinFromHash.
    await state.createProject("private board");
    await state.flushSave();
    const privateId = state.project.value.id;
    globalThis.location.hash = "#join=invalid";
    assert.equal(await state.joinFromHash(), false);
    assert.equal(state.project.value.id, privateId);
    globalThis.location.hash = "#join=" + "k".repeat(22);
    assert.equal(await state.joinFromHash(), true);
    await state.flushSave();
    assert.equal(state.project.value.share.room, "k".repeat(22));
    assert.equal(state.project.value.cards.length, 0);
    assert.equal(saved.size, 3);
    assert.equal(cleared, 2);
  } finally {
    await state.flushSave(); state.installStoreForTests(store);
    for (const [key, value] of Object.entries(originals)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
});
