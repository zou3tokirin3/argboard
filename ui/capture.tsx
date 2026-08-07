import { useEffect, useRef, useState } from "preact/hooks";
import { readCaptureDraft } from "./capture-draft.ts";
import { parseCaptureLine } from "./capture-notation.ts";
import { DigShovelIcon, DigStopButton } from "./digging-controls.tsx";
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
  diggingCardId,
  exploreComposeCard,
  exploreImageDraft,
  type ImageReferenceCaptureMode,
  imageReferenceCaptureMode,
  isReplaying,
  pasteExploreImage,
  patchExploreImageDraft,
  project,
  resolveMediaUrl,
  setImageReferenceCaptureMode,
  stopDigging,
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

function CaptureDiggingBar() {
  const diggingId = diggingCardId.value;
  if (!diggingId) return null;
  const card = project.value?.cards.find((item) => item.id === diggingId);
  if (!card) return null;
  return (
    <div
      class="capture__digging"
      data-testid="capture-digging-bar"
      aria-label={`掘り中: ${card.title}`}
      aria-live="polite"
    >
      <span class="capture__digging-source">
        <span
          class="dig-act is-active capture__digging-badge"
          aria-hidden="true"
        >
          <DigShovelIcon />
        </span>
        <strong class="capture__digging-title">{card.title}</strong>
      </span>
      <DigStopButton onClick={() => stopDigging()} />
    </div>
  );
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

function CaptureIntentToggle(props: {
  mode: ImageReferenceCaptureMode;
  disabled?: boolean;
  onChange: (mode: ImageReferenceCaptureMode) => void;
}) {
  const disabled = props.disabled ?? false;
  return (
    <div
      class="inspector__size-toggle capture-intent-toggle"
      role="group"
      aria-label="追加の種別"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        class={props.mode === "dig" ? "is-active" : undefined}
        data-testid="capture-intent-dig"
        aria-pressed={props.mode === "dig"}
        aria-label="掘る"
        title="発見として掘る（発見元を記録）"
        disabled={disabled}
        onClick={() => props.onChange("dig")}
      >
        <DigShovelIcon />
      </button>
      <button
        type="button"
        class={props.mode === "thought" ? "is-active" : undefined}
        data-testid="capture-intent-thought"
        aria-pressed={props.mode === "thought"}
        aria-label="考察"
        title="考察カードとして追加"
        disabled={disabled}
        onClick={() => props.onChange("thought")}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect
            x="3.5"
            y="3.5"
            width="9"
            height="9"
            rx="2"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-dasharray="2.5 2"
          />
        </svg>
      </button>
    </div>
  );
}

function ExploreImageReference() {
  const card = exploreComposeCard.value;
  const replaying = isReplaying.value;
  const captureMode = imageReferenceCaptureMode.value;
  const diggingId = diggingCardId.value;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!card || !isLocalMediaRef(card.image)) {
      setUrl(null);
      return;
    }
    void resolveMediaUrl(card.image).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [card?.id, card?.image]);

  if (!card || !isLocalMediaRef(card.image)) return null;

  const digging = captureMode === "dig" && diggingId === card.id;

  return (
    <div
      class="capture-compose capture-image-staging capture-image-reference"
      data-testid="capture-compose"
    >
      <div class="capture-image-staging__preview">
        {url
          ? (
            <img
              src={url}
              alt={card.title}
              data-testid="capture-compose-preview"
            />
          )
          : null}
      </div>
      <div
        class="capture-image-reference__bar"
        data-testid="capture-image-reference-bar"
      >
        <span class="capture-image-reference__source">
          {digging
            ? (
              <span
                class="dig-act is-active capture__digging-badge"
                aria-hidden="true"
              >
                <DigShovelIcon />
              </span>
            )
            : null}
          <strong>{card.title}</strong>
          {digging
            ? (
              <span class="capture-image-reference__digging-label">
                から掘り中
              </span>
            )
            : captureMode === "thought"
            ? (
              <span class="capture-image-reference__digging-label">
                を見ながら考察
              </span>
            )
            : null}
        </span>
        <CaptureIntentToggle
          mode={captureMode}
          disabled={replaying}
          onChange={setImageReferenceCaptureMode}
        />
        {digging ? <DigStopButton onClick={() => stopDigging()} /> : null}
        <button
          type="button"
          class="capture-compose__cancel"
          data-testid="capture-compose-close"
          disabled={replaying}
          onClick={() => closeExploreCompose()}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

export function Capture(props: { explore?: boolean }) {
  const explore = props.explore ?? false;
  const replaying = isReplaying.value;
  const staging = explore && exploreImageDraft.value;
  const composeCard = exploreComposeCard.value;
  const inCompose = composeCard && isLocalMediaRef(composeCard.image);
  const referenceCaptureMode = inCompose
    ? imageReferenceCaptureMode.value
    : null;
  const captureSourceCard = inCompose && referenceCaptureMode === "dig"
    ? composeCard
    : diggingCardId.value
    ? project.value?.cards.find((item) => item.id === diggingCardId.value)
    : undefined;
  const digging = Boolean(captureSourceCard) &&
    diggingCardId.value === captureSourceCard?.id &&
    !inCompose;
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
    await addCard(parsed.title, {
      body: parsed.body,
      url: parsed.url,
      ...(inCompose && referenceCaptureMode === "thought"
        ? { role: "thought" as const }
        : {}),
    });
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

  return (
    <div
      class={`capture-block${explore ? " capture-block--explore" : ""}${
        staging ? " capture-block--staging" : ""
      }${inCompose ? " capture-block--compose" : ""}${
        digging ? " capture-block--digging" : ""
      }`}
      onDragOver={explore ? onImageDragOver : undefined}
      onDrop={explore ? onImageDrop : undefined}
    >
      {staging ? <ExploreImageStaging /> : null}
      {inCompose ? <ExploreImageReference /> : null}
      {!staging && digging ? <CaptureDiggingBar /> : null}
      {!staging
        ? (
          <form class="capture" onSubmit={submit}>
            <span class="capture__plus" aria-hidden="true">＋</span>
            <input
              ref={input}
              data-testid="capture-input"
              aria-label={inCompose ? "画像を見ながら追加" : "新しい手がかり"}
              aria-describedby="capture-hint"
              autocomplete="off"
              placeholder={inCompose && referenceCaptureMode === "thought"
                ? `「${composeCard!.title}」を見ながら考える…`
                : captureSourceCard
                ? `「${captureSourceCard.title}」から見つけたこと…`
                : "見つけたことを1行で…"}
              onKeyDown={onHistoryKey}
              onInput={() => {
                if (historyIndex >= 0) setHistoryIndex(-1);
              }}
            />
            {explore && !staging
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
              画像を見ながら1行で追加 · 上で<strong>掘る</strong>／<strong>
                考察
              </strong>
              を切替 · <kbd>↵</kbd>で新カード · <kbd>Esc</kbd>／閉じるで終了
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
