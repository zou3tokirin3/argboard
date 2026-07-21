import {
  appendEvent,
  applyConnectCards,
  applyPlaceCardOnBoard,
  createEmptyProject,
  parseProjectJson,
} from "../../ui/project.ts";

Deno.test("appendEvent keeps schema version 1 and preserves older projects", () => {
  const base = createEmptyProject("ログ", 1);
  if (base.events !== undefined) {
    throw new Error("empty project should omit events");
  }
  const next = appendEvent(base, { type: "project_opened", at: 10 });
  if (next.version !== 1 || next.events?.length !== 1) {
    throw new Error("event append failed");
  }
  const parsed = parseProjectJson(JSON.stringify(base));
  if (parsed.events !== undefined) {
    throw new Error("legacy JSON without events must still parse");
  }
});

Deno.test("export/import roundtrip keeps events", () => {
  const a = crypto.randomUUID();
  let project = createEmptyProject("往復", 1);
  project = {
    ...project,
    cards: [{ id: a, title: "手がかり", foundAt: 1 }],
  };
  project = applyPlaceCardOnBoard(project, a, 12, 34)!;
  project = appendEvent(project, {
    type: "card_placed",
    at: 2,
    cardId: a,
    x: 12,
    y: 34,
  });
  const restored = parseProjectJson(JSON.stringify(project));
  if (JSON.stringify(restored.events) !== JSON.stringify(project.events)) {
    throw new Error("events must survive JSON roundtrip");
  }
});

Deno.test("card_removed snapshot can include cascaded links", () => {
  const a = crypto.randomUUID();
  const b = crypto.randomUUID();
  let project = createEmptyProject("削除", 1);
  project = {
    ...project,
    cards: [
      { id: a, title: "A", foundAt: 1 },
      { id: b, title: "B", foundAt: 2 },
    ],
  };
  project = applyPlaceCardOnBoard(project, a, 0, 0)!;
  project = applyPlaceCardOnBoard(project, b, 40, 0)!;
  project = applyConnectCards(project, a, b)!;
  const link = project.links[0]!;
  const event = {
    type: "card_removed" as const,
    at: 9,
    card: project.cards[0]!,
    links: [link],
    position: { x: 0, y: 0 },
  };
  project = appendEvent(project, event);
  const last = project.events?.at(-1);
  if (last?.type !== "card_removed" || last.links[0]?.id !== link.id) {
    throw new Error("removal snapshot missing link");
  }
});
