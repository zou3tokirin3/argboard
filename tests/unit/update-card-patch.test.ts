import { test } from "node:test";
import {
  appendEvent,
  createEmptyProject,
  viewThrough,
} from "../../ui/project.ts";

test("viewThrough keeps body and url when card_updated changes title only", () => {
  const card = {
    id: "a",
    title: "旧タイトル",
    body: "本文メモ",
    url: "https://example.com",
    foundAt: 10,
  };
  let project = createEmptyProject("部分更新", 1);
  project = { ...project, cards: [card] };
  project = appendEvent(project, { type: "card_added", at: 10, card });
  project = appendEvent(project, {
    type: "card_updated",
    at: 20,
    cardId: "a",
    title: "新タイトル",
  });

  const viewed = viewThrough(project, 1);
  const next = viewed.cards[0];
  if (next?.title !== "新タイトル") {
    throw new Error(`title not updated: ${JSON.stringify(next)}`);
  }
  if (next?.body !== "本文メモ" || next?.url !== "https://example.com") {
    throw new Error(
      `untouched fields were overwritten: ${JSON.stringify(next)}`,
    );
  }
});

test("viewThrough keeps title when card_updated changes body only", () => {
  const card = {
    id: "a",
    title: "固定タイトル",
    body: "旧本文",
    foundAt: 10,
  };
  let project = createEmptyProject("部分更新", 1);
  project = { ...project, cards: [card] };
  project = appendEvent(project, { type: "card_added", at: 10, card });
  project = appendEvent(project, {
    type: "card_updated",
    at: 20,
    cardId: "a",
    body: "新本文",
  });

  const viewed = viewThrough(project, 1);
  const next = viewed.cards[0];
  if (next?.title !== "固定タイトル" || next?.body !== "新本文") {
    throw new Error(`partial body update failed: ${JSON.stringify(next)}`);
  }
});
