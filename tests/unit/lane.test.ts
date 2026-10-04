import { laneMemberCards } from "../../ui/project.ts";
import { sortLaneCards, storyWhenSortKey } from "../../ui/story-when.ts";
import type { Card, Link } from "../../ui/types.ts";

function card(
  id: string,
  title: string,
  patch: Partial<Card> = {},
): Card {
  return { id, title, foundAt: 1, ...patch };
}

Deno.test("laneMemberCards: 1-hop timed neighbors only", () => {
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
  const ids = laneMemberCards(links, cards, "person").map((item) => item.id)
    .toSorted();
  if (ids.join(",") !== "a") {
    throw new Error(`expected only timed 1-hop, got ${ids.join(",")}`);
  }
});

Deno.test("laneMemberCards: includes 2-hop via thought", () => {
  const cards = [
    card("person", "山田"),
    card("thought", "仮説", { role: "thought" }),
    card("event", "倉庫", { storyWhen: "22:00", storyUntil: "20min" }),
  ];
  const links: Pick<Link, "from" | "to">[] = [
    { from: "person", to: "thought" },
    { from: "thought", to: "event" },
  ];
  const ids = laneMemberCards(links, cards, "person").map((item) => item.id);
  if (ids.join(",") !== "event") {
    throw new Error(`expected thought-mediated event, got ${ids.join(",")}`);
  }
});

Deno.test("laneMemberCards: 2-hop via finding is not enough", () => {
  const cards = [
    card("person", "山田"),
    card("mid", "中継"),
    card("event", "屋上", { storyWhen: "夜" }),
  ];
  const links: Pick<Link, "from" | "to">[] = [
    { from: "person", to: "mid" },
    { from: "mid", to: "event" },
  ];
  if (laneMemberCards(links, cards, "person").length !== 0) {
    throw new Error("finding-mediated 2-hop must stay out");
  }
});

Deno.test("sortLaneCards: clock times before label-only", () => {
  const sorted = sortLaneCards([
    card("night", "屋上", { storyWhen: "夜" }),
    card("late", "短波", { storyWhen: "23:17" }),
    card("early", "倉庫", { storyWhen: "12:34", storyUntil: "20min" }),
  ]).map((item) => item.id);
  if (sorted.join(",") !== "early,late,night") {
    throw new Error(`bad order: ${sorted.join(",")}`);
  }
});

Deno.test("storyWhenSortKey reads first clock-like token", () => {
  if (
    storyWhenSortKey(card("a", "A", { storyWhen: "23:17" })) !== 23 * 60 + 17
  ) {
    throw new Error("point key");
  }
  if (storyWhenSortKey(card("c", "C", { storyWhen: "夜" })) != null) {
    throw new Error("label-only must be null");
  }
});
