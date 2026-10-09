export type PreviewSurface = "wide" | "rail";

export type PreviewHeightStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export const PREVIEW_HEIGHT_KEY = "argboard.imagePreviewHeight";
export const PREVIEW_MIN_PX = 96;
const RESERVE_PX = 160;
const DEFAULTS = {
  wide: { vh: 0.52, cap: 520 },
  rail: { vh: 0.36, cap: 280 },
} as const;

/** Old surface names from explore/side era (T060). */
const LEGACY_SURFACE: Record<string, PreviewSurface> = {
  explore: "wide",
  side: "rail",
  wide: "wide",
  rail: "rail",
};

function browserStore(): PreviewHeightStore | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function defaultPreviewHeight(surface: PreviewSurface, vh: number) {
  const spec = DEFAULTS[surface];
  return Math.round(Math.min(spec.vh * vh, spec.cap));
}

export function maxPreviewHeight(vh: number) {
  return Math.max(PREVIEW_MIN_PX, vh - RESERVE_PX);
}

export function clampPreviewHeight(px: number, vh: number) {
  return Math.round(
    Math.min(maxPreviewHeight(vh), Math.max(PREVIEW_MIN_PX, px)),
  );
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
      const surface = LEGACY_SURFACE[key];
      if (!surface) continue;
      if (typeof value === "number" && Number.isFinite(value)) {
        // Prefer already-migrated keys over legacy aliases.
        if (out[surface] != null && (key === "explore" || key === "side")) {
          continue;
        }
        out[surface] = value;
      }
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
) {
  if (!store) return;
  try {
    store.setItem(
      PREVIEW_HEIGHT_KEY,
      JSON.stringify({ ...readStoredPreviewHeights(store), [surface]: px }),
    );
  } catch {
    // Quota or privacy mode: remember height in this session only.
  }
}

export function resolvePreviewHeight(
  surface: PreviewSurface,
  vh: number,
  store: PreviewHeightStore | null = browserStore(),
) {
  const stored = readStoredPreviewHeights(store)[surface];
  return clampPreviewHeight(
    typeof stored === "number" ? stored : defaultPreviewHeight(surface, vh),
    vh,
  );
}
