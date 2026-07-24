import type { Board, Card, Link, Project, ProjectEvent } from "./types.ts";

export function appendEvent(
  project: Project,
  event: ProjectEvent,
): Project {
  return { ...project, events: [...(project.events ?? []), event] };
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
