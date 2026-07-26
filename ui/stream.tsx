import {
  filteredCards,
  isReplaying,
  removeCard,
  search,
  selectCardFromStream,
  selectedCardId,
  viewProject,
} from "./state.ts";
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
          onInput={(event) => search.value = event.currentTarget.value}
          placeholder="手がかりを検索"
          aria-label="手がかりを検索"
        />
      </label>
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
                    </span>
                  </span>
                  <strong>{card.title}</strong>
                  {card.body ? <small>{card.body}</small> : null}
                  {card.tags?.length
                    ? (
                      <span class="tags">
                        {card.tags.map((tag) => <i key={tag}>#{tag}</i>)}
                      </span>
                    )
                    : null}
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
