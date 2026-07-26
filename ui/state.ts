import { computed, signal } from "@preact/signals";
import { store } from "./db.ts";
import {
  appendEvent,
  applyConnectCards,
  applyPlaceCardOnBoard,
  applyRemoveCard,
  applyRemoveLink,
  applySetBoardViewport,
  applyUpdateLink,
  createDemoProject,
  createEmptyProject,
  type FocusOrigin,
  parseProjectJson,
  replaySteps,
  viewThrough,
  withBirthEvents,
} from "./project.ts";
import { normalizeTag } from "./tags.ts";
import type { AppMode, Board, Card, Link, Project } from "./types.ts";

export type { FocusOrigin } from "./project.ts";
export { createDemoProject, createEmptyProject } from "./project.ts";
export { replaySteps } from "./project.ts";

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
/** Session-only: stream asked the board to pan this card into view (T031 rework). */
export const revealCardId = signal<string | null>(null);
/** Session-only focus view (T018 card / T033 tag). Not persisted. */
export const focusOrigin = signal<FocusOrigin | null>(null);
export const focusHops = signal(1);
/** Session-only growth replay index (T025). Not persisted. null = live. */
export const replayIndex = signal<number | null>(null);
export const saveStatus = signal<"loading" | "saved" | "saving" | "error">(
  "loading",
);

export const isReplaying = computed(() => replayIndex.value != null);

export const replayStepList = computed(() => {
  const current = project.value;
  return current ? replaySteps(current) : [];
});

export const replayThrough = computed(() => {
  const index = replayIndex.value;
  if (index == null) return null;
  return replayStepList.value[index]?.through ?? null;
});

export function enterReplay(): void {
  const current = project.value;
  if (!current) return;
  const birthed = withBirthEvents(current);
  if (birthed.events !== current.events) {
    // Persist synthetic births once so this session's later edits can rewind.
    project.value = birthed;
    void persist(birthed);
  }
  clearFocusView();
  const steps = replaySteps(birthed);
  if (steps.length === 0) return;
  replayIndex.value = 0;
}

export function setReplayIndex(index: number): void {
  const steps = replayStepList.value;
  if (steps.length === 0) {
    replayIndex.value = null;
    return;
  }
  replayIndex.value = Math.min(Math.max(0, index), steps.length - 1);
}

export function stepReplay(delta: number): void {
  if (replayIndex.value == null) return;
  setReplayIndex(replayIndex.value + delta);
}

export function clearReplay(): void {
  replayIndex.value = null;
}

export function setFocusView(cardId: string): void {
  focusOrigin.value = { kind: "card", cardId };
  focusHops.value = 1;
}

export function setFocusViewByTag(tag: string): void {
  const name = normalizeTag(tag);
  if (!name) return;
  focusOrigin.value = { kind: "tag", tag: name };
  focusHops.value = 1;
  search.value = name;
}

export function expandFocusHops(): void {
  if (!focusOrigin.value) return;
  focusHops.value += 1;
}

export function shrinkFocusHops(): void {
  if (!focusOrigin.value || focusHops.value <= 1) return;
  focusHops.value -= 1;
}

export function clearFocusView(): void {
  const origin = focusOrigin.value;
  focusOrigin.value = null;
  focusHops.value = 1;
  if (origin?.kind === "tag" && normalizeTag(search.value) === origin.tag) {
    search.value = "";
  }
}

function clearTagFocusIfEmpty(cards: readonly Card[]): void {
  const origin = focusOrigin.value;
  if (origin?.kind !== "tag") return;
  const still = cards.some((card) =>
    (card.tags ?? []).some((value) => normalizeTag(value) === origin.tag)
  );
  if (!still) clearFocusView();
}

export const appMode = computed<AppMode>(() =>
  project.value?.ui?.mode ?? "explore"
);
export const sideOpen = computed(() => project.value?.ui?.sideOpen ?? false);

/** Live project, or a display-only slice when replaying. */
export const viewProject = computed<Project | null>(() => {
  const current = project.value;
  if (!current) return null;
  const through = replayThrough.value;
  if (through == null) return current;
  const slice = viewThrough(current, through);
  const board = current.boards[0];
  if (!board) return current;
  return {
    ...current,
    cards: slice.cards,
    links: slice.links,
    boards: [{
      ...board,
      cardIds: slice.cardIds,
      positions: slice.positions,
    }, ...current.boards.slice(1)],
  };
});

export const filteredCards = computed(() => {
  const current = viewProject.value;
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
  const current = viewProject.value;
  const id = selectedCardId.value;
  if (!current || !id) return null;
  return current.cards.find((card) => card.id === id) ?? null;
});

export const selectedLink = computed(() => {
  const current = viewProject.value;
  const id = selectedLinkId.value;
  if (!current || !id) return null;
  return current.links.find((link) => link.id === id) ?? null;
});

async function refreshSummaries(): Promise<void> {
  projectSummaries.value = await store.listProjects();
}

/** Serialize IndexedDB writes and always persist the latest in-memory project. */
let saveChain: Promise<void> = Promise.resolve();
let saveDirty = false;
let saveGeneration = 0;

async function drainSaves(): Promise<void> {
  while (saveDirty) {
    saveDirty = false;
    const latest = project.value;
    if (!latest) continue;
    await store.saveProject(latest);
    await refreshSummaries();
  }
}

async function persist(next: Project): Promise<void> {
  project.value = next;
  saveDirty = true;
  const myGeneration = ++saveGeneration;
  saveStatus.value = "saving";

  const task = saveChain.then(drainSaves);
  saveChain = task.catch((error) => {
    console.error(error);
  });

  try {
    await task;
    if (myGeneration === saveGeneration) saveStatus.value = "saved";
  } catch (error) {
    console.error(error);
    if (myGeneration === saveGeneration) saveStatus.value = "error";
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

async function activateProject(next: Project): Promise<void> {
  writeActiveProjectId(next.id);
  selectedCardId.value = null;
  selectedLinkId.value = null;
  revealCardId.value = null;
  clearFocusView();
  clearReplay();
  search.value = "";
  // Snapshot missing births before open so later edits can rewind text/labels.
  const birthed = withBirthEvents(next);
  const opened = appendEvent(birthed, {
    type: "project_opened",
    at: Date.now(),
  });
  project.value = opened;
  saveStatus.value = "saving";
  await store.saveProject(opened);
  saveStatus.value = "saved";
}

/** Select from the discovery stream; pan the board if the card is placed. */
export function selectCardFromStream(cardId: string): void {
  selectedCardId.value = cardId;
  selectedLinkId.value = null;
  const board = project.value?.boards[0];
  if (board?.cardIds.includes(cardId) && board.positions[cardId]) {
    revealCardId.value = cardId;
  } else {
    revealCardId.value = null;
  }
}

function assertWritable(): Project | null {
  if (replayIndex.value != null) return null;
  return project.value;
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
  await activateProject(initial);
  projectSummaries.value = await store.listProjects();
}

export async function createProject(
  name = "新しいケース",
): Promise<Project> {
  const next = createEmptyProject(name);
  await store.saveProject(next);
  await activateProject(next);
  await refreshSummaries();
  return project.value ?? next;
}

export async function switchProject(id: string): Promise<void> {
  if (project.value?.id === id) return;
  const loaded = await store.loadProject(id);
  if (!loaded) return;
  await activateProject(loaded);
}

export async function addCard(
  title: string,
  options?: {
    role?: "finding" | "thought";
    placeAt?: { x: number; y: number };
    body?: string;
    url?: string;
  },
): Promise<void> {
  const cleanTitle = title.trim();
  if (!cleanTitle) return;
  const body = options?.body?.trim() ? options.body.trim() : undefined;
  const url = options?.url?.trim() ? options.url.trim() : undefined;

  // Read + write memory must stay synchronous so overlapping captures
  // cannot both snapshot the same Project and drop a later card.
  const current = assertWritable();
  if (!current) return;

  const card: Card = {
    id: crypto.randomUUID(),
    title: cleanTitle,
    foundAt: Date.now(),
    ...(options?.role === "thought" ? { role: "thought" as const } : {}),
    ...(body ? { body } : {}),
    ...(url ? { url } : {}),
  };
  let next = appendEvent(
    { ...current, cards: [...current.cards, card] },
    { type: "card_added", at: card.foundAt, card },
  );
  if (options?.placeAt) {
    next = applyPlaceCardOnBoard(
      next,
      card.id,
      options.placeAt.x,
      options.placeAt.y,
    ) ?? next;
    next = appendEvent(next, {
      type: "card_placed",
      at: Date.now(),
      cardId: card.id,
      x: options.placeAt.x,
      y: options.placeAt.y,
    });
    selectedCardId.value = card.id;
    selectedLinkId.value = null;
  }
  // persist() writes project.value synchronously before any await.
  const saving = persist(next);

  if (!persistenceRequested) {
    persistenceRequested = true;
    // Must not block on-memory reflection or later captures.
    void store.requestPersistence().catch(() => false);
  }

  await saving;
}

export async function setAppMode(mode: AppMode): Promise<void> {
  const current = project.value;
  if (!current || (current.ui?.mode ?? "explore") === mode) return;
  if (mode === "explore") clearReplay();
  await persist(withUi(current, { mode }));
}

export async function setSideOpen(open: boolean): Promise<void> {
  const current = project.value;
  if (!current || (current.ui?.sideOpen ?? false) === open) return;
  await persist(withUi(current, { sideOpen: open }));
}

export async function updateCard(
  id: string,
  patch: Pick<Card, "title" | "body" | "url">,
): Promise<void> {
  const current = assertWritable();
  if (!current) return;
  const title = patch.title.trim();
  if (!title) return;
  const body = patch.body?.trim() ? patch.body.trim() : undefined;
  const url = patch.url?.trim() ? patch.url.trim() : undefined;
  const next = {
    ...current,
    cards: current.cards.map((card) =>
      card.id === id ? { ...card, title, body, url } : card
    ),
  };
  await persist(appendEvent(next, {
    type: "card_updated",
    at: Date.now(),
    cardId: id,
    title,
    body,
    url,
  }));
}

/** Replace a card's free tags (T031). Empty list clears tags. */
export async function updateCardTags(
  id: string,
  tags: string[],
): Promise<void> {
  const current = assertWritable();
  if (!current) return;
  const card = current.cards.find((item) => item.id === id);
  if (!card) return;
  const nextTags = tags.length ? [...tags] : undefined;
  const next = {
    ...current,
    cards: current.cards.map((item) => {
      if (item.id !== id) return item;
      if (nextTags) return { ...item, tags: nextTags };
      const { tags: _drop, ...rest } = item;
      return rest;
    }),
  };
  clearTagFocusIfEmpty(next.cards);
  await persist(appendEvent(next, {
    type: "card_updated",
    at: Date.now(),
    cardId: id,
    title: card.title,
    body: card.body,
    url: card.url,
    tags: nextTags ?? [],
  }));
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

export async function importProjectFromText(text: string): Promise<Project> {
  const parsed = parseProjectJson(text);
  const next: Project = {
    ...parsed,
    id: crypto.randomUUID(),
    name: `${parsed.name}（取り込み）`,
  };
  await store.saveProject(next);
  await activateProject(next);
  await refreshSummaries();
  return project.value ?? next;
}

export function pickAndImportProject(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = () => {
    void input.files?.[0]?.text().then(importProjectFromText).catch((e) =>
      alert(e instanceof Error ? e.message : "読み込めませんでした")
    );
  };
  input.click();
}

export async function flushSave(): Promise<void> {
  await saveChain;
  if (project.value) await store.saveProject(project.value);
}

export async function placeCardOnBoard(
  cardId: string,
  x: number,
  y: number,
): Promise<void> {
  const current = assertWritable();
  if (!current) return;
  const next = applyPlaceCardOnBoard(current, cardId, x, y);
  if (!next) return;
  selectedCardId.value = cardId;
  selectedLinkId.value = null;
  await persist(appendEvent(next, {
    type: "card_placed",
    at: Date.now(),
    cardId,
    x,
    y,
  }));
}

/** Persist a finished board drag (final position only). */
export async function commitCardPlacement(cardId: string): Promise<void> {
  const current = assertWritable();
  if (!current) return;
  const pos = current.boards[0]?.positions[cardId];
  if (!pos) {
    await flushSave();
    return;
  }
  await persist(appendEvent(current, {
    type: "card_placed",
    at: Date.now(),
    cardId,
    x: pos.x,
    y: pos.y,
  }));
}

export async function connectCards(
  fromId: string,
  toId: string,
  kind: Link["kind"] = "connects",
): Promise<void> {
  const current = assertWritable();
  if (!current) return;
  const next = applyConnectCards(current, fromId, toId, kind);
  if (!next) return;
  const link = next.links.find((item) =>
    !current.links.some((known) => known.id === item.id)
  );
  // Keep the board quiet after drawing — edit later via link click + inspector.
  selectedLinkId.value = null;
  selectedCardId.value = null;
  if (!link) {
    await persist(next);
    return;
  }
  await persist(
    appendEvent(next, { type: "link_added", at: Date.now(), link }),
  );
}

export async function updateLink(
  linkId: string,
  patch: Partial<Pick<Link, "label" | "kind">>,
): Promise<void> {
  const current = assertWritable();
  if (!current) return;
  const next = applyUpdateLink(current, linkId, patch);
  if (!next) return;
  const link = next.links.find((item) => item.id === linkId);
  if (!link) {
    await persist(next);
    return;
  }
  await persist(appendEvent(next, {
    type: "link_updated",
    at: Date.now(),
    linkId,
    label: link.label,
    kind: link.kind,
  }));
}

export async function removeLink(linkId: string): Promise<void> {
  const current = assertWritable();
  if (!current) return;
  const link = current.links.find((item) => item.id === linkId);
  const next = applyRemoveLink(current, linkId);
  if (!next || !link) return;
  if (selectedLinkId.value === linkId) selectedLinkId.value = null;
  await persist(appendEvent(next, {
    type: "link_removed",
    at: Date.now(),
    link,
  }));
}

export async function removeCard(cardId: string): Promise<void> {
  const current = assertWritable();
  if (!current) return;
  const card = current.cards.find((item) => item.id === cardId);
  if (!card) return;
  const links = current.links.filter((l) =>
    l.from === cardId || l.to === cardId
  );
  const position = current.boards[0]?.positions[cardId];
  const next = applyRemoveCard(current, cardId);
  if (!next) return;
  if (selectedCardId.value === cardId) selectedCardId.value = null;
  if (revealCardId.value === cardId) revealCardId.value = null;
  const origin = focusOrigin.value;
  if (origin?.kind === "card" && origin.cardId === cardId) clearFocusView();
  clearTagFocusIfEmpty(next.cards);
  if (!next.links.some((link) => link.id === selectedLinkId.value)) {
    selectedLinkId.value = null;
  }
  await persist(appendEvent(next, {
    type: "card_removed",
    at: Date.now(),
    card,
    links,
    ...(position ? { position } : {}),
  }));
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
  const current = assertWritable();
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
