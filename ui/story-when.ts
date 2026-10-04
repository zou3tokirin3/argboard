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
