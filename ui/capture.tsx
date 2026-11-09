import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "../src/i18n/index.ts";
import { readCaptureDraft } from "./capture-draft.ts";
import { CaptureImageSlot, withStoryFields } from "./capture-image-slot.tsx";
import { parseCaptureLine } from "./capture-notation.ts";
import { imageBlobFromDataTransfer } from "./clipboard-image.ts";
import { useCompactChromeHints } from "./compact-chrome.ts";
import { DigShovelIcon, DigStopButton } from "./digging-controls.tsx";
import type { PreviewSurface } from "./image-preview-height.ts";
import {
  clampPreviewHeight,
  maxPreviewHeight,
  PREVIEW_MIN_PX,
  resolvePreviewHeight,
  writeStoredPreviewHeight,
} from "./image-preview-height.ts";
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
  setImageReferenceCaptureMode,
  startDigging,
  stopDigging,
} from "./state.ts";
import { collectTagUsage, normalizeTag } from "./tags.ts";
import { useMediaUrl } from "./use-media-url.ts";

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

const DIG_PREFIX_MAX = 15;

function buildDigPrefix(title: string): string {
  const short =
    title.length > DIG_PREFIX_MAX
      ? `${title.slice(0, DIG_PREFIX_MAX)}…`
      : title;
  return `${short} › `;
}

function CaptureDiggingBar() {
  const diggingId = diggingCardId.value;
  if (!diggingId) return null;
  const cards = project.value?.cards ?? [];

  // foundVia チェーンを辿って祖先リストを構築（ループ防止つき）
  const chain: typeof cards = [];
  let cur = cards.find((c) => c.id === diggingId);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    cur = cur.foundVia ? cards.find((c) => c.id === cur!.foundVia) : undefined;
  }
  if (chain.length === 0) return null;

  return (
    <div
      class="capture__digging"
      data-testid="capture-digging-bar"
      aria-label={t("capture.digging.label", {
        title: chain.at(-1)?.title ?? "",
      })}
      aria-live="polite"
    >
      <span class="capture__digging-source">
        <span
          class="dig-act is-active capture__digging-badge"
          aria-hidden="true"
        >
          <DigShovelIcon />
        </span>
        {chain.length > 2 ? (
          <>
            <span class="capture__digging-crumb">
              <button
                type="button"
                class="capture__digging-back"
                onClick={() => startDigging(chain[0].id)}
              >
                {chain[0].title}
              </button>
            </span>
            <span class="capture__digging-crumb">
              <span class="capture__digging-sep" aria-hidden="true">
                ›
              </span>
              <span
                class="capture__digging-ellipsis"
                aria-label={t("capture.digging.depth.label", {
                  count: chain.length - 2,
                })}
              >
                …
              </span>
            </span>
            <span class="capture__digging-crumb">
              <span class="capture__digging-sep" aria-hidden="true">
                ›
              </span>
              <strong class="capture__digging-title">
                {chain.at(-1)!.title}
              </strong>
            </span>
          </>
        ) : (
          chain.map((card, i) => (
            <span key={card.id} class="capture__digging-crumb">
              {i > 0 && (
                <span class="capture__digging-sep" aria-hidden="true">
                  ›
                </span>
              )}
              {i < chain.length - 1 ? (
                <button
                  type="button"
                  class="capture__digging-back"
                  onClick={() => startDigging(card.id)}
                >
                  {card.title}
                </button>
              ) : (
                <strong class="capture__digging-title">{card.title}</strong>
              )}
            </span>
          ))
        )}
      </span>
      <DigStopButton onClick={() => stopDigging()} />
    </div>
  );
}

function CaptureTagChips(props: {
  selected: string[];
  disabled: boolean;
  onToggle: (name: string) => void;
}) {
  const usage = collectTagUsage(project.value?.cards ?? []);
  if (usage.length === 0) return null;
  const selected = new Set(props.selected.map(normalizeTag).filter(Boolean));
  return (
    <div
      class="capture-tag-chips"
      data-testid="capture-tag-chips"
      role="group"
      aria-label={t("capture.tags.label")}
    >
      {usage.map((entry) => {
        const on = selected.has(entry.name);
        const unsettled = entry.count === 1;
        return (
          <button
            type="button"
            key={entry.name}
            class={`capture-tag-chip${on ? " is-on" : ""}${
              unsettled ? " is-unsettled" : ""
            }`}
            data-testid="capture-tag-chip"
            aria-pressed={on}
            disabled={props.disabled}
            title={
              unsettled
                ? t("capture.tags.unsettled.title", { name: entry.name })
                : entry.name
            }
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => props.onToggle(entry.name)}
          >
            #{entry.name}
          </button>
        );
      })}
    </div>
  );
}

function ExploreImageStaging(props: {
  selectedTags: string[];
  disabled: boolean;
  onToggleTag: (name: string) => void;
  onCommitted: () => void;
}) {
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
      await commitExploreImageDraft(
        props.selectedTags.length ? { tags: props.selectedTags } : undefined,
      );
      props.onCommitted();
    } catch (error) {
      alert(error instanceof Error ? error.message : t("capture.add.error"));
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
          alt={t("capture.staging.image.alt")}
          width={1600}
          height={1000}
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
          placeholder={t("capture.title.label")}
          disabled={replaying}
          aria-label={t("capture.title.label")}
          onInput={(event) =>
            patchExploreImageDraft({ title: event.currentTarget.value })
          }
        />
        <CaptureTagChips
          selected={props.selectedTags}
          disabled={props.disabled}
          onToggle={props.onToggleTag}
        />
        <textarea
          class="capture-compose__body"
          data-testid="capture-image-staging-body"
          rows={3}
          value={draft.body}
          placeholder={t("capture.body.placeholder")}
          disabled={replaying}
          aria-label={t("capture.body.label")}
          onInput={(event) =>
            patchExploreImageDraft({ body: event.currentTarget.value })
          }
        />
      </div>
      <div class="capture-compose__meta">
        <input
          type="text"
          class="capture-compose__story-when"
          data-testid="capture-image-staging-story-when"
          value={draft.storyWhen}
          placeholder={t("capture.storyWhen.placeholder")}
          disabled={replaying}
          aria-label={t("capture.storyWhen.label")}
          onInput={(event) =>
            patchExploreImageDraft({ storyWhen: event.currentTarget.value })
          }
        />
        <input
          type="text"
          class="capture-compose__story-until"
          data-testid="capture-image-staging-story-until"
          value={draft.storyUntil}
          placeholder={t("capture.storyUntil.placeholder")}
          disabled={replaying}
          aria-label={t("capture.storyUntil.label")}
          onInput={(event) =>
            patchExploreImageDraft({ storyUntil: event.currentTarget.value })
          }
        />
        <input
          type="url"
          class="capture-compose__url"
          data-testid="capture-image-staging-url"
          value={draft.url}
          placeholder={t("capture.source.label")}
          disabled={replaying}
          aria-label={t("capture.source.label")}
          onInput={(event) =>
            patchExploreImageDraft({ url: event.currentTarget.value })
          }
        />
        <button
          type="submit"
          class="capture-compose__submit"
          data-testid="capture-image-staging-submit"
          disabled={replaying}
        >
          {t("capture.add.label")}
        </button>
        <button
          type="button"
          class="capture-compose__cancel"
          data-testid="capture-image-staging-cancel"
          disabled={replaying}
          onClick={() => clearExploreImageDraft()}
        >
          {t("capture.cancel.label")}
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
      aria-label={t("capture.intent.label")}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        class={props.mode === "dig" ? "is-active" : undefined}
        data-testid="capture-intent-dig"
        aria-pressed={props.mode === "dig"}
        aria-label={t("capture.intent.dig.label")}
        title={t("capture.intent.dig.title")}
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
        aria-label={t("capture.intent.thought.label")}
        title={t("capture.intent.thought.title")}
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

function ExploreImageReference(props: { wide?: boolean }) {
  const surface: PreviewSurface = props.wide ? "wide" : "rail";
  const card = exploreComposeCard.value;
  const replaying = isReplaying.value;
  const captureMode = imageReferenceCaptureMode.value;
  const diggingId = diggingCardId.value;
  const url = useMediaUrl(card?.image);
  const [previewHeight, setPreviewHeight] = useState(() =>
    resolvePreviewHeight(surface, globalThis.innerHeight),
  );
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  function persistHeight(next: number) {
    setPreviewHeight(next);
    writeStoredPreviewHeight(surface, next);
  }

  function heightFromDrag(clientY: number): number | null {
    const drag = dragRef.current;
    if (!drag) return null;
    return clampPreviewHeight(
      drag.startH + (clientY - drag.startY),
      globalThis.innerHeight,
    );
  }

  function onResizePointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const handle = event.currentTarget;
    if (!(handle instanceof HTMLElement)) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    dragRef.current = { startY: event.clientY, startH: previewHeight };
  }

  function onResizePointerMove(event: PointerEvent) {
    const next = heightFromDrag(event.clientY);
    if (next != null) setPreviewHeight(next);
  }

  function onResizePointerUp(event: PointerEvent) {
    const next = heightFromDrag(event.clientY);
    dragRef.current = null;
    if (next != null) persistHeight(next);
  }

  function onResizeKeyDown(event: KeyboardEvent) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 16 : -16;
    persistHeight(
      clampPreviewHeight(previewHeight + delta, globalThis.innerHeight),
    );
  }

  if (!card || !isLocalMediaRef(card.image)) return null;

  const digging = diggingId === card.id;

  return (
    <div
      class="capture-compose capture-image-staging capture-image-reference"
      data-testid="capture-compose"
    >
      <div
        class="capture-image-staging__preview capture-image-reference__preview"
        style={{ height: `${previewHeight}px` }}
      >
        {url ? (
          <img
            src={url}
            alt={card.title}
            width={1600}
            height={1000}
            data-testid="capture-compose-preview"
          />
        ) : null}
        <div
          class="capture-image-reference__resize"
          role="separator"
          aria-orientation="horizontal"
          aria-label={t("capture.preview.resize.label")}
          title={t("capture.preview.resize.title")}
          aria-valuenow={previewHeight}
          aria-valuemin={PREVIEW_MIN_PX}
          aria-valuemax={maxPreviewHeight(globalThis.innerHeight)}
          tabIndex={0}
          data-testid="capture-compose-preview-resize"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
          onKeyDown={onResizeKeyDown}
        />
      </div>
      <div
        class="capture-image-reference__bar"
        data-testid="capture-image-reference-bar"
      >
        <span class="capture-image-reference__source">
          {digging ? (
            <span
              class="dig-act is-active capture__digging-badge"
              aria-hidden="true"
            >
              <DigShovelIcon />
            </span>
          ) : null}
          <strong>{card.title}</strong>
          {digging ? (
            <span class="capture-image-reference__digging-label">
              {captureMode === "thought"
                ? t("capture.reference.thought.label")
                : t("capture.reference.dig.label")}
            </span>
          ) : null}
        </span>
        <CaptureIntentToggle
          mode={captureMode}
          disabled={replaying}
          onChange={setImageReferenceCaptureMode}
        />
        {digging && captureMode === "dig" ? (
          <DigStopButton onClick={() => stopDigging()} />
        ) : null}
        <button
          type="button"
          class="capture-compose__cancel"
          data-testid="capture-compose-close"
          disabled={replaying}
          onClick={() => closeExploreCompose()}
        >
          {t("capture.close.label")}
        </button>
      </div>
    </div>
  );
}

export function Capture(props: { wide?: boolean }) {
  const wide = props.wide ?? false;
  const compactHints = useCompactChromeHints();
  const replaying = isReplaying.value;
  const staging = wide && exploreImageDraft.value;
  const composeCard = exploreComposeCard.value;
  const inCompose = composeCard && isLocalMediaRef(composeCard.image);
  const referenceCaptureMode = inCompose
    ? imageReferenceCaptureMode.value
    : null;
  const captureSourceCard =
    inCompose && referenceCaptureMode === "dig"
      ? composeCard
      : diggingCardId.value
        ? project.value?.cards.find((item) => item.id === diggingCardId.value)
        : undefined;
  const digging =
    Boolean(captureSourceCard) &&
    diggingCardId.value === captureSourceCard?.id &&
    !inCompose;
  const input = useRef<HTMLInputElement>(null);
  const storyWhenInput = useRef<HTMLInputElement>(null);
  const storyUntilInput = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState(readHistory);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const draftRef = useRef("");

  // Pre-fill input with parent title prefix when digging starts or switches card.
  useEffect(() => {
    if (!captureSourceCard || !input.current) return;
    // Only pre-fill when the field is empty or already has a prefix (not mid-typing).
    const current = input.current.value;
    const oldPrefix = buildDigPrefix(captureSourceCard.title);
    if (current === "" || current === oldPrefix) {
      showLine(buildDigPrefix(captureSourceCard.title));
    }
  }, [captureSourceCard?.id]);

  function getDraftLine(): string {
    return input.current?.value ?? "";
  }

  function getStoryWhen(): string {
    return storyWhenInput.current?.value ?? "";
  }

  function getStoryUntil(): string {
    return storyUntilInput.current?.value ?? "";
  }

  function showLine(line: string): void {
    if (!input.current) return;
    input.current.value = line;
    const end = line.length;
    input.current.setSelectionRange(end, end);
  }

  function toggleCaptureTag(name: string): void {
    const tag = normalizeTag(name);
    if (!tag) return;
    setSelectedTags((current) =>
      current.some((item) => normalizeTag(item) === tag)
        ? current.filter((item) => normalizeTag(item) !== tag)
        : [...current, tag],
    );
  }

  function clearSelectedTags(): void {
    setSelectedTags([]);
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const line = input.current?.value ?? "";
    const parsed = parseCaptureLine(line);
    if (!parsed) return;
    const storyWhen = getStoryWhen().trim();
    const storyUntil = getStoryUntil().trim();
    const tags = selectedTags;
    if (storyWhenInput.current) storyWhenInput.current.value = "";
    if (storyUntilInput.current) storyUntilInput.current.value = "";
    draftRef.current = "";
    if (captureSourceCard) {
      showLine(buildDigPrefix(captureSourceCard.title));
    } else if (input.current) {
      input.current.value = "";
    }
    setHistoryIndex(-1);
    clearSelectedTags();
    const next = pushHistory(history, line);
    setHistory(next);
    writeHistory(next);
    await addCard(parsed.title, {
      body: parsed.body,
      url: parsed.url,
      ...(storyWhen ? { storyWhen } : {}),
      ...(storyUntil ? { storyUntil } : {}),
      ...(tags.length ? { tags } : {}),
      ...(inCompose && referenceCaptureMode === "thought"
        ? { role: "thought" as const }
        : {}),
    });
  }

  function onHistoryKey(event: KeyboardEvent): void {
    if (event.key === "Backspace" && captureSourceCard) {
      const prefix = buildDigPrefix(captureSourceCard.title);
      const current = (event.currentTarget as HTMLInputElement).value;
      if (current === prefix) {
        event.preventDefault();
        showLine("");
        return;
      }
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (history.length === 0) return;

    const value =
      event.currentTarget instanceof HTMLInputElement
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
    if (!wide || replaying) return;
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  async function onImageDrop(event: DragEvent) {
    if (!wide || replaying) return;
    const blob = imageBlobFromDataTransfer(event);
    if (!blob) return;
    event.preventDefault();
    try {
      const line = getDraftLine().trim();
      const draft = withStoryFields(
        line ? parseCaptureLine(line) : readCaptureDraft(),
        getStoryWhen(),
        getStoryUntil(),
      );
      await pasteExploreImage(blob, draft ?? undefined);
    } catch (error) {
      alert(
        error instanceof Error ? error.message : t("cardImage.attach.error"),
      );
    }
  }

  return (
    <div
      class={`capture-block${wide ? " capture-block--wide" : ""}${
        staging ? " capture-block--staging" : ""
      }${inCompose ? " capture-block--compose" : ""}${
        digging ? " capture-block--digging" : ""
      }`}
      onDragOver={wide ? onImageDragOver : undefined}
      onDrop={wide ? onImageDrop : undefined}
    >
      {staging ? (
        <ExploreImageStaging
          selectedTags={selectedTags}
          disabled={replaying}
          onToggleTag={toggleCaptureTag}
          onCommitted={clearSelectedTags}
        />
      ) : null}
      {inCompose ? <ExploreImageReference wide={wide} /> : null}
      {!staging && digging ? <CaptureDiggingBar /> : null}
      {!staging ? (
        <>
          <form class="capture" onSubmit={submit}>
            <span class="capture__plus" aria-hidden="true">
              ＋
            </span>
            <input
              ref={input}
              data-testid="capture-input"
              aria-label={
                inCompose
                  ? t("capture.input.reference.label")
                  : t("capture.input.label")
              }
              aria-describedby="capture-hint"
              autocomplete="off"
              placeholder={
                inCompose && referenceCaptureMode === "thought"
                  ? t("capture.input.thought.placeholder", {
                      title: composeCard!.title,
                    })
                  : captureSourceCard
                    ? t("capture.input.dig.placeholder", {
                        title: captureSourceCard.title,
                      })
                    : t("capture.input.placeholder")
              }
              onKeyDown={onHistoryKey}
              onInput={() => {
                if (historyIndex >= 0) setHistoryIndex(-1);
              }}
            />
            <input
              ref={storyWhenInput}
              type="text"
              class="capture__story-when"
              data-testid="capture-story-when"
              aria-label={t("capture.storyWhen.label")}
              autocomplete="off"
              placeholder={t("capture.storyWhen.placeholder")}
              disabled={replaying}
            />
            <input
              ref={storyUntilInput}
              type="text"
              class="capture__story-until"
              data-testid="capture-story-until"
              aria-label={t("capture.storyUntil.label")}
              autocomplete="off"
              placeholder={t("capture.storyUntil.placeholder")}
              disabled={replaying}
            />
            {wide ? (
              <CaptureImageSlot
                disabled={replaying}
                getDraftLine={getDraftLine}
                getStoryWhen={getStoryWhen}
                getStoryUntil={getStoryUntil}
              />
            ) : null}
            {/*
                Multiple text fields disable implicit Enter-submit unless a
                default submit button exists. Keep the 1-line Enter path.
              */}
            <button type="submit" class="capture__submit-sr">
              {t("capture.add.label")}
            </button>
            <kbd>↵</kbd>
          </form>
          <CaptureTagChips
            selected={selectedTags}
            disabled={replaying}
            onToggle={toggleCaptureTag}
          />
        </>
      ) : null}
      <p class="capture-hint" id="capture-hint">
        {staging ? (
          compactHints ? (
            // biome-ignore lint/complexity/noUselessFragments: Preserve the original capture hint tree.
            <>{t("capture.hint.staging.compact")}</>
          ) : (
            <>
              {t("capture.hint.staging.start")}
              <kbd>⌘/Ctrl+↵</kbd>
              {t("capture.hint.staging.title")}
              <kbd>↵</kbd>
              {t("capture.hint.staging.submit")}
              <kbd>Shift+↵</kbd>
              {t("capture.hint.staging.newline")}
              <kbd>Esc</kbd>
              {t("capture.hint.staging.cancel")}
            </>
          )
        ) : inCompose ? (
          compactHints ? (
            <>
              {t("capture.hint.reference.start")}
              <strong>{t("capture.intent.dig.label")}</strong>／
              <strong>{t("capture.intent.thought.label")}</strong>
              {t("capture.hint.reference.compactEnd")}
            </>
          ) : (
            <>
              {t("capture.hint.reference.start")}
              <strong>{t("capture.intent.dig.label")}</strong>／
              <strong>{t("capture.intent.thought.label")}</strong>
              {t("capture.hint.reference.switch")}
              <kbd>↵</kbd>
              {t("capture.hint.reference.submit")}
              <kbd>Esc</kbd>
              {t("capture.hint.reference.close")}
            </>
          )
        ) : compactHints ? (
          <>
            <code>
              {t("capture.hint.default.title")}
              {/* ひとこと */}
            </code>
            {t("capture.hint.default.compact")}
          </>
        ) : (
          <>
            <code>
              {t("capture.hint.default.title")}
              {/* ひとこと */}
            </code>
            {t("capture.hint.default.source")}
            {wide ? (
              <>
                {" "}
                <kbd>⌘V</kbd>
                {t("capture.hint.default.image")}
              </>
            ) : null}
            <kbd>↑</kbd>/<kbd>↓</kbd>
            {t("capture.hint.default.history")}
          </>
        )}
      </p>
    </div>
  );
}
