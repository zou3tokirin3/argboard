export type Project = {
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  cards: Card[];
  links: Link[];
  boards: Board[];
};

export type Card = {
  id: string;
  title: string;
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
