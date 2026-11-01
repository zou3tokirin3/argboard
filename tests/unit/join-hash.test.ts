import assert from "node:assert/strict";
import { test } from "node:test";
import { parseJoinHash } from "../../ui/sync.ts";

test("invitation hash accepts only a valid complete room id", () => {
  for (const room of ["a".repeat(22), "_-".repeat(32)]) {
    assert.equal(parseJoinHash(`#join=${room}`), room);
  }
  for (const hash of ["", "#other=abc", "#join=", "#join=short", `#join=${"a".repeat(65)}`, `#join=${"a".repeat(22)}&extra`, `#join=${"a".repeat(22)}%20`]) {
    assert.equal(parseJoinHash(hash), null);
  }
});
