/// <reference lib="dom" />

import { createEmptyProject } from "../../ui/project.ts";
import {
  closeExploreCompose,
  diggingCardId,
  imageReferenceCaptureMode,
  openExploreCompose,
  project,
  setImageReferenceCaptureMode,
} from "../../ui/state.ts";

function seedViewedCard(options?: { contemplate?: boolean }): string {
  const id = crypto.randomUUID();
  const now = Date.now();
  project.value = {
    ...createEmptyProject("参照", now),
    cards: [{ id, title: "資料", foundAt: now, image: "media-1" }],
    ui: {
      panelPhase: options?.contemplate ? "rail" : "wide",
    },
  };
  diggingCardId.value = null;
  closeExploreCompose();
  return id;
}

Deno.test("image reference thought mode keeps digging the viewed card", async (t) => {
  await t.step(
    "contemplate compose starts digging on the first thought",
    () => {
      const parentId = seedViewedCard({ contemplate: true });
      openExploreCompose(parentId);
      if (imageReferenceCaptureMode.value !== "thought") {
        throw new Error("contemplate compose defaults to thought");
      }
      if (diggingCardId.value !== parentId) {
        throw new Error("thought compose must start digging the viewed card");
      }
      closeExploreCompose();
      if (diggingCardId.value != null) {
        throw new Error("closing compose must stop digging");
      }
    },
  );

  await t.step("dig/thought switch does not drop the viewed parent", () => {
    const parentId = seedViewedCard();
    openExploreCompose(parentId, { mode: "dig" });
    if (diggingCardId.value !== parentId) {
      throw new Error("dig compose must start digging");
    }
    setImageReferenceCaptureMode("thought");
    const afterThought = imageReferenceCaptureMode.value;
    if (afterThought !== "thought" || diggingCardId.value !== parentId) {
      throw new Error("switching to thought must not stop digging");
    }
    setImageReferenceCaptureMode("dig");
    const afterDig = imageReferenceCaptureMode.value;
    if (afterDig !== "dig" || diggingCardId.value !== parentId) {
      throw new Error("switching back to dig must keep the same parent");
    }
    closeExploreCompose();
    if (diggingCardId.value != null) {
      throw new Error("closing compose must stop digging");
    }
  });
});
