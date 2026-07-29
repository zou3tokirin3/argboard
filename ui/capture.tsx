import { useEffect, useRef, useState } from "preact/hooks";
import { readCaptureDraft } from "./capture-draft.ts";
import { CardImageField } from "./card-image-field.tsx";
import { parseCaptureLine } from "./capture-notation.ts";
import { CardRoleToggle } from "./card-role-toggle.tsx";
import {
  imageBlobFromClipboard,
  imageBlobFromDataTransfer,
} from "./clipboard-image.ts";
import { isLocalMediaRef } from "./media.ts";
import {
  addCard,
  clearExploreImageDraft,
  closeExploreCompose,
  commitExploreImageDraft,
  exploreComposeCard,
  exploreImageDraft,
  isReplaying,
  pasteExploreImage,
  patchExploreImageDraft,
  updateCard,
} from "./state.ts";

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

function CaptureImageSlot(props: {
  disabled: boolean;
  getDraftLine: () => string;
}) {
  const [busy, setBusy] = useState(false);

  async function applyBlob(blob: Blob | undefined) {
    if (!blob || props.disabled || busy) return;
    setBusy(true);
    try {
      const line = props.getDraftLine().trim();
      const draft = line ? parseCaptureLine(line) : readCaptureDraft();
      await pasteExploreImage(blob, draft ?? undefined);
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "画像を添付できませんでした",
      );
    } finally {
      setBusy(false);
    }
  }

  function onPaste(event: ClipboardEvent) {
    if (props.disabled) return;
    const blob = imageBlobFromClipboard(event);
    if (!blob) return;
    event.preventDefault();
    void applyBlob(blob);
  }

  function onPick(event: Event) {
    event.stopPropagation();
    if (props.disabled || busy) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      setBusy(true);
      const line = props.getDraftLine().trim();
      const draft = line ? parseCaptureLine(line) : readCaptureDraft();
      void pasteExploreImage(file, draft ?? undefined).catch((error) => {
        alert(
          error instanceof Error ? error.message : "画像を添付できませんでした",
        );
      }).finally(() => setBusy(false));
    };
    input.click();
  }

  return (
    <>
      <div
        class="capture__image-slot"
        data-testid="capture-image-slot"
        tabIndex={props.disabled ? -1 : 0}
        title="スクショを貼る（⌘V）"
        onPaste={onPaste}
        role="group"
        aria-label="スクショを貼り付け"
      >
        <span aria-hidden="true">🖼</span>
      </div>
      <button
        type="button"
        class="capture__image-pick"
        data-testid="capture-image-pick"
        title="画像ファイルを選ぶ"
        aria-label="画像ファイルを選ぶ"
        disabled={props.disabled || busy}
        onClick={onPick}
      >
        …
      </button>
    </>
  );
}

function ExploreImageStaging() {
  const draft = exploreImageDraft.value;
  const replaying = isReplaying.value;
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, [draft?.previewUrl]);

  if (!draft) return null;

  async function commitStaging() {
    if (replaying) return;
    try {
      await commitExploreImageDraft();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "カードを追加できませんでした",
      );
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    await commitStaging();
  }

  function onStagingKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void commitStaging();
    }
  }

  return (
    <form
      class="capture-compose capture-image-staging"
      data-testid="capture-image-staging"
      onSubmit={submit}
      onKeyDown={onStagingKeyDown}
    >
      <div class="capture-image-staging__preview">
        <img
          src={draft.previewUrl}
          alt="準備中のスクショ"
          data-testid="capture-image-staging-preview"
        />
      </div>
      <div class="capture-compose__fields">
        <input
          ref={titleRef}
          type="text"
          class="capture-compose__title"
          data-testid="capture-image-staging-title"
          value={draft.title}
          placeholder="タイトル"
          disabled={replaying}
          aria-label="タイトル"
          onInput={(event) =>
            patchExploreImageDraft({ title: event.currentTarget.value })}
        />
        <textarea
          class="capture-compose__body"
          data-testid="capture-image-staging-body"
          rows={5}
          value={draft.body}
          placeholder="事実や考察を書く…"
          disabled={replaying}
          aria-label="メモ"
          onInput={(event) =>
            patchExploreImageDraft({ body: event.currentTarget.value })}
        />
      </div>
      <div class="capture-compose__meta">
        <input
          type="url"
          class="capture-compose__url"
          data-testid="capture-image-staging-url"
          value={draft.url}
          placeholder="出典URL"
          disabled={replaying}
          aria-label="出典URL"
          onInput={(event) =>
            patchExploreImageDraft({ url: event.currentTarget.value })}
        />
        <button
          type="submit"
          class="capture-compose__submit"
          data-testid="capture-image-staging-submit"
          disabled={replaying}
        >
          追加
        </button>
        <button
          type="button"
          class="capture-compose__cancel"
          data-testid="capture-image-staging-cancel"
          disabled={replaying}
          onClick={() => clearExploreImageDraft()}
        >
          やめる
        </button>
      </div>
    </form>
  );
}

function ExploreCompose() {
  const card = exploreComposeCard.value;
  const replaying = isReplaying.value;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    setTitle(card?.title ?? "");
    setBody(card?.body ?? "");
    setUrl(card?.url ?? "");
  }, [card?.id, card?.title, card?.body, card?.url]);

  if (!card || !isLocalMediaRef(card.image)) return null;

  async function commit() {
    if (replaying) return;
    await updateCard(card!.id, { title, body, url });
  }

  return (
    <div class="capture-compose" data-testid="capture-compose">
      <div class="capture-compose__row">
        <CardImageField
          cardId={card.id}
          image={card.image}
          disabled={replaying}
          variant="inline"
          testId="capture-compose-image"
        />
        <div class="capture-compose__fields">
          <input
            type="text"
            class="capture-compose__title"
            data-testid="capture-compose-title"
            value={title}
            placeholder="タイトル"
            disabled={replaying}
            aria-label="タイトル"
            onInput={(event) => setTitle(event.currentTarget.value)}
            onBlur={commit}
          />
          <textarea
            class="capture-compose__body"
            data-testid="capture-compose-body"
            rows={3}
            value={body}
            placeholder="画像を見ながら事実や考察を書く…"
            disabled={replaying}
            aria-label="メモ"
            onInput={(event) => setBody(event.currentTarget.value)}
            onBlur={commit}
          />
        </div>
      </div>
      <div class="capture-compose__meta">
        <input
          type="url"
          class="capture-compose__url"
          data-testid="capture-compose-url"
          value={url}
          placeholder="出典URL"
          disabled={replaying}
          aria-label="出典URL"
          onInput={(event) => setUrl(event.currentTarget.value)}
          onBlur={commit}
        />
        <CardRoleToggle
          cardId={card.id}
          role={card.role}
          disabled={replaying}
          testIdPrefix="capture-compose"
        />
      </div>
    </div>
  );
}

export function Capture(props: { explore?: boolean }) {
  const explore = props.explore ?? false;
  const replaying = isReplaying.value;
  const staging = explore && exploreImageDraft.value;
  const composeCard = exploreComposeCard.value;
  const inCompose = explore && composeCard &&
    isLocalMediaRef(composeCard.image);
  const input = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState(readHistory);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const draftRef = useRef("");

  function getDraftLine(): string {
    return input.current?.value ?? "";
  }

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
    if (input.current) input.current.value = "";
    draftRef.current = "";
    setHistoryIndex(-1);
    const next = pushHistory(history, line);
    setHistory(next);
    writeHistory(next);
    if (inCompose) closeExploreCompose();
    await addCard(parsed.title, { body: parsed.body, url: parsed.url });
  }

  function onHistoryKey(event: KeyboardEvent): void {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (history.length === 0) return;

    const value = event.currentTarget instanceof HTMLInputElement
      ? event.currentTarget.value
      : "";

    if (event.key === "ArrowUp") {
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

  function onImageDragOver(event: DragEvent) {
    if (!explore || replaying) return;
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  async function onImageDrop(event: DragEvent) {
    if (!explore || replaying) return;
    const blob = imageBlobFromDataTransfer(event);
    if (!blob) return;
    event.preventDefault();
    try {
      const line = getDraftLine().trim();
      const draft = line ? parseCaptureLine(line) : readCaptureDraft();
      await pasteExploreImage(blob, draft ?? undefined);
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "画像を添付できませんでした",
      );
    }
  }

  function onCaptureFocus() {
    if (inCompose) closeExploreCompose();
  }

  return (
    <div
      class={`capture-block${explore ? " capture-block--explore" : ""}${
        staging ? " capture-block--staging" : ""
      }${inCompose ? " capture-block--compose" : ""}`}
      onDragOver={explore ? onImageDragOver : undefined}
      onDrop={explore ? onImageDrop : undefined}
    >
      {staging ? <ExploreImageStaging /> : null}
      {inCompose ? <ExploreCompose /> : null}
      {!staging
        ? (
          <form class="capture" onSubmit={submit}>
            <span class="capture__plus" aria-hidden="true">＋</span>
            <input
              ref={input}
              data-testid="capture-input"
              aria-label={inCompose ? "1行入力に戻る" : "新しい手がかり"}
              aria-describedby="capture-hint"
              autocomplete="off"
              placeholder={inCompose
                ? "1行入力に戻る…"
                : "見つけたことを1行で…"}
              onKeyDown={onHistoryKey}
              onFocus={explore ? onCaptureFocus : undefined}
              onInput={() => {
                if (historyIndex >= 0) setHistoryIndex(-1);
              }}
            />
            {explore && !inCompose
              ? (
                <CaptureImageSlot
                  disabled={replaying}
                  getDraftLine={getDraftLine}
                />
              )
              : null}
            <kbd>↵</kbd>
          </form>
        )
        : null}
      <p class="capture-hint" id="capture-hint">
        {staging
          ? (
            <>
              画像を準備中 · <kbd>⌘/Ctrl+↵</kbd> またはタイトルで<kbd>↵</kbd>
              で追加 · メモは<kbd>Shift+↵</kbd>で改行 ·{" "}
              <kbd>Esc</kbd>／やめるで取消 · もう一度貼ると差し替え
            </>
          )
          : inCompose
          ? (
            <>
              追記モード · 下の1行入力をクリック、Esc、発見ログの別カードで戻る
              · サムネクリックで再開
            </>
          )
          : (
            <>
              <code>題 // ひとこと</code> · URLはそのまま貼ると出典に ·
              {explore
                ? (
                  <>
                    {" "}
                    <kbd>⌘V</kbd>／ドラッグでスクショ（確定前に編集） ·
                  </>
                )
                : null}
              <kbd>↑</kbd>/<kbd>↓</kbd> で入力履歴 · タグはカード選択後に追加
            </>
          )}
      </p>
    </div>
  );
}
