import {
  clampPreviewHeight,
  defaultPreviewHeight,
  PREVIEW_HEIGHT_KEY,
  PREVIEW_MIN_PX,
  readStoredPreviewHeights,
  resolvePreviewHeight,
  writeStoredPreviewHeight,
} from "../../ui/image-preview-height.ts";

function memoryStore(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    map,
  };
}

Deno.test("default explore height matches min(52vh, 520)", () => {
  if (defaultPreviewHeight("explore", 1000) !== 520) {
    throw new Error("tall viewport must cap explore at 520");
  }
  if (defaultPreviewHeight("explore", 800) !== 416) {
    throw new Error("800px viewport must use 52vh");
  }
});

Deno.test("default side height matches min(36vh, 280)", () => {
  if (defaultPreviewHeight("side", 1000) !== 280) {
    throw new Error("tall viewport must cap side at 280");
  }
  if (defaultPreviewHeight("side", 600) !== 216) {
    throw new Error("600px viewport must use 36vh");
  }
});

Deno.test("clamp keeps capture row space and a minimum pane", () => {
  if (clampPreviewHeight(40, 900) !== PREVIEW_MIN_PX) {
    throw new Error("must not shrink below the minimum pane");
  }
  if (clampPreviewHeight(900, 900) !== 740) {
    throw new Error("must reserve 160px for the capture row");
  }
});

Deno.test("stored heights persist per surface and skip the project", () => {
  const store = memoryStore();
  writeStoredPreviewHeight("explore", 480, store);
  writeStoredPreviewHeight("side", 320, store);
  const read = readStoredPreviewHeights(store);
  if (read.explore !== 480 || read.side !== 320) {
    throw new Error(`expected both surfaces, got ${JSON.stringify(read)}`);
  }
  const raw = store.map.get(PREVIEW_HEIGHT_KEY);
  if (!raw?.includes("explore") || raw.includes("cards")) {
    throw new Error("must store only preview heights in localStorage");
  }
});

Deno.test("resolve uses stored height when present, else the CSS default", () => {
  const empty = memoryStore();
  if (resolvePreviewHeight("explore", 1000, empty) !== 520) {
    throw new Error("empty store must keep the current explore default");
  }
  writeStoredPreviewHeight("explore", 600, empty);
  if (resolvePreviewHeight("explore", 1000, empty) !== 600) {
    throw new Error("stored explore height must win");
  }
  if (resolvePreviewHeight("side", 1000, empty) !== 280) {
    throw new Error("explore storage must not change the side default");
  }
});

Deno.test("resolve clamps a stored height that no longer fits", () => {
  const store = memoryStore();
  writeStoredPreviewHeight("side", 700, store);
  if (resolvePreviewHeight("side", 500, store) !== 340) {
    throw new Error("short window must clamp the stored side height");
  }
});
