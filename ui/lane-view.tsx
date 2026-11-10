import { t } from "../src/i18n/index.ts";
import { laneMemberCards } from "./project.ts";
import {
  clearLaneView,
  expandStoryHops,
  laneView,
  selectCardFromStoryChrono,
  selectedCardId,
  setStoryChronoOrder,
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
  const { open, originId, hops, order } = laneView.value;
  const selectedId = selectedCardId.value;
  if (!current || !open || !originId) return null;

  const origin = current.cards.find((card) => card.id === originId);
  if (!origin) {
    return (
      <aside class="lane-panel" aria-label={t("lane.label")}>
        <p class="lane-empty">{t("lane.origin.missing")}</p>
        <button
          type="button"
          data-testid="story-chrono-clear"
          onClick={() => clearLaneView()}
        >
          {t("capture.close.label")}
        </button>
      </aside>
    );
  }

  const ascending = sortLaneCards(
    laneMemberCards(current.links, current.cards, origin.id, hops),
  );
  const members = order === "desc" ? ascending.toReversed() : ascending;
  const suspicious = storyOrderSuspicious(members);

  return (
    <aside class="lane-panel" aria-label={t("lane.label")}>
      <header class="lane-panel__header">
        <div class="lane-panel__title-row">
          <h2>{t("lane.label")}</h2>
          <div class="lane-panel__hops" aria-live="polite">
            <span>{t("lane.hops", { hops })}</span>
            <button
              type="button"
              class="lane-panel__hop"
              data-testid="story-chrono-shrink"
              disabled={hops <= 1}
              aria-label={t("stream.focus.shrink.label")}
              onClick={() => shrinkStoryHops()}
            >
              −
            </button>
            <button
              type="button"
              class="lane-panel__hop"
              data-testid="story-chrono-expand"
              aria-label={t("stream.focus.expand.label")}
              onClick={() => expandStoryHops()}
            >
              ＋
            </button>
            <button
              type="button"
              class="lane-panel__hop"
              data-testid="story-chrono-clear"
              aria-label={t("lane.clear")}
              onClick={() => clearLaneView()}
            >
              ×
            </button>
          </div>
        </div>
        <div
          class="lane-panel__order"
          role="group"
          aria-label={t("lane.order.label")}
        >
          <button
            type="button"
            class="lane-panel__order-btn"
            data-testid="story-chrono-order-asc"
            aria-label={t("lane.order.asc")}
            aria-pressed={order === "asc" ? "true" : "false"}
            title={t("lane.order.asc")}
            onClick={() => setStoryChronoOrder("asc")}
          >
            ↑
          </button>
          <button
            type="button"
            class="lane-panel__order-btn"
            data-testid="story-chrono-order-desc"
            aria-label={t("lane.order.desc")}
            aria-pressed={order === "desc" ? "true" : "false"}
            title={t("lane.order.desc")}
            onClick={() => setStoryChronoOrder("desc")}
          >
            ↓
          </button>
        </div>
        <p class="lane-empty">
          {t("lane.origin.hint", { title: origin.title })}
        </p>
      </header>
      {members.length === 0 ? (
        <p class="lane-empty">{t("lane.empty")}</p>
      ) : (
        <ul class="lane-list">
          {members.map((card, index) => (
            <li key={card.id}>
              <button
                type="button"
                class={`lane-list__row${
                  selectedId === card.id ? " is-selected" : ""
                }`}
                data-testid="story-chrono-row"
                data-card-id={card.id}
                aria-current={selectedId === card.id ? "true" : undefined}
                onClick={() => selectCardFromStoryChrono(card.id)}
              >
                <span class="lane-when">
                  {formatStoryWhenLabel(card) || "—"}
                </span>
                <span class="lane-list__title">{card.title}</span>
                {suspicious[index] ? (
                  <span class="lane-flag">{t("lane.order.suspicious")}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
