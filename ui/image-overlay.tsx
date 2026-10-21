import { useEffect, useRef } from "preact/hooks";
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
      aria-label="画像を拡大して見る（1×）"
      title="拡大して見る（1×）"
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
          alt="添付スクショ（1×）"
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
      aria-label={`${props.title} の画像`}
    >
      <header class="image-overlay__head">
        <strong>{props.title}</strong>
        <span class="image-overlay__hint">1×・右で編集できます</span>
        <button
          type="button"
          data-testid="image-overlay-close"
          onClick={props.onClose}
        >
          閉じる（Esc）
        </button>
      </header>
      <FixedScaleImage image={props.image} />
    </div>
  );
}
