import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { transformSync } from "esbuild";
import { createTranslator, t } from "../../src/i18n/index.ts";
import { ja } from "../../src/i18n/ja.ts";

const placeholders = (text: string) =>
  [...new Set([...text.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]))].sort();

function checkCatalog(candidate: Record<string, string>) {
  assert.deepEqual(Object.keys(candidate).sort(), Object.keys(ja).sort());
  for (const key of Object.keys(ja) as (keyof typeof ja)[]) {
    assert.deepEqual(placeholders(candidate[key]), placeholders(ja[key]), key);
  }
}

test("all shipped catalogs have the canonical keys and parameters", () => {
  // Add each future locale here when phase 2 is authorized.
  for (const catalog of [ja]) checkCatalog(catalog);
  assert.throws(() => checkCatalog({ ...ja, extra: "extra" }));
  const { "imageOverlay.close.label": _removed, ...missing } = ja;
  assert.throws(() => checkCatalog(missing));
  assert.throws(() =>
    checkCatalog({ ...ja, "imageOverlay.dialog.label": "{wrong}" }),
  );
});

test("translation preserves wording and treats substitutions as literal text", () => {
  assert.equal(t("imageOverlay.close.label"), "閉じる（Esc）");
  for (const title of [
    "<img src=x onerror=alert(1)>",
    "$& {title}",
    "",
    "日本語",
  ]) {
    assert.equal(t("imageOverlay.dialog.label", { title }), `${title} の画像`);
  }
  assert.equal(t("imageOverlay.dialog.label", { title: 42 }), "42 の画像");
});

test("missing runtime messages fall back to ja; warnings are development-only", (ctx) => {
  const warn = ctx.mock.method(console, "warn", () => {});
  assert.equal(
    createTranslator({})("imageOverlay.close.label"),
    ja["imageOverlay.close.label"],
  );
  assert.equal(warn.mock.callCount(), 0);
  assert.equal(
    createTranslator({}, true)("imageOverlay.dialog.label", { title: "A" }),
    "A の画像",
  );
  assert.equal(warn.mock.callCount(), 1);
  createTranslator(ja, true)("imageOverlay.close.label");
  assert.equal(warn.mock.callCount(), 1);
});

// esbuild parses TSX and removes comments; Unicode output also exposes escaped literals.
function japaneseLiterals(source: string) {
  const { code } = transformSync(source, {
    loader: "tsx",
    charset: "utf8",
    legalComments: "none",
    minifyWhitespace: true,
  });
  return (
    code.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]+/gu) ??
    []
  );
}

test("Japanese literal detector catches UI forms, allowing comments", () => {
  const source =
    // biome-ignore lint/suspicious/noTemplateCurlyInString: TSX fixture includes literal interpolation syntax.
    '// 日本語 comment\nconst view = <button title="説明">閉じる{`画像 ${name} の表示`}</button>;';
  assert.equal(japaneseLiterals(source).length, 4);
  assert.notDeepEqual(
    japaneseLiterals(String.raw`const text = "\u753b\u50cf";`),
    [],
  );
  assert.deepEqual(japaneseLiterals("<div>{/* 日本語 */}Hello</div>"), []);
  assert.deepEqual(
    japaneseLiterals('/* 日本語 */ const key = "imageOverlay.close.label";'),
    [],
  );
});

test("extracted surface contains no Japanese UI literals", () => {
  // Phase 1 slices 1–4. Expand this strict scope with each extraction PR; no file-wide exemptions.
  for (const path of [
    "ui/image-overlay.tsx",
    "ui/card-image-field.tsx",
    "ui/capture-image-slot.tsx",
    "ui/capture.tsx",
  ]) {
    const source = readFileSync(
      new URL(`../../${path}`, import.meta.url),
      "utf8",
    );
    assert.deepEqual(japaneseLiterals(source), [], path);
  }
  // ja.ts is the canonical literal source; tests/fixtures are intentionally outside UI scope.
});
