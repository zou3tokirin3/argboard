import {
  appendEvent,
  applyConnectCards,
  applyPlaceCardOnBoard,
  applyRemoveCard,
  applyUpdateLink,
  createEmptyProject,
  replaySteps,
  viewAt,
} from "../../ui/project.ts";

Deno.test("viewAt stage1 filters by foundAt/createdAt with current positions", () => {
  const a = "a";
  const b = "b";
  let project = createEmptyProject("再生", 1);
  project = {
    ...project,
    cards: [
      { id: a, title: "早い", foundAt: 10 },
      { id: b, title: "遅い", foundAt: 50 },
    ],
  };
  project = applyPlaceCardOnBoard(project, a, 1, 2)!;
  project = applyPlaceCardOnBoard(project, b, 3, 4)!;
  project = applyConnectCards(project, a, b)!;
  project = {
    ...project,
    links: project.links.map((link) => ({ ...link, createdAt: 40 })),
  };

  const early = viewAt(project, 30);
  if (early.cards.length !== 1 || early.cards[0]?.id !== a) {
    throw new Error("only early card should remain");
  }
  if (early.links.length !== 0) {
    throw new Error("link created later must be hidden");
  }
  if (early.positions[a]?.x !== 1 || early.cardIds.includes(b)) {
    throw new Error("positions/cardIds must match stage1 filter");
  }

  const mid = viewAt(project, 45);
  if (mid.cards.length !== 1 || mid.links.length !== 0) {
    throw new Error("link without both card ends must drop");
  }
  const late = viewAt(project, 60);
  if (late.cards.length !== 2 || late.links.length !== 1) {
    throw new Error("both cards and link should appear at the end");
  }
});

Deno.test("viewAt stage2 replays place, kind, and removal snapshots", () => {
  const a = "a";
  const b = "b";
  let project = createEmptyProject("忠実", 1);
  const cardA = { id: a, title: "A", foundAt: 10 };
  const cardB = { id: b, title: "B", foundAt: 20 };
  project = { ...project, cards: [cardA, cardB] };
  project = appendEvent(project, { type: "card_added", at: 10, card: cardA });
  project = appendEvent(project, { type: "card_added", at: 20, card: cardB });
  project = applyPlaceCardOnBoard(project, a, 0, 0)!;
  project = appendEvent(project, {
    type: "card_placed",
    at: 11,
    cardId: a,
    x: 0,
    y: 0,
  });
  project = applyPlaceCardOnBoard(project, b, 100, 0)!;
  project = appendEvent(project, {
    type: "card_placed",
    at: 21,
    cardId: b,
    x: 100,
    y: 0,
  });
  project = applyConnectCards(project, a, b)!;
  const link = project.links[0]!;
  project = appendEvent(project, {
    type: "link_added",
    at: 22,
    link: { ...link, createdAt: 22 },
  });
  project = {
    ...project,
    links: project.links.map((item) =>
      item.id === link.id ? { ...item, createdAt: 22 } : item
    ),
  };
  project = applyUpdateLink(project, link.id, { kind: "contradicts" })!;
  project = appendEvent(project, {
    type: "link_updated",
    at: 30,
    linkId: link.id,
    kind: "contradicts",
  });
  project = applyPlaceCardOnBoard(project, a, 50, 50)!;
  project = appendEvent(project, {
    type: "card_placed",
    at: 40,
    cardId: a,
    x: 50,
    y: 50,
  });

  const beforeMove = viewAt(project, 25);
  if (beforeMove.positions[a]?.x !== 0) {
    throw new Error("placement before later move must win at earlier at");
  }
  if (beforeMove.links[0]?.kind !== "connects") {
    throw new Error("kind update after at must not apply");
  }

  const afterKind = viewAt(project, 35);
  if (afterKind.links[0]?.kind !== "contradicts") {
    throw new Error("kind update must apply");
  }

  const removedLinks = project.links.filter((item) =>
    item.from === b || item.to === b
  );
  const removedPos = project.boards[0]!.positions[b]!;
  project = applyRemoveCard(project, b)!;
  project = appendEvent(project, {
    type: "card_removed",
    at: 50,
    card: cardB,
    links: removedLinks,
    position: removedPos,
  });

  const beforeRemove = viewAt(project, 45);
  if (beforeRemove.cards.length !== 2 || beforeRemove.links.length !== 1) {
    throw new Error("removed-later card must resurrect for earlier at");
  }
  const afterRemove = viewAt(project, 60);
  if (
    afterRemove.cards.length !== 1 || afterRemove.cards[0]?.id !== a ||
    afterRemove.links.length !== 0
  ) {
    throw new Error("removal at must hide card and cascaded links");
  }
});

Deno.test("replaySteps are discrete execution units, not a time continuum", () => {
  const a = "a";
  const b = "b";
  let project = createEmptyProject("ステップ", 1);
  const cardA = { id: a, title: "A", foundAt: 10 };
  const cardB = { id: b, title: "B", foundAt: 20 };
  project = { ...project, cards: [cardA, cardB] };
  project = appendEvent(project, { type: "card_added", at: 10, card: cardA });
  project = appendEvent(project, { type: "card_added", at: 20, card: cardB });
  project = applyPlaceCardOnBoard(project, a, 0, 0)!;
  project = appendEvent(project, {
    type: "card_placed",
    at: 11,
    cardId: a,
    x: 0,
    y: 0,
  });
  project = appendEvent(project, {
    type: "project_opened",
    at: 5,
  });
  project = appendEvent(project, {
    type: "card_updated",
    at: 15,
    cardId: a,
    title: "A'",
  });

  const steps = replaySteps(project);
  if (steps.length !== 4) {
    throw new Error(`expected 4 growth steps, got ${steps.length}`);
  }
  if (
    steps[0]?.label !== "追加 · A" || steps[1]?.label !== "配置 · A" ||
    steps[2]?.label !== "編集 · A'" || steps[3]?.label !== "追加 · B"
  ) {
    throw new Error(`unexpected step labels: ${steps.map((s) => s.label)}`);
  }
});

Deno.test("replaySteps include link connect and label edits", () => {
  const a = "a";
  const b = "b";
  let project = createEmptyProject("糸", 1);
  const cardA = { id: a, title: "A", foundAt: 1 };
  const cardB = { id: b, title: "B", foundAt: 2 };
  project = { ...project, cards: [cardA, cardB] };
  project = appendEvent(project, { type: "card_added", at: 1, card: cardA });
  project = appendEvent(project, { type: "card_added", at: 2, card: cardB });
  project = applyPlaceCardOnBoard(project, a, 0, 0)!;
  project = applyPlaceCardOnBoard(project, b, 40, 0)!;
  project = applyConnectCards(project, a, b)!;
  const link = project.links[0]!;
  project = appendEvent(project, {
    type: "link_added",
    at: 3,
    link: { ...link, createdAt: 3 },
  });
  project = appendEvent(project, {
    type: "link_updated",
    at: 4,
    linkId: link.id,
    label: "同一人物？",
    kind: "connects",
  });

  const steps = replaySteps(project);
  const labels = steps.map((step) => step.label);
  if (!labels.includes("糸 · 接続")) {
    throw new Error(`missing link connect step: ${labels}`);
  }
  if (!labels.includes("糸 · 同一人物？")) {
    throw new Error(`missing link label step: ${labels}`);
  }
});
