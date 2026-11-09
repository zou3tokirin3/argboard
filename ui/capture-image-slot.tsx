import { useState } from "preact/hooks";
import { t } from "../src/i18n/index.ts";
import { readCaptureDraft } from "./capture-draft.ts";
import { parseCaptureLine } from "./capture-notation.ts";
import { imageBlobFromClipboard } from "./clipboard-image.ts";
import { useCompactChromeHints } from "./compact-chrome.ts";
import { pasteExploreImage } from "./state.ts";

export function withStoryFields(
  draft: ReturnType<typeof parseCaptureLine> | null,
  storyWhen: string,
  storyUntil: string,
):
  | ReturnType<typeof parseCaptureLine>
  | { title: string; storyWhen?: string; storyUntil?: string }
  | null {
  const when = storyWhen.trim();
  const until = storyUntil.trim();
  if (!draft) {
    if (!when && !until) return null;
    return {
      title: "",
      ...(when ? { storyWhen: when } : {}),
      ...(until ? { storyUntil: until } : {}),
    };
  }
  return {
    ...draft,
    ...(when ? { storyWhen: when } : {}),
    ...(until ? { storyUntil: until } : {}),
  };
}

export function CaptureImageSlot(props: {
  disabled: boolean;
  getDraftLine: () => string;
  getStoryWhen: () => string;
  getStoryUntil: () => string;
}) {
  const compactHints = useCompactChromeHints();
  const [busy, setBusy] = useState(false);

  function draftFromLine() {
    const line = props.getDraftLine().trim();
    const parsed = line ? parseCaptureLine(line) : readCaptureDraft();
    return withStoryFields(parsed, props.getStoryWhen(), props.getStoryUntil());
  }

  async function applyBlob(blob: Blob | undefined) {
    if (!blob || props.disabled || busy) return;
    setBusy(true);
    try {
      await pasteExploreImage(blob, draftFromLine() ?? undefined);
    } catch (error) {
      alert(
        error instanceof Error ? error.message : t("cardImage.attach.error"),
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

  function applyFile(file: File | undefined) {
    if (!file || props.disabled || busy) return;
    setBusy(true);
    void pasteExploreImage(file, draftFromLine() ?? undefined)
      .catch((error) => {
        alert(
          error instanceof Error ? error.message : t("cardImage.attach.error"),
        );
      })
      .finally(() => setBusy(false));
  }

  function onPick(event: Event) {
    event.stopPropagation();
    if (props.disabled || busy) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      applyFile(input.files?.[0]);
    };
    input.click();
  }

  function onFileChange(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0];
    input.value = "";
    applyFile(file);
  }

  return (
    <>
      <label
        class="capture__image-slot"
        title={
          compactHints
            ? t("captureImage.pick.label")
            : t("captureImage.paste.title")
        }
      >
        <input
          type="file"
          accept="image/*"
          data-testid="capture-image-slot"
          aria-label={
            compactHints
              ? t("captureImage.pick.label")
              : t("captureImage.paste.label")
          }
          disabled={props.disabled || busy}
          onPaste={onPaste}
          onChange={onFileChange}
        />
        <span aria-hidden="true">🖼</span>
      </label>
      <button
        type="button"
        class="capture__image-pick"
        data-testid="capture-image-pick"
        title={t("captureImage.file.label")}
        aria-label={t("captureImage.file.label")}
        disabled={props.disabled || busy}
        onClick={onPick}
      >
        …
      </button>
    </>
  );
}
