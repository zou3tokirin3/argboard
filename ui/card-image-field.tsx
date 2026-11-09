import { useState } from "preact/hooks";
import { t } from "../src/i18n/index.ts";
import {
  imageBlobFromClipboard,
  imageBlobFromDataTransfer,
} from "./clipboard-image.ts";
import { useCompactChromeHints } from "./compact-chrome.ts";
import { isLocalMediaRef } from "./media.ts";
import { clearCardImage, setCardImage } from "./state.ts";
import { useMediaUrl } from "./use-media-url.ts";

export function CardImageField(props: {
  cardId: string;
  image: string | undefined;
  disabled: boolean;
  /** compact = inspector; inline = capture compose beside fields */
  variant?: "compact" | "inline";
  testId?: string;
  /** When set, the preview opens the fixed-scale overlay (T064). */
  onEnlarge?: () => void;
}) {
  const variant = props.variant ?? "compact";
  const compactHints = useCompactChromeHints();
  const [busy, setBusy] = useState(false);
  const hasImage = isLocalMediaRef(props.image);

  const url = useMediaUrl(props.image);

  async function applyBlob(blob: Blob | undefined) {
    if (!blob || props.disabled || busy) return;
    setBusy(true);
    try {
      await setCardImage(props.cardId, blob);
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

  function onPick() {
    if (props.disabled || busy) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      void applyBlob(input.files?.[0]);
    };
    input.click();
  }

  return (
    <div
      class={`card-image-field card-image-field--${variant}${
        hasImage ? " has-image" : ""
      }`}
    >
      {variant === "compact" ? <span>{t("cardImage.label")}</span> : null}
      <div
        class="card-image-field__drop"
        data-testid={props.testId ?? "card-image-field"}
        tabIndex={props.disabled ? -1 : 0}
        onPaste={onPaste}
        onDragOver={(event) => {
          if (props.disabled) return;
          event.preventDefault();
        }}
        onDrop={(event) => {
          if (props.disabled) return;
          event.preventDefault();
          void applyBlob(imageBlobFromDataTransfer(event));
        }}
      >
        {url && props.onEnlarge ? (
          <button
            type="button"
            class="card-image-field__enlarge"
            data-testid="inspector-image-enlarge"
            aria-label={t("imageOverlay.enlarge.label")}
            title={t("imageOverlay.enlarge.title")}
            onClick={props.onEnlarge}
          >
            <img
              class="card-image-field__preview"
              src={url}
              alt={t("cardImage.image.alt")}
              width={1600}
              height={1000}
            />
            <span class="image-enlarge-badge" aria-hidden="true">
              ⤢
            </span>
          </button>
        ) : url ? (
          <img
            class="card-image-field__preview"
            src={url}
            alt={t("cardImage.image.alt")}
            width={1600}
            height={1000}
          />
        ) : hasImage ? (
          <span class="card-image-field__preview" aria-hidden="true" />
        ) : (
          <p class="card-image-field__hint">
            {variant === "inline"
              ? compactHints
                ? t("cardImage.inline.hint")
                : t("cardImage.inline.pasteHint")
              : compactHints
                ? t("cardImage.compact.hint")
                : t("cardImage.desktop.hint")}
          </p>
        )}
      </div>
      {variant === "inline" ? (
        hasImage ? (
          <div class="card-image-field__actions card-image-field__actions--mini">
            <button
              type="button"
              data-testid={`${props.testId ?? "card-image-field"}-pick`}
              disabled={props.disabled || busy}
              onClick={onPick}
            >
              {t("cardImage.inline.replace.label")}
            </button>
            <button
              type="button"
              data-testid={`${props.testId ?? "card-image-field"}-clear`}
              disabled={props.disabled || busy}
              onClick={() => {
                void clearCardImage(props.cardId);
              }}
            >
              {t("cardImage.clear.label")}
            </button>
          </div>
        ) : null
      ) : (
        <div class="card-image-field__actions">
          <button
            type="button"
            data-testid={`${props.testId ?? "card-image-field"}-pick`}
            disabled={props.disabled || busy}
            onClick={onPick}
          >
            {hasImage
              ? t("cardImage.replace.label")
              : t("cardImage.pick.label")}
          </button>
          {hasImage ? (
            <button
              type="button"
              data-testid={`${props.testId ?? "card-image-field"}-clear`}
              disabled={props.disabled || busy}
              onClick={() => {
                void clearCardImage(props.cardId);
              }}
            >
              {t("cardImage.clear.label")}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
