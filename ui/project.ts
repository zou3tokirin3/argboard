import type { Board, Card, Link, Project, ProjectEvent } from "./types.ts";

export function appendEvent(
  project: Project,
  event: ProjectEvent,
): Project {
  return { ...project, events: [...(project.events ?? []), event] };
}

/** Board/stream slice at a point in time (T025). Does not mutate `project`. */
export type ProjectSlice = {
  cards: Card[];
  links: Link[];
  cardIds: string[];
  positions: Record<string, { x: number; y: number }>;
};

/**
 * Hybrid replay: pre-log entities via foundAt/createdAt (current positions);
 * events period replays add/update/remove/place/kind.
 */
export function viewAt(project: Project, at: number): ProjectSlice {
  const events = project.events ?? [];
  const cardsWithAdded = new Set<string>();
  const linksWithAdded = new Set<string>();
  for (const event of events) {
    if (event.type === "card_added") cardsWithAdded.add(event.card.id);
    if (event.type === "link_added") linksWithAdded.add(event.link.id);
  }

  const cards = new Map<string, Card>();
  const links = new Map<string, Link>();
  const positions: Record<string, { x: number; y: number }> = {};
  const cardIds = new Set<string>();
  const board = project.boards[0];

  for (const card of project.cards) {
    if (card.foundAt <= at && !cardsWithAdded.has(card.id)) {
      cards.set(card.id, card);
    }
  }
  for (const link of project.links) {
    if (link.createdAt <= at && !linksWithAdded.has(link.id)) {
      links.set(link.id, link);
    }
  }
  for (const event of events) {
    if (event.type === "card_removed" && event.at > at) {
      if (event.card.foundAt <= at && !cardsWithAdded.has(event.card.id)) {
        cards.set(event.card.id, event.card);
        if (event.position) {
          positions[event.card.id] = event.position;
          cardIds.add(event.card.id);
        }
      }
      for (const link of event.links) {
        if (link.createdAt <= at && !linksWithAdded.has(link.id)) {
          links.set(link.id, link);
        }
      }
    }
    if (
      event.type === "link_removed" && event.at > at &&
      event.link.createdAt <= at && !linksWithAdded.has(event.link.id)
    ) {
      links.set(event.link.id, event.link);
    }
  }
  if (board) {
    for (const id of board.cardIds) {
      if (!cards.has(id)) continue;
      cardIds.add(id);
      const pos = board.positions[id];
      if (pos) positions[id] = pos;
    }
    for (const [id, pos] of Object.entries(board.positions)) {
      if (cards.has(id)) positions[id] = pos;
    }
  }

  const chron = events
    .filter((event) => event.at <= at)
    .toSorted((left, right) => left.at - right.at);
  for (const event of chron) {
    switch (event.type) {
      case "project_opened":
        break;
      case "card_added":
        cards.set(event.card.id, event.card);
        break;
      case "card_updated": {
        const prev = cards.get(event.cardId);
        if (!prev) break;
        cards.set(event.cardId, {
          ...prev,
          title: event.title,
          body: event.body,
          url: event.url,
        });
        break;
      }
      case "card_removed":
        cards.delete(event.card.id);
        cardIds.delete(event.card.id);
        delete positions[event.card.id];
        for (const link of event.links) links.delete(link.id);
        for (const [linkId, link] of links) {
          if (link.from === event.card.id || link.to === event.card.id) {
            links.delete(linkId);
          }
        }
        break;
      case "link_added":
        links.set(event.link.id, event.link);
        break;
      case "link_updated": {
        const prev = links.get(event.linkId);
        if (!prev) break;
        links.set(event.linkId, {
          ...prev,
          label: event.label,
          kind: event.kind,
        });
        break;
      }
      case "link_removed":
        links.delete(event.link.id);
        break;
      case "card_placed":
        if (!cards.has(event.cardId)) break;
        positions[event.cardId] = { x: event.x, y: event.y };
        cardIds.add(event.cardId);
        break;
    }
  }

  for (const [linkId, link] of [...links]) {
    if (!cards.has(link.from) || !cards.has(link.to)) links.delete(linkId);
  }
  for (const id of [...cardIds]) {
    if (!cards.has(id)) cardIds.delete(id);
  }

  return {
    cards: [...cards.values()],
    links: [...links.values()],
    cardIds: [...cardIds],
    positions,
  };
}

/** One discrete growth beat for step replay (T025). */
export type ReplayStep = {
  at: number;
  label: string;
};

function titleForCard(project: Project, cardId: string): string {
  const living = project.cards.find((card) => card.id === cardId);
  if (living) return living.title;
  for (const event of project.events ?? []) {
    if (event.type === "card_added" && event.card.id === cardId) {
      return event.card.title;
    }
    if (event.type === "card_removed" && event.card.id === cardId) {
      return event.card.title;
    }
  }
  return "カード";
}

function labelForEvent(project: Project, event: ProjectEvent): string | null {
  switch (event.type) {
    case "project_opened":
      return null;
    case "card_added":
      return `追加 · ${event.card.title}`;
    case "card_updated":
      return `編集 · ${event.title}`;
    case "card_removed":
      return `削除 · ${event.card.title}`;
    case "card_placed":
      return `配置 · ${titleForCard(project, event.cardId)}`;
    case "link_added": {
      const tip = event.link.label?.trim();
      if (tip) return `糸 · ${tip}`;
      return event.link.kind === "contradicts" ? "糸 · 要検討" : "糸 · 接続";
    }
    case "link_updated": {
      const tip = event.label?.trim();
      if (tip) return `糸 · ${tip}`;
      return event.kind === "contradicts" ? "糸 · 要検討" : "糸 · 通常";
    }
    case "link_removed":
      return "糸 · 削除";
  }
}

/**
 * Discrete execution units for the replay bar.
 * Prefers T024 events; falls back to foundAt/createdAt for pre-log entities.
 */
export function replaySteps(project: Project): ReplayStep[] {
  const events = project.events ?? [];
  const cardsWithAdded = new Set<string>();
  const linksWithAdded = new Set<string>();
  for (const event of events) {
    if (event.type === "card_added") cardsWithAdded.add(event.card.id);
    if (event.type === "link_added") linksWithAdded.add(event.link.id);
  }

  const steps: ReplayStep[] = [];
  for (const event of events) {
    const label = labelForEvent(project, event);
    if (label) steps.push({ at: event.at, label });
  }

  for (const card of project.cards) {
    if (cardsWithAdded.has(card.id)) continue;
    steps.push({ at: card.foundAt, label: `発見 · ${card.title}` });
  }
  for (const event of events) {
    if (event.type !== "card_removed" || cardsWithAdded.has(event.card.id)) {
      continue;
    }
    steps.push({
      at: event.card.foundAt,
      label: `発見 · ${event.card.title}`,
    });
  }
  for (const link of project.links) {
    if (linksWithAdded.has(link.id)) continue;
    steps.push({
      at: link.createdAt,
      label: link.kind === "contradicts" ? "糸 · 要検討" : "糸 · 接続",
    });
  }
  for (const event of events) {
    if (event.type !== "link_removed" || linksWithAdded.has(event.link.id)) {
      continue;
    }
    steps.push({
      at: event.link.createdAt,
      label: event.link.kind === "contradicts" ? "糸 · 要検討" : "糸 · 接続",
    });
  }

  return steps.toSorted((left, right) => left.at - right.at);
}

export function createEmptyProject(
  name: string,
  now = Date.now(),
): Project {
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: name.trim() || "新しいケース",
    createdAt: now,
    cards: [],
    links: [],
    boards: [{
      id: "main-board",
      name: "メインボード",
      cardIds: [],
      positions: {},
    }],
    ui: { mode: "explore", sideOpen: false },
  };
}

/** Undirected BFS from startId up to `hops` link steps (includes start). */
export function reachableCardIds(
  links: readonly Pick<Link, "from" | "to">[],
  startId: string,
  hops: number,
): Set<string> {
  const reached = new Set<string>([startId]);
  if (hops <= 0) return reached;
  const adj = new Map<string, string[]>();
  for (const link of links) {
    const from = adj.get(link.from) ?? [];
    from.push(link.to);
    adj.set(link.from, from);
    const to = adj.get(link.to) ?? [];
    to.push(link.from);
    adj.set(link.to, to);
  }
  let frontier = [startId];
  for (let depth = 0; depth < hops; depth += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of adj.get(id) ?? []) {
        if (reached.has(neighbor)) continue;
        reached.add(neighbor);
        next.push(neighbor);
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return reached;
}

export function parseProjectJson(text: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("JSONとして読めません");
  }
  const p = data as Partial<Project>;
  if (
    typeof data !== "object" || !data || p.version !== 1 ||
    typeof p.id !== "string" || typeof p.name !== "string" ||
    typeof p.createdAt !== "number" || !Array.isArray(p.cards) ||
    !Array.isArray(p.links) || !Array.isArray(p.boards)
  ) throw new Error("未対応の形式か version です");
  return data as Project;
}

function withMainBoard(
  project: Project,
  update: (board: Board) => Board,
): Project {
  const board = project.boards[0];
  if (!board) return project;
  return { ...project, boards: [update(board), ...project.boards.slice(1)] };
}

/** Place or move a card on the main board. Returns null if the card is unknown. */
export function applyPlaceCardOnBoard(
  project: Project,
  cardId: string,
  x: number,
  y: number,
): Project | null {
  if (!project.cards.some((card) => card.id === cardId)) return null;
  return withMainBoard(project, (board) => ({
    ...board,
    cardIds: board.cardIds.includes(cardId)
      ? board.cardIds
      : [...board.cardIds, cardId],
    positions: { ...board.positions, [cardId]: { x, y } },
  }));
}

/** Create a link between two board cards. Returns null when invalid / duplicate. */
export function applyConnectCards(
  project: Project,
  fromId: string,
  toId: string,
  kind: Link["kind"] = "connects",
): Project | null {
  if (fromId === toId) return null;
  const board = project.boards[0];
  if (!board?.cardIds.includes(fromId) || !board.cardIds.includes(toId)) {
    return null;
  }
  if (
    project.links.some((link) => link.from === fromId && link.to === toId)
  ) {
    return null;
  }
  const link: Link = {
    id: crypto.randomUUID(),
    from: fromId,
    to: toId,
    kind,
    createdAt: Date.now(),
  };
  return { ...project, links: [...project.links, link] };
}

export function applyUpdateLink(
  project: Project,
  linkId: string,
  patch: Partial<Pick<Link, "label" | "kind">>,
): Project | null {
  if (!project.links.some((link) => link.id === linkId)) return null;
  return {
    ...project,
    links: project.links.map((link) => {
      if (link.id !== linkId) return link;
      const label = patch.label !== undefined
        ? (patch.label.trim() || undefined)
        : link.label;
      return {
        ...link,
        label,
        kind: patch.kind ?? link.kind,
      };
    }),
  };
}

export function applyRemoveLink(
  project: Project,
  linkId: string,
): Project | null {
  if (!project.links.some((link) => link.id === linkId)) return null;
  return {
    ...project,
    links: project.links.filter((link) => link.id !== linkId),
  };
}

/** Remove a card and cascade links + board placement. */
export function applyRemoveCard(
  project: Project,
  cardId: string,
): Project | null {
  if (!project.cards.some((card) => card.id === cardId)) return null;
  return withMainBoard(
    {
      ...project,
      cards: project.cards.filter((card) => card.id !== cardId),
      links: project.links.filter((l) => l.from !== cardId && l.to !== cardId),
    },
    (board) => {
      const { [cardId]: _, ...positions } = board.positions;
      return {
        ...board,
        cardIds: board.cardIds.filter((id) => id !== cardId),
        positions,
      };
    },
  );
}

export function applySetBoardViewport(
  project: Project,
  viewport: NonNullable<Board["viewport"]>,
): Project {
  return withMainBoard(project, (board) => ({ ...board, viewport }));
}

export function createDemoProject(now = Date.now()): Project {
  const cards: Card[] = [
    {
      id: "radio-signal",
      title: "23:17の短波ラジオ",
      body: "毎晩同じ時刻に数字列が流れる。",
      foundAt: now - 3600000,
    },
    {
      id: "station-locker",
      title: "東口ロッカー B-17",
      body: "動画の背景に一瞬だけ映り込んだ。",
      foundAt: now - 2800000,
    },
    {
      id: "missing-poster",
      title: "消えた告知ポスター",
      body: "アーカイブにはあるが、現地では剥がされていた。",
      foundAt: now - 1900000,
    },
    {
      id: "seventeen-theory",
      title: "17は集合時刻ではなく番号？",
      role: "thought",
      body: "時刻、ロッカー、投稿IDに17が繰り返し現れる。",
      foundAt: now - 900000,
    },
  ];

  return {
    version: 1,
    id: crypto.randomUUID(),
    name: "CASE 017 / 夜の放送",
    createdAt: now,
    cards,
    links: [
      {
        id: "signal-theory",
        from: "radio-signal",
        to: "seventeen-theory",
        label: "17が反復",
        kind: "connects",
        createdAt: now,
      },
      {
        id: "locker-theory",
        from: "station-locker",
        to: "seventeen-theory",
        label: "B-17",
        kind: "connects",
        createdAt: now,
      },
      {
        id: "poster-signal",
        from: "missing-poster",
        to: "radio-signal",
        label: "日付が合わない?",
        kind: "contradicts",
        createdAt: now,
      },
    ],
    boards: [{
      id: "main-board",
      name: "メインボード",
      cardIds: cards.map((card) => card.id),
      positions: {
        "radio-signal": { x: 90, y: 90 },
        "station-locker": { x: 480, y: 70 },
        "missing-poster": { x: 95, y: 345 },
        "seventeen-theory": { x: 470, y: 330 },
      },
    }],
    ui: { mode: "explore", sideOpen: false },
  };
}
