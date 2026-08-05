/// <reference lib="dom" />

import { launch } from "@astral/astral";

function freePort(): number {
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const { port } = listener.addr as Deno.NetAddr;
  listener.close();
  return port;
}

const port = freePort();
const origin = `http://127.0.0.1:${port}`;

const server = new Deno.Command(Deno.execPath(), {
  args: ["run", "-A", "serve.ts"],
  env: { ...Deno.env.toObject(), PORT: String(port) },
  stdout: "null",
  stderr: "inherit",
}).spawn();

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/`);
      if (response.ok) return;
    } catch {
      // The server process is still starting; the loop polls until the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Local server did not become ready");
}

try {
  await waitForServer();
  const browser = await launch({ headless: true });
  try {
    const page = await browser.newPage(`${origin}/?test=1`);
    await page.waitForSelector('[data-testid="capture-input"]');

    // ① 連続キャプチャ → persist 要求はブロックしない → リロードで両方残る
    await page.evaluate(() => {
      const storage = navigator.storage;
      if (!storage?.persist) {
        throw new Error("navigator.storage.persist is unavailable");
      }
      const original = storage.persist.bind(storage);
      storage.persist = () =>
        new Promise((resolve) => {
          // Hold the permission prompt so overlapping captures can race.
          setTimeout(() => {
            void original().then(resolve, () => resolve(false));
          }, 1_500);
        });
    });

    const stamp = Date.now();
    const titles = [`連続A ${stamp}`, `連続B ${stamp}`] as const;
    await page.evaluate(async (cardTitles: string[]) => {
      const api = (globalThis as typeof globalThis & {
        __argboardTest?: { addCard: (title: string) => Promise<void> };
      }).__argboardTest;
      if (!api) throw new Error("Test hooks were not installed");
      // Overlap the two adds while requestPersistence is still pending.
      await Promise.all(cardTitles.map((title) => api.addCard(title)));
    }, { args: [[...titles]] });

    await page.waitForFunction(
      () =>
        ((globalThis as typeof globalThis & {
          __argboardTest?: { getPersistenceRequestCount: () => number };
        }).__argboardTest?.getPersistenceRequestCount() ?? 0) >= 1,
    );

    for (const title of titles) {
      await page.waitForFunction(
        (expectedTitle: string) => {
          const cards = (globalThis as typeof globalThis & {
            __argboardTest?: {
              getState: () => { cards: { title: string }[] };
            };
          }).__argboardTest?.getState().cards ?? [];
          return cards.some((card) => card.title === expectedTitle);
        },
        { args: [title] },
      );
    }

    const persistCalls = await page.evaluate(() =>
      (globalThis as typeof globalThis & {
        __argboardTest?: { getPersistenceRequestCount: () => number };
      }).__argboardTest?.getPersistenceRequestCount() ?? 0
    );
    if (persistCalls < 1) {
      throw new Error(
        "navigator.storage.persist() was not requested after first card",
      );
    }

    const inMemoryCount = await page.evaluate((expected: string[]) => {
      const cards = (globalThis as typeof globalThis & {
        __argboardTest?: {
          getState: () => { cards: { title: string }[] };
        };
      }).__argboardTest?.getState().cards ?? [];
      return expected.filter((title) =>
        cards.some((card) => card.title === title)
      ).length;
    }, { args: [[...titles]] });
    if (inMemoryCount !== 2) {
      throw new Error(
        `Expected both consecutive cards in memory, found ${inMemoryCount}`,
      );
    }

    await page.evaluate(async () =>
      await (globalThis as typeof globalThis & {
        __argboardTest?: { flushSave: () => Promise<void> };
      }).__argboardTest?.flushSave()
    );
    await page.reload();
    await page.waitForSelector('[data-testid="capture-input"]');
    for (const title of titles) {
      await page.waitForFunction(
        (expectedTitle: string) =>
          document.body.textContent?.includes(expectedTitle) ?? false,
        { args: [title] },
      );
    }

    // ⑤ プロジェクト作成・切替でカードが分離される
    const firstProjectId = await page.evaluate(() =>
      (globalThis as typeof globalThis & {
        __argboardTest?: { getState: () => { id: string } };
      }).__argboardTest?.getState().id ?? ""
    );
    if (!firstProjectId) throw new Error("Missing first project id");

    const second = await page.evaluate(async (name: string) => {
      const api = (globalThis as typeof globalThis & {
        __argboardTest?: {
          createProject: (
            projectName?: string,
          ) => Promise<{ id: string; name: string }>;
        };
      }).__argboardTest;
      if (!api) throw new Error("Test hooks were not installed");
      return await api.createProject(name);
    }, { args: [`切替ケース ${Date.now()}`] });

    await page.waitForFunction(
      (projectId: string) =>
        (globalThis as typeof globalThis & {
          __argboardTest?: { getState: () => { id: string } };
        }).__argboardTest?.getState().id === projectId,
      { args: [second.id] },
    );
    const stillHasFirstCard = await page.evaluate(
      (expectedTitle: string) =>
        document.body.textContent?.includes(expectedTitle) ?? false,
      { args: [titles[0]] },
    );
    if (stillHasFirstCard) {
      throw new Error("New project still showed the previous project's card");
    }

    const secondTitle = `別ケースの手がかり ${Date.now()}`;
    await page.locator<HTMLInputElement>('[data-testid="capture-input"]').fill(
      secondTitle,
    );
    await page.keyboard.press("Enter", {});
    await page.waitForFunction(
      (expectedTitle: string) =>
        document.body.textContent?.includes(expectedTitle),
      { args: [secondTitle] },
    );
    await page.evaluate(async () =>
      await (globalThis as typeof globalThis & {
        __argboardTest?: { flushSave: () => Promise<void> };
      }).__argboardTest?.flushSave()
    );

    await page.evaluate(async (projectId: string) => {
      const api = (globalThis as typeof globalThis & {
        __argboardTest?: { switchProject: (id: string) => Promise<void> };
      }).__argboardTest;
      if (!api) throw new Error("Test hooks were not installed");
      await api.switchProject(projectId);
    }, { args: [firstProjectId] });

    await page.waitForFunction(
      (expectedTitle: string) =>
        document.body.textContent?.includes(expectedTitle) ?? false,
      { args: [titles[0]] },
    );
    const leakedSecondCard = await page.evaluate(
      (expectedTitle: string) =>
        document.body.textContent?.includes(expectedTitle) ?? false,
      { args: [secondTitle] },
    );
    if (leakedSecondCard) {
      throw new Error("Switched project still showed the other project's card");
    }

    // ④ export→import 往復（新規id・既存非破壊・同等復元）
    await page.waitForSelector('[data-testid="export-btn"]');
    await page.waitForSelector('[data-testid="import-btn"]');
    const roundtrip = await page.evaluate(async () => {
      const api = (globalThis as typeof globalThis & {
        __argboardTest?: {
          getState: () => {
            id: string;
            name: string;
            cards: unknown[];
            links: unknown[];
            boards: unknown[];
            ui?: unknown;
          };
          importProjectFromText: (text: string) => Promise<{ id: string }>;
          listProjects: () => { id: string }[];
          switchProject: (id: string) => Promise<void>;
        };
      }).__argboardTest;
      if (!api) throw new Error("Test hooks were not installed");
      const source = api.getState();
      const sourceId = source.id;
      const snapshot = {
        cards: source.cards,
        links: source.links,
        boards: source.boards,
        ui: source.ui,
      };
      const imported = await api.importProjectFromText(
        JSON.stringify(source),
      );
      if (imported.id === sourceId) {
        throw new Error("Import must assign a new project id");
      }
      const ids = api.listProjects().map((item) => item.id);
      if (!ids.includes(sourceId) || !ids.includes(imported.id)) {
        throw new Error(
          "Import must keep the source project and add a new one",
        );
      }
      const restored = api.getState();
      if (restored.name !== `${source.name}（取り込み）`) {
        throw new Error("Import must mark the new project name");
      }
      const body = {
        cards: restored.cards,
        links: restored.links,
        boards: restored.boards,
        ui: restored.ui,
      };
      if (JSON.stringify(body) !== JSON.stringify(snapshot)) {
        throw new Error("Import did not restore equivalent project data");
      }
      await api.switchProject(sourceId);
      return { sourceId, importedId: imported.id };
    });
    if (!roundtrip.sourceId || !roundtrip.importedId) {
      throw new Error("Roundtrip did not return project ids");
    }

    // ② ストリーム→ボード配置（フック経由・§10-3）
    const boardCase = await page.evaluate(async (name: string) => {
      const api = (globalThis as typeof globalThis & {
        __argboardTest?: {
          createProject: (projectName?: string) => Promise<{ id: string }>;
        };
      }).__argboardTest;
      if (!api) throw new Error("Test hooks were not installed");
      return await api.createProject(name);
    }, { args: [`ボードケース ${Date.now()}`] });

    await page.waitForFunction(
      (projectId: string) =>
        (globalThis as typeof globalThis & {
          __argboardTest?: { getState: () => { id: string } };
        }).__argboardTest?.getState().id === projectId,
      { args: [boardCase.id] },
    );

    const placedTitles = [
      `配置A ${Date.now()}`,
      `配置B ${Date.now() + 1}`,
    ] as const;

    for (const cardTitle of placedTitles) {
      await page.waitForSelector('[data-testid="capture-input"]');
      await page.locator<HTMLInputElement>('[data-testid="capture-input"]')
        .fill(cardTitle);
      await page.keyboard.press("Enter", {});
      await page.waitForFunction(
        (expectedTitle: string) =>
          document.body.textContent?.includes(expectedTitle) ?? false,
        { args: [cardTitle] },
      );
    }

    const cardIds = await page.evaluate((titles: string[]) => {
      const state = (globalThis as typeof globalThis & {
        __argboardTest?: {
          getState: () => { cards: { id: string; title: string }[] };
        };
      }).__argboardTest?.getState();
      if (!state) throw new Error("Missing state");
      return titles.map((title) => {
        const card = state.cards.find((item) => item.title === title);
        if (!card) throw new Error(`Missing card ${title}`);
        return card.id;
      });
    }, { args: [[...placedTitles]] });

    await page.evaluate(async () => {
      const api = (globalThis as typeof globalThis & {
        __argboardTest?: {
          setAppMode: (mode: "explore" | "contemplate") => Promise<void>;
        };
      }).__argboardTest;
      if (!api) throw new Error("Test hooks were not installed");
      await api.setAppMode("contemplate");
    });

    await page.waitForFunction(
      () =>
        (globalThis as typeof globalThis & {
          __argboardTest?: {
            getState: () => { ui?: { mode?: string } };
          };
        }).__argboardTest?.getState().ui?.mode === "contemplate",
    );

    await page.evaluate(
      async (
        payload: { ids: string[]; points: [number, number][] },
      ) => {
        const api = (globalThis as typeof globalThis & {
          __argboardTest?: {
            placeCardOnBoard: (
              cardId: string,
              x: number,
              y: number,
            ) => Promise<void>;
          };
        }).__argboardTest;
        if (!api) throw new Error("Test hooks were not installed");
        for (let index = 0; index < payload.ids.length; index += 1) {
          const [x, y] = payload.points[index]!;
          await api.placeCardOnBoard(payload.ids[index]!, x, y);
        }
      },
      {
        args: [{
          ids: cardIds,
          points: [[80, 90], [360, 140]] as [number, number][],
        }],
      },
    );

    await page.waitForFunction(
      (ids: string[]) => {
        const board = (globalThis as typeof globalThis & {
          __argboardTest?: {
            getState: () => {
              boards: { cardIds: string[] }[];
            };
          };
        }).__argboardTest?.getState().boards[0];
        return ids.every((id) => board?.cardIds.includes(id));
      },
      { args: [cardIds] },
    );

    // ③ 糸を張る→ラベル→要検討→通常（フック経由）
    await page.evaluate(async (ids: string[]) => {
      const api = (globalThis as typeof globalThis & {
        __argboardTest?: {
          connectCards: (fromId: string, toId: string) => Promise<void>;
          updateLink: (
            linkId: string,
            patch: { label?: string; kind?: "connects" | "contradicts" },
          ) => Promise<void>;
          getState: () => { links: { id: string; from: string; to: string }[] };
        };
      }).__argboardTest;
      if (!api) throw new Error("Test hooks were not installed");
      await api.connectCards(ids[0]!, ids[1]!);
      const link = api.getState().links.find((item) =>
        item.from === ids[0] && item.to === ids[1]
      );
      if (!link) throw new Error("Link was not created");
      await api.updateLink(link.id, {
        label: "同一人物?",
        kind: "contradicts",
      });
    }, { args: [cardIds] });

    await page.waitForFunction(
      (ids: string[]) => {
        const link = (globalThis as typeof globalThis & {
          __argboardTest?: {
            getState: () => {
              links: {
                from: string;
                to: string;
                label?: string;
                kind: string;
              }[];
            };
          };
        }).__argboardTest?.getState().links.find((item) =>
          item.from === ids[0] && item.to === ids[1]
        );
        return link?.label === "同一人物?" && link.kind === "contradicts";
      },
      { args: [cardIds] },
    );

    await page.evaluate(async (ids: string[]) => {
      const api = (globalThis as typeof globalThis & {
        __argboardTest?: {
          updateLink: (
            linkId: string,
            patch: { label?: string; kind?: "connects" | "contradicts" },
          ) => Promise<void>;
          getState: () => {
            links: { id: string; from: string; to: string }[];
          };
        };
      }).__argboardTest;
      if (!api) throw new Error("Test hooks were not installed");
      const link = api.getState().links.find((item) =>
        item.from === ids[0] && item.to === ids[1]
      );
      if (!link) throw new Error("Link was not found");
      await api.updateLink(link.id, { kind: "connects" });
    }, { args: [cardIds] });

    await page.waitForFunction(
      (ids: string[]) => {
        const link = (globalThis as typeof globalThis & {
          __argboardTest?: {
            getState: () => {
              links: {
                from: string;
                to: string;
                label?: string;
                kind: string;
              }[];
            };
          };
        }).__argboardTest?.getState().links.find((item) =>
          item.from === ids[0] && item.to === ids[1]
        );
        return link?.label === "同一人物?" && link.kind === "connects";
      },
      { args: [cardIds] },
    );

    await page.waitForSelector('[data-testid="link-line"]');
    await page.waitForSelector('[data-testid="board-node"]');

    // 探索モード: 画像ペースト → ステージング → 確定でカード化
    const imgStamp = `img-${Date.now()}`;
    await page.evaluate(async (title: string) => {
      const api = (globalThis as typeof globalThis & {
        __argboardTest?: {
          setAppMode: (mode: "explore" | "contemplate") => Promise<void>;
          pasteExploreImage: (blob: Blob) => Promise<string | null>;
          commitExploreImageDraft: () => Promise<string | null>;
          patchExploreImageDraft: (
            patch: { title?: string; body?: string; url?: string },
          ) => void;
          getState: () => {
            cards: { id: string; title: string; image?: string }[];
          };
        };
      }).__argboardTest;
      if (!api) throw new Error("Test hooks were not installed");
      await api.setAppMode("explore");
      const before = api.getState().cards.length;
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 2;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("canvas toBlob failed");
      const earlyId = await api.pasteExploreImage(blob);
      if (earlyId != null) throw new Error("paste should stage, not create");
      if (api.getState().cards.length !== before) {
        throw new Error("card created before commit");
      }
      if (!document.querySelector('[data-testid="capture-image-staging"]')) {
        throw new Error("staging UI missing");
      }
      const titleInput = document.querySelector(
        '[data-testid="capture-image-staging-title"]',
      );
      if (!titleInput) throw new Error("staging title input missing");
      api.patchExploreImageDraft({ title });
      const cardId = await api.commitExploreImageDraft();
      if (!cardId) throw new Error("commit returned null");
      const card = api.getState().cards.find((item) => item.id === cardId);
      if (!card?.image) throw new Error("committed card has no image ref");
      if (card.title !== title) {
        throw new Error(`unexpected title: ${card.title}`);
      }
    }, { args: [imgStamp] });
    await page.waitForSelector('[data-testid="capture-input"]');

    // 探索モード: 選択中カードにインライン title input が出る（保存は人間確認）
    const titleStamp = `inline-edit-${Date.now()}`;
    await page.evaluate(async (from: string) => {
      const api = (globalThis as typeof globalThis & {
        __argboardTest?: {
          setAppMode: (mode: "explore" | "contemplate") => Promise<void>;
          addCard: (title: string) => Promise<string | null>;
          selectSingleCard: (cardId: string) => void;
        };
      }).__argboardTest;
      if (!api) throw new Error("Test hooks were not installed");
      await api.setAppMode("explore");
      const cardId = await api.addCard(from);
      if (!cardId) throw new Error("addCard failed");
      api.selectSingleCard(cardId);
      const deadline = Date.now() + 5_000;
      while (Date.now() < deadline) {
        if (
          document.querySelector('[data-testid="stream-card-title-input"]')
        ) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error("stream title input missing");
    }, { args: [titleStamp] });
  } finally {
    await browser.close();
  }
} finally {
  try {
    server.kill("SIGTERM");
  } catch {
    // The server may already have exited when startup itself failed.
  }
  await server.status;
}
