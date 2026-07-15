import {
  applyConnectCards,
  applyPlaceCardOnBoard,
  applySetBoardViewport,
  applyUpdateLink,
  createEmptyProject,
} from "../../ui/project.ts";

Deno.test("applyPlaceCardOnBoard adds a card and position", () => {
  let project = createEmptyProject("ボード", 1);
  const cardId = crypto.randomUUID();
  project = {
    ...project,
    cards: [{ id: cardId, title: "手がかり", foundAt: 1 }],
  };
  const next = applyPlaceCardOnBoard(project, cardId, 40, 80);
  if (!next) throw new Error("place should succeed");
  if (!next.boards[0]?.cardIds.includes(cardId)) {
    throw new Error("card was not placed on board");
  }
  if (next.boards[0]?.positions[cardId]?.x !== 40) {
    throw new Error("position x mismatch");
  }
});

Deno.test("applyPlaceCardOnBoard rejects unknown cards", () => {
  const project = createEmptyProject("ボード", 1);
  const next = applyPlaceCardOnBoard(project, "missing", 0, 0);
  if (next !== null) throw new Error("unknown card must be rejected");
});

Deno.test("applyConnectCards creates connects link once", () => {
  const a = crypto.randomUUID();
  const b = crypto.randomUUID();
  let project = createEmptyProject("ボード", 1);
  project = {
    ...project,
    cards: [
      { id: a, title: "A", foundAt: 1 },
      { id: b, title: "B", foundAt: 2 },
    ],
  };
  project = applyPlaceCardOnBoard(project, a, 0, 0)!;
  project = applyPlaceCardOnBoard(project, b, 100, 0)!;
  const linked = applyConnectCards(project, a, b);
  if (!linked || linked.links.length !== 1) {
    throw new Error("expected one link");
  }
  if (linked.links[0]?.kind !== "connects") {
    throw new Error("default kind must be connects");
  }
  const dup = applyConnectCards(linked, a, b);
  if (dup !== null) throw new Error("duplicate link must be rejected");
});

Deno.test("applyUpdateLink sets label and kind", () => {
  const a = crypto.randomUUID();
  const b = crypto.randomUUID();
  let project = createEmptyProject("ボード", 1);
  project = {
    ...project,
    cards: [
      { id: a, title: "A", foundAt: 1 },
      { id: b, title: "B", foundAt: 2 },
    ],
  };
  project = applyPlaceCardOnBoard(project, a, 0, 0)!;
  project = applyPlaceCardOnBoard(project, b, 100, 0)!;
  project = applyConnectCards(project, a, b)!;
  const linkId = project.links[0]!.id;
  const labeled = applyUpdateLink(project, linkId, {
    label: "同一人物?",
    kind: "contradicts",
  });
  if (!labeled) throw new Error("update failed");
  if (labeled.links[0]?.label !== "同一人物?") {
    throw new Error("label not applied");
  }
  if (labeled.links[0]?.kind !== "contradicts") {
    throw new Error("kind not applied");
  }
  const resolved = applyUpdateLink(labeled, linkId, { kind: "connects" });
  if (!resolved) throw new Error("resolve failed");
  if (resolved.links[0]?.kind !== "connects") {
    throw new Error("kind not restored to connects");
  }
  if (resolved.links[0]?.label !== "同一人物?") {
    throw new Error("label must remain after kind restore");
  }
});

Deno.test("applySetBoardViewport stores pan/zoom", () => {
  const project = createEmptyProject("ボード", 1);
  const next = applySetBoardViewport(project, { x: 12, y: -4, zoom: 1.25 });
  const viewport = next.boards[0]?.viewport;
  if (!viewport || viewport.zoom !== 1.25 || viewport.x !== 12) {
    throw new Error("viewport not stored");
  }
});
