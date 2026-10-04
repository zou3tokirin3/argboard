import {
  appendEvent,
  createEmptyProject,
  parseProjectJson,
  viewThrough,
} from "../../ui/project.ts";

Deno.test("parseProjectJson roundtrips card.storyWhen", () => {
  const card = {
    id: "a",
    title: "目撃",
    foundAt: 10,
    storyWhen: "23:17",
  };
  let project = createEmptyProject("作中時間", 1);
  project = { ...project, cards: [card] };
  const parsed = parseProjectJson(JSON.stringify(project));
  if (parsed.cards[0]?.storyWhen !== "23:17") {
    throw new Error(
      `storyWhen must survive JSON: ${JSON.stringify(parsed.cards[0])}`,
    );
  }
});

Deno.test("viewThrough applies and clears storyWhen on card_updated", () => {
  const card = {
    id: "a",
    title: "A",
    foundAt: 10,
  };
  let project = createEmptyProject("作中時間再生", 1);
  project = { ...project, cards: [card] };
  project = appendEvent(project, { type: "card_added", at: 10, card });
  project = appendEvent(project, {
    type: "card_updated",
    at: 20,
    cardId: "a",
    title: "A",
    storyWhen: "夜",
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
    storyWhen: "Day3",
  });
  project = appendEvent(project, {
    type: "card_updated",
    at: 50,
    cardId: "a",
    title: "A",
    body: "メモ",
    storyWhen: "",
  });

  const before = viewThrough(project, 0);
  if (before.cards[0]?.storyWhen) {
    throw new Error("storyWhen must be absent before set");
  }
  const set = viewThrough(project, 1);
  if (set.cards[0]?.storyWhen !== "夜") {
    throw new Error("storyWhen must apply");
  }
  const kept = viewThrough(project, 2);
  if (kept.cards[0]?.storyWhen !== "夜" || kept.cards[0]?.body !== "メモ") {
    throw new Error("body update must keep prior storyWhen");
  }
  const changed = viewThrough(project, 3);
  if (changed.cards[0]?.storyWhen !== "Day3") {
    throw new Error("storyWhen must update");
  }
  const cleared = viewThrough(project, 4);
  if (cleared.cards[0]?.storyWhen) {
    throw new Error("empty storyWhen must clear");
  }
  const rewind = viewThrough(project, 1);
  if (rewind.cards[0]?.storyWhen !== "夜" || rewind.cards[0]?.body) {
    throw new Error("rewinding past clear must restore storyWhen without body");
  }
});
