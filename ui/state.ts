import { computed, signal } from "@preact/signals";
import { store } from "./db.ts";
import {
  applyConnectCards,
  applyPlaceCardOnBoard,
  applyRemoveLink,
  applySetBoardViewport,
  applyUpdateLink,
  createDemoProject,
  createEmptyProject,
} from "./project.ts";
import type { AppMode, Board, Card, Link, Project } from "./types.ts";

export { createDemoProject, createEmptyProject } from "./project.ts";

const ACTIVE_PROJECT_KEY = "argboard.activeProjectId";
let persistenceRequested = false;

export type ProjectSummary = {
  id: string;
  name: string;
  cardCount: number;
  updatedAt: number;
};

function readActiveProjectId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

function writeActiveProjectId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  } catch {
    // Quota or privacy mode: active id is best-effort only.
  }
}

function pickProjectId(summaries: ProjectSummary[]): string {
  const preferred = readActiveProjectId();
  if (preferred && summaries.some((item) => item.id === preferred)) {
    return preferred;
  }
  return summaries.toSorted((left, right) =>
    right.updatedAt - left.updatedAt
  )[0]
    .id;
}

export const project = signal<Project | null>(null);
export const projectSummaries = signal<ProjectSummary[]>([]);
export const search = signal("");
export const selectedCardId = signal<string | null>(null);
export const selectedLinkId = signal<string | null>(null);
export const saveStatus = signal<"loading" | "saved" | "saving" | "error">(
  "loading",
);

export const appMode = computed<AppMode>(() =>
  project.value?.ui?.mode ?? "explore"
);
export const sideOpen = computed(() => project.value?.ui?.sideOpen ?? false);

export const filteredCards = computed(() => {
  const current = project.value;
  if (!current) return [];
  const query = search.value.trim().toLocaleLowerCase("ja");
  return current.cards.filter((card) => {
    if (!query) return true;
    return [card.title, card.body, card.url, ...(card.tags ?? [])]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase("ja").includes(query));
  }).toSorted((left, right) => right.foundAt - left.foundAt);
});

export const selectedCard = computed(() => {
  const current = project.value;
  const id = selectedCardId.value;
  if (!current || !id) return null;
  return current.cards.find((card) => card.id === id) ?? null;
});

export const selectedLink = computed(() => {
  const current = project.value;
  const id = selectedLinkId.value;
  if (!current || !id) return null;
  return current.links.find((link) => link.id === id) ?? null;
});

async function refreshSummaries(): Promise<void> {
  projectSummaries.value = await store.listProjects();
}

async function persist(next: Project): Promise<void> {
  project.value = next;
  saveStatus.value = "saving";
  try {
    await store.saveProject(next);
    await refreshSummaries();
    saveStatus.value = "saved";
  } catch (error) {
    console.error(error);
    saveStatus.value = "error";
  }
}

function withUi(
  current: Project,
  patch: Partial<NonNullable<Project["ui"]>>,
): Project {
  return {
    ...current,
    ui: {
      mode: current.ui?.mode ?? "explore",
      sideOpen: current.ui?.sideOpen ?? false,
      ...patch,
    },
  };
}

function activateProject(next: Project): void {
  writeActiveProjectId(next.id);
  selectedCardId.value = null;
  selectedLinkId.value = null;
  search.value = "";
  project.value = next;
  saveStatus.value = "saved";
}

/** Update in-memory project without writing to IndexedDB (drag/pan frames). */
export function patchProjectLocal(next: Project): void {
  project.value = next;
}

export async function initialize(): Promise<void> {
  let summaries = await store.listProjects();
  if (summaries.length === 0) {
    const seeded = createDemoProject();
    await store.saveProject(seeded);
    writeActiveProjectId(seeded.id);
    summaries = await store.listProjects();
  }

  const id = pickProjectId(summaries);
  let initial = await store.loadProject(id);
  if (!initial) {
    initial = createEmptyProject("新しいケース");
    await store.saveProject(initial);
  }
  activateProject(initial);
  projectSummaries.value = await store.listProjects();
}

export async function createProject(
  name = "新しいケース",
): Promise<Project> {
  const next = createEmptyProject(name);
  await store.saveProject(next);
  activateProject(next);
  await refreshSummaries();
  return next;
}

export async function switchProject(id: string): Promise<void> {
  if (project.value?.id === id) return;
  const loaded = await store.loadProject(id);
  if (!loaded) return;
  activateProject(loaded);
}

export async function addCard(title: string): Promise<void> {
  const current = project.value;
  const cleanTitle = title.trim();
  if (!current || !cleanTitle) return;

  const card: Card = {
    id: crypto.randomUUID(),
    title: cleanTitle,
    foundAt: Date.now(),
  };
  if (!persistenceRequested) {
    persistenceRequested = true;
    await store.requestPersistence().catch(() => false);
  }
  await persist({ ...current, cards: [...current.cards, card] });
}

export async function setAppMode(mode: AppMode): Promise<void> {
  const current = project.value;
  if (!current || (current.ui?.mode ?? "explore") === mode) return;
  await persist(withUi(current, { mode }));
}

export async function setSideOpen(open: boolean): Promise<void> {
  const current = project.value;
  if (!current || (current.ui?.sideOpen ?? false) === open) return;
  await persist(withUi(current, { sideOpen: open }));
}

export async function updateCard(
  id: string,
  patch: Pick<Card, "title" | "body">,
): Promise<void> {
  const current = project.value;
  if (!current) return;
  const title = patch.title.trim();
  if (!title) return;
  const body = patch.body?.trim() ? patch.body.trim() : undefined;
  await persist({
    ...current,
    cards: current.cards.map((card) =>
      card.id === id ? { ...card, title, body } : card
    ),
  });
}

export function exportProject(): void {
  const current = project.value;
  if (!current) return;
  const blob = new Blob([JSON.stringify(current, null, 2)], {
    type: "application/json",
  });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `${current.name.replaceAll(/[\\/:*?\"<>|]/g, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

export async function flushSave(): Promise<void> {
  if (project.value) await store.saveProject(project.value);
}

export async function placeCardOnBoard(
  cardId: string,
  x: number,
  y: number,
): Promise<void> {
  const current = project.value;
  if (!current) return;
  const next = applyPlaceCardOnBoard(current, cardId, x, y);
  if (!next) return;
  selectedCardId.value = cardId;
  selectedLinkId.value = null;
  await persist(next);
}

export async function connectCards(
  fromId: string,
  toId: string,
  kind: Link["kind"] = "connects",
): Promise<void> {
  const current = project.value;
  if (!current) return;
  const next = applyConnectCards(current, fromId, toId, kind);
  if (!next) return;
  // Keep the board quiet after drawing — edit later via link click + inspector.
  selectedLinkId.value = null;
  selectedCardId.value = null;
  await persist(next);
}

export async function updateLink(
  linkId: string,
  patch: Partial<Pick<Link, "label" | "kind">>,
): Promise<void> {
  const current = project.value;
  if (!current) return;
  const next = applyUpdateLink(current, linkId, patch);
  if (!next) return;
  await persist(next);
}

export async function removeLink(linkId: string): Promise<void> {
  const current = project.value;
  if (!current) return;
  const next = applyRemoveLink(current, linkId);
  if (!next) return;
  if (selectedLinkId.value === linkId) selectedLinkId.value = null;
  await persist(next);
}

export async function setBoardViewport(
  viewport: NonNullable<Board["viewport"]>,
): Promise<void> {
  const current = project.value;
  if (!current) return;
  await persist(applySetBoardViewport(current, viewport));
}

export function moveCardOnBoardLocal(
  cardId: string,
  x: number,
  y: number,
): void {
  const current = project.value;
  if (!current) return;
  const next = applyPlaceCardOnBoard(current, cardId, x, y);
  if (next) patchProjectLocal(next);
}

export function setBoardViewportLocal(
  viewport: NonNullable<Board["viewport"]>,
): void {
  const current = project.value;
  if (!current) return;
  patchProjectLocal(applySetBoardViewport(current, viewport));
}
