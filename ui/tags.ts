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

/**
 * Replace one tag with another on a card's list (rename or merge).
 * Dedupes; returns undefined when the list becomes empty.
 */
export function replaceTag(
  tags: string[] | undefined,
  from: string,
  to: string,
): { tags: string[] | undefined; changed: boolean } {
  const src = normalizeTag(from);
  const dst = normalizeTag(to);
  if (!tags?.length || !src || !dst || src === dst) {
    return { tags, changed: false };
  }
  let changed = false;
  const next: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const name = normalizeTag(raw) === src ? dst : normalizeTag(raw);
    if (normalizeTag(raw) === src) changed = true;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    next.push(name);
  }
  if (!changed) return { tags, changed: false };
  return { tags: next.length ? next : undefined, changed: true };
}

/** Approximate chip width for board one-line layout (10px face). */
function estimateTagChipWidth(name: string): number {
  let text = 6; // "#"
  for (const ch of name) {
    text += (ch.codePointAt(0) ?? 0) > 0xff ? 10 : 6;
  }
  return text + 12; // padding + border
}

/**
 * Pick tags that fit one row; remainder becomes +N.
 * Always keeps the first tag when any exist (CSS may ellipsis a long name).
 */
export function fitTagsOneLine(
  tags: readonly string[],
  maxWidthPx: number,
): { shown: string[]; hidden: number } {
  if (tags.length === 0) return { shown: [], hidden: 0 };
  const gap = 4;
  const moreW = 24;
  const shown: string[] = [];
  let used = 0;
  for (let i = 0; i < tags.length; i++) {
    const name = tags[i]!;
    const width = estimateTagChipWidth(name);
    const next = shown.length === 0 ? width : used + gap + width;
    const rest = tags.length - i - 1;
    const limit = rest > 0 ? maxWidthPx - gap - moreW : maxWidthPx;
    if (shown.length === 0 || next <= limit) {
      shown.push(name);
      used = next;
      if (rest > 0 && next > limit) break;
      continue;
    }
    break;
  }
  return { shown, hidden: tags.length - shown.length };
}
