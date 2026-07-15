import { filteredCards, project, search, selectedCardId } from "./state.ts";
import { CARD_MIME } from "./types.ts";

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
});

export function Stream() {
  const boardCardIds = new Set(project.value?.boards[0]?.cardIds ?? []);
  const isContemplate = (project.value?.ui?.mode ?? "explore") ===
    "contemplate";

  return (
    <section class="stream" aria-label="発見ログ">
      <div class="section-heading">
        <div>
          <span class="eyebrow">タイムライン</span>
          <h2>発見ログ</h2>
        </div>
        <span class="count">{project.value?.cards.length ?? 0}</span>
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
        {filteredCards.value.map((card) => (
          <button
            type="button"
            class={`stream-card ${
              selectedCardId.value === card.id ? "is-selected" : ""
            } ${isContemplate ? "is-draggable" : ""}`}
            data-testid="stream-card"
            data-card-id={card.id}
            data-role={card.role === "thought" ? "thought" : "finding"}
            draggable={isContemplate}
            onDragStart={(event) => {
              if (!isContemplate) return;
              globalThis.getSelection?.()?.removeAllRanges();
              event.dataTransfer?.setData(CARD_MIME, card.id);
              event.dataTransfer!.effectAllowed = "copy";
            }}
            onDragEnd={() => globalThis.getSelection?.()?.removeAllRanges()}
            onClick={() => selectedCardId.value = card.id}
          >
            <span class="stream-card__meta">
              <time>{timeFormatter.format(card.foundAt)}</time>
              <span>
                {card.role === "thought" ? "考察 · " : ""}
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
        ))}
      </div>
    </section>
  );
}
