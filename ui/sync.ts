import type { Card, Link, Project } from "./types.ts";

export type Op =
  | { k: "name"; v: string }
  | { k: "card"; id: string; v: Card | null }
  | {
      k: "cf";
      id: string;
      f: Exclude<keyof Card, "id" | "image">;
      v: Card[keyof Card] | null;
    }
  | { k: "pos"; id: string; v: { x: number; y: number } | null }
  | { k: "link"; id: string; v: Link | null };
export type SyncOp = { oid: string; op: Op };
export type OrderedOp = SyncOp & { seq: number };
export const roomValid = (room: string) => /^[A-Za-z0-9_-]{22,64}$/.test(room);
export const randomRoom = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
export function stripForShare(p: Project) {
  return {
    name: p.name,
    links: p.links,
    cards: p.cards.map(({ image: _, ...card }) => card),
    positions: p.boards[0]?.positions ?? {},
  };
}
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function diffOps(prev: Project, next: Project): Op[] {
  const a = stripForShare(prev),
    b = stripForShare(next),
    ops: Op[] = [];
  if (a.name !== b.name) ops.push({ k: "name", v: b.name });
  for (const id of new Set([...a.cards, ...b.cards].map((c) => c.id))) {
    const x = a.cards.find((c) => c.id === id),
      y = b.cards.find((c) => c.id === id);
    if (!x || !y) ops.push({ k: "card", id, v: y ?? null });
    else
      for (const f of new Set([...Object.keys(x), ...Object.keys(y)]) as Set<
        keyof Card
      >) {
        if (f !== "id" && f !== "image" && !equal(x[f], y[f]))
          ops.push({ k: "cf", id, f, v: y[f] ?? null });
      }
  }
  const x = a.positions,
    y = b.positions;
  for (const id of new Set([...Object.keys(x), ...Object.keys(y)])) {
    if (!equal(x[id], y[id])) ops.push({ k: "pos", id, v: y[id] ?? null });
  }
  for (const id of new Set([...a.links, ...b.links].map((l) => l.id))) {
    const x = a.links.find((l) => l.id === id),
      y = b.links.find((l) => l.id === id);
    if (!equal(x, y)) ops.push({ k: "link", id, v: y ?? null });
  }
  return ops;
}
function setEntity<T extends { id: string }>(
  items: T[],
  op: { id: string; v: T | null },
): T[] {
  return [
    ...items.filter((item) => item.id !== op.id),
    ...(op.v ? [op.v] : []),
  ];
}
export function applyOp(project: Project, op: Op): Project {
  if (op.k === "name") return { ...project, name: op.v };
  if (op.k === "card")
    return { ...project, cards: setEntity(project.cards, op) };
  if (op.k === "link")
    return { ...project, links: setEntity(project.links, op) };
  if (op.k === "cf")
    return {
      ...project,
      cards: project.cards.map((c) => {
        if (c.id !== op.id) return c;
        const next = { ...c };
        if (op.v === null) delete next[op.f];
        else Object.assign(next, { [op.f]: op.v });
        return next;
      }),
    };
  const board = project.boards[0];
  if (!board) return project;
  const positions = { ...board.positions };
  delete positions[op.id];
  if (op.v) positions[op.id] = op.v;
  const cardIds = board.cardIds.filter((id) => id !== op.id);
  if (op.v) cardIds.push(op.id);
  return {
    ...project,
    boards: [{ ...board, positions, cardIds }, ...project.boards.slice(1)],
  };
}

export function queueOps(
  prev: Project,
  next: Project,
  identify: (op: Op) => SyncOp,
): Project {
  if (!next.share) return next;
  const pending = [...next.share.pending, ...diffOps(prev, next).map(identify)];
  return { ...next, share: { ...next.share, pending } };
}
/** Apply to the confirmed base, then overlay pending; never apply remote ops to the overlay. */
export function receiveOps(
  base: Project,
  local: Project,
  ops: OrderedOp[],
): [Project, Project] {
  const share = local.share!;
  let seq = share.seq;
  const acknowledged = new Set(ops.map((o) => o.oid));
  for (const o of ops)
    if (o.seq > seq) {
      base = applyOp(base, o.op);
      seq = o.seq;
    }
  const pending = share.pending.filter((o) => !acknowledged.has(o.oid));
  let next = pending.reduce((p, o) => applyOp(p, o.op), base);
  const { positions, cardIds } = next.boards[0];
  next = {
    ...local,
    name: next.name,
    cards: next.cards.map((c) => {
      const image = local.cards.find((x) => x.id === c.id)?.image;
      return image ? { ...c, image } : c;
    }),
    links: next.links,
    boards: local.boards.map((b, i) => (i ? b : { ...b, positions, cardIds })),
    share: { ...share, seq, pending },
  };
  return [base, next];
}
