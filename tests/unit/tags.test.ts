import {
  attachTag,
  buildTagSuggestions,
  collectTagUsage,
  detachTag,
  normalizeTag,
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
