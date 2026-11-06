import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldShowShareButton } from "../../ui/sharing-host.ts";

for (const hostname of ["argboard.github.io", "GITHUB.IO", "team.github.io."]) {
  test(`share button is hidden on Pages: ${hostname}`, () => {
    assert.equal(shouldShowShareButton(hostname), false);
  });
}
for (const hostname of ["argboard.workers.dev", "localhost", "127.0.0.1", "[::1]", "github.io.example.test"]) {
  test(`share button remains visible: ${hostname}`, () => {
    assert.equal(shouldShowShareButton(hostname), true);
  });
}
