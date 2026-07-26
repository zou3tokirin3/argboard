import { useEffect, useState } from "preact/hooks";
import {
  clearReplay,
  enterReplay,
  isReplaying,
  removeCard,
  removeLink,
  replayStepList,
  selectedCard,
  selectedCardId,
  selectedLink,
  selectedLinkId,
  updateCard,
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
} from "./tags.ts";

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
  tags: string[] | undefined;
  disabled: boolean;
}) {
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

  useEffect(() => {
    setDraft("");
    setOpen(false);
    setActive(0);
  }, [props.cardId]);
  useEffect(() => setActive(0), [draft]);

  async function apply(item: TagSuggestItem) {
    if (props.disabled) return;
    await updateCardTags(props.cardId, attachTag(attached, item.name));
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
    <label class="inspector__field inspector__tags">
      <span>タグ（上限{TAG_KIND_LIMIT}・新規は候補から）</span>
      <div class="inspector__tag-chips">
        {attached.map((tag) => {
          const unsettled = (counts.get(tag) ?? 1) === 1;
          return (
            <span
              key={tag}
              class={`inspector__tag-chip${unsettled ? " is-unsettled" : ""}`}
              title={unsettled ? "未定着（1枚のみ）" : tag}
            >
              #{tag}
              <button
                type="button"
                class="inspector__tag-chip-remove"
                disabled={props.disabled}
                aria-label={`「${tag}」を外す`}
                onClick={() => {
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
      <div class="inspector__tag-input-wrap">
        <input
          type="text"
          data-testid="inspector-tag-input"
          value={draft}
          disabled={props.disabled}
          placeholder="付けて整理…"
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
    </label>
  );
}

export function Inspector() {
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
                selectedCardId.value = null;
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
