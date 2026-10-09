import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { BoardView } from "./board.tsx";
import { Capture } from "./capture.tsx";
import { readCaptureDraft } from "./capture-draft.ts";
import { imageBlobFromClipboard } from "./clipboard-image.ts";
import { getPersistenceRequestCount } from "./db.ts";
import { Inspector } from "./inspector.tsx";
import { LaneWorkspace } from "./lane-view.tsx";
import {
  activeProjectId,
  addCard,
  clearCardFoundVia,
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
  laneView,
  panelPhase,
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
  selectCardFromBoard,
  selectCardFromStream,
  selectedCardId,
  selectedLinkId,
  selectSingleCard,
  setAppMode,
  setPanelPhase,
  spawnThoughtFromLink,
  startDigging,
  stopDigging,
  switchProject,
  updateCardRole,
  updateLink,
} from "./state.ts";
import { appTitle } from "./release.ts";
import { Stream } from "./stream.tsx";

const INSTALL_TIP_KEY = "argboard.installTipDismissed";

function isStandaloneDisplay(): boolean {
  if (globalThis.matchMedia("(display-mode: standalone)").matches) return true;
  const safari = navigator as Navigator & { standalone?: boolean };
  return safari.standalone === true;
}

function useAppTitle() {
  useEffect(() => {
    document.title = appTitle();
  }, []);
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
      spawnThoughtFromLink: (
        fromId: string,
        x: number,
        y: number,
      ) => Promise<string | null>;
      updateLink: (
        linkId: string,
        patch: { label?: string; kind?: "connects" | "contradicts" },
      ) => Promise<void>;
      setAppMode: (mode: "explore" | "contemplate") => Promise<void>;
      setPanelPhase: (phase: "wide" | "rail" | "closed") => Promise<void>;
      commitExploreImageDraft: () => Promise<string | null>;
      patchExploreImageDraft: (
        patch: { title?: string; body?: string; url?: string },
      ) => void;
      pasteExploreImage: (
        blob: Blob,
        draft?: { title: string; body?: string; url?: string },
      ) => Promise<string | null>;
      startDigging: (cardId: string) => void;
      stopDigging: () => void;
      clearCardFoundVia: (cardId: string) => Promise<void>;
      selectCardFromStream: (cardId: string) => void;
      selectCardFromBoard: (cardId: string) => void;
      selectSingleCard: (cardId: string) => void;
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
            <h1 data-testid="app-release">{appTitle()}</h1>
            <small>{projectName.value}</small>
          </div>
        </div>
      </div>
      <div class="topbar__actions">
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

function Workspace() {
  const phase = panelPhase.value;
  const open = phase !== "closed";
  const wide = phase === "wide";

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (panelPhase.value !== "wide") return;
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
      if (event.key !== "Escape") return;
      if (panelPhase.value === "wide" && exploreImageDraft.value) {
        event.preventDefault();
        clearExploreImageDraft();
        return;
      }
      if (!exploreComposeCardId.value) return;
      event.preventDefault();
      closeExploreCompose();
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Element | null;
      if (panelPhase.value === "wide" && exploreImageDraft.value) {
        if (target?.closest(".capture-image-staging")) return;
        if (target?.closest('[data-testid="capture-image-slot"]')) return;
        if (target?.closest('[data-testid="capture-image-pick"]')) return;
        return;
      }
      if (!exploreComposeCardId.value) return;
      if (target?.closest(".capture-block")) return;
      if (target?.closest('[data-testid="stream-card-thumb"]')) return;
      if (target?.closest(".inspector")) return;
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
    <div
      class={`workspace workspace--board is-side-${phase}`}
      data-testid="workspace"
      data-panel-phase={phase}
    >
      <aside
        class="side-panel"
        id="discovery-side"
        aria-label="発見ログ"
        aria-hidden={!open}
        inert={!open || undefined}
      >
        <div class="side-panel__inner">
          <Capture wide={wide} />
          <Stream />
        </div>
      </aside>
      <div class="side-chrome">
        {open
          ? (
            <button
              type="button"
              class="side-phase"
              data-testid={wide ? "side-rail" : "side-wide"}
              aria-label={wide ? "発見ログを狭く" : "発見ログを広く"}
              title={wide ? "発見ログを狭く" : "発見ログを広く"}
              onClick={() => void setPanelPhase(wide ? "rail" : "wide")}
            >
              <span aria-hidden="true">{wide ? "«" : "»"}</span>
            </button>
          )
          : null}
        <button
          type="button"
          class="side-toggle"
          data-testid={open ? "side-close" : "side-open"}
          aria-expanded={open}
          aria-controls="discovery-side"
          aria-label={open ? "発見ログを閉じる" : "発見ログを開く"}
          title={open ? "発見ログを閉じる" : "発見ログを開く"}
          onClick={() => void setPanelPhase(open ? "closed" : "rail")}
        >
          <span aria-hidden="true">{open ? "<" : ">"}</span>
        </button>
      </div>
      <div
        class={`contemplate-main${
          laneView.value.open ? " is-chrono-open" : ""
        }`}
      >
        {laneView.value.open ? <LaneWorkspace /> : null}
        <BoardView />
        <Inspector />
      </div>
    </div>
  );
}

function AppShell() {
  return (
    <div class="app-shell">
      <a class="skip-link" href="#main-content" data-testid="skip-link">
        本文へ
      </a>
      <InstallTip />
      <TopBar />
      <main id="main-content" tabIndex={-1}>
        <Workspace />
      </main>
    </div>
  );
}

function ProjectBootstrap() {
  if (!hasProject.value) {
    return <main class="loading">読み込み中…</main>;
  }
  return <AppShell />;
}

function isUsableControl(el: HTMLElement | null): el is HTMLElement {
  if (!el) return false;
  if (el.closest("[inert]")) return false;
  if (el instanceof HTMLButtonElement && el.disabled) return false;
  if (el instanceof HTMLInputElement && el.disabled) return false;
  return true;
}

/** Capture → search. Mac Tab otherwise leaves the page. */
function chromeTabCycle(): HTMLElement[] {
  const capture = document.querySelector<HTMLElement>(
    '[data-testid="capture-input"]',
  );
  const search = document.querySelector<HTMLElement>(
    '.search input[type="search"]',
  );
  return [capture, search].filter(isUsableControl);
}

function moveChromeTab(event: KeyboardEvent): boolean {
  if (event.key !== "Tab") return false;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;

  if (target.closest(".skip-link") && !event.shiftKey) {
    const capture = document.querySelector<HTMLElement>(
      '[data-testid="capture-input"]',
    );
    if (isUsableControl(capture)) {
      event.preventDefault();
      capture.focus();
      return true;
    }
  }

  const items = chromeTabCycle();
  if (items.length < 2) return false;
  const index = items.findIndex((el) => el === target || el.contains(target));
  if (index < 0) return false;
  event.preventDefault();
  const next = event.shiftKey
    ? items[(index - 1 + items.length) % items.length]!
    : items[(index + 1) % items.length]!;
  next.focus();
  return true;
}

function App() {
  useAppTitle();
  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (moveChromeTab(event)) return;
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
    globalThis.addEventListener("keydown", onKeyDown, true);
    return () => globalThis.removeEventListener("keydown", onKeyDown, true);
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
    spawnThoughtFromLink,
    updateLink,
    setAppMode,
    setPanelPhase,
    pasteExploreImage,
    commitExploreImageDraft,
    patchExploreImageDraft,
    startDigging,
    stopDigging,
    clearCardFoundVia,
    selectCardFromStream,
    selectCardFromBoard,
    selectSingleCard,
  };
  document.documentElement.dataset.test = "true";
} else if ("serviceWorker" in navigator) {
  const localDev = location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";
  if (localDev) {
    // Local verify: an old shell worker makes every reload look stale.
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        void registration.unregister();
      }
    });
  } else {
    void navigator.serviceWorker.register(new URL("./sw.js", location.href), {
      scope: "./",
    });
  }
}

render(<App />, document.getElementById("app")!);
