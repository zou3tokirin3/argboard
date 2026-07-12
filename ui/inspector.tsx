import { useEffect, useState } from "preact/hooks";
import { selectedCard, updateCard } from "./state.ts";

export function Inspector() {
  const card = selectedCard.value;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    setTitle(card?.title ?? "");
    setBody(card?.body ?? "");
  }, [card?.id, card?.title, card?.body]);

  if (!card) {
    return (
      <aside class="inspector" aria-label="カード編集">
        <p class="inspector__empty">ボード上のカードを選ぶと編集できます</p>
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
          <h2>カード</h2>
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
