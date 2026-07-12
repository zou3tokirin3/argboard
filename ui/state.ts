import { computed, signal } from "@preact/signals";
import { store } from "./db.ts";
import type { AppMode, Card, Project } from "./types.ts";

const PROJECT_ID = "first-case";
const now = Date.now();
let persistenceRequested = false;

function createDemoProject(): Project {
  const cards: Card[] = [
    {
      id: "radio-signal",
      title: "23:17の短波ラジオ",
      body: "毎晩同じ時刻に数字列が流れる。",
      tags: ["音声", "時刻"],
      foundAt: now - 3600000,
    },
    {
      id: "station-locker",
      title: "東口ロッカー B-17",
      body: "動画の背景に一瞬だけ映り込んだ。",
      tags: ["場所"],
      foundAt: now - 2800000,
    },
    {
      id: "missing-poster",
      title: "消えた告知ポスター",
      body: "アーカイブにはあるが、現地では剥がされていた。",
      tags: ["矛盾"],
      foundAt: now - 1900000,
    },
    {
      id: "seventeen-theory",
      title: "17は集合時刻ではなく番号？",
      body: "時刻、ロッカー、投稿IDに17が繰り返し現れる。",
      tags: ["仮説"],
      foundAt: now - 900000,
    },
  ];

  return {
    version: 1,
    id: PROJECT_ID,
    name: "CASE 017 / 夜の放送",
    createdAt: now,
    cards,
    links: [
      {
        id: "signal-theory",
        from: "radio-signal",
        to: "seventeen-theory",
        label: "17が反復",
        kind: "connects",
        createdAt: now,
      },
      {
        id: "locker-theory",
        from: "station-locker",
        to: "seventeen-theory",
        label: "B-17",
        kind: "connects",
        createdAt: now,
      },
      {
        id: "poster-signal",
        from: "missing-poster",
        to: "radio-signal",
        label: "日付が矛盾",
        kind: "contradicts",
        createdAt: now,
      },
    ],
    boards: [{
      id: "main-board",
      name: "メインボード",
      cardIds: cards.map((card) => card.id),
      positions: {
        "radio-signal": { x: 90, y: 90 },
        "station-locker": { x: 480, y: 70 },
        "missing-poster": { x: 95, y: 345 },
        "seventeen-theory": { x: 470, y: 330 },
      },
    }],
    ui: { mode: "explore", sideOpen: false },
  };
}

export const project = signal<Project | null>(null);
export const search = signal("");
export const selectedCardId = signal<string | null>(null);
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

async function persist(next: Project): Promise<void> {
  project.value = next;
  saveStatus.value = "saving";
  try {
    await store.saveProject(next);
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

export async function initialize(): Promise<void> {
  const existing = await store.loadProject(PROJECT_ID);
  const initial = existing ?? createDemoProject();
  project.value = initial;
  if (!existing) await store.saveProject(initial);
  saveStatus.value = "saved";
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
  await persist({ ...current, cards: [...current.cards, card] });
  if (!persistenceRequested) {
    persistenceRequested = true;
    await store.requestPersistence().catch(() => false);
  }
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
