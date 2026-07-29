import {
  appendEvent,
  createEmptyProject,
  parseProjectJson,
  viewThrough,
} from "../../ui/project.ts";

Deno.test("parseProjectJson roundtrips card.role", () => {
  let project = createEmptyProject("種別", 1);
  const finding = { id: "f1", title: "発見", foundAt: 10 };
  const thought = {
    id: "t1",
    title: "考察",
    role: "thought" as const,
    foundAt: 20,
  };
  project = { ...project, cards: [finding, thought] };
  const parsed = parseProjectJson(JSON.stringify(project));
  if (parsed.cards[0]?.role) {
    throw new Error("finding must omit role on disk");
  }
  if (parsed.cards[1]?.role !== "thought") {
    throw new Error(
      `thought role must survive JSON: ${JSON.stringify(parsed.cards[1])}`,
    );
  }
});

Deno.test("viewThrough applies and rewinds card role on card_updated", () => {
  const card = { id: "a", title: "A", foundAt: 10 };
  let project = createEmptyProject("種別再生", 1);
  project = { ...project, cards: [card] };
  project = appendEvent(project, { type: "card_added", at: 10, card });
  project = appendEvent(project, {
    type: "card_updated",
    at: 20,
    cardId: "a",
    title: "A",
    role: "thought",
  });
  project = appendEvent(project, {
    type: "card_updated",
    at: 30,
    cardId: "a",
    title: "A",
    body: "メモ",
  });
  project = appendEvent(project, {
    type: "card_updated",
    at: 40,
    cardId: "a",
    title: "A",
    body: "メモ",
    role: "",
  });

  const before = viewThrough(project, 0);
  if (before.cards[0]?.role) {
    throw new Error("role must be absent before role event");
  }
  const thought = viewThrough(project, 1);
  if (thought.cards[0]?.role !== "thought") {
    throw new Error("role thought must apply");
  }
  const kept = viewThrough(project, 2);
  if (kept.cards[0]?.role !== "thought" || kept.cards[0]?.body !== "メモ") {
    throw new Error("body update must keep prior role");
  }
  const cleared = viewThrough(project, 3);
  if (cleared.cards[0]?.role) {
    throw new Error("empty role must clear to finding");
  }
  const rewind = viewThrough(project, 1);
  if (rewind.cards[0]?.role !== "thought" || rewind.cards[0]?.body) {
    throw new Error("rewinding past clear must restore thought without body");
  }
});
