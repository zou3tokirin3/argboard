import * as cp from "node:child_process";
import { test } from "@playwright/test";
import { verifyEdits } from "./confirm-edit.mjs";
import { selectStream, verifyStream } from "./stream-confirm.mjs";

test("T098 confirms changed fields and stream Escape cancellation", async ({ page }) => {
  const server = cp.spawn("node", ["scripts/serve.js"], {
    env: { ...process.env, PORT: "4198" }, stdio: "ignore",
  });
  try {
    const deadline = Date.now() + 10_000;
    while (true) {
      try { if ((await fetch("http://127.0.0.1:4198")).ok) break; } catch {}
      if (server.exitCode !== null || Date.now() > deadline) throw new Error("T098 local server did not start");
      await page.waitForTimeout(50);
    }
    await verifyEdits(page, "http://127.0.0.1:4198");
    await page.reload();
    await page.waitForFunction(() => window.__argboardTest?.getState()?.id);
    const [id, destination] = await page.evaluate(async () => [
      await window.__argboardTest.addCard("TITLE-X-original"),
      await window.__argboardTest.addCard("Destination"),
    ]);
    await selectStream(page, id);
    await verifyStream(page, null, id, destination);
  } finally {
    server.kill();
  }
});
