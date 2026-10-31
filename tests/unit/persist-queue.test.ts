import assert from "node:assert/strict";
import { test } from "node:test";
import { createPersistQueue } from "../../ui/persist-queue.ts";
import { createEmptyProject } from "../../ui/project.ts";

test("serializes A and B, coalesces latest A, and delays the indicator", async () => {
  const a = createEmptyProject("A");
  const b = createEmptyProject("B");
  const latest = { ...a, name: "A latest" };
  const writes = [];
  const statuses = [];
  const changes = [];
  let release;
  let tick;
  const queue = createPersistQueue({
    saveProject: async (snapshot) => {
      writes.push(snapshot);
      if (writes.length === 1) await new Promise((resolve) => { release = resolve; });
    },
    onStatus: (status) => statuses.push(status),
    onPendingChange: (value) => changes.push(value),
    schedule: (fn, ms) => { assert.equal(ms, 450); tick = fn; return 1; },
    cancel: () => { tick = undefined; },
  });
  void queue.enqueue(a);
  await Promise.resolve();
  void queue.enqueue({ ...a, name: "intermediate" });
  void queue.enqueue(latest);
  void queue.enqueue(b);
  assert.deepEqual(statuses, []);
  tick();
  assert.equal(statuses.at(-1).projectId, a.id);
  assert.equal(queue.getLatest(a.id), latest);
  release();
  await queue.flush();
  assert.deepEqual(writes, [a, latest, b]);
  assert.deepEqual(changes, [true, false]);
  assert.equal(queue.hasUnsaved(), false);
  assert.equal(queue.getLatest(a.id), undefined);
  assert.deepEqual(statuses.at(-1), { kind: "idle" });
});

test("failure keeps newest A, continues B, and retains error until retry", async () => {
  const a = createEmptyProject("A");
  const latest = { ...a, name: "A latest" };
  const b = createEmptyProject("B");
  const statuses = [];
  const changes = [];
  const writes = [];
  let reject;
  const queue = createPersistQueue({
    saveProject: async (snapshot) => {
      writes.push(snapshot);
      if (writes.length === 1) await new Promise((_, fail) => { reject = fail; });
    },
    onStatus: (status) => statuses.push(status),
    onPendingChange: (value) => changes.push(value),
  });
  void queue.enqueue(a);
  await Promise.resolve();
  void queue.enqueue(latest);
  void queue.enqueue(b);
  reject(new Error("disk full"));
  await queue.flush();
  assert.deepEqual(writes, [a, b]);
  assert.equal(queue.getLatest(a.id), latest);
  assert.equal(queue.hasUnsaved(), true);
  assert.deepEqual(changes, [true]);
  assert.deepEqual(statuses.at(-1), { kind: "error", projectId: a.id, projectName: latest.name });
  await queue.retry(a.id);
  assert.equal(writes.at(-1), latest);
  assert.deepEqual(changes, [true, false]);
  assert.deepEqual(statuses.at(-1), { kind: "idle" });
});
