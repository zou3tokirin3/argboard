import { APP_PREVIEW, APP_RELEASE, appTitle } from "../../ui/release.ts";

Deno.test("appTitle shows release with optional preview ticket", () => {
  const title = appTitle();
  if (!title.startsWith(`ARGBoard · ${APP_RELEASE}`)) {
    throw new Error(`unexpected title: ${title}`);
  }
  if (APP_PREVIEW) {
    if (!title.includes(`+${APP_PREVIEW}`)) {
      throw new Error(`expected preview ticket: ${title}`);
    }
  } else if (title.includes("+")) {
    throw new Error(`preview should be cleared: ${title}`);
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
