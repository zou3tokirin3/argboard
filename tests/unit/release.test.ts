import { appTitle } from "../../ui/release.ts";

Deno.test("appTitle shows release only when preview is cleared", () => {
  const title = appTitle();
  if (!title.startsWith("ARGBoard · 0.")) {
    throw new Error(`unexpected title: ${title}`);
  }
});

Deno.test("appTitle includes preview ticket", () => {
  const title = appTitle();
  if (!title.includes("+T063")) {
    throw new Error(`expected preview ticket in title: ${title}`);
  }
});

Deno.test("appTitle appends non-main branch", () => {
  const title = appTitle("task/T058");
  if (!title.endsWith(" · task/T058")) {
    throw new Error(`expected branch suffix: ${title}`);
  }
});

Deno.test("appTitle skips main branch suffix", () => {
  const title = appTitle("main");
  if (title.includes(" · main")) {
    throw new Error(`main should not appear as suffix: ${title}`);
  }
});
