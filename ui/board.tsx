import { useEffect, useRef, useState } from "preact/hooks";
import {
  connectCards,
  flushSave,
  moveCardOnBoardLocal,
  placeCardOnBoard,
  project,
  removeLink,
  selectedCardId,
  selectedLinkId,
  setBoardViewportLocal,
} from "./state.ts";
import type { Card, Link } from "./types.ts";
import { CARD_MIME } from "./types.ts";

const NODE_WIDTH = 235;
const NODE_HEIGHT = 128;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;

type Viewport = { x: number; y: number; zoom: number };

function defaultViewport(boardViewport?: Viewport): Viewport {
  return boardViewport ?? { x: 0, y: 0, zoom: 1 };
}

function nodeCenter(
  cardId: string,
  positions: Record<string, { x: number; y: number }>,
) {
  const position = positions[cardId] ?? { x: 0, y: 0 };
  return { x: position.x + NODE_WIDTH / 2, y: position.y + NODE_HEIGHT / 2 };
}

function threadAnchor(
  cardId: string,
  positions: Record<string, { x: number; y: number }>,
) {
  const position = positions[cardId] ?? { x: 0, y: 0 };
  return { x: position.x + NODE_WIDTH, y: position.y + NODE_HEIGHT / 2 };
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function clearTextSelection(): void {
  const selection = globalThis.getSelection?.();
  selection?.removeAllRanges();
}

function LinkLine(
  { link, positions }: {
    link: Link;
    positions: Record<string, { x: number; y: number }>;
  },
) {
  const from = nodeCenter(link.from, positions);
  const to = nodeCenter(link.to, positions);
  const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const selected = selectedLinkId.value === link.id;
  return (
    <g
      class={`link ${link.kind === "contradicts" ? "is-contradiction" : ""} ${
        selected ? "is-selected" : ""
      }`}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.preventDefault();
        clearTextSelection();
        selectedLinkId.value = link.id;
        selectedCardId.value = null;
      }}
      role="button"
      tabIndex={0}
      aria-label={link.label ? `糸: ${link.label}` : "糸を選択"}
    >
      <line
        class="link__hit"
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
      />
      <line
        data-testid="link-line"
        data-link-id={link.id}
        class="link__stroke"
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
      />
      <g
        class="link__knob"
        transform={`translate(${midpoint.x} ${midpoint.y})`}
      >
        <circle class="link__knob-hit" r="14" />
        <circle class="link__knob-face" r="7" />
      </g>
      {link.label
        ? (
          <g
            class="link__label"
            transform={`translate(${midpoint.x} ${midpoint.y - 22})`}
          >
            <rect x="-48" y="-13" width="96" height="26" rx="5" />
            <text text-anchor="middle" y="4">{link.label}</text>
          </g>
        )
        : null}
    </g>
  );
}

function BoardNode({
  card,
  x,
  y,
  isDropTarget,
  onPaperPointerDown,
  onPinPointerDown,
  onThreadPointerDown,
}: {
  card: Card;
  x: number;
  y: number;
  isDropTarget: boolean;
  onPaperPointerDown: (event: PointerEvent, cardId: string) => void;
  onPinPointerDown: (event: PointerEvent, cardId: string) => void;
  onThreadPointerDown: (event: PointerEvent, cardId: string) => void;
}) {
  const selected = selectedCardId.value === card.id;
  const pinX = NODE_WIDTH / 2;
  const threadY = NODE_HEIGHT / 2;
  return (
    <g
      class={`board-node ${selected ? "is-selected" : ""} ${
        isDropTarget ? "is-drop-target" : ""
      }`}
      data-testid="board-node"
      data-card-id={card.id}
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
      <text class="board-node__index" x="18" y="27">
        {card.id.slice(0, 8)}
      </text>
      <foreignObject x="18" y="40" width={NODE_WIDTH - 36} height="70">
        <div class="board-node__title">{card.title}</div>
      </foreignObject>

      {/* Pin: move card. Invisible hit disc is larger than the visible head. */}
      <g
        class="board-node__pin"
        data-testid="board-pin"
        transform={`translate(${pinX} 0)`}
        onPointerDown={(event) => onPinPointerDown(event, card.id)}
        role="button"
        aria-label="ピンをドラッグして移動"
      >
        <circle class="board-node__pin-hit" cx="0" cy="2" r="18" />
        <circle class="board-node__pin-head" cx="0" cy="0" r="9" />
        <polygon
          class="board-node__pin-needle"
          points="-3,6 3,6 0,18"
        />
      </g>

      {/* Thread stub: draw a link. Not a pin — a short thread end. */}
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
  const board = current?.boards[0];
  const canvasRef = useRef<HTMLDivElement>(null);
  const [rubber, setRubber] = useState<
    {
      fromId: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      targetId: string | null;
    } | null
  >(null);
  const dragRef = useRef<
    | {
      type: "pan";
      startX: number;
      startY: number;
      origin: Viewport;
    }
    | {
      type: "node";
      cardId: string;
      offsetX: number;
      offsetY: number;
    }
    | {
      type: "link";
      fromId: string;
      targetId: string | null;
    }
    | null
  >(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const linkId = selectedLinkId.value;
      if (!linkId) return;
      event.preventDefault();
      void removeLink(linkId);
    }
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!current || !board) return null;

  const viewport = defaultViewport(board.viewport);
  const cardMap = new Map(current.cards.map((card) => [card.id, card]));

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
    for (let index = ids.length - 1; index >= 0; index -= 1) {
      const cardId = ids[index]!;
      if (cardId === exceptId) continue;
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

  function onPinPointerDown(event: PointerEvent, cardId: string) {
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
    if (drag.type === "pan" || drag.type === "node") {
      await flushSave();
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

  return (
    <section class="board" aria-label="捜査ボード">
      <div class="board__toolbar">
        <div>
          <span class="status-dot"></span>
          <strong>{board.name}</strong>
          <small>{board.cardIds.length}件の手がかり</small>
        </div>
        <span class="board__hint">
          ピンで移動 / 右の糸端で接続 / 紙面は選択
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
          <g
            transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}
          >
            <g class="nodes">
              {board.cardIds.map((cardId) => {
                const card = cardMap.get(cardId);
                const position = board.positions[cardId];
                return card && position
                  ? (
                    <BoardNode
                      key={card.id}
                      card={card}
                      x={position.x}
                      y={position.y}
                      isDropTarget={rubber?.targetId === card.id}
                      onPaperPointerDown={onPaperPointerDown}
                      onPinPointerDown={onPinPointerDown}
                      onThreadPointerDown={onThreadPointerDown}
                    />
                  )
                  : null;
              })}
            </g>
            {/* Links above nodes so threads stay clickable. */}
            <g class="links">
              {current.links.map((link) => (
                <LinkLine
                  key={link.id}
                  link={link}
                  positions={board.positions}
                />
              ))}
              {rubber
                ? (
                  <line
                    class={`link__rubber ${
                      rubber.targetId ? "is-snapped" : ""
                    }`}
                    data-testid="link-rubber"
                    x1={rubber.x1}
                    y1={rubber.y1}
                    x2={rubber.x2}
                    y2={rubber.y2}
                  />
                )
                : null}
            </g>
          </g>
        </svg>
        <div class="board__legend">
          <span>
            <i class="thread"></i> 関連
          </span>
          <span>
            <i class="thread is-dashed"></i> 矛盾
          </span>
        </div>
      </div>
    </section>
  );
}
