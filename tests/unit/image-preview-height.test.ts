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

Deno.test("default wide height matches min(52vh, 520)", () => {
  if (defaultPreviewHeight("wide", 1000) !== 520) {
    throw new Error("tall viewport must cap wide at 520");
  }
  if (defaultPreviewHeight("wide", 800) !== 416) {
    throw new Error("800px viewport must use 52vh");
  }
});

Deno.test("default rail height matches min(36vh, 280)", () => {
  if (defaultPreviewHeight("rail", 1000) !== 280) {
    throw new Error("tall viewport must cap rail at 280");
  }
  if (defaultPreviewHeight("rail", 600) !== 216) {
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
  writeStoredPreviewHeight("wide", 480, store);
  writeStoredPreviewHeight("rail", 320, store);
  const read = readStoredPreviewHeights(store);
  if (read.wide !== 480 || read.rail !== 320) {
    throw new Error(`expected both surfaces, got ${JSON.stringify(read)}`);
  }
  const raw = store.map.get(PREVIEW_HEIGHT_KEY);
  if (!raw?.includes("wide") || raw.includes("cards")) {
    throw new Error("must store only preview heights in localStorage");
  }
});

Deno.test("legacy explore/side keys migrate to wide/rail", () => {
  const store = memoryStore({
    [PREVIEW_HEIGHT_KEY]: JSON.stringify({ explore: 400, side: 200 }),
  });
  const read = readStoredPreviewHeights(store);
  if (read.wide !== 400 || read.rail !== 200) {
    throw new Error(`legacy migrate failed: ${JSON.stringify(read)}`);
  }
});

Deno.test("resolve uses stored height when present, else the CSS default", () => {
  const empty = memoryStore();
  if (resolvePreviewHeight("wide", 1000, empty) !== 520) {
    throw new Error("empty store must keep the current wide default");
  }
  writeStoredPreviewHeight("wide", 600, empty);
  if (resolvePreviewHeight("wide", 1000, empty) !== 600) {
    throw new Error("stored wide height must win");
  }
  if (resolvePreviewHeight("rail", 1000, empty) !== 280) {
    throw new Error("wide storage must not change the rail default");
  }
});

Deno.test("resolve clamps a stored height that no longer fits", () => {
  const store = memoryStore();
  writeStoredPreviewHeight("rail", 700, store);
  if (resolvePreviewHeight("rail", 500, store) !== 340) {
    throw new Error("short window must clamp the stored rail height");
  }
});
