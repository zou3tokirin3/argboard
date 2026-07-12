import { render } from "preact";
import { useEffect } from "preact/hooks";
import { BoardView } from "./board.tsx";
import { Capture } from "./capture.tsx";
import {
  exportProject,
  flushSave,
  initialize,
  project,
  saveStatus,
} from "./state.ts";
import { Stream } from "./stream.tsx";

declare global {
  interface Window {
    __argboardTest?: {
      getState: () => unknown;
      flushSave: () => Promise<void>;
    };
  }
}

function App() {
  useEffect(() => {
    initialize();
  }, []);

  if (!project.value) {
    return <main class="loading">読み込み中…</main>;
  }

  const statusLabel = saveStatus.value === "saving"
    ? "保存中…"
    : saveStatus.value === "error"
    ? "保存できませんでした"
    : "このブラウザに保存済み";

  return (
    <main class="app-shell">
      <header class="topbar">
        <div class="brand">
          <span class="brand__mark" aria-hidden="true">A</span>
          <div>
            <span>ARGBoard</span>
            <small>手がかりノート</small>
          </div>
        </div>
        <div class="case-title">
          <small>プロジェクト</small>
          <strong>{project.value.name}</strong>
        </div>
        <div class="topbar__actions">
          <span class={`save-status is-${saveStatus.value}`}>
            {statusLabel}
          </span>
          <button
            type="button"
            data-testid="export-btn"
            onClick={exportProject}
          >
            JSONを書き出す
          </button>
        </div>
      </header>
      <Capture />
      <div class="workspace">
        <Stream />
        <BoardView />
      </div>
    </main>
  );
}

if (new URLSearchParams(location.search).has("test")) {
  (globalThis as Window & typeof globalThis).__argboardTest = {
    getState: () => structuredClone(project.value),
    flushSave,
  };
  document.documentElement.dataset.test = "true";
}

render(<App />, document.getElementById("app")!);
