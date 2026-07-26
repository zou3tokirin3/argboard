/** Free-tag helpers (T031). Values come from cards — no tag master. */

export const TAG_KIND_LIMIT = 12;

export type TagUsage = { name: string; count: number };

export type TagSuggestItem =
  | { kind: "existing"; name: string; unsettled: boolean }
  | { kind: "create"; name: string };

export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Unique tags with use counts (order: first-seen). */
export function collectTagUsage(
  cards: ReadonlyArray<{ tags?: string[] }>,
): TagUsage[] {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const card of cards) {
    for (const raw of card.tags ?? []) {
      const name = normalizeTag(raw);
      if (!name) continue;
      if (!counts.has(name)) order.push(name);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return order.map((name) => ({ name, count: counts.get(name)! }));
}

export function buildTagSuggestions(
  query: string,
  usage: TagUsage[],
  attached: ReadonlyArray<string>,
): { items: TagSuggestItem[]; atLimit: boolean } {
  const q = normalizeTag(query);
  const attachedSet = new Set(attached.map(normalizeTag).filter(Boolean));
  const atLimit = usage.length >= TAG_KIND_LIMIT;
  const qLower = q.toLowerCase();
  const items: TagSuggestItem[] = [];
  for (const entry of usage) {
    if (attachedSet.has(entry.name)) continue;
    if (q && !entry.name.toLowerCase().includes(qLower)) continue;
    items.push({
      kind: "existing",
      name: entry.name,
      unsettled: entry.count === 1,
    });
  }
  if (
    q && !attachedSet.has(q) && !usage.some((e) => e.name === q) && !atLimit
  ) {
    items.push({ kind: "create", name: q });
  }
  return { items, atLimit };
}

export function attachTag(tags: string[] | undefined, name: string): string[] {
  const next = normalizeTag(name);
  if (!next) return tags ? [...tags] : [];
  const current = tags ?? [];
  return current.some((t) => normalizeTag(t) === next)
    ? [...current]
    : [...current, next];
}

export function detachTag(
  tags: string[] | undefined,
  name: string,
): string[] | undefined {
  const target = normalizeTag(name);
  if (!tags?.length || !target) return tags;
  const next = tags.filter((t) => normalizeTag(t) !== target);
  return next.length ? next : undefined;
}
