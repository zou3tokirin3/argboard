import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { BoardView } from "./board.tsx";
import { Capture } from "./capture.tsx";
import { readCaptureDraft } from "./capture-draft.ts";
import { imageBlobFromClipboard } from "./clipboard-image.ts";
import { getPersistenceRequestCount } from "./db.ts";
import { Inspector } from "./inspector.tsx";
import {
  activeProjectId,
  addCard,
  appMode,
  clearExploreImageDraft,
  closeExploreCompose,
  commitExploreImageDraft,
  connectCards,
  createProject,
  exploreComposeCardId,
  exploreImageDraft,
  exportProject,
  flushSave,
  hasProject,
  importProjectFromText,
  initialize,
  isReplaying,
  pasteExploreImage,
  patchExploreImageDraft,
  pickAndImportProject,
  placeCardOnBoard,
  project,
  projectName,
  projectSummaries,
  refreshProjectSummaries,
  removeCard,
  removeLink,
  renameProject,
  saveStatus,
  selectedCardId,
  selectedLinkId,
  setAppMode,
  setSideOpen,
  sideOpen,
  switchProject,
  updateCardRole,
  updateLink,
} from "./state.ts";
import { Stream } from "./stream.tsx";

const INSTALL_TIP_KEY = "argboard.installTipDismissed";

function isStandaloneDisplay(): boolean {
  if (globalThis.matchMedia("(display-mode: standalone)").matches) return true;
  const safari = navigator as Navigator & { standalone?: boolean };
  return safari.standalone === true;
}

function InstallTip() {
  const [open, setOpen] = useState(() => {
    if (isStandaloneDisplay()) return false;
    try {
      return localStorage.getItem(INSTALL_TIP_KEY) !== "1";
    } catch {
      return true;
    }
  });

  if (!open) return null;

  return (
    <div class="install-tip" role="status" data-testid="install-tip">
      <p>
        ホーム画面やDockに追加すると、このブラウザでの保存がより安定します。
      </p>
      <button
        type="button"
        data-testid="install-tip-dismiss"
        onClick={() => {
          try {
            localStorage.setItem(INSTALL_TIP_KEY, "1");
          } catch {
            // ignore quota / private mode
          }
          setOpen(false);
        }}
      >
        閉じる
      </button>
    </div>
  );
}

declare global {
  interface Window {
    __argboardTest?: {
      getState: () => unknown;
      flushSave: () => Promise<void>;
      getPersistenceRequestCount: () => number;
      addCard: (
        title: string,
        options?: {
          role?: "finding" | "thought";
          placeAt?: { x: number; y: number };
        },
      ) => Promise<string | null>;
      updateCardRole: (
        id: string,
        role: "finding" | "thought",
      ) => Promise<void>;
      createProject: (name?: string) => Promise<unknown>;
      importProjectFromText: (text: string) => Promise<unknown>;
      switchProject: (id: string) => Promise<void>;
      listProjects: () => unknown;
      placeCardOnBoard: (cardId: string, x: number, y: number) => Promise<void>;
      connectCards: (fromId: string, toId: string) => Promise<void>;
      updateLink: (
        linkId: string,
        patch: { label?: string; kind?: "connects" | "contradicts" },
      ) => Promise<void>;
      setAppMode: (mode: "explore" | "contemplate") => Promise<void>;
      commitExploreImageDraft: () => Promise<string | null>;
      patchExploreImageDraft: (
        patch: { title?: string; body?: string; url?: string },
      ) => void;
      pasteExploreImage: (
        blob: Blob,
        draft?: { title: string; body?: string; url?: string },
      ) => Promise<string | null>;
    };
  }
}

function SaveStatusLabel() {
  const status = saveStatus.value;
  const label = status === "saving"
    ? "保存中…"
    : status === "error"
    ? "保存できませんでした"
    : "このブラウザに保存済み";
  return (
    <span class={`save-status is-${status}`} aria-live="polite">
      {label}
    </span>
  );
}

function TopBar() {
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectRename, setProjectRename] = useState("");
  const mode = appMode.value;
  const renameSource = projectName.value;
  const renameProjectId = activeProjectId.value;

  useEffect(() => {
    setProjectRename((prev) => (prev === renameSource ? prev : renameSource));
  }, [renameProjectId, renameSource]);

  useEffect(() => {
    if (!projectMenuOpen) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Element | null;
      if (target?.closest("[data-project-menu-root]")) return;
      setProjectMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setProjectMenuOpen(false);
    }
    globalThis.addEventListener("pointerdown", onPointerDown);
    globalThis.addEventListener("keydown", onKeyDown);
    return () => {
      globalThis.removeEventListener("pointerdown", onPointerDown);
      globalThis.removeEventListener("keydown", onKeyDown);
    };
  }, [projectMenuOpen]);

  return (
    <header class="topbar">
      <div class="topbar__left">
        <div
          class={`project-menu ${projectMenuOpen ? "is-open" : ""}`}
          data-project-menu-root
        >
          <button
            type="button"
            class="project-menu__toggle"
            data-testid="project-menu-toggle"
            aria-haspopup="menu"
            aria-expanded={projectMenuOpen}
            aria-controls="project-menu-panel"
            onClick={() => {
              const next = !projectMenuOpen;
              setProjectMenuOpen(next);
              if (next) void refreshProjectSummaries();
            }}
          >
            プロジェクト
          </button>
          {projectMenuOpen
            ? (
              <div
                id="project-menu-panel"
                class="project-menu__panel"
                role="menu"
                aria-label="プロジェクト操作"
              >
                <label class="project-menu__field">
                  <span>切替</span>
                  <select
                    data-testid="project-select"
                    aria-label="プロジェクト切替"
                    value={activeProjectId.value}
                    onChange={(event) => {
                      void switchProject(event.currentTarget.value);
                      setProjectMenuOpen(false);
                    }}
                  >
                    {projectSummaries.value
                      .toSorted((left, right) =>
                        right.updatedAt - left.updatedAt
                      )
                      .map((item) => {
                        const when = new Date(item.updatedAt).toLocaleString(
                          "ja",
                          {
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        );
                        return (
                          <option key={item.id} value={item.id}>
                            {item.name}（{item.cardCount}枚・{when}）
                          </option>
                        );
                      })}
                  </select>
                </label>
                <button
                  type="button"
                  class="project-menu__action"
                  data-testid="project-create"
                  role="menuitem"
                  onClick={() => {
                    void createProject();
                    setProjectMenuOpen(false);
                  }}
                >
                  新規作成
                </button>
                <form
                  class="project-menu__rename"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void renameProject(projectRename);
                    setProjectMenuOpen(false);
                  }}
                >
                  <label class="project-menu__field">
                    <span>名前変更</span>
                    <input
                      data-testid="project-rename-input"
                      aria-label="プロジェクト名"
                      value={projectRename}
                      onInput={(event) =>
                        setProjectRename(event.currentTarget.value)}
                    />
                  </label>
                  <button
                    type="submit"
                    class="project-menu__action"
                    data-testid="project-rename-save"
                  >
                    保存
                  </button>
                </form>
              </div>
            )
            : null}
        </div>
        <div class="brand">
          <span class="brand__mark" aria-hidden="true">A</span>
          <div>
            <span>ARGBoard</span>
            <small>{projectName.value}</small>
          </div>
        </div>
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
        <SaveStatusLabel />
        <button
          type="button"
          data-testid="export-btn"
          onClick={() => {
            void exportProject();
          }}
        >
          JSONを書き出す
        </button>
        <button
          type="button"
          data-testid="import-btn"
          onClick={pickAndImportProject}
        >
          JSONを読み込む
        </button>
      </div>
    </header>
  );
}

function ExploreWorkspace() {
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (appMode.value !== "explore") return;
      if (isReplaying.value) return;
      const blob = imageBlobFromClipboard(event);
      if (!blob) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) {
        if (!target.closest(".capture-block")) return;
      }
      event.preventDefault();
      const draft = readCaptureDraft() ?? undefined;
      void pasteExploreImage(blob, draft ?? undefined);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (appMode.value !== "explore") return;
      if (event.key !== "Escape") return;
      if (exploreImageDraft.value) {
        event.preventDefault();
        clearExploreImageDraft();
        return;
      }
      if (!exploreComposeCardId.value) return;
      event.preventDefault();
      closeExploreCompose();
    }
    function onPointerDown(event: PointerEvent) {
      if (appMode.value !== "explore") return;
      const target = event.target as Element | null;
      if (exploreImageDraft.value) {
        if (target?.closest(".capture-image-staging")) return;
        if (target?.closest('[data-testid="capture-image-slot"]')) return;
        if (target?.closest('[data-testid="capture-image-pick"]')) return;
        return;
      }
      if (!exploreComposeCardId.value) return;
      if (target?.closest(".capture-compose")) return;
      if (target?.closest('[data-testid="stream-card-thumb"]')) return;
      if (target?.closest('[data-testid="capture-input"]')) return;
      closeExploreCompose();
    }
    globalThis.addEventListener("paste", onPaste);
    globalThis.addEventListener("keydown", onKeyDown);
    globalThis.addEventListener("pointerdown", onPointerDown);
    return () => {
      globalThis.removeEventListener("paste", onPaste);
      globalThis.removeEventListener("keydown", onKeyDown);
      globalThis.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <>
      <Capture explore />
      <div class="workspace workspace--explore">
        <Stream />
      </div>
    </>
  );
}

function ContemplateWorkspace() {
  const side = sideOpen.value;
  return (
    <div
      class={`workspace workspace--contemplate ${side ? "is-side-open" : ""}`}
    >
      <aside
        class="side-panel"
        id="discovery-side"
        aria-label="発見ログサイド"
        aria-hidden={!side}
        inert={!side || undefined}
      >
        <div class="side-panel__inner">
          <Capture />
          <Stream />
        </div>
      </aside>
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
  );
}

function AppShell() {
  const mode = appMode.value;
  return (
    <main class={`app-shell mode-${mode}`}>
      <InstallTip />
      <TopBar />
      {mode === "explore" ? <ExploreWorkspace /> : <ContemplateWorkspace />}
    </main>
  );
}

function ProjectBootstrap() {
  if (!hasProject.value) {
    return <main class="loading">読み込み中…</main>;
  }
  return <AppShell />;
}

function App() {
  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const linkId = selectedLinkId.value;
      if (linkId) {
        event.preventDefault();
        void removeLink(linkId);
        return;
      }
      const cardId = selectedCardId.value;
      if (!cardId) return;
      event.preventDefault();
      void removeCard(cardId);
    }
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, []);

  return <ProjectBootstrap />;
}

const isTest = new URLSearchParams(location.search).has("test");

if (isTest) {
  (globalThis as Window & typeof globalThis).__argboardTest = {
    getState: () => structuredClone(project.value),
    flushSave,
    getPersistenceRequestCount,
    addCard,
    updateCardRole,
    createProject: async (name?: string) =>
      structuredClone(await createProject(name)),
    importProjectFromText: (text: string) =>
      importProjectFromText(text).then(structuredClone),
    switchProject,
    listProjects: () => structuredClone(projectSummaries.value),
    placeCardOnBoard,
    connectCards,
    updateLink,
    setAppMode,
    pasteExploreImage,
    commitExploreImageDraft,
    patchExploreImageDraft,
  };
  document.documentElement.dataset.test = "true";
} else if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.register(new URL("./sw.js", location.href), {
    scope: "./",
  });
}

render(<App />, document.getElementById("app")!);
