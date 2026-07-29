import { useEffect, useState } from "preact/hooks";
import { CardRoleToggle } from "./card-role-toggle.tsx";
import { CardImageField } from "./card-image-field.tsx";
import {
  attachTagToCards,
  clearCardSelection,
  clearReplay,
  enterReplay,
  isReplaying,
  mergeProjectTags,
  removeCard,
  removeLink,
  renameProjectTag,
  replayStepList,
  selectedCard,
  selectedCardIds,
  selectedLink,
  selectedLinkId,
  updateCard,
  updateCardSize,
  updateCardTags,
  updateLink,
  viewProject,
} from "./state.ts";
import {
  attachTag,
  buildTagSuggestions,
  collectTagUsage,
  detachTag,
  normalizeTag,
  TAG_KIND_LIMIT,
  type TagSuggestItem,
  type TagUsage,
} from "./tags.ts";

async function organizeTag(tag: string, usage: TagUsage[]): Promise<void> {
  const others = usage.filter((e) => e.name !== tag).map((e) => e.name);
  const next = globalThis.prompt(
    others.length
      ? `「${tag}」を改名、または既存名で統合（${others.join(" / ")}）`
      : `「${tag}」の新しい名前`,
    tag,
  );
  if (next == null) return;
  const name = normalizeTag(next);
  if (!name || name === tag) return;
  if (others.includes(name)) await mergeProjectTags(tag, name);
  else await renameProjectTag(tag, name);
}

function HistoryEntry() {
  const replaying = isReplaying.value;
  const steps = replayStepList.value;
  if (replaying) {
    return (
      <div class="inspector__history">
        <button
          type="button"
          data-testid="replay-exit"
          class="inspector__history-btn"
          onClick={() => clearReplay()}
        >
          いまに戻る
        </button>
      </div>
    );
  }
  return (
    <div class="inspector__history">
      <button
        type="button"
        data-testid="replay-enter"
        class="inspector__history-btn"
        disabled={steps.length === 0}
        title="ボードが育った手順をステップでたどる"
        onClick={() => enterReplay()}
      >
        タイムライン
      </button>
    </div>
  );
}

function TagField(props: {
  cardId: string;
  /** When longer than 1, attach to all and hide per-card chips. */
  cardIds?: string[];
  tags: string[] | undefined;
  disabled: boolean;
}) {
  const ids = props.cardIds ?? [props.cardId];
  const bulk = ids.length > 1;
  const usage = collectTagUsage(viewProject.value?.cards ?? []);
  const attached = props.tags ?? [];
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { items, atLimit } = buildTagSuggestions(draft, usage, attached);
  const q = normalizeTag(draft);
  const blocked = atLimit && !!q && !usage.some((e) => e.name === q) &&
    !attached.some((t) => normalizeTag(t) === q);
  const counts = new Map(usage.map((e) => [e.name, e.count]));
  const resetKey = bulk ? ids.join(",") : props.cardId;

  useEffect(() => {
    setDraft("");
    setOpen(false);
    setActive(0);
  }, [resetKey]);
  useEffect(() => setActive(0), [draft]);

  async function apply(item: TagSuggestItem) {
    if (props.disabled) return;
    if (bulk) await attachTagToCards(ids, item.name);
    else await updateCardTags(props.cardId, attachTag(attached, item.name));
    setDraft("");
    setOpen(false);
    setActive(0);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || !items.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + items.length) % items.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[active];
      if (item) void apply(item);
    }
  }

  return (
    <div class="inspector__field inspector__tags">
      <span>
        {bulk
          ? `タグを一括付与（${ids.length}枚）`
          : `タグ（上限${TAG_KIND_LIMIT}・新規は候補から）`}
      </span>
      {!bulk
        ? (
          <div class="inspector__tag-chips">
            {attached.map((tag) => {
              const unsettled = (counts.get(tag) ?? 1) === 1;
              return (
                <span
                  key={tag}
                  class={`inspector__tag-chip${
                    unsettled ? " is-unsettled" : ""
                  }`}
                  title={unsettled ? "未定着（1枚のみ）" : tag}
                >
                  <span class="inspector__tag-chip-label">#{tag}</span>
                  {unsettled
                    ? (
                      <button
                        type="button"
                        class="inspector__tag-organize-btn"
                        disabled={props.disabled}
                        title="改名または統合"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (!props.disabled) void organizeTag(tag, usage);
                        }}
                      >
                        整理
                      </button>
                    )
                    : null}
                  <button
                    type="button"
                    class="inspector__tag-chip-remove"
                    disabled={props.disabled}
                    aria-label={`「${tag}」を外す`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!props.disabled) {
                        void updateCardTags(
                          props.cardId,
                          detachTag(attached, tag) ?? [],
                        );
                      }
                    }}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )
        : null}
      <div class="inspector__tag-input-wrap">
        <input
          type="text"
          data-testid="inspector-tag-input"
          value={draft}
          disabled={props.disabled}
          placeholder={bulk ? "選んだカードへ付けて整理…" : "付けて整理…"}
          autocomplete="off"
          onInput={(event) => {
            setDraft(event.currentTarget.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        {open && (items.length || blocked)
          ? (
            <ul
              class="inspector__tag-suggest"
              data-testid="inspector-tag-suggest"
              role="listbox"
            >
              {items.map((item, index) => (
                <li key={`${item.kind}:${item.name}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    class={`inspector__tag-suggest-item${
                      index === active ? " is-active" : ""
                    }`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      void apply(item);
                    }}
                  >
                    {item.kind === "create" ? `「${item.name}」を新規作成` : (
                      <>
                        #{item.name}
                        {item.unsettled ? <small>未定着</small> : null}
                      </>
                    )}
                  </button>
                </li>
              ))}
              {blocked
                ? (
                  <li class="inspector__tag-suggest-hint">
                    種類上限です。既存から選ぶか整理してください
                  </li>
                )
                : null}
            </ul>
          )
          : null}
      </div>
    </div>
  );
}

export function Inspector() {
  const multiIds = selectedCardIds.value;
  const card = selectedCard.value;
  const link = selectedLink.value;
  const replaying = isReplaying.value;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");

  useEffect(() => {
    setTitle(card?.title ?? "");
    setBody(card?.body ?? "");
    setUrl(card?.url ?? "");
  }, [card?.id, card?.title, card?.body, card?.url]);

  useEffect(() => {
    setLabel(link?.label ?? "");
  }, [link?.id, link?.label]);

  if (link) {
    return (
      <aside class="inspector" aria-label="糸の編集">
        <div class="section-heading">
          <div>
            <span class="eyebrow">糸</span>
            <h2>{replaying ? "表示" : "ラベル"}</h2>
          </div>
        </div>
        <label class="inspector__field">
          <span>ひとこと</span>
          <input
            type="text"
            data-testid="link-label-input"
            value={label}
            placeholder="同一人物？ など"
            disabled={replaying}
            onInput={(event) => setLabel(event.currentTarget.value)}
            onBlur={() => updateLink(link.id, { label })}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </label>
        <label class="inspector__field">
          <span>状態</span>
          <select
            data-testid="link-kind-toggle"
            value={link.kind}
            disabled={replaying}
            onChange={(event) =>
              updateLink(link.id, {
                kind: event.currentTarget.value as "connects" | "contradicts",
              })}
          >
            <option value="connects">通常</option>
            <option value="contradicts">要検討</option>
          </select>
        </label>
        {replaying
          ? <p class="inspector__hint">タイムライン表示中は読めます</p>
          : (
            <>
              <button
                type="button"
                class="inspector__danger"
                data-testid="link-delete"
                onClick={() => removeLink(link.id)}
              >
                この糸を削除
              </button>
              <p class="inspector__hint">Delete キーでも削除できます</p>
            </>
          )}
        <HistoryEntry />
      </aside>
    );
  }

  if (multiIds.length > 1) {
    return (
      <aside class="inspector" aria-label="複数カードの整理">
        <div class="section-heading">
          <div>
            <span class="eyebrow">複数選択</span>
            <h2>{multiIds.length}枚を整理</h2>
          </div>
        </div>
        <p class="inspector__hint">
          Shift＋空白ドラッグで囲む。紙クリックで追加／もう一度で外す
        </p>
        <TagField
          cardId={multiIds[0]!}
          cardIds={multiIds}
          tags={[]}
          disabled={replaying}
        />
        <HistoryEntry />
      </aside>
    );
  }

  if (!card) {
    return (
      <aside class="inspector" aria-label="カード編集">
        <p class="inspector__empty">
          カードか糸を選ぶと、ここで編集できます
        </p>
        <HistoryEntry />
      </aside>
    );
  }

  async function commit() {
    if (isReplaying.value) return;
    await updateCard(card!.id, { title, body, url });
  }

  const cards = viewProject.value?.cards ?? [];
  const cardLinks =
    viewProject.value?.links.filter((item) =>
      item.from === card.id || item.to === card.id
    ) ?? [];

  return (
    <aside class="inspector" aria-label="カード編集">
      <div class="section-heading">
        <div>
          <span class="eyebrow">{replaying ? "タイムライン" : "簡易編集"}</span>
          <h2>{card.role === "thought" ? "考察カード" : "発見カード"}</h2>
        </div>
        <div class="inspector__heading-tools">
          <CardRoleToggle
            cardId={card.id}
            role={card.role}
            disabled={replaying}
            testIdPrefix="inspector"
          />
          <div
            class="inspector__size-toggle"
            role="group"
            aria-label="ボード上のサイズ"
          >
            <button
              type="button"
              class={card.size === "l" ? undefined : "is-active"}
              data-testid="inspector-card-size-m"
              aria-pressed={card.size !== "l"}
              title="標準"
              disabled={replaying}
              onClick={() => void updateCardSize(card.id, "m")}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <rect
                  x="4"
                  y="5"
                  width="8"
                  height="6"
                  rx="1"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
              </svg>
            </button>
            <button
              type="button"
              class={card.size === "l" ? "is-active" : undefined}
              data-testid="inspector-card-size-l"
              aria-pressed={card.size === "l"}
              title="大きめ"
              disabled={replaying}
              onClick={() => void updateCardSize(card.id, "l")}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <rect
                  x="2"
                  y="3"
                  width="12"
                  height="10"
                  rx="1.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <label class="inspector__field">
        <span>タイトル</span>
        <input
          type="text"
          data-testid="inspector-title"
          value={title}
          disabled={replaying}
          onInput={(event) => setTitle(event.currentTarget.value)}
          onBlur={commit}
        />
      </label>
      <label class="inspector__field">
        <span>出典URL</span>
        <input
          type="url"
          data-testid="inspector-url"
          value={url}
          placeholder="https://"
          disabled={replaying}
          onInput={(event) => setUrl(event.currentTarget.value)}
          onBlur={commit}
        />
      </label>
      <label class="inspector__field">
        <span>メモ</span>
        <textarea
          data-testid="inspector-body"
          rows={6}
          value={body}
          disabled={replaying}
          onInput={(event) => setBody(event.currentTarget.value)}
          onBlur={commit}
        />
      </label>
      <div class="inspector__field">
        <CardImageField
          cardId={card.id}
          image={card.image}
          disabled={replaying}
          variant="compact"
          testId="inspector-image"
        />
      </div>
      <TagField
        cardId={card.id}
        tags={card.tags}
        disabled={replaying}
      />
      {cardLinks.length
        ? (
          <label class="inspector__field">
            <span>つながり</span>
            <select
              data-testid="card-links"
              value=""
              onChange={(event) => {
                const id = event.currentTarget.value;
                if (!id) return;
                selectedLinkId.value = id;
                clearCardSelection();
              }}
            >
              <option value="">糸を選ぶ…</option>
              {cardLinks.map((item) => {
                const other = cards.find((c) =>
                  c.id === (item.from === card.id ? item.to : item.from)
                );
                return (
                  <option key={item.id} value={item.id}>
                    {other?.title ?? "？"} · {item.label || "（ラベルなし）"} ·
                    {" "}
                    {item.kind === "contradicts" ? "要検討" : "通常"}
                  </option>
                );
              })}
            </select>
          </label>
        )
        : null}
      {replaying
        ? <p class="inspector__hint">タイムライン表示中は読めます</p>
        : (
          <>
            <button
              type="button"
              class="inspector__danger"
              data-testid="card-delete"
              onClick={() => removeCard(card.id)}
            >
              このカードを削除
            </button>
            <p class="inspector__hint">Delete キーでも削除できます</p>
          </>
        )}
      <HistoryEntry />
    </aside>
  );
}
