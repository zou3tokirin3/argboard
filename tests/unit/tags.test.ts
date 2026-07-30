import {
  attachTag,
  buildTagSuggestions,
  collectTagUsage,
  commonTagsAmong,
  detachTag,
  fitTagsOneLine,
  normalizeTag,
  replaceTag,
  TAG_KIND_LIMIT,
} from "../../ui/tags.ts";

Deno.test("normalizeTag trims and collapses spaces", () => {
  if (normalizeTag("  十七  歳  ") !== "十七 歳") {
    throw new Error("spaces should collapse");
  }
});

Deno.test("collectTagUsage counts and keeps first-seen order", () => {
  const usage = collectTagUsage([
    { tags: ["十七", "音声"] },
    { tags: ["十七"] },
    { tags: [" 十七 "] },
    {},
  ]);
  if (
    usage.length !== 2 || usage[0]?.name !== "十七" || usage[0]?.count !== 3
  ) {
    throw new Error(`unexpected usage: ${JSON.stringify(usage)}`);
  }
  if (usage[1]?.name !== "音声" || usage[1]?.count !== 1) {
    throw new Error("second tag should be unsettled");
  }
});

Deno.test("buildTagSuggestions filters attached and offers create", () => {
  const usage = collectTagUsage([
    { tags: ["十七"] },
    { tags: ["音声"] },
  ]);
  const { items, atLimit } = buildTagSuggestions("十七", usage, ["音声"]);
  if (atLimit) throw new Error("should not be at limit");
  if (items.length !== 1 || items[0]?.kind !== "existing") {
    throw new Error(`expected existing 十七: ${JSON.stringify(items)}`);
  }
  const created = buildTagSuggestions("新拠点", usage, []);
  if (
    created.items.length !== 1 || created.items[0]?.kind !== "create" ||
    created.items[0].name !== "新拠点"
  ) {
    throw new Error(`expected create: ${JSON.stringify(created.items)}`);
  }
});

Deno.test("buildTagSuggestions blocks create at kind limit", () => {
  const tags = Array.from({ length: TAG_KIND_LIMIT }, (_, i) => `t${i}`);
  const usage = collectTagUsage(tags.map((name) => ({ tags: [name] })));
  const { items, atLimit } = buildTagSuggestions("新しい", usage, []);
  if (!atLimit) throw new Error("expected atLimit");
  if (items.some((item) => item.kind === "create")) {
    throw new Error("create must be blocked at limit");
  }
});

Deno.test("attachTag and detachTag round-trip", () => {
  const once = attachTag(undefined, "十七");
  if (once.length !== 1 || once[0] !== "十七") {
    throw new Error("attach empty failed");
  }
  const twice = attachTag(once, "十七");
  if (twice.length !== 1) throw new Error("duplicate attach");
  const cleared = detachTag(twice, "十七");
  if (cleared !== undefined) throw new Error("detach last should clear");
});

Deno.test("replaceTag renames and merges with dedupe", () => {
  const renamed = replaceTag(["十七", "音声"], "十七", "17歳");
  if (
    !renamed.changed || !renamed.tags || renamed.tags.join(",") !== "17歳,音声"
  ) {
    throw new Error(`rename failed: ${JSON.stringify(renamed)}`);
  }
  const merged = replaceTag(["十七", "音声"], "音声", "十七");
  if (
    !merged.changed || !merged.tags || merged.tags.join(",") !== "十七"
  ) {
    throw new Error(`merge failed: ${JSON.stringify(merged)}`);
  }
  const missing = replaceTag(["十七"], "音声", "拠点");
  if (missing.changed) throw new Error("missing source should no-op");
});

Deno.test("commonTagsAmong returns tags shared by every selected card", () => {
  const a = "a";
  const b = "b";
  const c = "c";
  const cards = [
    { id: a, tags: ["十七", "音声", "拠点"] },
    { id: b, tags: ["音声", "十七"] },
    { id: c, tags: ["メモ"] },
  ];
  const ab = commonTagsAmong(cards, [a, b]);
  if (ab.join(",") !== "十七,音声") {
    throw new Error(`ab common: ${ab.join(",")}`);
  }
  const abc = commonTagsAmong(cards, [a, b, c]);
  if (abc.length !== 0) throw new Error("abc should have no common tag");
  const ac = commonTagsAmong(cards, [a, c]);
  if (ac.length !== 0) throw new Error("ac should have no common tag");
});

Deno.test("fitTagsOneLine keeps all when width is enough", () => {
  const { shown, hidden } = fitTagsOneLine(["十七", "音声"], 200);
  if (shown.length !== 2 || hidden !== 0) {
    throw new Error(
      `expected all visible: ${JSON.stringify({ shown, hidden })}`,
    );
  }
});

Deno.test("fitTagsOneLine collapses overflow to +N", () => {
  const tags = ["十七", "音声", "拠点", "メモ", "追加"];
  const { shown, hidden } = fitTagsOneLine(tags, 80);
  if (shown.length === 0) throw new Error("first tag should remain");
  if (hidden !== tags.length - shown.length || hidden < 1) {
    throw new Error(`expected +N: ${JSON.stringify({ shown, hidden })}`);
  }
  if (shown.some((name, i) => name !== tags[i])) {
    throw new Error("shown tags must keep order from the start");
  }
});
