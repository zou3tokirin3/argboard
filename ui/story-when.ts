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

export type StorySortKey = {
  /** clock = sortable time; bucket = label group (夜 / Day3 …) */
  kind: "clock" | "bucket";
  /** Ordinal day when weakly parsed; null = same-day / unknown */
  day: number | null;
  /** Minutes from midnight when clock-like */
  minute: number | null;
  bucketRank: number;
  bucketLabel: string;
};

const BUCKET_RULES: Array<
  { re: RegExp; rank: number | ((m: RegExpMatchArray) => number) }
> = [
  { re: /^朝$/, rank: 10 },
  { re: /^昼$/, rank: 20 },
  { re: /^夕方$/, rank: 30 },
  { re: /^夜$/, rank: 40 },
  { re: /^深夜$/, rank: 50 },
  { re: /^Day\s*(\d+)$/i, rank: (m) => 100 + Number(m[1]) },
  { re: /^day\s*(\d+)$/i, rank: (m) => 100 + Number(m[1]) },
];

function parseClockMinutes(text: string): number | null {
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Weak day ordinal: YYYY-MM-DD, M/D, M月D日 → comparable int */
function parseDayOrdinal(text: string): number | null {
  const iso = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return Number(iso[1]) * 372 + Number(iso[2]) * 31 + Number(iso[3]);
  }
  const md = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (md) return Number(md[1]) * 31 + Number(md[2]);
  const jp = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (jp) return Number(jp[1]) * 31 + Number(jp[2]);
  return null;
}

function parseBucket(
  text: string,
): { rank: number; label: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  for (const rule of BUCKET_RULES) {
    const match = trimmed.match(rule.re);
    if (!match) continue;
    const rank = typeof rule.rank === "function" ? rule.rank(match) : rule.rank;
    return { rank, label: match[0] };
  }
  return null;
}

/**
 * Soft sort key from free-text story fields (T073).
 * Prefer storyWhen for ordering; storyUntil alone can still yield a clock/bucket.
 */
export function storyWhenSortKey(card: StoryWhenFields): StorySortKey {
  const when = card.storyWhen?.trim() ?? "";
  const until = card.storyUntil?.trim() ?? "";
  const primary = when || until;
  const day = parseDayOrdinal(primary);
  const minute = parseClockMinutes(primary);
  if (minute != null || day != null) {
    return {
      kind: "clock",
      day,
      minute: minute ?? 0,
      bucketRank: 0,
      bucketLabel: "",
    };
  }
  const bucket = parseBucket(primary);
  if (bucket) {
    return {
      kind: "bucket",
      day: null,
      minute: null,
      bucketRank: bucket.rank,
      bucketLabel: bucket.label,
    };
  }
  return {
    kind: "bucket",
    day: null,
    minute: null,
    bucketRank: 10_000,
    bucketLabel: primary || "?",
  };
}

/** Clock-only: treat 00:00–05:59 as after evening (same-night ARG feel). */
function nightAwareMinute(key: StorySortKey): number {
  const minute = key.minute ?? 0;
  if (key.day != null) return minute;
  return minute < 6 * 60 ? minute + 24 * 60 : minute;
}

function compareSortKeys(left: StorySortKey, right: StorySortKey): number {
  if (left.kind !== right.kind) {
    return left.kind === "clock" ? -1 : 1;
  }
  if (left.kind === "clock" && right.kind === "clock") {
    if (left.day != null && right.day != null && left.day !== right.day) {
      return left.day - right.day;
    }
    const leftMin = nightAwareMinute(left);
    const rightMin = nightAwareMinute(right);
    if (leftMin !== rightMin) return leftMin - rightMin;
    return 0;
  }
  if (left.bucketRank !== right.bucketRank) {
    return left.bucketRank - right.bucketRank;
  }
  return left.bucketLabel.localeCompare(right.bucketLabel, "ja");
}

/** Clock-sortable times first, then bucket groups by rank/label/title. */
export function sortLaneCards<T extends StoryWhenFields & { title: string }>(
  cards: readonly T[],
): T[] {
  return cards.toSorted((left, right) => {
    const cmp = compareSortKeys(
      storyWhenSortKey(left),
      storyWhenSortKey(right),
    );
    if (cmp !== 0) return cmp;
    const labelCmp = formatStoryWhenLabel(left).localeCompare(
      formatStoryWhenLabel(right),
      "ja",
    );
    return labelCmp || left.title.localeCompare(right.title, "ja");
  });
}

/**
 * Per-row flags after sort (T073): early-morning clock-only (night wrap) or
 * clock→bucket edge. Index i refers to cards[i]; true =「順が怪しい」.
 */
export function storyOrderSuspicious(
  cards: readonly StoryWhenFields[],
): boolean[] {
  const flags = cards.map(() => false);
  for (let i = 0; i < cards.length; i += 1) {
    const key = storyWhenSortKey(cards[i]!);
    if (
      key.kind === "clock" && key.day == null && (key.minute ?? 0) < 6 * 60
    ) {
      flags[i] = true;
    }
  }
  for (let i = 1; i < cards.length; i += 1) {
    const prev = storyWhenSortKey(cards[i - 1]!);
    const curr = storyWhenSortKey(cards[i]!);
    if (prev.kind === "clock" && curr.kind === "bucket") flags[i] = true;
  }
  return flags;
}
