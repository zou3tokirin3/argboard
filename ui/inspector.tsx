import { useEffect, useState } from "preact/hooks";
import {
  removeLink,
  selectedCard,
  selectedLink,
  updateCard,
  updateLink,
} from "./state.ts";

export function Inspector() {
  const card = selectedCard.value;
  const link = selectedLink.value;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [label, setLabel] = useState("");

  useEffect(() => {
    setTitle(card?.title ?? "");
    setBody(card?.body ?? "");
  }, [card?.id, card?.title, card?.body]);

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
    await updateCard(card!.id, { title, body });
  }

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
        <span>メモ</span>
        <textarea
          data-testid="inspector-body"
          rows={6}
          value={body}
          onInput={(event) => setBody(event.currentTarget.value)}
          onBlur={commit}
        />
      </label>
    </aside>
  );
}
