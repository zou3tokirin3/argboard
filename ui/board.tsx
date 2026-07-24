import { useRef, useState } from "preact/hooks";
import {
  addCard,
  clearFocusView,
  commitCardPlacement,
  connectCards,
  expandFocusHops,
  flushSave,
  focusCardId,
  focusHops,
  moveCardOnBoardLocal,
  placeCardOnBoard,
  project,
  selectedCardId,
  selectedLinkId,
  setBoardViewportLocal,
  setFocusView,
} from "./state.ts";
import { parseCaptureLine } from "./capture-notation.ts";
import { reachableCardIds } from "./project.ts";
import type { Card, Link } from "./types.ts";
import { CARD_MIME } from "./types.ts";

const NODE_WIDTH = 235;
const NODE_HEIGHT = 128;
const ADHESIVE_HEIGHT = 38;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const LINK_LANE_GAP = 22;

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

type Viewport = { x: number; y: number; zoom: number };
type Point = { x: number; y: number };
type Rubber = {
  fromId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  targetId: string | null;
};
type Drag =
  | { type: "pan"; startX: number; startY: number; origin: Viewport }
  | {
    type: "node";
    cardId: string;
    offsetX: number;
    offsetY: number;
    originX: number;
    originY: number;
  }
  | { type: "link"; fromId: string; targetId: string | null };
type LinkGeometry = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  mx: number;
  my: number;
  labelX: number;
  labelY: number;
  directed: boolean;
};

function defaultViewport(boardViewport?: Viewport): Viewport {
  return boardViewport ?? { x: 0, y: 0, zoom: 1 };
}

function nodeCenter(
  cardId: string,
  positions: Record<string, { x: number; y: number }>,
): Point {
  const position = positions[cardId] ?? { x: 0, y: 0 };
  return { x: position.x + NODE_WIDTH / 2, y: position.y + NODE_HEIGHT / 2 };
}

function threadAnchor(
  cardId: string,
  positions: Record<string, { x: number; y: number }>,
): Point {
  const position = positions[cardId] ?? { x: 0, y: 0 };
  return { x: position.x + NODE_WIDTH, y: position.y + NODE_HEIGHT / 2 };
}

/** Border point of the card rect, on the ray from `from` toward `toward`. */
function rectEdge(from: Point, toward: Point): Point {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return from;
  const halfW = NODE_WIDTH / 2;
  const halfH = NODE_HEIGHT / 2;
  const sx = Math.abs(dx) < 0.001
    ? Number.POSITIVE_INFINITY
    : halfW / Math.abs(dx);
  const sy = Math.abs(dy) < 0.001
    ? Number.POSITIVE_INFINITY
    : halfH / Math.abs(dy);
  const t = Math.min(sx, sy);
  return { x: from.x + dx * t, y: from.y + dy * t };
}

function pairSiblings(link: Link, links: Link[]): Link[] {
  return links
    .filter((item) =>
      (item.from === link.from && item.to === link.to) ||
      (item.from === link.to && item.to === link.from)
    )
    .toSorted((left, right) => left.id.localeCompare(right.id));
}

function linkLane(link: Link, siblings: Link[]): number {
  if (siblings.length < 2) return 0;
  const index = siblings.findIndex((item) => item.id === link.id);
  return index - (siblings.length - 1) / 2;
}

function offsetSegment(
  start: Point,
  end: Point,
  lane: number,
  /** Canonical axis for the unordered pair — keeps reciprocal lanes apart. */
  axisFrom: Point,
  axisTo: Point,
): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  mx: number;
  my: number;
  px: number;
  py: number;
} {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const ax = axisTo.x - axisFrom.x;
  const ay = axisTo.y - axisFrom.y;
  const alen = Math.hypot(ax, ay) || 1;
  const px = -ay / alen;
  const py = ax / alen;
  const o = lane * LINK_LANE_GAP;
  const inset = Math.min(12, len / 4);
  const x1 = start.x + ux * inset + px * o;
  const y1 = start.y + uy * inset + py * o;
  const x2 = end.x - ux * inset + px * o;
  const y2 = end.y - uy * inset + py * o;
  return {
    x1,
    y1,
    x2,
    y2,
    mx: (x1 + x2) / 2,
    my: (y1 + y2) / 2,
    px,
    py,
  };
}

function linkGeometry(
  link: Link,
  links: Link[],
  positions: Record<string, { x: number; y: number }>,
): LinkGeometry {
  const from = nodeCenter(link.from, positions);
  const to = nodeCenter(link.to, positions);
  const start = rectEdge(from, to);
  const end = rectEdge(to, from);
  const siblings = pairSiblings(link, links);
  const directed = siblings.length >= 2;
  const lane = linkLane(link, siblings);
  const [axisFromId, axisToId] = link.from < link.to
    ? [link.from, link.to]
    : [link.to, link.from];
  const segment = offsetSegment(
    start,
    end,
    lane,
    nodeCenter(axisFromId, positions),
    nodeCenter(axisToId, positions),
  );
  const along = directed ? 0.78 : 0.5;
  const side = lane === 0 ? 1 : Math.sign(lane);
  const labelX = segment.x1 + (segment.x2 - segment.x1) * along +
    segment.px * side * 12;
  const labelY = segment.y1 + (segment.y2 - segment.y1) * along +
    segment.py * side * 12 - (directed ? 0 : 14);
  return {
    x1: segment.x1,
    y1: segment.y1,
    x2: segment.x2,
    y2: segment.y2,
    mx: segment.mx,
    my: segment.my,
    labelX,
    labelY,
    directed,
  };
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function clearTextSelection(): void {
  const selection = globalThis.getSelection?.();
  selection?.removeAllRanges();
}

function selectLink(linkId: string): void {
  selectedLinkId.value = linkId;
  selectedCardId.value = null;
}

function mapLinkVisuals(
  links: Link[],
  all: Link[],
  positions: Record<string, { x: number; y: number }>,
  prefix: string,
) {
  return links.map((link) => (
    <LinkVisual
      key={`${prefix}-${link.id}`}
      link={link}
      geometry={linkGeometry(link, all, positions)}
    />
  ));
}

function LinkVisual(
  { link, geometry }: {
    link: Link;
    geometry: LinkGeometry;
  },
) {
  const selected = selectedLinkId.value === link.id;
  const marker = geometry.directed
    ? (link.kind === "contradicts"
      ? "url(#arrow-contradicts)"
      : "url(#arrow-connects)")
    : undefined;
  return (
    <g
      class={`link link--visual ${
        link.kind === "contradicts" ? "is-contradiction" : ""
      } ${selected ? "is-selected" : ""}`}
    >
      <line
        data-testid="link-line"
        data-link-id={link.id}
        class="link__stroke"
        x1={geometry.x1}
        y1={geometry.y1}
        x2={geometry.x2}
        y2={geometry.y2}
        marker-end={marker}
      />
      {link.label
        ? (
          <g
            class="link__label"
            transform={`translate(${geometry.labelX} ${geometry.labelY})`}
          >
            <rect x="-40" y="-11" width="80" height="22" rx="4" />
            <text text-anchor="middle" y="4">{link.label}</text>
          </g>
        )
        : null}
    </g>
  );
}

function LinkHit(
  { link, geometry }: {
    link: Link;
    geometry: LinkGeometry;
  },
) {
  const selected = selectedLinkId.value === link.id;
  return (
    <g
      class={`link link--hit ${
        link.kind === "contradicts" ? "is-contradiction" : ""
      } ${selected ? "is-selected" : ""}`}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.preventDefault();
        clearTextSelection();
        selectLink(link.id);
      }}
      role="button"
      tabIndex={0}
      aria-label={link.label
        ? `糸: ${link.label}`
        : `糸 ${link.from} → ${link.to}`}
    >
      <line
        class="link__hit"
        x1={geometry.x1}
        y1={geometry.y1}
        x2={geometry.x2}
        y2={geometry.y2}
      />
      <g
        class="link__knob"
        transform={`translate(${geometry.mx} ${geometry.my})`}
      >
        <circle class="link__knob-hit" r="14" />
        <circle class="link__knob-face" r="7" />
      </g>
    </g>
  );
}

function BoardNode({
  card,
  x,
  y,
  isDropTarget,
  isRelated,
  isDimmed,
  onAdhesivePointerDown,
  onPaperPointerDown,
  onThreadPointerDown,
}: {
  card: Card;
  x: number;
  y: number;
  isDropTarget: boolean;
  isRelated: boolean;
  isDimmed: boolean;
  onAdhesivePointerDown: (event: PointerEvent, cardId: string) => void;
  onPaperPointerDown: (event: PointerEvent, cardId: string) => void;
  onThreadPointerDown: (event: PointerEvent, cardId: string) => void;
}) {
  const selected = selectedCardId.value === card.id;
  const threadY = NODE_HEIGHT / 2;
  const thought = card.role === "thought";
  return (
    <g
      class={`board-node ${selected ? "is-selected" : ""} ${
        isDropTarget ? "is-drop-target" : ""
      } ${thought ? "is-thought" : ""} ${isRelated ? "is-related" : ""} ${
        isDimmed ? "is-dimmed" : ""
      }`}
      data-testid="board-node"
      data-card-id={card.id}
      data-role={thought ? "thought" : "finding"}
      data-dimmed={isDimmed ? "true" : undefined}
      transform={`translate(${x} ${y})`}
    >
      <rect
        class="board-node__shadow"
        x="5"
        y="7"
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx="3"
      />
      <rect
        class="board-node__paper"
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx="3"
        onPointerDown={(event) => onPaperPointerDown(event, card.id)}
      />
      <rect
        class="board-node__adhesive"
        data-testid="board-adhesive"
        x="0"
        y="0"
        width={NODE_WIDTH}
        height={ADHESIVE_HEIGHT}
        rx="3"
        onPointerDown={(event) => onAdhesivePointerDown(event, card.id)}
        role="button"
        aria-label="糊付け部分をドラッグして移動"
      />
      <text class="board-node__index" x="18" y="27">
        {thought ? "考察" : "発見"}
      </text>
      {card.url
        ? (
          <a
            class="board-node__source"
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="board-node-source"
            aria-label="出典を開く"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <title>{sourceHost(card.url)}</title>
            <rect
              class="board-node__source-hit"
              x={NODE_WIDTH - 34}
              y="8"
              width="26"
              height="22"
              rx="4"
            />
            <text
              class="board-node__source-mark"
              x={NODE_WIDTH - 21}
              y="24"
              text-anchor="middle"
            >
              ↗
            </text>
          </a>
        )
        : null}
      <foreignObject
        x="18"
        y="40"
        width={NODE_WIDTH - 36}
        height="78"
        style={{ pointerEvents: "none" }}
      >
        <div class="board-node__content">
          <div class="board-node__title">{card.title}</div>
          {card.body?.trim()
            ? (
              <div class="board-node__preview" data-testid="board-node-preview">
                {card.body.trim()}
              </div>
            )
            : null}
        </div>
      </foreignObject>
      <g
        class="board-node__thread"
        data-testid="link-handle"
        transform={`translate(${NODE_WIDTH} ${threadY})`}
        onPointerDown={(event) => onThreadPointerDown(event, card.id)}
        role="button"
        aria-label="糸をドラッグして接続"
      >
        <rect
          class="board-node__thread-hit"
          x="-4"
          y="-16"
          width="36"
          height="32"
        />
        <line class="board-node__thread-cord" x1="0" y1="0" x2="18" y2="0" />
        <path
          class="board-node__thread-end"
          d="M18 -5 Q28 -8 26 0 Q28 8 18 5 Z"
        />
      </g>
    </g>
  );
}

export function BoardView() {
  const current = project.value;
  const sel = selectedCardId.value;
  const focusId = focusCardId.value;
  const hops = focusHops.value;
  const board = current?.boards[0];
  const canvasRef = useRef<HTMLDivElement>(null);
  const [rubber, setRubber] = useState<Rubber | null>(null);
  const dragRef = useRef<Drag | null>(null);

  if (!current || !board) return null;

  const viewport = defaultViewport(board.viewport);
  const cardMap = new Map(current.cards.map((card) => [card.id, card]));
  const focusSet = focusId
    ? reachableCardIds(current.links, focusId, hops)
    : null;
  const visibleLinks = focusSet
    ? current.links.filter((link) =>
      focusSet.has(link.from) && focusSet.has(link.to)
    )
    : current.links;
  const front = sel
    ? visibleLinks.filter((link) => link.from === sel || link.to === sel)
    : [];
  const relatedIds = new Set(
    front.flatMap((link) => [link.from, link.to].filter((id) => id !== sel)),
  );

  function clientToWorld(clientX: number, clientY: number) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const vp = defaultViewport(project.value?.boards[0]?.viewport);
    return {
      x: (clientX - rect.left - vp.x) / vp.zoom,
      y: (clientY - rect.top - vp.y) / vp.zoom,
    };
  }

  function hitNode(
    worldX: number,
    worldY: number,
    exceptId?: string,
  ): string | null {
    const positions = project.value?.boards[0]?.positions ?? {};
    const ids = project.value?.boards[0]?.cardIds ?? [];
    const pad = 12;
    const focused = focusCardId.value
      ? reachableCardIds(
        project.value?.links ?? [],
        focusCardId.value,
        focusHops.value,
      )
      : null;
    for (let index = ids.length - 1; index >= 0; index -= 1) {
      const cardId = ids[index]!;
      if (cardId === exceptId) continue;
      if (focused && !focused.has(cardId)) continue;
      const position = positions[cardId];
      if (!position) continue;
      if (
        worldX >= position.x - pad &&
        worldX <= position.x + NODE_WIDTH + pad &&
        worldY >= position.y - pad &&
        worldY <= position.y + NODE_HEIGHT + pad
      ) {
        return cardId;
      }
    }
    return null;
  }

  function onCanvasPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest(".board-node") || target.closest(".link")) return;
    event.preventDefault();
    clearTextSelection();
    selectedCardId.value = null;
    selectedLinkId.value = null;
    const vp = defaultViewport(project.value?.boards[0]?.viewport);
    dragRef.current = {
      type: "pan",
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...vp },
    };
    canvasRef.current?.setPointerCapture(event.pointerId);
  }

  function onPaperPointerDown(event: PointerEvent, cardId: string) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    clearTextSelection();
    selectedCardId.value = cardId;
    selectedLinkId.value = null;
  }

  function onAdhesivePointerDown(event: PointerEvent, cardId: string) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    clearTextSelection();
    selectedCardId.value = cardId;
    selectedLinkId.value = null;
    const world = clientToWorld(event.clientX, event.clientY);
    const position = project.value?.boards[0]?.positions[cardId] ??
      { x: 0, y: 0 };
    dragRef.current = {
      type: "node",
      cardId,
      offsetX: world.x - position.x,
      offsetY: world.y - position.y,
      originX: position.x,
      originY: position.y,
    };
    canvasRef.current?.setPointerCapture(event.pointerId);
  }

  function onThreadPointerDown(event: PointerEvent, cardId: string) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    clearTextSelection();
    selectedLinkId.value = null;
    selectedCardId.value = null;
    const start = threadAnchor(
      cardId,
      project.value?.boards[0]?.positions ?? {},
    );
    dragRef.current = { type: "link", fromId: cardId, targetId: null };
    setRubber({
      fromId: cardId,
      x1: start.x,
      y1: start.y,
      x2: start.x,
      y2: start.y,
      targetId: null,
    });
    canvasRef.current?.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();
    clearTextSelection();
    if (drag.type === "pan") {
      setBoardViewportLocal({
        x: drag.origin.x + (event.clientX - drag.startX),
        y: drag.origin.y + (event.clientY - drag.startY),
        zoom: drag.origin.zoom,
      });
      return;
    }
    if (drag.type === "node") {
      const world = clientToWorld(event.clientX, event.clientY);
      moveCardOnBoardLocal(
        drag.cardId,
        world.x - drag.offsetX,
        world.y - drag.offsetY,
      );
      return;
    }
    const world = clientToWorld(event.clientX, event.clientY);
    const start = threadAnchor(
      drag.fromId,
      project.value?.boards[0]?.positions ?? {},
    );
    const targetId = hitNode(world.x, world.y, drag.fromId);
    drag.targetId = targetId;
    const tip = targetId
      ? nodeCenter(targetId, project.value?.boards[0]?.positions ?? {})
      : world;
    setRubber({
      fromId: drag.fromId,
      x1: start.x,
      y1: start.y,
      x2: tip.x,
      y2: tip.y,
      targetId,
    });
  }

  async function onPointerUp(event: PointerEvent) {
    const drag = dragRef.current;
    dragRef.current = null;
    setRubber(null);
    if (!drag) return;
    if (drag.type === "pan") {
      await flushSave();
      return;
    }
    if (drag.type === "node") {
      const pos = project.value?.boards[0]?.positions[drag.cardId];
      if (
        pos && (pos.x !== drag.originX || pos.y !== drag.originY)
      ) {
        await commitCardPlacement(drag.cardId);
      } else {
        await flushSave();
      }
      return;
    }
    const world = clientToWorld(event.clientX, event.clientY);
    const dropId = drag.targetId ?? hitNode(world.x, world.y, drag.fromId);
    if (dropId) {
      await connectCards(drag.fromId, dropId);
    }
  }

  function onWheel(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const vp = defaultViewport(project.value?.boards[0]?.viewport);
    const nextZoom = clampZoom(vp.zoom * (event.deltaY < 0 ? 1.08 : 0.92));
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const worldX = (cursorX - vp.x) / vp.zoom;
    const worldY = (cursorY - vp.y) / vp.zoom;
    setBoardViewportLocal({
      x: cursorX - worldX * nextZoom,
      y: cursorY - worldY * nextZoom,
      zoom: nextZoom,
    });
    void flushSave();
  }

  function onDragOver(event: DragEvent) {
    if (!event.dataTransfer?.types.includes(CARD_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  async function onDrop(event: DragEvent) {
    const cardId = event.dataTransfer?.getData(CARD_MIME);
    if (!cardId) return;
    event.preventDefault();
    clearTextSelection();
    const world = clientToWorld(event.clientX, event.clientY);
    await placeCardOnBoard(
      cardId,
      world.x - NODE_WIDTH / 2,
      world.y - NODE_HEIGHT / 2,
    );
  }

  async function submitThought(event: SubmitEvent) {
    event.preventDefault();
    const input = (event.currentTarget as HTMLFormElement)
      .elements.namedItem("thought") as HTMLInputElement;
    const parsed = parseCaptureLine(input.value);
    if (!parsed) return;
    input.value = "";
    const rect = canvasRef.current?.getBoundingClientRect();
    const vp = defaultViewport(project.value?.boards[0]?.viewport);
    await addCard(parsed.title, {
      role: "thought",
      body: parsed.body,
      url: parsed.url,
      placeAt: {
        x: ((rect?.width ?? 640) / 2 - vp.x) / vp.zoom - NODE_WIDTH / 2,
        y: ((rect?.height ?? 480) / 2 - vp.y) / vp.zoom - NODE_HEIGHT / 2,
      },
    });
  }

  return (
    <section class="board" aria-label="捜査ボード">
      <div class="board__toolbar">
        <div>
          <span class="status-dot"></span>
          <strong>{board.name}</strong>
          <small>{board.cardIds.length}件の手がかり</small>
        </div>
        <form class="capture board__thought" onSubmit={submitThought}>
          <input
            name="thought"
            data-testid="thought-input"
            aria-label="考察カードを追加"
            autocomplete="off"
            placeholder="考察を1行で…（// 可）"
          />
          <kbd>↵</kbd>
        </form>
        <div class="board__focus" data-testid="board-focus">
          {focusId
            ? (
              <>
                <small>{hops}周目</small>
                <button
                  type="button"
                  data-testid="focus-expand"
                  onClick={() => expandFocusHops()}
                >
                  もう一周
                </button>
                <button
                  type="button"
                  data-testid="focus-clear"
                  onClick={() => clearFocusView()}
                >
                  全部見る
                </button>
              </>
            )
            : (
              <button
                type="button"
                data-testid="focus-set"
                disabled={!sel}
                onClick={() => sel && setFocusView(sel)}
              >
                この視点で見る
              </button>
            )}
        </div>
        <span class="board__hint">
          上部の糊で移動 / 糸端で接続（往復すると矢印） / 糸は中ほどで選択
        </span>
      </div>
      <div
        class={`board__canvas ${rubber ? "is-linking" : ""}`}
        ref={canvasRef}
        data-testid="board-canvas"
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <svg aria-label="手がかりの関係図">
          <defs>
            {([["arrow-connects", "var(--link)"], [
              "arrow-contradicts",
              "var(--danger)",
            ]] as const).map(([id, fill]) => (
              <marker
                id={id}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={fill} />
              </marker>
            ))}
          </defs>
          <g
            transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}
          >
            <g class="links links--visual" aria-hidden="true">
              {mapLinkVisuals(
                visibleLinks,
                visibleLinks,
                board.positions,
                "v",
              )}
            </g>
            <g class="links links--hit">
              {visibleLinks.map((link) => (
                <LinkHit
                  key={`h-${link.id}`}
                  link={link}
                  geometry={linkGeometry(
                    link,
                    visibleLinks,
                    board.positions,
                  )}
                />
              ))}
            </g>
            <g class="nodes">
              {board.cardIds.map((cardId) => {
                const card = cardMap.get(cardId);
                const position = board.positions[cardId];
                const dimmed = focusSet ? !focusSet.has(cardId) : false;
                return card && position
                  ? (
                    <BoardNode
                      key={card.id}
                      card={card}
                      x={position.x}
                      y={position.y}
                      isDropTarget={!dimmed && rubber?.targetId === card.id}
                      isRelated={!dimmed && relatedIds.has(card.id)}
                      isDimmed={dimmed}
                      onAdhesivePointerDown={onAdhesivePointerDown}
                      onPaperPointerDown={onPaperPointerDown}
                      onThreadPointerDown={onThreadPointerDown}
                    />
                  )
                  : null;
              })}
            </g>
            {rubber
              ? (
                <line
                  class={`link__rubber ${rubber.targetId ? "is-snapped" : ""}`}
                  data-testid="link-rubber"
                  x1={rubber.x1}
                  y1={rubber.y1}
                  x2={rubber.x2}
                  y2={rubber.y2}
                />
              )
              : null}
          </g>
        </svg>
        <svg
          class="board__link-front"
          style="position:absolute;inset:0;pointer-events:none"
        >
          <g
            transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}
          >
            {mapLinkVisuals(front, visibleLinks, board.positions, "f")}
          </g>
        </svg>
        <div class="board__legend">
          <span>
            <i class="thread"></i> 通常
          </span>
          <span>
            <i class="thread is-dashed"></i> 要検討
          </span>
        </div>
      </div>
    </section>
  );
}
