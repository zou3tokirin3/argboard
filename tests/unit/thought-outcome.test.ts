import {
  appendEvent,
  createEmptyProject,
  parseProjectJson,
  viewThrough,
} from "../../ui/project.ts";

Deno.test("parseProjectJson roundtrips card.outcome on thought cards", () => {
  const thought = {
    id: "t1",
    title: "仮説",
    role: "thought" as const,
    outcome: "open" as const,
    foundAt: 20,
  };
  let project = createEmptyProject("成否", 1);
  project = { ...project, cards: [thought] };
  const parsed = parseProjectJson(JSON.stringify(project));
  if (parsed.cards[0]?.outcome !== "open") {
    throw new Error(
      `outcome must survive JSON: ${JSON.stringify(parsed.cards[0])}`,
    );
  }
});

Deno.test("viewThrough applies and rewinds card outcome on card_updated", () => {
  const card = {
    id: "a",
    title: "A",
    role: "thought" as const,
    foundAt: 10,
  };
  let project = createEmptyProject("成否再生", 1);
  project = { ...project, cards: [card] };
  project = appendEvent(project, { type: "card_added", at: 10, card });
  project = appendEvent(project, {
    type: "card_updated",
    at: 20,
    cardId: "a",
    title: "A",
    outcome: "open",
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
    outcome: "held",
  });
  project = appendEvent(project, {
    type: "card_updated",
    at: 50,
    cardId: "a",
    title: "A",
    body: "メモ",
    outcome: "",
  });

  const before = viewThrough(project, 0);
  if (before.cards[0]?.outcome) {
    throw new Error("outcome must be absent before outcome event");
  }
  const open = viewThrough(project, 1);
  if (open.cards[0]?.outcome !== "open") {
    throw new Error("outcome open must apply");
  }
  const kept = viewThrough(project, 2);
  if (kept.cards[0]?.outcome !== "open" || kept.cards[0]?.body !== "メモ") {
    throw new Error("body update must keep prior outcome");
  }
  const held = viewThrough(project, 3);
  if (held.cards[0]?.outcome !== "held") {
    throw new Error("outcome held must apply");
  }
  const cleared = viewThrough(project, 4);
  if (cleared.cards[0]?.outcome) {
    throw new Error("empty outcome must clear");
  }
  const rewind = viewThrough(project, 1);
  if (rewind.cards[0]?.outcome !== "open" || rewind.cards[0]?.body) {
    throw new Error("rewinding past clear must restore open without body");
  }
});

Deno.test("viewThrough clears outcome when role reverts to finding", () => {
  const card = {
    id: "a",
    title: "A",
    role: "thought" as const,
    outcome: "open" as const,
    foundAt: 10,
  };
  let project = createEmptyProject("種別成否", 1);
  project = { ...project, cards: [card] };
  project = appendEvent(project, { type: "card_added", at: 10, card });
  project = appendEvent(project, {
    type: "card_updated",
    at: 20,
    cardId: "a",
    title: "A",
    role: "",
    outcome: "",
  });

  const cleared = viewThrough(project, 1);
  if (cleared.cards[0]?.role || cleared.cards[0]?.outcome) {
    throw new Error("finding must drop role and outcome");
  }
});
