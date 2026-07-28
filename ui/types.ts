export type AppMode = "explore" | "contemplate";

export type ProjectUi = {
  mode: AppMode;
  sideOpen?: boolean;
};

export type ProjectEvent =
  | { type: "project_opened"; at: number }
  | { type: "card_added"; at: number; card: Card }
  | {
    type: "card_updated";
    at: number;
    cardId: string;
    title: string;
    body?: string;
    url?: string;
    /** Local media id (IndexedDB Blob). Present when image changed. */
    image?: string;
    /** Present only when tags changed (omit keeps previous tags on replay). */
    tags?: string[];
    /**
     * Present only when board size changed (omit keeps previous on replay).
     * `""` clears to default medium.
     */
    size?: "m" | "l" | "";
  }
  | {
    type: "card_removed";
    at: number;
    card: Card;
    links: Link[];
    position?: { x: number; y: number };
  }
  | { type: "link_added"; at: number; link: Link }
  | {
    type: "link_updated";
    at: number;
    linkId: string;
    label?: string;
    kind: Link["kind"];
  }
  | { type: "link_removed"; at: number; link: Link }
  | { type: "card_placed"; at: number; cardId: string; x: number; y: number };

export type Project = {
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  cards: Card[];
  links: Link[];
  boards: Board[];
  ui?: ProjectUi;
  /** Append-only operation log (T024). Absent on older projects. */
  events?: ProjectEvent[];
};

export type Card = {
  id: string;
  title: string;
  role?: "finding" | "thought";
  body?: string;
  url?: string;
  /** Local media id in IndexedDB (not an external URL). */
  image?: string;
  tags?: string[];
  /** Board display size (T022). Omit or `"m"` = default; `"l"` = large. */
  size?: "m" | "l";
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
