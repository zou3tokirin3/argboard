import { parseCaptureLine } from "../../ui/capture-notation.ts";

Deno.test("plain title is unchanged", () => {
  const parsed = parseCaptureLine("  手がかりA  ");
  if (
    !parsed || parsed.title !== "手がかりA" || parsed.body || parsed.url
  ) {
    throw new Error(`unexpected: ${JSON.stringify(parsed)}`);
  }
});

Deno.test("title // note splits into title and body", () => {
  const parsed = parseCaptureLine("看板の色 // 夜だと読めない");
  if (
    !parsed || parsed.title !== "看板の色" ||
    parsed.body !== "夜だと読めない" || parsed.url
  ) {
    throw new Error(`unexpected: ${JSON.stringify(parsed)}`);
  }
});

Deno.test("inline URL moves to url and leaves the title", () => {
  const parsed = parseCaptureLine(
    "公式サイト https://example.com/path を見た",
  );
  if (
    !parsed || parsed.title !== "公式サイト を見た" ||
    parsed.url !== "https://example.com/path" || parsed.body
  ) {
    throw new Error(`unexpected: ${JSON.stringify(parsed)}`);
  }
});

Deno.test("title // note with URL fills all three fields", () => {
  const parsed = parseCaptureLine(
    "題 // ひとこと https://example.com/a",
  );
  if (
    !parsed || parsed.title !== "題" || parsed.body !== "ひとこと" ||
    parsed.url !== "https://example.com/a"
  ) {
    throw new Error(`unexpected: ${JSON.stringify(parsed)}`);
  }
});

Deno.test("URL-only uses hostname as temporary title", () => {
  const parsed = parseCaptureLine("https://www.example.com/foo");
  if (
    !parsed || parsed.title !== "example.com" ||
    parsed.url !== "https://www.example.com/foo" || parsed.body
  ) {
    throw new Error(`unexpected: ${JSON.stringify(parsed)}`);
  }
});

Deno.test("URL // note uses hostname title and body", () => {
  const parsed = parseCaptureLine("https://example.org // 初見");
  if (
    !parsed || parsed.title !== "example.org" ||
    parsed.body !== "初見" || parsed.url !== "https://example.org"
  ) {
    throw new Error(`unexpected: ${JSON.stringify(parsed)}`);
  }
});

Deno.test("empty and note-only lines are rejected", () => {
  if (parseCaptureLine("   ") !== null) {
    throw new Error("blank should be null");
  }
  if (parseCaptureLine("// メモだけ") !== null) {
    throw new Error("note-only without URL should be null");
  }
});
