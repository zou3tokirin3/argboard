import type { Card } from "./types.ts";

/** Board card display size (T022). Omit / `"m"` = current default. */
export type CardSize = "m" | "l";

export type NodeDims = {
  w: number;
  h: number;
  /** foreignObject height below the adhesive band (y=40). */
  contentH: number;
};

/** Default (= medium) matches pre-T022 fixed NODE_WIDTH/HEIGHT. */
export const NODE_DIMS: Record<CardSize, NodeDims> = {
  m: { w: 235, h: 128, contentH: 78 },
  l: { w: 320, h: 200, contentH: 148 },
};

export const ADHESIVE_HEIGHT = 38;

export function normalizeCardSize(
  size: Card["size"] | CardSize | "" | undefined,
): CardSize {
  return size === "l" ? "l" : "m";
}

export function nodeDims(
  card: Pick<Card, "size"> | CardSize | undefined,
): NodeDims {
  if (typeof card === "string") return NODE_DIMS[normalizeCardSize(card)];
  return NODE_DIMS[normalizeCardSize(card?.size)];
}

export function dimsForCardId(
  cardId: string,
  cards: ReadonlyArray<Pick<Card, "id" | "size">>,
): NodeDims {
  const card = cards.find((item) => item.id === cardId);
  return nodeDims(card);
}
