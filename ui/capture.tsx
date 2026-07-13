import { useRef } from "preact/hooks";
import { addCard } from "./state.ts";

export function Capture() {
  const input = useRef<HTMLInputElement>(null);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const title = input.current?.value ?? "";
    if (!title.trim()) return;
    // Clear first so the next capture can start while save drains.
    if (input.current) input.current.value = "";
    await addCard(title);
  }

  return (
    <form class="capture" onSubmit={submit}>
      <span class="capture__plus" aria-hidden="true">＋</span>
      <input
        ref={input}
        data-testid="capture-input"
        aria-label="新しい手がかり"
        autocomplete="off"
        placeholder="見つけたことを1行で…"
      />
      <kbd>↵</kbd>
    </form>
  );
}
