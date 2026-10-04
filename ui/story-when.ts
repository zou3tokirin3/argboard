/** Optional in-story time fields on a card (T069 / T072). */
export type StoryWhenFields = {
  storyWhen?: string;
  storyUntil?: string;
};

/** True when either the point or the optional span end is set. */
export function hasStoryWhen(card: StoryWhenFields): boolean {
  return Boolean(card.storyWhen?.trim() || card.storyUntil?.trim());
}

/**
 * Short label for stream / lists.
 * Point: `12:34` · Span: `12:34–20min` · End-only: `–2:00` · Duration-only: `20min`
 */
export function formatStoryWhenLabel(card: StoryWhenFields): string {
  const when = card.storyWhen?.trim() ?? "";
  const until = card.storyUntil?.trim() ?? "";
  if (when && until) return `${when}–${until}`;
  if (until) return `–${until}`;
  return when;
}

/** Soft clock minutes from free-text story fields; null = label-only. */
export function storyWhenSortKey(card: StoryWhenFields): number | null {
  const text = `${card.storyWhen ?? ""} ${card.storyUntil ?? ""}`;
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Clock-sortable times first, then label-only by label/title (T073). */
export function sortLaneCards<T extends StoryWhenFields & { title: string }>(
  cards: readonly T[],
): T[] {
  return cards.toSorted((left, right) => {
    const leftKey = storyWhenSortKey(left);
    const rightKey = storyWhenSortKey(right);
    if (leftKey != null && rightKey != null && leftKey !== rightKey) {
      return leftKey - rightKey;
    }
    if (leftKey != null && rightKey == null) return -1;
    if (leftKey == null && rightKey != null) return 1;
    const labelCmp = formatStoryWhenLabel(left).localeCompare(
      formatStoryWhenLabel(right),
      "ja",
    );
    return labelCmp || left.title.localeCompare(right.title, "ja");
  });
}
