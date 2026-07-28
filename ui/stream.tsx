import {
  clearFocusView,
  expandFocusHops,
  filteredCards,
  focusHops,
  focusOrigin,
  isReplaying,
  removeCard,
  search,
  selectCardFromStream,
  selectedCardId,
  setFocusViewByTag,
  shrinkFocusHops,
  unplacedOnly,
  viewProject,
} from "./state.ts";
import { MediaThumb } from "./media-thumb.tsx";
import { isLocalMediaRef } from "./media.ts";
import { collectTagUsage } from "./tags.ts";
import { CARD_MIME } from "./types.ts";

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
});

function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

function TagFocusControls() {
  const current = viewProject.value;
  const usage = current ? collectTagUsage(current.cards) : [];
  if (usage.length === 0) return null;
  const origin = focusOrigin.value;
  const tagFocus = origin?.kind === "tag" ? origin.tag : null;
  const hops = focusHops.value;
  return (
    <div class="stream__tag-focus">
      <div class="stream__tag-focus-list" role="group" aria-label="タグで視点">
        {usage.map((entry) => (
          <button
            key={entry.name}
            type="button"
            class={`stream__tag-focus-btn${
              tagFocus === entry.name ? " is-active" : ""
            }`}
            data-testid="stream-tag-focus-btn"
            data-tag={entry.name}
            aria-pressed={tagFocus === entry.name}
            title={`「${entry.name}」の視点で見る（${entry.count}件）`}
            onClick={() => setFocusViewByTag(entry.name)}
          >
            #{entry.name}
            <span class="stream__tag-focus-count">{entry.count}</span>
          </button>
        ))}
      </div>
      {tagFocus
        ? (
          <div class="stream__tag-focus-ops" aria-label={`視点 #${tagFocus}`}>
            <span class="board__focus-meta" aria-live="polite">
              視点 · {hops}
            </span>
            <button
              type="button"
              class="board__focus-icon"
              disabled={hops <= 1}
              aria-label="一周戻す"
              title="一周戻す"
              onClick={() => shrinkFocusHops()}
            >
              −
            </button>
            <button
              type="button"
              class="board__focus-icon"
              aria-label="もう一周広げる"
              title="もう一周広げる"
              onClick={() => expandFocusHops()}
            >
              ＋
            </button>
            <button
              type="button"
              class="board__focus-icon"
              data-testid="tag-focus-clear"
              aria-label="視点をやめる"
              title="視点をやめる"
              onClick={() => clearFocusView()}
            >
              ×
            </button>
          </div>
        )
        : null}
    </div>
  );
}

export function Stream() {
  const current = viewProject.value;
  const replaying = isReplaying.value;
  const boardCardIds = new Set(current?.boards[0]?.cardIds ?? []);
  const isContemplate = (current?.ui?.mode ?? "explore") === "contemplate";
  const canDrag = isContemplate && !replaying;

  return (
    <section class="stream" aria-label="発見ログ">
      <div class="section-heading">
        <div>
          <span class="eyebrow">タイムライン</span>
          <h2>発見ログ</h2>
        </div>
        <span class="count">{current?.cards.length ?? 0}</span>
      </div>
      <label class="search">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={search.value}
          onInput={(event) => {
            search.value = event.currentTarget.value;
            if (!search.value.trim() && focusOrigin.value?.kind === "tag") {
              clearFocusView();
            }
          }}
          placeholder="手がかりを検索"
          aria-label="手がかりを検索"
        />
      </label>
      <div class="stream__filters">
        <button
          type="button"
          class={`stream__filter-btn${unplacedOnly.value ? " is-active" : ""}`}
          data-testid="stream-unplaced-only"
          aria-pressed={unplacedOnly.value}
          title="ボードに未配置のカードだけを表示"
          onClick={() => {
            unplacedOnly.value = !unplacedOnly.value;
          }}
        >
          未配置のみ
        </button>
      </div>
      <TagFocusControls />
      <div class="stream__list">
        {filteredCards.value.map((card) => {
          const selected = selectedCardId.value === card.id;
          return (
            <div class="stream-row" key={card.id}>
              <div
                class={`stream-card ${selected ? "is-selected" : ""} ${
                  card.role === "thought" ? "is-thought" : ""
                } ${canDrag ? "is-draggable" : ""}`}
                data-testid="stream-card"
                data-card-id={card.id}
                data-role={card.role === "thought" ? "thought" : "finding"}
              >
                <button
                  type="button"
                  class="stream-card__main"
                  draggable={canDrag}
                  onDragStart={(event) => {
                    if (!canDrag) return;
                    globalThis.getSelection?.()?.removeAllRanges();
                    event.dataTransfer?.setData(CARD_MIME, card.id);
                    event.dataTransfer!.effectAllowed = "copy";
                  }}
                  onDragEnd={() =>
                    globalThis.getSelection?.()?.removeAllRanges()}
                  onClick={() => selectCardFromStream(card.id)}
                >
                  <span class="stream-card__meta">
                    <time>{timeFormatter.format(card.foundAt)}</time>
                    <span>
                      {card.role === "thought" ? "考察" : "発見"} ·{" "}
                      {boardCardIds.has(card.id) ? "ボード済" : "未配置"}
                      {isLocalMediaRef(card.image) ? " · 画像" : ""}
                    </span>
                  </span>
                  <span class="stream-card__body-row">
                    <span class="stream-card__text">
                      <strong>{card.title}</strong>
                      {card.body ? <small>{card.body}</small> : null}
                      {card.tags?.length
                        ? (
                          <span class="tags">
                            {card.tags.map((tag) => <i key={tag}>#{tag}</i>)}
                          </span>
                        )
                        : null}
                    </span>
                    {isLocalMediaRef(card.image)
                      ? (
                        <MediaThumb
                          image={card.image}
                          className="stream-card__thumb"
                        />
                      )
                      : null}
                  </span>
                </button>
                {card.url
                  ? (
                    <a
                      class="stream-card__url"
                      data-testid="stream-card-url"
                      href={card.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {sourceLabel(card.url)}
                    </a>
                  )
                  : null}
              </div>
              {selected && !replaying
                ? (
                  <button
                    type="button"
                    class="inspector__danger stream-card__delete"
                    data-testid="stream-card-delete"
                    onClick={() => removeCard(card.id)}
                  >
                    削除
                  </button>
                )
                : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
