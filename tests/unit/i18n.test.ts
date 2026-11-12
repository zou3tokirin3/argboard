import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { transformSync } from "esbuild";
import { en } from "../../src/i18n/en.ts";
import {
  createTranslator,
  langFromSearch,
  resolveLang,
  t,
} from "../../src/i18n/index.ts";
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
  for (const catalog of [ja, en]) checkCatalog(catalog);
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
  // Phase 1 slices 1–11. Expand this strict scope with each extraction PR; no file-wide exemptions.
  for (const path of [
    "ui/image-overlay.tsx",
    "ui/card-image-field.tsx",
    "ui/capture-image-slot.tsx",
    "ui/capture.tsx",
    "ui/stream.tsx",
    "ui/inspector.tsx",
    "ui/card-role-toggle.tsx",
    "ui/thought-outcome-field.tsx",
    "ui/thought-outcome.ts",
    "ui/digging-controls.tsx",
    "ui/main.tsx",
    "ui/board.tsx",
    "ui/lane-view.tsx",
    "ui/stream-sticky-trail.tsx",
    "ui/media.ts",
    "ui/image-compress.ts",
    "ui/media-thumb.tsx",
    "ui/icon-tip.tsx",
    "ui/thought-outcome-icon.tsx",
    "ui/sync-client.ts",
  ]) {
    const source = readFileSync(
      new URL(`../../${path}`, import.meta.url),
      "utf8",
    );
    assert.deepEqual(japaneseLiterals(source), [], path);
  }
  // ja.ts is the canonical literal source; tests/fixtures are intentionally outside UI scope.
});

test("slice9 shared labels and errors preserve exact Japanese wording", () => {
  assert.equal(t("stream.stickyTrail.label"), "上にスクロールした親");
  assert.equal(t("media.zip.unreadable"), "zipとして読めません");
  assert.equal(t("media.zip.compressed"), "圧縮されたzipは未対応です");
  assert.equal(
    t("media.zip.missingProject"),
    "zipに project.json がありません",
  );
  assert.equal(t("image.compress.error"), "画像を圧縮できませんでした");
});

test("state Japanese literals are persisted-data exceptions only", () => {
  // Saved data, not UI wording. Follow up with project.ts history/demo inventory.
  const source = readFileSync(
    new URL("../../ui/state.ts", import.meta.url),
    "utf8",
  );
  assert.deepEqual(japaneseLiterals(source), [
    // The unchanged detector splits prolonged sound marks (ー).
    "共有ボ",
    "ド",
    "新しいケ",
    "ス",
    "新しいケ",
    "ス",
    "無題",
    "無題",
    "取り込み",
    "取り込み",
  ]);
});

test("slice10 sync status and state errors preserve exact Japanese wording", () => {
  assert.equal(t("sync.status.offline"), "オフライン");
  assert.equal(t("sync.status.connected"), "接続中");
  assert.equal(t("sync.status.error"), "同期エラー");
  assert.equal(
    t("sync.status.errorDetail", { error: "room full" }),
    "同期エラー: room full",
  );
  assert.equal(t("image.file.notImage"), "画像ファイルを選んでください");
  assert.equal(t("project.import.error"), "読み込めませんでした");
});

test("slice11 project history labels and import errors preserve exact Japanese wording", () => {
  assert.equal(t("project.history.cardFallback"), "カード");
  assert.equal(t("project.history.cardAdded", { title: "A" }), "追加 · A");
  assert.equal(t("project.history.cardUpdated", { title: "A" }), "編集 · A");
  assert.equal(t("project.history.cardRemoved", { title: "A" }), "削除 · A");
  assert.equal(t("project.history.cardPlaced", { title: "A" }), "配置 · A");
  assert.equal(t("project.history.linkAddedContradicts"), "糸 · 要検討");
  assert.equal(t("project.history.linkAdded"), "糸 · 接続");
  assert.equal(t("project.history.linkLabel", { label: "A" }), "ラベル · A");
  assert.equal(t("project.history.linkMarkedContradicts"), "糸 · 要検討に");
  assert.equal(t("project.history.linkMarkedConnects"), "糸 · 通常に");
  assert.equal(t("project.history.linkRemoved"), "糸 · 削除");
  assert.equal(
    t("project.history.foundViaCleared", { title: "A" }),
    "発見元を外す · A",
  );
  assert.equal(t("project.import.invalidJson"), "JSONとして読めません");
  assert.equal(t("project.import.unsupported"), "未対応の形式か version です");
  const title = "{title} / $&";
  assert.equal(t("project.history.cardAdded", { title }), `追加 · ${title}`);
});

test("project Japanese literals are persisted-data and demo exceptions only", () => {
  // Saved data/demo content, not UI wording; follow-up needs 隆さん’s decision.
  // The unchanged detector splits prolonged sound marks (ー).
  const source = readFileSync(
    new URL("../../ui/project.ts", import.meta.url),
    "utf8",
  );
  assert.deepEqual(japaneseLiterals(source), [
    "新しいケ",
    "ス",
    "メインボ",
    "ド",
    "考察",
    "の短波ラジオ",
    "毎晩同じ時刻に数字列が流れる",
    "東口ロッカ",
    "動画の背景に一瞬だけ映り込んだ",
    "消えた告知ポスタ",
    "ア",
    "カイブにはあるが",
    "現地では剥がされていた",
    "夜",
    "は集合時刻ではなく番号",
    "時刻",
    "ロッカ",
    "投稿",
    "に",
    "が繰り返し現れる",
    "終電後の改札音",
    "短波のあとに聞こえた",
    "という証言",
    "日付が曖昧",
    "夜の放送",
    "が反復",
    "日付が合わない",
    "そのあと",
    "メインボ",
    "ド",
  ]);
});

test("URL language selection accepts only ja and en, defaulting to Japanese", () => {
  for (const [search, expected] of [
    ["", "ja"],
    ["?test=1", "ja"],
    ["?lang=ja", "ja"],
    ["?lang=en", "en"],
    ["?test=1&lang=en", "en"],
    ["?lang=en&test=1", "en"],
    ["?lang=", "ja"],
    ["?lang", "ja"],
    ["?lang=EN", "ja"],
    ["?lang=en-US", "ja"],
    ["?lang=foo", "ja"],
    ["?lang=%20en", "ja"],
    ["?lang=en+", "ja"],
    ["?LANG=en", "ja"],
    ["?other=lang%3Den", "ja"],
    ["?lang=ja&lang=en", "ja"],
    ["?lang=en&lang=ja", "en"],
    ["?lang=%65%6e", "en"],
  ] as const) {
    assert.equal(langFromSearch(search), expected, search);
    assert.equal(resolveLang({ search }), expected, search);
    if (expected === "ja") {
      assert.equal(t("stream.label"), "発見ログ");
    }
  }
  assert.equal(resolveLang(), "ja", "Node has no location");
});

test("English catalog uses glossary wording and literal typed parameters", () => {
  const translate = createTranslator(
    resolveLang({ search: "?lang=en" }) === "en" ? en : ja,
  );
  assert.equal(translate("stream.label"), "Discovery log");
  assert.equal(translate("board.label"), "Investigation board");
  assert.equal(translate("digging.active.label"), "Exploring");
  assert.equal(translate("cardImage.image.alt"), "Attached screenshot");
  assert.equal(translate("capture.source.label"), "Source URL");
  assert.equal(translate("stream.storyWhen.label"), "Story time");
  assert.equal(translate("inspector.link.eyebrow"), "Thread");
  assert.equal(translate("stream.role.thought"), "Thought");
  for (const title of ["<img src=x>", "$& {title}", "", "日本語"]) {
    assert.equal(
      translate("imageOverlay.dialog.label", { title }),
      `Image for ${title}`,
    );
    assert.equal(
      translate("project.history.cardAdded", { title }),
      `Added · ${title}`,
    );
  }
  assert.equal(
    translate("capture.digging.depth.label", { count: 3 }),
    "3 levels",
  );
});

test("boot selects the URL catalog once; changing location does not change t", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "location");
  try {
    let index = 0;
    for (const [search, expected] of [
      ["?lang=en", "Discovery log"],
      ["?lang=ja", "発見ログ"],
      ["", "発見ログ"],
      ["?lang=", "発見ログ"],
      ["?lang=EN", "発見ログ"],
      ["?lang=en-US", "発見ログ"],
      ["?lang=foo", "発見ログ"],
    ]) {
      Object.defineProperty(globalThis, "location", {
        configurable: true,
        value: { search },
      });
      const boot = await import(`../../src/i18n/index.ts?boot=${index++}`);
      assert.equal(boot.t("stream.label"), expected, search);
      Object.defineProperty(globalThis, "location", {
        configurable: true,
        value: { search: "?lang=en" },
      });
      assert.equal(
        boot.t("stream.label"),
        expected,
        "catalog is fixed at boot",
      );
    }
  } finally {
    if (original) Object.defineProperty(globalThis, "location", original);
    else Reflect.deleteProperty(globalThis, "location");
  }
});
