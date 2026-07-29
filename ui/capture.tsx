import { useRef, useState } from "preact/hooks";
import { parseCaptureLine } from "./capture-notation.ts";
import { addCard } from "./state.ts";

const HISTORY_KEY = "argboard.captureHistory";
const HISTORY_MAX = 50;

function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(-HISTORY_MAX);
  } catch {
    return [];
  }
}

function writeHistory(lines: string[]): void {
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(lines.slice(-HISTORY_MAX)),
    );
  } catch {
    // Quota or privacy mode: history is best-effort only.
  }
}

function pushHistory(lines: string[], line: string): string[] {
  const clean = line.trim();
  if (!clean) return lines;
  if (lines[lines.length - 1] === clean) return lines;
  return [...lines, clean].slice(-HISTORY_MAX);
}

export function Capture() {
  const input = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState(readHistory);
  /** -1 = live draft; 0..n-1 = history entry (oldest → newest). */
  const [historyIndex, setHistoryIndex] = useState(-1);
  const draftRef = useRef("");

  function showLine(line: string): void {
    if (!input.current) return;
    input.current.value = line;
    const end = line.length;
    input.current.setSelectionRange(end, end);
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const line = input.current?.value ?? "";
    const parsed = parseCaptureLine(line);
    if (!parsed) return;
    // Clear first so the next capture can start while save drains.
    if (input.current) input.current.value = "";
    draftRef.current = "";
    setHistoryIndex(-1);
    const next = pushHistory(history, line);
    setHistory(next);
    writeHistory(next);
    await addCard(parsed.title, { body: parsed.body, url: parsed.url });
  }

  function onHistoryKey(event: KeyboardEvent): void {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (history.length === 0) return;

    const value = event.currentTarget instanceof HTMLInputElement
      ? event.currentTarget.value
      : "";

    if (event.key === "ArrowUp") {
      // Don't steal ↑ while editing a fresh (non-history) line.
      if (historyIndex < 0 && value.trim()) return;
      event.preventDefault();
      if (historyIndex < 0) {
        draftRef.current = value;
        const next = history.length - 1;
        setHistoryIndex(next);
        showLine(history[next]!);
        return;
      }
      if (historyIndex <= 0) return;
      const next = historyIndex - 1;
      setHistoryIndex(next);
      showLine(history[next]!);
      return;
    }

    // ArrowDown
    if (historyIndex < 0) return;
    event.preventDefault();
    if (historyIndex >= history.length - 1) {
      setHistoryIndex(-1);
      showLine(draftRef.current);
      return;
    }
    const next = historyIndex + 1;
    setHistoryIndex(next);
    showLine(history[next]!);
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
          onKeyDown={onHistoryKey}
          onInput={() => {
            if (historyIndex >= 0) setHistoryIndex(-1);
          }}
        />
        <kbd>↵</kbd>
      </form>
      <p class="capture-hint" id="capture-hint">
        <code>題 // ひとこと</code> · URLはそのまま貼ると出典に ·
        <kbd>↑</kbd>/<kbd>↓</kbd> で入力履歴 · タグはカード選択後に追加
      </p>
    </div>
  );
}
