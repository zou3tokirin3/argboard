import type { Project } from "./types.ts";

export type PersistStatus =
  | { kind: "idle" }
  | { kind: "saving" | "error"; projectId: string; projectName: string };

export function createPersistQueue(deps: {
  saveProject: (project: Project) => Promise<void>;
  onStatus: (status: PersistStatus) => void;
  onPendingChange?: (hasUnsaved: boolean) => void;
  indicatorDelayMs?: number;
  schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  cancel?: (id: ReturnType<typeof setTimeout>) => void;
}) {
  const pending = new Map<string, Project>();
  const failed = new Map<string, Project>();
  const schedule = deps.schedule ?? setTimeout;
  const cancel = deps.cancel ?? clearTimeout;
  let chain = Promise.resolve();
  let unsaved = false;
  let visible = false;
  const hasUnsaved = () => pending.size > 0 || failed.size > 0;
  function notify() {
    if (unsaved === hasUnsaved()) return;
    unsaved = hasUnsaved();
    deps.onPendingChange?.(unsaved);
  }
  function report(kind: "saving" | "error", snapshot: Project) {
    visible = true;
    deps.onStatus({ kind, projectId: snapshot.id, projectName: snapshot.name });
  }
  async function drain() {
    while (pending.size) {
      const [id, snapshot] = pending.entries().next().value!;
      if (visible && !failed.size) report("saving", snapshot);
      const timer = schedule(() => {
        if (!failed.size) report("saving", snapshot);
      }, deps.indicatorDelayMs ?? 450);
      try {
        await deps.saveProject(snapshot);
        if (pending.get(id) === snapshot) pending.delete(id);
        failed.delete(id);
      } catch {
        const keep = pending.get(id) ?? snapshot;
        pending.delete(id);
        failed.set(id, keep);
        report("error", keep);
      } finally {
        cancel(timer);
      }
      notify();
      const error = failed.values().next().value;
      if (error) report("error", error);
      else if (!pending.size) {
        visible = false;
        deps.onStatus({ kind: "idle" });
      }
    }
  }
  function kick() {
    chain = chain.then(drain);
    return chain;
  }
  return {
    enqueue(snapshot: Project): Promise<void> {
      pending.set(snapshot.id, snapshot);
      failed.delete(snapshot.id);
      notify();
      return kick();
    },
    getLatest: (id: string) => pending.get(id) ?? failed.get(id),
    hasUnsaved,
    retry(projectId?: string): Promise<void> {
      for (const [id, snapshot] of failed) {
        if (projectId && id !== projectId) continue;
        if (!pending.has(id)) pending.set(id, snapshot);
        failed.delete(id);
      }
      notify();
      return kick();
    },
    async flush(): Promise<void> {
      do {
        await chain;
      } while (pending.size);
    },
  };
}
