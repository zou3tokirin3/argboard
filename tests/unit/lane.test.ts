import { laneMemberCards } from "../../ui/project.ts";
import {
  sortLaneCards,
  storyOrderSuspicious,
  storyWhenSortKey,
} from "../../ui/story-when.ts";
import type { Card, Link } from "../../ui/types.ts";

function card(
  id: string,
  title: string,
  patch: Partial<Card> = {},
): Card {
  return { id, title, foundAt: 1, ...patch };
}

Deno.test("laneMemberCards: n-hop timed cards only", () => {
  const cards = [
    card("person", "山田"),
    card("a", "短波", { storyWhen: "23:17" }),
    card("b", "メモ"),
    card("far", "遠い", { storyWhen: "01:00" }),
  ];
  const links: Pick<Link, "from" | "to">[] = [
    { from: "person", to: "a" },
    { from: "person", to: "b" },
    { from: "b", to: "far" },
  ];
  const one = laneMemberCards(links, cards, "person", 1).map((c) => c.id)
    .toSorted();
  if (one.join(",") !== "a") {
    throw new Error(`1 hop: ${one.join(",")}`);
  }
  const two = laneMemberCards(links, cards, "person", 2).map((c) => c.id)
    .toSorted();
  if (two.join(",") !== "a,far") {
    throw new Error(`2 hop: ${two.join(",")}`);
  }
});

Deno.test("laneMemberCards: excludes origin", () => {
  const cards = [
    card("person", "山田", { storyWhen: "12:00" }),
    card("a", "短波", { storyWhen: "23:17" }),
  ];
  const links: Pick<Link, "from" | "to">[] = [
    { from: "person", to: "a" },
  ];
  const ids = laneMemberCards(links, cards, "person", 1).map((c) => c.id);
  if (ids.join(",") !== "a") {
    throw new Error(`origin must be excluded: ${ids.join(",")}`);
  }
});

Deno.test("sortLaneCards: night-aware clock then buckets", () => {
  const sorted = sortLaneCards([
    card("night", "屋上", { storyWhen: "夜" }),
    card("early", "終電後", { storyWhen: "1:05" }),
    card("late", "短波", { storyWhen: "23:17" }),
    card("eve", "ロッカー", { storyWhen: "22:40" }),
  ]).map((item) => item.id);
  if (sorted.join(",") !== "eve,late,early,night") {
    throw new Error(`bad order: ${sorted.join(",")}`);
  }
});

Deno.test("storyOrderSuspicious marks early-morning clock-only", () => {
  const cards = [
    card("eve", "ロッカー", { storyWhen: "22:40" }),
    card("late", "短波", { storyWhen: "23:17" }),
    card("early", "終電後", { storyWhen: "1:05" }),
    card("night", "屋上", { storyWhen: "夜" }),
  ];
  const sorted = sortLaneCards(cards);
  const flags = storyOrderSuspicious(sorted);
  const earlyIdx = sorted.findIndex((c) => c.id === "early");
  const nightIdx = sorted.findIndex((c) => c.id === "night");
  if (!flags[earlyIdx]) throw new Error("1:05 should be flagged");
  if (!flags[nightIdx]) throw new Error("bucket after clock should be flagged");
});

Deno.test("story-chrono desc reverses sortLaneCards; flags follow display", () => {
  const cards = [
    card("eve", "ロッカー", { storyWhen: "22:40" }),
    card("late", "短波", { storyWhen: "23:17" }),
    card("early", "終電後", { storyWhen: "1:05" }),
    card("night", "屋上", { storyWhen: "夜" }),
  ];
  const ascending = sortLaneCards(cards);
  const descending = ascending.toReversed();
  if (descending.map((c) => c.id).join(",") !== "night,early,late,eve") {
    throw new Error(`bad desc: ${descending.map((c) => c.id).join(",")}`);
  }
  const flags = storyOrderSuspicious(descending);
  const earlyIdx = descending.findIndex((c) => c.id === "early");
  const nightIdx = descending.findIndex((c) => c.id === "night");
  if (!flags[earlyIdx]) throw new Error("1:05 should stay flagged in desc");
  // In desc, night (bucket) is above early (clock) — not a clock→bucket edge.
  if (flags[nightIdx]) {
    throw new Error("bucket-first in desc must not use asc adjacency flag");
  }
});

Deno.test("storyWhenSortKey reads day and clock", () => {
  const key = storyWhenSortKey({ storyWhen: "3/1 23:17" });
  if (key.kind !== "clock" || key.day == null || key.minute !== 23 * 60 + 17) {
    throw new Error(`unexpected key ${JSON.stringify(key)}`);
  }
});
