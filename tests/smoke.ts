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

    // ① カード作成 → persist 要求 → リロードで残る
    const title = `スモーク手がかり ${Date.now()}`;
    await page.locator<HTMLInputElement>('[data-testid="capture-input"]').fill(
      title,
    );
    await page.keyboard.press("Enter", {});
    await page.waitForFunction(
      () =>
        ((globalThis as typeof globalThis & {
          __argboardTest?: { getPersistenceRequestCount: () => number };
        }).__argboardTest?.getPersistenceRequestCount() ?? 0) >= 1,
    );
    await page.waitForFunction(
      (expectedTitle: string) =>
        document.body.textContent?.includes(expectedTitle),
      { args: [title] },
    );
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
    await page.evaluate(async () =>
      await (globalThis as typeof globalThis & {
        __argboardTest?: { flushSave: () => Promise<void> };
      }).__argboardTest?.flushSave()
    );
    await page.reload();
    await page.waitForFunction(
      (expectedTitle: string) =>
        document.body.textContent?.includes(expectedTitle),
      { args: [title] },
    );

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
      { args: [title] },
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
      { args: [title] },
    );
    const leakedSecondCard = await page.evaluate(
      (expectedTitle: string) =>
        document.body.textContent?.includes(expectedTitle) ?? false,
      { args: [secondTitle] },
    );
    if (leakedSecondCard) {
      throw new Error("Switched project still showed the other project's card");
    }

    // ④ エクスポートボタンが存在しクリックできる
    await page.waitForSelector('[data-testid="export-btn"]');
    await page.locator('[data-testid="export-btn"]').click();
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
