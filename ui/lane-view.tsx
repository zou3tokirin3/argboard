import { laneMemberCards } from "./project.ts";
import {
  clearLaneView,
  expandStoryHops,
  laneView,
  selectSingleCard,
  shrinkStoryHops,
  viewProject,
} from "./state.ts";
import {
  formatStoryWhenLabel,
  sortLaneCards,
  storyOrderSuspicious,
} from "./story-when.ts";

export function LaneWorkspace() {
  const current = viewProject.value;
  const { open, originId, hops } = laneView.value;
  if (!current || !open || !originId) return null;

  const origin = current.cards.find((card) => card.id === originId);
  if (!origin) {
    return (
      <div class="lane-panel">
        <p class="lane-empty">起点カードが見つかりません</p>
        <button
          type="button"
          data-testid="story-chrono-clear"
          onClick={() => clearLaneView()}
        >
          閉じる
        </button>
      </div>
    );
  }

  const members = sortLaneCards(
    laneMemberCards(current.links, current.cards, origin.id, hops),
  );
  const suspicious = storyOrderSuspicious(members);

  return (
    <div class="lane-panel">
      <header class="lane-panel__header">
        <div class="lane-panel__title-row">
          <h2>作中で並べる</h2>
          <div class="lane-panel__hops" aria-live="polite">
            <span>作中 · {hops}</span>
            <button
              type="button"
              class="lane-panel__hop"
              data-testid="story-chrono-shrink"
              disabled={hops <= 1}
              aria-label="一周戻す"
              onClick={() => shrinkStoryHops()}
            >
              −
            </button>
            <button
              type="button"
              class="lane-panel__hop"
              data-testid="story-chrono-expand"
              aria-label="もう一周広げる"
              onClick={() => expandStoryHops()}
            >
              ＋
            </button>
            <button
              type="button"
              class="lane-panel__hop"
              data-testid="story-chrono-clear"
              aria-label="作中並びをやめる"
              onClick={() => clearLaneView()}
            >
              ×
            </button>
          </div>
        </div>
        <p class="lane-empty">
          「{origin.title}」から糸で届く作中時間つきカード。配置は覚えません。
        </p>
      </header>
      {members.length === 0
        ? <p class="lane-empty">この範囲に作中時間つきカードがありません</p>
        : (
          <ul class="lane-list">
            {members.map((card, index) => (
              <li key={card.id}>
                <button
                  type="button"
                  class="lane-list__row"
                  data-testid="story-chrono-row"
                  data-card-id={card.id}
                  onClick={() => selectSingleCard(card.id)}
                >
                  <span class="lane-when">
                    {formatStoryWhenLabel(card) || "—"}
                  </span>
                  <span class="lane-list__title">{card.title}</span>
                  {suspicious[index]
                    ? <span class="lane-flag">順が怪しい</span>
                    : null}
                </button>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
