import { NODE_DIMS, nodeDims, normalizeCardSize } from "../../ui/node-size.ts";
import {
  appendEvent,
  createEmptyProject,
  parseProjectJson,
  viewThrough,
} from "../../ui/project.ts";

Deno.test("nodeDims defaults omitted size to medium (pre-T022)", () => {
  const m = nodeDims(undefined);
  if (m.w !== 235 || m.h !== 128) {
    throw new Error(`expected medium 235x128, got ${m.w}x${m.h}`);
  }
  if (normalizeCardSize(undefined) !== "m" || normalizeCardSize("m") !== "m") {
    throw new Error("normalizeCardSize must treat omit/m as medium");
  }
  const l = nodeDims({ size: "l" });
  if (l.w <= m.w || l.h <= m.h) {
    throw new Error("large must be bigger than medium on both axes");
  }
  if (NODE_DIMS.l.contentH <= NODE_DIMS.m.contentH) {
    throw new Error("large content area must grow with height");
  }
});

Deno.test("parseProjectJson roundtrips card.size", () => {
  let project = createEmptyProject("サイズ", 1);
  const card = {
    id: "c1",
    title: "大カード",
    size: "l" as const,
    foundAt: 10,
  };
  project = { ...project, cards: [card] };
  const parsed = parseProjectJson(JSON.stringify(project));
  if (parsed.cards[0]?.size !== "l") {
    throw new Error(
      `size must survive JSON: ${JSON.stringify(parsed.cards[0])}`,
    );
  }
});

Deno.test("viewThrough applies and rewinds card size on card_updated", () => {
  const card = { id: "a", title: "A", foundAt: 10 };
  let project = createEmptyProject("サイズ再生", 1);
  project = { ...project, cards: [card] };
  project = appendEvent(project, { type: "card_added", at: 10, card });
  project = appendEvent(project, {
    type: "card_updated",
    at: 20,
    cardId: "a",
    title: "A",
    size: "l",
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
    size: "",
  });

  const before = viewThrough(project, 0);
  if (before.cards[0]?.size) {
    throw new Error("size must be absent before size event");
  }
  const large = viewThrough(project, 1);
  if (large.cards[0]?.size !== "l") {
    throw new Error("size l must apply");
  }
  const kept = viewThrough(project, 2);
  if (kept.cards[0]?.size !== "l" || kept.cards[0]?.body !== "メモ") {
    throw new Error("title/body update must keep prior size");
  }
  const cleared = viewThrough(project, 3);
  if (cleared.cards[0]?.size) {
    throw new Error("empty size must clear to default");
  }
  const rewind = viewThrough(project, 1);
  if (rewind.cards[0]?.size !== "l" || rewind.cards[0]?.body) {
    throw new Error("rewinding past clear must restore large without body");
  }
});
