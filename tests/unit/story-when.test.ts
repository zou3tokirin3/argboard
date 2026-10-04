import {
  appendEvent,
  createEmptyProject,
  parseProjectJson,
  viewThrough,
} from "../../ui/project.ts";
import { formatStoryWhenLabel, hasStoryWhen } from "../../ui/story-when.ts";

Deno.test("parseProjectJson roundtrips card.storyWhen and storyUntil", () => {
  const card = {
    id: "a",
    title: "目撃",
    foundAt: 10,
    storyWhen: "12:34",
    storyUntil: "20min",
  };
  let project = createEmptyProject("作中時間", 1);
  project = { ...project, cards: [card] };
  const parsed = parseProjectJson(JSON.stringify(project));
  if (parsed.cards[0]?.storyWhen !== "12:34") {
    throw new Error(
      `storyWhen must survive JSON: ${JSON.stringify(parsed.cards[0])}`,
    );
  }
  if (parsed.cards[0]?.storyUntil !== "20min") {
    throw new Error(
      `storyUntil must survive JSON: ${JSON.stringify(parsed.cards[0])}`,
    );
  }
});

Deno.test("card_added with storyWhen and storyUntil keeps them on replay", () => {
  const card = {
    id: "cap",
    title: "倉庫",
    foundAt: 10,
    storyWhen: "22:00",
    storyUntil: "翌2:00",
  };
  let project = createEmptyProject("キャプチャ作中時間", 1);
  project = appendEvent(project, { type: "card_added", at: 10, card });
  const viewed = viewThrough(project, 0);
  if (viewed.cards[0]?.storyWhen !== "22:00") {
    throw new Error(
      `capture storyWhen must replay: ${JSON.stringify(viewed.cards[0])}`,
    );
  }
  if (viewed.cards[0]?.storyUntil !== "翌2:00") {
    throw new Error(
      `capture storyUntil must replay: ${JSON.stringify(viewed.cards[0])}`,
    );
  }
});

Deno.test("viewThrough applies and clears storyUntil on card_updated", () => {
  const card = {
    id: "a",
    title: "A",
    foundAt: 10,
    storyWhen: "12:34",
  };
  let project = createEmptyProject("帯再生", 1);
  project = { ...project, cards: [card] };
  project = appendEvent(project, { type: "card_added", at: 10, card });
  project = appendEvent(project, {
    type: "card_updated",
    at: 20,
    cardId: "a",
    title: "A",
    storyUntil: "20min",
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
    storyUntil: "13:00",
  });
  project = appendEvent(project, {
    type: "card_updated",
    at: 50,
    cardId: "a",
    title: "A",
    body: "メモ",
    storyUntil: "",
  });

  const before = viewThrough(project, 0);
  if (before.cards[0]?.storyUntil) {
    throw new Error("storyUntil must be absent before set");
  }
  const set = viewThrough(project, 1);
  if (set.cards[0]?.storyUntil !== "20min") {
    throw new Error("storyUntil must apply");
  }
  if (set.cards[0]?.storyWhen !== "12:34") {
    throw new Error("storyWhen must stay when setting storyUntil");
  }
  const kept = viewThrough(project, 2);
  if (kept.cards[0]?.storyUntil !== "20min" || kept.cards[0]?.body !== "メモ") {
    throw new Error("body update must keep prior storyUntil");
  }
  const changed = viewThrough(project, 3);
  if (changed.cards[0]?.storyUntil !== "13:00") {
    throw new Error("storyUntil must update");
  }
  const cleared = viewThrough(project, 4);
  if (cleared.cards[0]?.storyUntil) {
    throw new Error("empty storyUntil must clear");
  }
  if (cleared.cards[0]?.storyWhen !== "12:34") {
    throw new Error("clearing storyUntil must keep storyWhen");
  }
  const rewind = viewThrough(project, 1);
  if (rewind.cards[0]?.storyUntil !== "20min" || rewind.cards[0]?.body) {
    throw new Error(
      "rewinding past clear must restore storyUntil without body",
    );
  }
});

Deno.test("hasStoryWhen and formatStoryWhenLabel cover point and span", () => {
  if (hasStoryWhen({})) {
    throw new Error("empty must be without");
  }
  if (!hasStoryWhen({ storyWhen: "12:34" })) {
    throw new Error("point must be with");
  }
  if (!hasStoryWhen({ storyUntil: "20min" })) {
    throw new Error("span-only must be with");
  }
  if (formatStoryWhenLabel({ storyWhen: "12:34" }) !== "12:34") {
    throw new Error("point label");
  }
  if (
    formatStoryWhenLabel({ storyWhen: "12:34", storyUntil: "20min" }) !==
      "12:34–20min"
  ) {
    throw new Error("span label");
  }
  if (formatStoryWhenLabel({ storyUntil: "2:00" }) !== "–2:00") {
    throw new Error("end-only label");
  }
});
