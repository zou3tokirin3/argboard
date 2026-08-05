import { computed, signal } from "@preact/signals";
import { store } from "./db.ts";
import { compressImage } from "./image-compress.ts";
import {
  buildZip,
  clearAllMediaObjectUrls,
  collectMediaIds,
  forgetMediaObjectUrl,
  isLocalMediaRef,
  mediaExtFromType,
  mediaFromZip,
  parseZip,
  peekMediaObjectUrl,
  projectJsonFromZip,
  rememberMediaObjectUrl,
} from "./media.ts";
import {
  appendEvent,
  applyConnectCards,
  applyMoveCardsOnBoard,
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
  sortCardsByFoundViaTree,
  viewThrough,
  withBirthEvents,
} from "./project.ts";
import { attachTag, detachTag, normalizeTag, replaceTag } from "./tags.ts";
import type { CardSize } from "./node-size.ts";
import { normalizeCardSize } from "./node-size.ts";
import type { ParsedCapture } from "./capture-notation.ts";
import type { AppMode, Board, Card, Link, Project } from "./types.ts";

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
export const hasProject = computed(() => project.value != null);
export const projectName = computed(() => project.value?.name ?? "");
export const activeProjectId = computed(() => project.value?.id ?? "");
export const search = signal("");
/** Session-only: show unplaced stream cards only (T040). Not persisted. */
export const unplacedOnly = signal(false);
/** Session-only: show placed stream cards only (T047). Not persisted. */
export const placedOnly = signal(false);
/** Session-only: nest stream by foundVia with collapse (T051). Default flat. */
export const streamTreeView = signal(false);
/** Session-only: collapsed parent card ids in tree view (T051). Not persisted. */
export const collapsedStreamBranches = signal<ReadonlySet<string>>(new Set());
/** Session-only: card id whose captures get foundVia (T050). Not persisted. */
export const diggingCardId = signal<string | null>(null);
export const selectedCardId = signal<string | null>(null);
/** Session-only multi-select (T032). Primary is selectedCardId (last id). */
export const selectedCardIds = signal<string[]>([]);
export const selectedLinkId = signal<string | null>(null);

/** Replace card selection; primary = last id. Clears link selection. */
export function setSelectedCards(ids: readonly string[]): void {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  selectedCardIds.value = unique;
  selectedCardId.value = unique[unique.length - 1] ?? null;
  selectedLinkId.value = null;
}

export function clearCardSelection(): void {
  selectedCardIds.value = [];
  selectedCardId.value = null;
}

/** Explore compose (T045): editing an image card at top capture — separate from stream selection. */
export const exploreComposeCardId = signal<string | null>(null);

export const exploreComposeCard = computed(() => {
  const id = exploreComposeCardId.value;
  if (!id) return null;
  return project.value?.cards.find((item) => item.id === id) ?? null;
});

export function stopDigging(): void {
  diggingCardId.value = null;
}

export function toggleStreamTreeView(): void {
  streamTreeView.value = !streamTreeView.value;
}

export function toggleStreamBranchCollapsed(cardId: string): void {
  const next = new Set(collapsedStreamBranches.value);
  if (next.has(cardId)) next.delete(cardId);
  else next.add(cardId);
  collapsedStreamBranches.value = next;
}

function expandStreamBranches(cardIds: readonly string[]): void {
  if (cardIds.length === 0) return;
  const next = new Set(collapsedStreamBranches.value);
  let changed = false;
  for (const id of cardIds) {
    if (next.delete(id)) changed = true;
  }
  if (changed) collapsedStreamBranches.value = next;
}

/** Open ancestor branches so a newly captured child stays visible (T051). */
function expandFoundViaAncestors(parentId: string | undefined): void {
  if (!parentId || !streamTreeView.value) return;
  const cards = project.value?.cards ?? [];
  const byId = new Map(cards.map((item) => [item.id, item]));
  const toExpand: string[] = [];
  let id: string | undefined = parentId;
  const seen = new Set<string>();
  while (id && byId.has(id) && !seen.has(id)) {
    seen.add(id);
    toExpand.push(id);
    id = byId.get(id)?.foundVia;
  }
  expandStreamBranches(toExpand);
}

/** Start or switch digging source (T050). Session-only. */
export function startDigging(cardId: string): void {
  if (!project.value?.cards.some((item) => item.id === cardId)) return;
  diggingCardId.value = cardId;
}

function resolveDiggingFoundVia(): string | undefined {
  const id = diggingCardId.value;
  if (!id) return undefined;
  if (!project.value?.cards.some((item) => item.id === id)) return undefined;
  return id;
}

export async function clearCardFoundVia(cardId: string): Promise<void> {
  const current = assertWritable();
  if (!current) return;
  const card = current.cards.find((item) => item.id === cardId);
  if (!card?.foundVia) return;
  const next = {
    ...current,
    cards: current.cards.map((item) => {
      if (item.id !== cardId) return item;
      const { foundVia: _removed, ...rest } = item;
      return rest;
    }),
  };
  await persist(appendEvent(next, {
    type: "found_via_cleared",
    at: Date.now(),
    cardId,
  }));
}

export function openExploreCompose(cardId: string): void {
  clearExploreImageDraft();
  exploreComposeCardId.value = cardId;
}

export function closeExploreCompose(): void {
  exploreComposeCardId.value = null;
}

/** Staged screenshot at top capture — not a card until committed (T045). */
export type ExploreImageDraft = {
  blob: Blob;
  previewUrl: string;
  title: string;
  body: string;
  url: string;
};

export const exploreImageDraft = signal<ExploreImageDraft | null>(null);

export function clearExploreImageDraft(): void {
  const draft = exploreImageDraft.value;
  if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl);
  exploreImageDraft.value = null;
}

export function patchExploreImageDraft(
  patch: Partial<Pick<ExploreImageDraft, "title" | "body" | "url">>,
): void {
  const draft = exploreImageDraft.value;
  if (!draft) return;
  exploreImageDraft.value = { ...draft, ...patch };
}

export function selectSingleCard(id: string): void {
  setSelectedCards([id]);
}

/** Toggle membership when a multi-selection already exists. */
export function toggleCardInSelection(id: string): void {
  const cur = selectedCardIds.value;
  if (cur.includes(id)) setSelectedCards(cur.filter((item) => item !== id));
  else setSelectedCards([...cur, id]);
}
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
  const boardCardIds = new Set(current.boards[0]?.cardIds ?? []);
  const filtered = current.cards.filter((card) => {
    if (unplacedOnly.value && boardCardIds.has(card.id)) return false;
    if (placedOnly.value && !boardCardIds.has(card.id)) return false;
    if (!query) return true;
    return [card.title, card.body, card.url, ...(card.tags ?? [])]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase("ja").includes(query));
  });
  if (streamTreeView.value) return filtered;
  return sortCardsByFoundViaTree(filtered);
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

/** Refresh project list for the menu (not on every card edit). */
export async function refreshProjectSummaries(): Promise<void> {
  await refreshSummaries();
}

/** Serialize IndexedDB writes and always persist the latest in-memory project. */
let saveChain: Promise<void> = Promise.resolve();
let saveDirty = false;
let saveGeneration = 0;
const SAVE_INDICATOR_DELAY_MS = 450;
let saveIndicatorTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleSavingIndicator(): void {
  if (saveIndicatorTimer != null) clearTimeout(saveIndicatorTimer);
  saveIndicatorTimer = setTimeout(() => {
    saveIndicatorTimer = undefined;
    saveStatus.value = "saving";
  }, SAVE_INDICATOR_DELAY_MS);
}

function clearSavingIndicator(): void {
  if (saveIndicatorTimer != null) {
    clearTimeout(saveIndicatorTimer);
    saveIndicatorTimer = undefined;
  }
}

async function drainSaves(): Promise<void> {
  while (saveDirty) {
    saveDirty = false;
    const latest = project.value;
    if (!latest) continue;
    await store.saveProject(latest);
  }
}

async function persist(next: Project): Promise<void> {
  project.value = next;
  saveDirty = true;
  const myGeneration = ++saveGeneration;
  scheduleSavingIndicator();

  const task = saveChain.then(drainSaves);
  saveChain = task.catch((error) => {
    console.error(error);
  });

  try {
    await task;
    clearSavingIndicator();
    if (myGeneration === saveGeneration && saveStatus.value !== "saved") {
      saveStatus.value = "saved";
    }
  } catch (error) {
    console.error(error);
    clearSavingIndicator();
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
  clearCardSelection();
  selectedLinkId.value = null;
  revealCardId.value = null;
  clearFocusView();
  clearReplay();
  search.value = "";
  unplacedOnly.value = false;
  placedOnly.value = false;
  stopDigging();
  clearAllMediaObjectUrls();
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
  if (
    selectedCardId.value === cardId &&
    selectedCardIds.value.length === 1
  ) {
    clearCardSelection();
    closeExploreCompose();
    revealCardId.value = null;
    return;
  }
  if (
    exploreComposeCardId.value && exploreComposeCardId.value !== cardId
  ) {
    closeExploreCompose();
  }
  selectSingleCard(cardId);
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

export async function renameProject(name: string): Promise<void> {
  const current = project.value;
  if (!current) return;
  const nextName = name.trim();
  if (!nextName || nextName === current.name) return;
  await persist({ ...current, name: nextName });
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
): Promise<string | null> {
  const cleanTitle = title.trim();
  if (!cleanTitle) return null;
  const body = options?.body?.trim() ? options.body.trim() : undefined;
  const url = options?.url?.trim() ? options.url.trim() : undefined;

  // Read + write memory must stay synchronous so overlapping captures
  // cannot both snapshot the same Project and drop a later card.
  const current = assertWritable();
  if (!current) return null;

  const foundVia = resolveDiggingFoundVia();
  const card: Card = {
    id: crypto.randomUUID(),
    title: cleanTitle,
    foundAt: Date.now(),
    ...(options?.role === "thought" ? { role: "thought" as const } : {}),
    ...(body ? { body } : {}),
    ...(url ? { url } : {}),
    ...(foundVia ? { foundVia } : {}),
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
    selectSingleCard(card.id);
  }
  // persist() writes project.value synchronously before any await.
  const saving = persist(next);
  expandFoundViaAncestors(foundVia);

  if (!persistenceRequested) {
    persistenceRequested = true;
    // Must not block on-memory reflection or later captures.
    void store.requestPersistence().catch(() => false);
  }

  await saving;
  return card.id;
}

/** Persist a card whose image blob is already compressed. */
async function createCardWithCompressedImage(
  compressed: Blob,
  draft?: ParsedCapture,
): Promise<string | null> {
  const current = assertWritable();
  if (!current) return null;
  const mediaId = crypto.randomUUID();
  const cardId = crypto.randomUUID();
  await store.putMedia({
    id: mediaId,
    projectId: current.id,
    blob: compressed,
  });
  const title = draft?.title.trim() || "（無題）";
  const body = draft?.body?.trim() ? draft.body.trim() : undefined;
  const url = draft?.url?.trim() ? draft.url.trim() : undefined;
  const foundVia = resolveDiggingFoundVia();
  const card: Card = {
    id: cardId,
    title,
    foundAt: Date.now(),
    image: mediaId,
    ...(body ? { body } : {}),
    ...(url ? { url } : {}),
    ...(foundVia ? { foundVia } : {}),
  };
  let next = appendEvent(
    { ...current, cards: [...current.cards, card] },
    { type: "card_added", at: card.foundAt, card },
  );
  next = appendEvent(next, {
    type: "card_updated",
    at: Date.now(),
    cardId,
    title: card.title,
    body: card.body,
    url: card.url,
    image: mediaId,
  });
  const saving = persist(next);
  expandFoundViaAncestors(foundVia);
  if (!persistenceRequested) {
    persistenceRequested = true;
    void store.requestPersistence().catch(() => false);
  }
  await saving;
  selectSingleCard(cardId);
  return cardId;
}

/** Create a finding card with a screenshot (file import etc.). */
export async function addCardWithImage(
  source: Blob,
  draft?: ParsedCapture,
): Promise<string | null> {
  if (!source.type.startsWith("image/")) {
    throw new Error("画像ファイルを選んでください");
  }
  const compressed = await compressImage(source);
  return createCardWithCompressedImage(compressed, draft);
}

/** Stage a screenshot at the top capture — user commits title/body later. */
export async function stageExploreImage(
  source: Blob,
  parsed?: ParsedCapture,
): Promise<void> {
  if (!source.type.startsWith("image/")) {
    throw new Error("画像ファイルを選んでください");
  }
  closeExploreCompose();
  const compressed = await compressImage(source);
  clearExploreImageDraft();
  exploreImageDraft.value = {
    blob: compressed,
    previewUrl: URL.createObjectURL(compressed),
    title: parsed?.title ?? "",
    body: parsed?.body ?? "",
    url: parsed?.url ?? "",
  };
}

/** Turn the staged screenshot into a card. */
export async function commitExploreImageDraft(): Promise<string | null> {
  const draft = exploreImageDraft.value;
  if (!draft) return null;
  const parsed: ParsedCapture = {
    title: draft.title.trim() || "（無題）",
    ...(draft.body.trim() ? { body: draft.body.trim() } : {}),
    ...(draft.url.trim() ? { url: draft.url.trim() } : {}),
  };
  const blob = draft.blob;
  clearExploreImageDraft();
  return await createCardWithCompressedImage(blob, parsed);
}

/**
 * Explore-mode image paste from the top capture area.
 * Compose open → replace that card's image; otherwise stage for commit.
 */
export async function pasteExploreImage(
  source: Blob,
  draft?: ParsedCapture,
): Promise<string | null> {
  const current = assertWritable();
  if (!current) return null;
  const composeId = exploreComposeCardId.value;
  if (composeId && current.cards.some((item) => item.id === composeId)) {
    await setCardImage(composeId, source);
    return composeId;
  }
  await stageExploreImage(source, draft);
  return null;
}

export async function setAppMode(mode: AppMode): Promise<void> {
  const current = project.value;
  if (!current || (current.ui?.mode ?? "explore") === mode) return;
  if (mode === "explore") clearReplay();
  else {
    closeExploreCompose();
    clearExploreImageDraft();
  }
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

function cardRoleLabel(role: Card["role"]): "finding" | "thought" {
  return role === "thought" ? "thought" : "finding";
}

/** Switch a card between finding and thought (T044). `"finding"` clears role. */
export async function updateCardRole(
  id: string,
  role: "finding" | "thought",
): Promise<void> {
  const current = assertWritable();
  if (!current) return;
  const card = current.cards.find((item) => item.id === id);
  if (!card) return;
  const nextRole = cardRoleLabel(role === "thought" ? "thought" : undefined);
  const prevRole = cardRoleLabel(card.role);
  if (nextRole === prevRole) return;
  const next = {
    ...current,
    cards: current.cards.map((item) => {
      if (item.id !== id) return item;
      if (nextRole === "thought") return { ...item, role: "thought" as const };
      const { role: _drop, ...rest } = item;
      return rest;
    }),
  };
  await persist(appendEvent(next, {
    type: "card_updated",
    at: Date.now(),
    cardId: id,
    title: card.title,
    body: card.body,
    url: card.url,
    role: nextRole === "thought" ? "thought" : "",
  }));
}

/** Set board display size for a card (T022). `"m"` clears to default. */
export async function updateCardSize(
  id: string,
  size: CardSize,
): Promise<void> {
  const current = assertWritable();
  if (!current) return;
  const card = current.cards.find((item) => item.id === id);
  if (!card) return;
  const nextSize = normalizeCardSize(size);
  const prev = normalizeCardSize(card.size);
  if (nextSize === prev) return;
  const next = {
    ...current,
    cards: current.cards.map((item) => {
      if (item.id !== id) return item;
      if (nextSize === "l") return { ...item, size: "l" as const };
      const { size: _drop, ...rest } = item;
      return rest;
    }),
  };
  await persist(appendEvent(next, {
    type: "card_updated",
    at: Date.now(),
    cardId: id,
    title: card.title,
    body: card.body,
    url: card.url,
    size: nextSize === "l" ? "l" : "",
  }));
}

/** Attach a tag to many cards in one persist (T032). Skips duplicates per card. */
export async function attachTagToCards(
  ids: readonly string[],
  name: string,
): Promise<void> {
  const current = assertWritable();
  if (!current || !normalizeTag(name) || ids.length === 0) return;
  const tag = normalizeTag(name);
  let next = current;
  let any = false;
  for (const id of ids) {
    const card = next.cards.find((item) => item.id === id);
    if (!card) continue;
    const tags = attachTag(card.tags, tag);
    if (tags.length === (card.tags?.length ?? 0)) continue;
    any = true;
    next = patchCardTags(next, card, tags);
  }
  if (any) {
    clearTagFocusIfEmpty(next.cards);
    await persist(next);
  }
}

/** Remove a tag from many cards in one persist (T048). Skips cards without the tag. */
export async function detachTagFromCards(
  ids: readonly string[],
  name: string,
): Promise<void> {
  const current = assertWritable();
  if (!current || !normalizeTag(name) || ids.length === 0) return;
  const tag = normalizeTag(name);
  let next = current;
  let any = false;
  for (const id of ids) {
    const card = next.cards.find((item) => item.id === id);
    if (!card) continue;
    if (!card.tags?.some((item) => normalizeTag(item) === tag)) continue;
    const tags = detachTag(card.tags, tag);
    any = true;
    next = patchCardTags(next, card, tags);
  }
  if (any) {
    clearTagFocusIfEmpty(next.cards);
    await persist(next);
  }
}

/** Rename or merge a tag across all cards (T032). Same op: replace `from` with `to`. */
export async function renameProjectTag(
  from: string,
  to: string,
): Promise<void> {
  await replaceProjectTag(from, to);
}

export async function mergeProjectTags(
  from: string,
  into: string,
): Promise<void> {
  await replaceProjectTag(from, into);
}

function patchCardTags(
  project: Project,
  card: Card,
  nextTags: string[] | undefined,
): Project {
  const cards = project.cards.map((item) => {
    if (item.id !== card.id) return item;
    if (nextTags) return { ...item, tags: nextTags };
    const { tags: _drop, ...rest } = item;
    return rest;
  });
  return appendEvent({ ...project, cards }, {
    type: "card_updated",
    at: Date.now(),
    cardId: card.id,
    title: card.title,
    body: card.body,
    url: card.url,
    tags: nextTags ?? [],
  });
}

async function replaceProjectTag(from: string, to: string): Promise<void> {
  const current = assertWritable();
  if (!current) return;
  const src = normalizeTag(from);
  const dst = normalizeTag(to);
  if (!src || !dst || src === dst) return;
  let next = current;
  let any = false;
  for (const card of current.cards) {
    const result = replaceTag(card.tags, src, dst);
    if (!result.changed) continue;
    any = true;
    next = patchCardTags(next, card, result.tags);
  }
  if (!any) return;
  clearTagFocusIfEmpty(next.cards);
  await persist(next);
}

async function gcMediaIfOrphan(
  mediaId: string | undefined,
  cards: ReadonlyArray<Card>,
): Promise<void> {
  if (!isLocalMediaRef(mediaId)) return;
  const id = mediaId!.trim();
  const stillUsed = cards.some((card) =>
    isLocalMediaRef(card.image) && card.image!.trim() === id
  );
  if (stillUsed) return;
  forgetMediaObjectUrl(id);
  await store.deleteMedia(id).catch(() => undefined);
}

/** Attach or replace the single screenshot on a card. */
export async function setCardImage(
  cardId: string,
  source: Blob,
): Promise<void> {
  const current = assertWritable();
  if (!current) return;
  const card = current.cards.find((item) => item.id === cardId);
  if (!card) return;
  if (!source.type.startsWith("image/")) {
    throw new Error("画像ファイルを選んでください");
  }
  const compressed = await compressImage(source);
  const mediaId = crypto.randomUUID();
  await store.putMedia({
    id: mediaId,
    projectId: current.id,
    blob: compressed,
  });
  const previous = card.image;
  const next = {
    ...current,
    cards: current.cards.map((item) =>
      item.id === cardId ? { ...item, image: mediaId } : item
    ),
  };
  await persist(appendEvent(next, {
    type: "card_updated",
    at: Date.now(),
    cardId,
    title: card.title,
    body: card.body,
    url: card.url,
    image: mediaId,
  }));
  await gcMediaIfOrphan(previous, next.cards);
}

/** Remove the screenshot from a card and GC the blob. */
export async function clearCardImage(cardId: string): Promise<void> {
  const current = assertWritable();
  if (!current) return;
  const card = current.cards.find((item) => item.id === cardId);
  if (!card || !card.image) return;
  const previous = card.image;
  const next = {
    ...current,
    cards: current.cards.map((item) => {
      if (item.id !== cardId) return item;
      const { image: _drop, ...rest } = item;
      return rest;
    }),
  };
  await persist(appendEvent(next, {
    type: "card_updated",
    at: Date.now(),
    cardId,
    title: card.title,
    body: card.body,
    url: card.url,
    image: "",
  }));
  await gcMediaIfOrphan(previous, next.cards);
  if (exploreComposeCardId.value === cardId) closeExploreCompose();
}
export async function resolveMediaUrl(
  image: string | undefined,
): Promise<string | null> {
  if (!isLocalMediaRef(image)) return null;
  const id = image!.trim();
  const cached = peekMediaObjectUrl(id);
  if (cached) return cached;
  const record = await store.getMedia(id);
  if (!record) return null;
  const url = URL.createObjectURL(record.blob);
  rememberMediaObjectUrl(id, url);
  return url;
}

export async function exportProject(): Promise<void> {
  const current = project.value;
  if (!current) return;
  const files = new Map<string, Uint8Array>();
  const json = new TextEncoder().encode(JSON.stringify(current, null, 2));
  files.set("project.json", json);
  for (const id of collectMediaIds(current.cards)) {
    const record = await store.getMedia(id);
    if (!record) continue;
    const ext = mediaExtFromType(record.blob.type);
    const bytes = new Uint8Array(await record.blob.arrayBuffer());
    files.set(`media/${id}.${ext}`, bytes);
  }
  const zipBytes = buildZip(files);
  const blob = new Blob([zipBytes.slice()], { type: "application/zip" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `${current.name.replaceAll(/[\\/:*?\"<>|]/g, "-")}.zip`;
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
  // Drop dangling local image refs when importing bare JSON (no media/).
  next.cards = next.cards.map((card) => {
    if (!isLocalMediaRef(card.image)) return card;
    const { image: _drop, ...rest } = card;
    return rest;
  });
  await store.saveProject(next);
  await activateProject(next);
  await refreshSummaries();
  return project.value ?? next;
}

async function importProjectFromZip(bytes: Uint8Array): Promise<Project> {
  const entries = parseZip(bytes);
  const parsed = parseProjectJson(projectJsonFromZip(entries));
  const media = mediaFromZip(entries);
  const next: Project = {
    ...parsed,
    id: crypto.randomUUID(),
    name: `${parsed.name}（取り込み）`,
  };
  const idMap = new Map<string, string>();
  for (const [oldId, { blob }] of media) {
    const newId = crypto.randomUUID();
    idMap.set(oldId, newId);
    await store.putMedia({ id: newId, projectId: next.id, blob });
  }
  next.cards = next.cards.map((card) => {
    if (!isLocalMediaRef(card.image)) return card;
    const mapped = idMap.get(card.image!.trim());
    if (!mapped) {
      const { image: _drop, ...rest } = card;
      return rest;
    }
    return { ...card, image: mapped };
  });
  await store.saveProject(next);
  await activateProject(next);
  await refreshSummaries();
  return project.value ?? next;
}

export async function importProjectFromFile(file: File): Promise<Project> {
  const name = file.name.toLowerCase();
  if (
    name.endsWith(".zip") || file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"
  ) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return await importProjectFromZip(bytes);
  }
  return await importProjectFromText(await file.text());
}

export function pickAndImportProject(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json,application/zip,.zip";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    void importProjectFromFile(file).catch((e) =>
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
  selectSingleCard(cardId);
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
  await commitCardPlacements([cardId]);
}

/** Persist finished board drags for several cards (one event each, single write). */
export async function commitCardPlacements(
  cardIds: readonly string[],
): Promise<void> {
  const current = assertWritable();
  if (!current) return;
  const at = Date.now();
  let next = current;
  let any = false;
  for (const cardId of cardIds) {
    const pos = next.boards[0]?.positions[cardId];
    if (!pos) continue;
    next = appendEvent(next, {
      type: "card_placed",
      at,
      cardId,
      x: pos.x,
      y: pos.y,
    });
    any = true;
  }
  if (any) await persist(next);
  else await flushSave();
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
  clearCardSelection();
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
  if (
    selectedCardId.value === cardId || selectedCardIds.value.includes(cardId)
  ) {
    setSelectedCards(selectedCardIds.value.filter((id) => id !== cardId));
  }
  if (revealCardId.value === cardId) revealCardId.value = null;
  if (exploreComposeCardId.value === cardId) closeExploreCompose();
  if (diggingCardId.value === cardId) stopDigging();
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
  await gcMediaIfOrphan(card.image, next.cards);
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

/** Drag frames: move cards by delta from captured origins (T046 bulk move). */
export function moveCardsOnBoardLocal(
  cardIds: readonly string[],
  origins: Readonly<Record<string, { x: number; y: number }>>,
  dx: number,
  dy: number,
): void {
  const current = assertWritable();
  if (!current) return;
  const moves = cardIds.map((cardId) => {
    const origin = origins[cardId] ?? { x: 0, y: 0 };
    return { cardId, x: origin.x + dx, y: origin.y + dy };
  });
  const next = applyMoveCardsOnBoard(current, moves);
  if (next) patchProjectLocal(next);
}

export function setBoardViewportLocal(
  viewport: NonNullable<Board["viewport"]>,
): void {
  const current = project.value;
  if (!current) return;
  patchProjectLocal(applySetBoardViewport(current, viewport));
}
