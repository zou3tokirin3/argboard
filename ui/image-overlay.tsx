import { useEffect, useRef } from "preact/hooks";
import { t } from "../src/i18n/index.ts";
import { openImageOverlay } from "./state.ts";
import { useMediaUrl } from "./use-media-url.ts";

/** "⤢" entry on the stream thumb (T064). */
export function ImageEnlargeButton(props: {
  cardId: string;
  className: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      class={`image-enlarge-btn ${props.className}`}
      data-testid={props.testId}
      aria-label={t("imageOverlay.enlarge.label")}
      title={t("imageOverlay.enlarge.title")}
      onClick={(event) => {
        event.stopPropagation();
        openImageOverlay(props.cardId);
      }}
    >
      <span aria-hidden="true">⤢</span>
    </button>
  );
}

/** Natural-pixel (1×) image; overflow scrolls natively. No pinch / pan. */
export function FixedScaleImage(props: { image: string | undefined }) {
  const url = useMediaUrl(props.image);
  return (
    <div class="image-overlay__scroll" tabIndex={0}>
      {url ? (
        <img
          class="image-overlay__img"
          src={url}
          alt={t("imageOverlay.image.alt")}
          draggable={false}
        />
      ) : null}
    </div>
  );
}

/**
 * Covers everything except the inspector, so every card field stays
 * editable while the image is open. Esc / button closes.
 */
export function ImageOverlay(props: {
  title: string;
  image: string | undefined;
  onClose: () => void;
}) {
  const onCloseRef = useRef(props.onClose);
  onCloseRef.current = props.onClose;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onCloseRef.current();
    }
    globalThis.addEventListener("keydown", onKeyDown, true);
    return () => globalThis.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    <div
      class="image-overlay"
      data-testid="image-overlay"
      role="dialog"
      aria-label={t("imageOverlay.dialog.label", { title: props.title })}
    >
      <header class="image-overlay__head">
        <strong>{props.title}</strong>
        <span class="image-overlay__hint">{t("imageOverlay.edit.hint")}</span>
        <button
          type="button"
          data-testid="image-overlay-close"
          onClick={props.onClose}
        >
          {t("imageOverlay.close.label")}
        </button>
      </header>
      <FixedScaleImage image={props.image} />
    </div>
  );
}
