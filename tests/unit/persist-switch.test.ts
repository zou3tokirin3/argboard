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
    const editing = state.renameProject("A latest");
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
      await editing;
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
    await editing;
    await state.flushSave();
    assert.equal(listeners.size, 0);
    assert.equal(writes.filter((item) => item.id === a.id).at(-1).name, "A latest");
  } finally {
    state.installStoreForTests(store);
    delete globalThis.window;
  }
});
