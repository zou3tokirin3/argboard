export type PreviewSurface = "explore" | "side";

export type PreviewHeightStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export const PREVIEW_HEIGHT_KEY = "argboard.imagePreviewHeight";
export const PREVIEW_MIN_PX = 96;
export const PREVIEW_RESERVE_PX = 160;

const DEFAULTS: Record<PreviewSurface, { vh: number; cap: number }> = {
  explore: { vh: 0.52, cap: 520 },
  side: { vh: 0.36, cap: 280 },
};

function browserStore(): PreviewHeightStore | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function defaultPreviewHeight(
  surface: PreviewSurface,
  viewportHeight: number,
): number {
  const spec = DEFAULTS[surface];
  return Math.round(Math.min(spec.vh * viewportHeight, spec.cap));
}

export function maxPreviewHeight(viewportHeight: number): number {
  return Math.max(PREVIEW_MIN_PX, viewportHeight - PREVIEW_RESERVE_PX);
}

export function clampPreviewHeight(px: number, viewportHeight: number): number {
  const max = maxPreviewHeight(viewportHeight);
  return Math.round(Math.min(max, Math.max(PREVIEW_MIN_PX, px)));
}

export function readStoredPreviewHeights(
  store: PreviewHeightStore | null = browserStore(),
): Partial<Record<PreviewSurface, number>> {
  if (!store) return {};
  try {
    const parsed: unknown = JSON.parse(store.getItem(PREVIEW_HEIGHT_KEY) ?? "");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Partial<Record<PreviewSurface, number>> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key !== "explore" && key !== "side") continue;
      if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeStoredPreviewHeight(
  surface: PreviewSurface,
  px: number,
  store: PreviewHeightStore | null = browserStore(),
): void {
  if (!store) return;
  try {
    const next = { ...readStoredPreviewHeights(store), [surface]: px };
    store.setItem(PREVIEW_HEIGHT_KEY, JSON.stringify(next));
  } catch {
    // Quota or privacy mode: remember height in this session only.
  }
}

export function resolvePreviewHeight(
  surface: PreviewSurface,
  viewportHeight: number,
  store: PreviewHeightStore | null = browserStore(),
): number {
  const stored = readStoredPreviewHeights(store)[surface];
  const raw = typeof stored === "number"
    ? stored
    : defaultPreviewHeight(surface, viewportHeight);
  return clampPreviewHeight(raw, viewportHeight);
}
