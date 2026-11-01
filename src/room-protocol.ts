import type { Op, OrderedOp, SyncOp } from "../ui/sync.ts";
import type { Card, Link } from "../ui/types.ts";

export { roomValid } from "../ui/sync.ts";

const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, n = 20000): v is string =>
  typeof v === "string" && v.length <= n;
const id = (v: unknown): v is string =>
  str(v, 100) &&
  v.length > 0 &&
  !["__proto__", "constructor", "prototype"].includes(v);
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const oneOf =
  (...values: string[]) =>
  (v: unknown) =>
    typeof v === "string" && values.includes(v);
type Fields = Record<string, (v: unknown) => boolean>;
const cardFields: Fields = {
  id,
  title: str,
  body: str,
  url: str,
  ogpImage: str,
  storyWhen: str,
  storyUntil: str,
  foundVia: id,
  foundAt: num,
  role: oneOf("finding", "thought"),
  size: oneOf("m", "l"),
  outcome: oneOf("open", "held", "failed"),
  tags: (v) => Array.isArray(v) && v.length <= 500 && v.every((x) => str(x)),
};
const linkFields: Fields = {
  id,
  from: id,
  to: id,
  label: str,
  kind: oneOf("connects", "contradicts"),
  createdAt: num,
};
const recordValid = (
  v: Record<string, unknown>,
  fields: Fields,
  required: string[],
) =>
  required.every((f) => Object.hasOwn(v, f)) &&
  Object.entries(v).every(([f, x]) => Object.hasOwn(fields, f) && fields[f](x));
function validOp(v: unknown): Op {
  if (!obj(v)) throw Error("op");
  if (v.k === "name" && str(v.v)) return { k: "name", v: v.v };
  if (!id(v.id)) throw Error("id");
  const value = v.v;
  if (
    v.k === "cf" &&
    typeof v.f === "string" &&
    v.f !== "id" &&
    Object.hasOwn(cardFields, v.f)
  ) {
    const valid =
      value === null
        ? !["title", "foundAt"].includes(v.f)
        : cardFields[v.f](value);
    if (valid) return { k: "cf", id: v.id, f: v.f, v: value } as Op;
  }
  if (
    v.k === "pos" &&
    (value === null || (obj(value) && num(value.x) && num(value.y)))
  ) {
    return {
      k: "pos",
      id: v.id,
      v: value === null ? null : { x: value.x, y: value.y },
    } as Op;
  }
  if (v.k === "card") {
    if (value === null) return { k: "card", id: v.id, v: null };
    if (obj(value) && value.id === v.id) {
      const { image: _, ...card } = value;
      if (recordValid(card, cardFields, ["id", "title", "foundAt"])) {
        return { k: "card", id: v.id, v: card as Card };
      }
    }
  }
  if (
    v.k === "link" &&
    (value === null ||
      (obj(value) &&
        value.id === v.id &&
        recordValid(value, linkFields, [
          "id",
          "from",
          "to",
          "kind",
          "createdAt",
        ])))
  ) {
    return { k: "link", id: v.id, v: value as Link | null };
  }
  throw Error("op");
}
export function parseMessage(
  raw: string | ArrayBuffer,
): { t: "hello"; since: number } | { t: "push"; ops: SyncOp[] } {
  if (
    typeof raw !== "string" ||
    new TextEncoder().encode(raw).length > 256 * 1024
  ) {
    throw Error("message size/type");
  }
  const v = JSON.parse(raw);
  if (!obj(v)) throw Error("message");
  if (
    v.t === "hello" &&
    Number.isSafeInteger(v.since) &&
    Number(v.since) >= 0
  ) {
    return { t: "hello", since: Number(v.since) };
  }
  if (v.t !== "push" || !Array.isArray(v.ops) || v.ops.length > 500)
    throw Error("push");
  return {
    t: "push",
    ops: v.ops.map((o) => {
      if (!obj(o) || !id(o.oid)) throw Error("oid");
      return { oid: o.oid, op: validOp(o.op) };
    }),
  };
}
/** Same ordering/deduplication rule for SQLite and the memory test server. */
export function sequenceOps(
  ops: SyncOp[],
  count: number,
  lookup: (oid: string) => OrderedOp | undefined,
  limit = 50000,
): OrderedOp[] {
  const seen = new Map<string, OrderedOp>();
  let seq = count;
  const result = ops.map((o) => {
    const old = seen.get(o.oid) ?? lookup(o.oid);
    if (old) return old;
    const next = { ...o, seq: ++seq };
    seen.set(o.oid, next);
    return next;
  });
  if (seq > limit) throw Error("room full");
  return result;
}
