import { render } from "preact";
import { useEffect } from "preact/hooks";
import { BoardView } from "./board.tsx";
import { Capture } from "./capture.tsx";
import { Inspector } from "./inspector.tsx";
import {
  appMode,
  exportProject,
  flushSave,
  initialize,
  project,
  saveStatus,
  setAppMode,
  setSideOpen,
  sideOpen,
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

  const mode = appMode.value;
  const side = sideOpen.value;
  const statusLabel = saveStatus.value === "saving"
    ? "保存中…"
    : saveStatus.value === "error"
    ? "保存できませんでした"
    : "このブラウザに保存済み";

  return (
    <main class={`app-shell mode-${mode}`}>
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
          <div class="mode-switch" role="tablist" aria-label="モード">
            <button
              type="button"
              role="tab"
              data-testid="mode-explore"
              aria-selected={mode === "explore"}
              class={mode === "explore" ? "is-active" : undefined}
              onClick={() => setAppMode("explore")}
            >
              探索
            </button>
            <button
              type="button"
              role="tab"
              data-testid="mode-contemplate"
              aria-selected={mode === "contemplate"}
              class={mode === "contemplate" ? "is-active" : undefined}
              onClick={() => setAppMode("contemplate")}
            >
              考察
            </button>
          </div>
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

      {mode === "explore"
        ? (
          <>
            <Capture />
            <div class="workspace workspace--explore">
              <Stream />
            </div>
          </>
        )
        : (
          <div
            class={`workspace workspace--contemplate ${
              side ? "is-side-open" : ""
            }`}
          >
            {side
              ? (
                <aside
                  class="side-panel"
                  id="discovery-side"
                  aria-label="発見ログサイド"
                >
                  <Capture />
                  <Stream />
                </aside>
              )
              : null}
            <button
              type="button"
              class="side-toggle"
              data-testid={side ? "side-close" : "side-open"}
              aria-expanded={side}
              aria-controls="discovery-side"
              aria-label={side ? "発見ログを閉じる" : "発見ログを開く"}
              title={side ? "発見ログを閉じる" : "発見ログを開く"}
              onClick={() => setSideOpen(!side)}
            >
              <span aria-hidden="true">{side ? "<" : ">"}</span>
            </button>
            <div class="contemplate-main">
              <BoardView />
              <Inspector />
            </div>
          </div>
        )}
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
