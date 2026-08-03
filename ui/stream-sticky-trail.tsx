import { useEffect, useRef, useState } from "preact/hooks";
import type { RefObject } from "preact";
import { DigShovelIcon } from "./digging-controls.tsx";
import { cardFoundViaDepth, foundViaAncestorChain } from "./project.ts";
import { selectCardFromStream } from "./state.ts";
import type { Card } from "./types.ts";

type StreamStickyTrailProps = {
  listRef: RefObject<HTMLDivElement>;
  visibleCards: readonly Card[];
  cardById: ReadonlyMap<string, Card>;
  visibleIds: ReadonlySet<string>;
};

/** px: ancestor mostly above the list top → show in trail */
const TRAIL_SHOW_ABOVE = 36;
/** px: ancestor clearly inside from top → drop from trail (hysteresis) */
const TRAIL_HIDE_BELOW = 52;
const TRAIL_HIDE_DELAY_MS = 220;

function trailKey(cards: readonly Card[]): string {
  return cards.map((item) => item.id).join("\0");
}

function ancestorRowHidden(
  row: HTMLElement | null,
  listRect: DOMRect,
): boolean {
  if (!row) return true;
  const rect = row.getBoundingClientRect();
  return rect.bottom < listRect.top + TRAIL_SHOW_ABOVE;
}

function ancestorRowVisibleEnough(
  row: HTMLElement | null,
  listRect: DOMRect,
): boolean {
  if (!row) return false;
  const rect = row.getBoundingClientRect();
  return rect.top < listRect.top + TRAIL_HIDE_BELOW &&
    rect.bottom > listRect.top + 8;
}

function recomputeTrail(
  list: HTMLElement,
  cardById: ReadonlyMap<string, Card>,
  visibleIds: ReadonlySet<string>,
): Card[] {
  const listRect = list.getBoundingClientRect();
  const rows = list.querySelectorAll<HTMLElement>(".stream-row[data-card-id]");
  const visibleIdsInView: string[] = [];

  for (const row of rows) {
    const id = row.dataset.cardId;
    if (!id) continue;
    const rect = row.getBoundingClientRect();
    if (rect.bottom > listRect.top + 4 && rect.top < listRect.bottom - 4) {
      visibleIdsInView.push(id);
    }
  }

  let deepest: Card | null = null;
  let maxDepth = 0;
  for (const id of visibleIdsInView) {
    const card = cardById.get(id);
    if (!card?.foundVia) continue;
    const depth = cardFoundViaDepth(card, cardById, 12, visibleIds);
    if (depth >= maxDepth) {
      maxDepth = depth;
      deepest = card;
    }
  }

  if (!deepest || maxDepth === 0) return [];

  const chain = foundViaAncestorChain(deepest, cardById, visibleIds);
  return chain.filter((ancestor) => {
    const row = list.querySelector<HTMLElement>(
      `.stream-row[data-card-id="${ancestor.id}"]`,
    );
    if (ancestorRowVisibleEnough(row, listRect)) return false;
    return ancestorRowHidden(row, listRect);
  }) as Card[];
}

export function StreamStickyTrail(props: StreamStickyTrailProps) {
  const [trail, setTrail] = useState<Card[]>([]);
  const { listRef, visibleCards, cardById, visibleIds } = props;
  const stableKey = useRef("");
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const apply = (next: Card[]) => {
      const key = trailKey(next);
      if (key) {
        if (hideTimer.current !== null) {
          clearTimeout(hideTimer.current);
          hideTimer.current = null;
        }
        if (key !== stableKey.current) {
          stableKey.current = key;
          setTrail(next);
        }
        return;
      }
      if (!stableKey.current) return;
      if (hideTimer.current !== null) return;
      hideTimer.current = setTimeout(() => {
        hideTimer.current = null;
        stableKey.current = "";
        setTrail([]);
      }, TRAIL_HIDE_DELAY_MS);
    };

    let frame = 0;
    const update = () => {
      frame = 0;
      apply(recomputeTrail(list, cardById, visibleIds));
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    list.addEventListener("scroll", schedule, { passive: true });
    const mo = new MutationObserver(schedule);
    mo.observe(list, { childList: true, subtree: true });
    schedule();

    return () => {
      list.removeEventListener("scroll", schedule);
      mo.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (hideTimer.current !== null) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
  }, [listRef, visibleCards, cardById, visibleIds]);

  if (trail.length === 0) return null;

  function jumpTo(cardId: string) {
    selectCardFromStream(cardId);
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(
      `.stream-row[data-card-id="${cardId}"]`,
    );
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  return (
    <div
      class="stream__sticky-trail"
      data-testid="stream-sticky-trail"
      aria-label="上にスクロールした親"
    >
      <span class="stream__sticky-trail-mark" aria-hidden="true">
        <DigShovelIcon />
      </span>
      {trail.map((ancestor, index) => (
        <span class="stream__sticky-trail-item" key={ancestor.id}>
          {index > 0
            ? <span class="stream__sticky-trail-sep" aria-hidden="true">›</span>
            : null}
          <button
            type="button"
            class="stream__sticky-trail-btn"
            data-testid="stream-sticky-trail-btn"
            title={ancestor.title}
            onClick={() =>
              jumpTo(ancestor.id)}
          >
            {ancestor.title}
          </button>
        </span>
      ))}
    </div>
  );
}
