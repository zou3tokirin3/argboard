import { useEffect, useState } from "preact/hooks";
import {
  focusCardId,
  project,
  removeCard,
  removeLink,
  selectedCard,
  selectedCardId,
  selectedLink,
  selectedLinkId,
  setFocusView,
  updateCard,
  updateLink,
} from "./state.ts";

export function Inspector() {
  const card = selectedCard.value;
  const link = selectedLink.value;
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
            <h2>ラベル</h2>
          </div>
        </div>
        <label class="inspector__field">
          <span>ひとこと</span>
          <input
            type="text"
            data-testid="link-label-input"
            value={label}
            placeholder="同一人物？ など"
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
            onChange={(event) =>
              updateLink(link.id, {
                kind: event.currentTarget.value as "connects" | "contradicts",
              })}
          >
            <option value="connects">通常</option>
            <option value="contradicts">要検討</option>
          </select>
        </label>
        <button
          type="button"
          class="inspector__danger"
          data-testid="link-delete"
          onClick={() => removeLink(link.id)}
        >
          この糸を削除
        </button>
        <p class="inspector__hint">Delete キーでも削除できます</p>
      </aside>
    );
  }

  if (!card) {
    return (
      <aside class="inspector" aria-label="カード編集">
        <p class="inspector__empty">
          カードか糸を選ぶと、ここで編集できます
        </p>
      </aside>
    );
  }

  async function commit() {
    await updateCard(card!.id, { title, body, url });
  }

  const cards = project.value?.cards ?? [];
  const cardLinks =
    project.value?.links.filter((item) =>
      item.from === card.id || item.to === card.id
    ) ?? [];

  return (
    <aside class="inspector" aria-label="カード編集">
      <div class="section-heading">
        <div>
          <span class="eyebrow">簡易編集</span>
          <h2>{card.role === "thought" ? "考察カード" : "発見カード"}</h2>
        </div>
      </div>
      <label class="inspector__field">
        <span>タイトル</span>
        <input
          type="text"
          data-testid="inspector-title"
          value={title}
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
          onInput={(event) => setBody(event.currentTarget.value)}
          onBlur={commit}
        />
      </label>
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
      {focusCardId.value === card.id
        ? (
          <p
            class="inspector__hint inspector__hint--focus"
            data-testid="focus-active-hint"
          >
            視点中。カード近くの − ＋ × で広さの調整と解除
          </p>
        )
        : (
          <>
            <button
              type="button"
              class="inspector__action"
              data-testid="focus-set"
              onClick={() => setFocusView(card.id)}
            >
              この視点で見る
            </button>
            <p class="inspector__hint">
              つながるカードだけを浮かべ、ほかは沈めます
            </p>
          </>
        )}
      <button
        type="button"
        class="inspector__danger"
        data-testid="card-delete"
        onClick={() => removeCard(card.id)}
      >
        このカードを削除
      </button>
      <p class="inspector__hint">Delete キーでも削除できます</p>
    </aside>
  );
}
