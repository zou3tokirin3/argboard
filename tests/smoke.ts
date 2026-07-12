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

    const title = `スモーク手がかり ${Date.now()}`;
    await page.locator<HTMLInputElement>('[data-testid="capture-input"]').fill(
      title,
    );
    await page.keyboard.press("Enter", {});
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
