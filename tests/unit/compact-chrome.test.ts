import { test } from "node:test";
import { COMPACT_CHROME_QUERY } from "../../ui/compact-chrome.ts";

test("compact chrome media query is coarse OR narrow 800", () => {
  if (COMPACT_CHROME_QUERY !== "(pointer: coarse), (max-width: 800px)") {
    throw new Error(`unexpected query: ${COMPACT_CHROME_QUERY}`);
  }
});
