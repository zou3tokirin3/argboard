import { normalizeTag } from "./tags.ts";
import type { Board, Card, Link, Project, ProjectEvent } from "./types.ts";

/** Session focus origin (T018 card / T033 tag). Not persisted. */
export type FocusOrigin =
  | { kind: "card"; cardId: string }
  | { kind: "tag"; tag: string };

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

/** Split "connect" from "label": link_added never carries a label. */
function linkWithoutLabel(link: Link): Link {
  const next = structuredClone(link);
  delete next.label;
  return next;
}

/** Push link_added (+ link_updated when labeled) and register the Sets. */
function pushLinkBirth(
  births: ProjectEvent[],
  link: Link,
  linksWithAdded: Set<string>,
  linksWithUpdates: Set<string>,
) {
  births.push({
    type: "link_added",
    at: link.createdAt,
    link: linkWithoutLabel(link),
  });
  linksWithAdded.add(link.id);
  if (link.label?.trim() && !linksWithUpdates.has(link.id)) {
    births.push({
      type: "link_updated",
      at: link.createdAt,
      linkId: link.id,
      label: link.label,
      kind: link.kind,
    });
    linksWithUpdates.add(link.id);
  }
}

/**
 * Normalize + fill birth events so replay can separate add / place / connect / label.
 * Idempotent. May rewrite labeled link_added into add + update.
 */
export function withBirthEvents(project: Project): Project {
  const raw = project.events ?? [];
  // Pass 1: split labeled link_added (common in older synthetic births / demo).
  const split: ProjectEvent[] = [];
  for (const event of raw) {
    if (event.type === "link_added" && event.link.label?.trim()) {
      const label = event.link.label;
      split.push({
        ...event,
        link: linkWithoutLabel(event.link),
      });
      split.push({
        type: "link_updated",
        at: event.at,
        linkId: event.link.id,
        label,
        kind: event.link.kind,
      });
      continue;
    }
    split.push(event);
  }

  const cardsWithAdded = new Set<string>();
  const linksWithAdded = new Set<string>();
  const cardsPlaced = new Set<string>();
  const linksWithUpdates = new Set<string>();
  for (const event of split) {
    if (event.type === "card_added") cardsWithAdded.add(event.card.id);
    if (event.type === "link_added") linksWithAdded.add(event.link.id);
    if (event.type === "card_placed") cardsPlaced.add(event.cardId);
    if (event.type === "link_updated") linksWithUpdates.add(event.linkId);
  }

  const births: ProjectEvent[] = [];
  for (const card of project.cards) {
    if (cardsWithAdded.has(card.id)) continue;
    births.push({
      type: "card_added",
      at: card.foundAt,
      card: structuredClone(card),
    });
    cardsWithAdded.add(card.id);
  }

  const board = project.boards[0];
  if (board) {
    for (const cardId of board.cardIds) {
      if (cardsPlaced.has(cardId)) continue;
      const pos = board.positions[cardId];
      const card = project.cards.find((item) => item.id === cardId);
      if (!pos || !card) continue;
      births.push({
        type: "card_placed",
        at: card.foundAt,
        cardId,
        x: pos.x,
        y: pos.y,
      });
      cardsPlaced.add(cardId);
    }
  }

  for (const link of project.links) {
    if (linksWithAdded.has(link.id)) continue;
    pushLinkBirth(births, link, linksWithAdded, linksWithUpdates);
  }

  // Deleted pre-log entities: birth from removal snapshots.
  for (const event of split) {
    if (event.type === "card_removed" && !cardsWithAdded.has(event.card.id)) {
      births.push({
        type: "card_added",
        at: event.card.foundAt,
        card: structuredClone(event.card),
      });
      if (event.position && !cardsPlaced.has(event.card.id)) {
        births.push({
          type: "card_placed",
          at: event.card.foundAt,
          cardId: event.card.id,
          x: event.position.x,
          y: event.position.y,
        });
        cardsPlaced.add(event.card.id);
      }
      cardsWithAdded.add(event.card.id);
      for (const link of event.links) {
        if (linksWithAdded.has(link.id)) continue;
        pushLinkBirth(births, link, linksWithAdded, linksWithUpdates);
      }
    }
    if (event.type === "link_removed" && !linksWithAdded.has(event.link.id)) {
      pushLinkBirth(births, event.link, linksWithAdded, linksWithUpdates);
    }
  }

  const tagged = [
    ...births.map((event, index) => ({ event, seq: index })),
    ...split.map((event, index) => ({
      event,
      seq: births.length + index,
    })),
  ];
  tagged.sort((left, right) =>
    left.event.at - right.event.at || left.seq - right.seq
  );
  const ordered = tagged.map((item) => item.event);
  const unchanged = births.length === 0 &&
    ordered.length === raw.length &&
    ordered.every((event, index) => {
      const prev = raw[index];
      return prev !== undefined &&
        JSON.stringify(event) === JSON.stringify(prev);
    });
  if (unchanged) return project;
  return {
    ...project,
    events: ordered,
  };
}

function applyEvent(
  event: ProjectEvent,
  cards: Map<string, Card>,
  links: Map<string, Link>,
  positions: Record<string, { x: number; y: number }>,
  cardIds: Set<string>,
): void {
  switch (event.type) {
    case "project_opened":
      break;
    case "card_added":
      cards.set(event.card.id, structuredClone(event.card));
      break;
    case "card_updated": {
      const prev = cards.get(event.cardId);
      if (!prev) break;
      const next: Card = {
        ...prev,
        title: event.title,
        body: event.body,
        url: event.url,
      };
      if ("tags" in event) {
        if (event.tags?.length) next.tags = [...event.tags];
        else delete next.tags;
      }
      if ("image" in event) {
        if (event.image) next.image = event.image;
        else delete next.image;
      }
      if ("size" in event) {
        if (event.size === "l") next.size = "l";
        else delete next.size;
      }
      if ("role" in event) {
        if (event.role === "thought") next.role = "thought";
        else delete next.role;
      }
      cards.set(event.cardId, next);
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
      links.set(event.link.id, structuredClone(event.link));
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

/**
 * Replay by inclusive event index (not timestamp). Same-ms steps stay ordered.
 */
export function viewThrough(
  project: Project,
  through: number,
): ProjectSlice {
  const sourced = withBirthEvents(project);
  const events = sourced.events ?? [];
  const cards = new Map<string, Card>();
  const links = new Map<string, Link>();
  const positions: Record<string, { x: number; y: number }> = {};
  const cardIds = new Set<string>();
  const board = sourced.boards[0];
  if (through < 0 || events.length === 0) {
    return { cards: [], links: [], cardIds: [], positions: {} };
  }
  const last = Math.min(through, events.length - 1);

  for (let index = 0; index <= last; index += 1) {
    applyEvent(events[index]!, cards, links, positions, cardIds);
  }

  // Placement fallback for cards that never got card_placed (e.g. demo births).
  if (board) {
    for (const [id, pos] of Object.entries(board.positions)) {
      if (!cards.has(id) || positions[id]) continue;
      positions[id] = pos;
      cardIds.add(id);
    }
  }

  for (const [linkId, link] of [...links]) {
    if (!cards.has(link.from) || !cards.has(link.to)) links.delete(linkId);
  }
  for (const id of [...cardIds]) {
    if (!cards.has(id) || !positions[id]) cardIds.delete(id);
  }

  return {
    cards: [...cards.values()],
    links: [...links.values()],
    cardIds: [...cardIds],
    positions,
  };
}

/** Timestamp cutoff helper (tests / coarse callers). Prefers last event at `at`. */
export function viewAt(project: Project, at: number): ProjectSlice {
  const events = withBirthEvents(project).events ?? [];
  let through = -1;
  for (let index = 0; index < events.length; index += 1) {
    if (events[index]!.at <= at) through = index;
  }
  if (through < 0) {
    return { cards: [], links: [], cardIds: [], positions: {} };
  }
  return viewThrough(project, through);
}

/** One discrete growth beat for step replay (T025). */
export type ReplayStep = {
  at: number;
  label: string;
  /** Inclusive index into withBirthEvents(project).events */
  through: number;
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
    case "link_added":
      return event.link.kind === "contradicts" ? "糸 · 要検討" : "糸 · 接続";
    case "link_updated": {
      const tip = event.label?.trim();
      if (tip) return `ラベル · ${tip}`;
      return event.kind === "contradicts" ? "糸 · 要検討に" : "糸 · 通常に";
    }
    case "link_removed":
      return "糸 · 削除";
  }
}

/**
 * Discrete execution units for the replay bar.
 * One step per meaningful event; `through` is the event-list index to apply.
 */
export function replaySteps(project: Project): ReplayStep[] {
  const sourced = withBirthEvents(project);
  const steps: ReplayStep[] = [];
  for (const [index, event] of (sourced.events ?? []).entries()) {
    const label = labelForEvent(sourced, event);
    if (!label) continue;
    steps.push({ at: event.at, label, through: index });
  }
  return steps;
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

function linkAdjacency(
  links: readonly Pick<Link, "from" | "to">[],
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const link of links) {
    const from = adj.get(link.from) ?? [];
    from.push(link.to);
    adj.set(link.from, from);
    const to = adj.get(link.to) ?? [];
    to.push(link.from);
    adj.set(link.to, to);
  }
  return adj;
}

/** Undirected multi-source BFS: seeds included; expand `extraHops` steps. */
export function reachableFromCardIds(
  links: readonly Pick<Link, "from" | "to">[],
  seedIds: readonly string[],
  extraHops: number,
): Set<string> {
  const reached = new Set<string>(seedIds);
  if (extraHops <= 0 || seedIds.length === 0) return reached;
  const adj = linkAdjacency(links);
  let frontier = [...seedIds];
  for (let depth = 0; depth < extraHops; depth += 1) {
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

/** Undirected BFS from startId up to `hops` link steps (includes start). */
export function reachableCardIds(
  links: readonly Pick<Link, "from" | "to">[],
  startId: string,
  hops: number,
): Set<string> {
  return reachableFromCardIds(links, [startId], hops);
}

/** Focus set (T018/T033): card BFS, or tag-holders at 1 hop then expand. */
export function focusReachableIds(
  links: readonly Pick<Link, "from" | "to">[],
  cards: ReadonlyArray<{ id: string; tags?: string[] }>,
  origin: FocusOrigin,
  hops: number,
): Set<string> {
  if (origin.kind === "card") {
    return reachableCardIds(links, origin.cardId, hops);
  }
  const tag = normalizeTag(origin.tag);
  const seeds = cards
    .filter((c) => (c.tags ?? []).some((t) => normalizeTag(t) === tag))
    .map((c) => c.id);
  return reachableFromCardIds(links, seeds, Math.max(0, hops - 1));
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

/** Move several board cards at once. Skips unknown cards; returns null if none apply. */
export function applyMoveCardsOnBoard(
  project: Project,
  moves: ReadonlyArray<{ cardId: string; x: number; y: number }>,
): Project | null {
  let next = project;
  let any = false;
  for (const { cardId, x, y } of moves) {
    const applied = applyPlaceCardOnBoard(next, cardId, x, y);
    if (!applied) continue;
    next = applied;
    any = true;
  }
  return any ? next : null;
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
