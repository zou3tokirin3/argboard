import assert from "node:assert/strict";
import { test } from "node:test";
import { store } from "../../ui/db.ts";
import { createEmptyProject } from "../../ui/project.ts";
import * as state from "../../ui/state.ts";

for (const fail of [false, true]) test(`switch and imports preserve pending A (failure=${fail})`, async () => {
  const a = createEmptyProject("A");
  const b = createEmptyProject("B");
  const writes = [];
  let release;
  const listeners = new Set();
  globalThis.window = {
    addEventListener: (type, fn) => { if (type === "beforeunload") listeners.add(fn); },
    removeEventListener: (type, fn) => { if (type === "beforeunload") listeners.delete(fn); },
  };
  state.installStoreForTests({
    ...store,
    loadProject: async (id) => id === a.id ? a : b,
    saveProject: async (snapshot) => {
      writes.push(snapshot);
      if (writes.length === 1) {
        await new Promise((resolve) => { release = resolve; });
        if (fail) throw new Error("disk full");
      }
    },
  });
  try {
    await state.switchProject(a.id);
    await state.renameProject("A latest");
    assert.equal(state.projectSummaries.value.find((item) => item.id === a.id).name, "A latest");
    await state.switchProject(b.id);
    assert.equal(state.project.value.id, b.id);
    await state.createProject("New");
    assert.equal(state.project.value.name, "New");
    await state.importProjectFromText(JSON.stringify(b));
    assert.equal(state.project.value.name, "B（取り込み）");
    const { buildZip } = await import("../../ui/media.ts");
    const zip = buildZip(new Map([["project.json", new TextEncoder().encode(JSON.stringify(b))]]));
    await state.importProjectFromFile(new File([zip], "project.zip"));
    assert.equal(state.project.value.name, "B（取り込み）");
    if (fail) {
      release();
      await state.flushSave();
      assert.equal(state.saveStatus.value, "error");
      assert.equal(state.saveStatusProject.value.id, a.id);
    }
    assert.equal(listeners.size, 1);
    const event = { preventDefault() { this.prevented = true; } };
    [...listeners][0](event);
    assert.equal(event.prevented, true);
    assert.equal(event.returnValue, "");
    await state.switchProject(a.id);
    assert.equal(state.project.value.name, "A latest");
    release();
    await state.flushSave();
    assert.equal(listeners.size, 0);
    assert.equal(writes.filter((item) => item.id === a.id).at(-1).name, "A latest");
  } finally {
    state.installStoreForTests(store);
    delete globalThis.window;
  }
});

test("editing B resolves while A's save is still held", { timeout: 2000 }, async () => {
  const a = createEmptyProject("A");
  const b = createEmptyProject("B");
  const writes = [];
  let release;
  let released = false;
  state.installStoreForTests({
    ...store,
    loadProject: async (id) => id === a.id ? a : b,
    saveProject: async (snapshot) => {
      if (snapshot.id === a.id && !released) {
        await new Promise((resolve) => { release = () => { released = true; resolve(); }; });
      }
      writes.push(snapshot);
    },
  });
  try {
    await state.switchProject(a.id);
    await state.renameProject("A latest");
    await state.switchProject(b.id);
    await state.renameProject("B latest");
    assert.equal(released, false);
    assert.equal(writes.length, 0);
    assert.equal(state.project.value.name, "B latest");
    release();
    await state.flushSave();
    assert.equal(writes.filter((item) => item.id === a.id).at(-1).name, "A latest");
    assert.equal(writes.filter((item) => item.id === b.id).at(-1).name, "B latest");
  } finally {
    release?.();
    await state.flushSave();
    state.installStoreForTests(store);
  }
});

test("retrySave retries every failed project", async () => {
  const a = createEmptyProject("A");
  const b = createEmptyProject("B");
  const saved = new Map();
  let fail = true;
  state.installStoreForTests({
    ...store,
    loadProject: async (id) => id === a.id ? a : b,
    saveProject: async (snapshot) => {
      if (fail) throw new Error("disk full");
      saved.set(snapshot.id, snapshot);
    },
  });
  try {
    await state.switchProject(a.id);
    await state.renameProject("A latest");
    await state.switchProject(b.id);
    await state.renameProject("B latest");
    await state.flushSave();
    assert.equal(state.saveStatus.value, "error");
    fail = false;
    await state.retrySave();
    assert.equal(saved.get(a.id).name, "A latest");
    assert.equal(saved.get(b.id).name, "B latest");
    assert.equal(state.saveStatus.value, "saved");
  } finally {
    fail = false;
    await state.retrySave();
    state.installStoreForTests(store);
  }
});
