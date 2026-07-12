import { project, selectedCardId } from "./state.ts";
import type { Card, Link } from "./types.ts";

const NODE_WIDTH = 235;
const NODE_HEIGHT = 128;

function nodeCenter(
  cardId: string,
  positions: Record<string, { x: number; y: number }>,
) {
  const position = positions[cardId] ?? { x: 0, y: 0 };
  return { x: position.x + NODE_WIDTH / 2, y: position.y + NODE_HEIGHT / 2 };
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
  return (
    <g class={link.kind === "contradicts" ? "link is-contradiction" : "link"}>
      <line
        data-testid="link-line"
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
      />
      {link.label
        ? (
          <g transform={`translate(${midpoint.x} ${midpoint.y})`}>
            <rect x="-48" y="-13" width="96" height="26" rx="5" />
            <text text-anchor="middle" y="4">{link.label}</text>
          </g>
        )
        : null}
    </g>
  );
}

function BoardNode({ card, x, y }: { card: Card; x: number; y: number }) {
  const selected = selectedCardId.value === card.id;
  return (
    <g
      class={`board-node ${selected ? "is-selected" : ""}`}
      data-testid="board-node"
      transform={`translate(${x} ${y})`}
      onClick={() => selectedCardId.value = card.id}
      role="button"
      tabIndex={0}
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
      />
      <rect
        class="board-node__pin"
        x={NODE_WIDTH / 2 - 8}
        y="-7"
        width="16"
        height="16"
        rx="8"
      />
      <text class="board-node__index" x="18" y="27">
        {card.id.slice(0, 8)}
      </text>
      <foreignObject x="18" y="40" width={NODE_WIDTH - 36} height="70">
        <div class="board-node__title">{card.title}</div>
      </foreignObject>
    </g>
  );
}

export function BoardView() {
  const current = project.value;
  const board = current?.boards[0];
  if (!current || !board) return null;
  const cardMap = new Map(current.cards.map((card) => [card.id, card]));

  return (
    <section class="board" aria-label="捜査ボード">
      <div class="board__toolbar">
        <div>
          <span class="status-dot"></span>
          <strong>{board.name}</strong>
          <small>{board.cardIds.length}件の手がかり</small>
        </div>
        <span class="board__hint">カードを選ぶと右で編集できます</span>
      </div>
      <div class="board__canvas">
        <svg viewBox="0 0 800 590" aria-label="手がかりの関係図">
          <g class="links">
            {current.links.map((link) => (
              <LinkLine link={link} positions={board.positions} />
            ))}
          </g>
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
                  />
                )
                : null;
            })}
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
