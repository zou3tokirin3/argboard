export type AppMode = "explore" | "contemplate";

export type ProjectUi = {
  mode: AppMode;
  sideOpen?: boolean;
};

export type Project = {
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  cards: Card[];
  links: Link[];
  boards: Board[];
  ui?: ProjectUi;
};

export type Card = {
  id: string;
  title: string;
  role?: "finding" | "thought";
  body?: string;
  url?: string;
  image?: string;
  tags?: string[];
  foundAt: number;
};

export type Link = {
  id: string;
  from: string;
  to: string;
  label?: string;
  kind: "connects" | "contradicts";
  createdAt: number;
};

export type Board = {
  id: string;
  name: string;
  cardIds: string[];
  positions: Record<string, { x: number; y: number }>;
  viewport?: { x: number; y: number; zoom: number };
};

/** Drag payload when placing a stream card onto the board. */
export const CARD_MIME = "application/x-argboard-card";
