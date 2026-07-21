import { useRef } from "preact/hooks";
import { parseCaptureLine } from "./capture-notation.ts";
import { addCard } from "./state.ts";

export function Capture() {
  const input = useRef<HTMLInputElement>(null);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const parsed = parseCaptureLine(input.current?.value ?? "");
    if (!parsed) return;
    // Clear first so the next capture can start while save drains.
    if (input.current) input.current.value = "";
    await addCard(parsed.title, { body: parsed.body, url: parsed.url });
  }

  return (
    <div class="capture-block">
      <form class="capture" onSubmit={submit}>
        <span class="capture__plus" aria-hidden="true">＋</span>
        <input
          ref={input}
          data-testid="capture-input"
          aria-label="新しい手がかり"
          aria-describedby="capture-hint"
          autocomplete="off"
          placeholder="見つけたことを1行で…"
        />
        <kbd>↵</kbd>
      </form>
      <p class="capture-hint" id="capture-hint">
        <code>題 // ひとこと</code> · URLはそのまま貼ると出典に
      </p>
    </div>
  );
}
