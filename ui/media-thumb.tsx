import { useEffect, useState } from "preact/hooks";
import { isLocalMediaRef } from "./media.ts";
import { resolveMediaUrl } from "./state.ts";

/** Extreme aspect → center-crop; otherwise show the whole image. */
function fitForNaturalSize(
  width: number,
  height: number,
): "contain" | "cover" {
  if (width <= 0 || height <= 0) return "contain";
  const ratio = height / width;
  // Very tall scroll-capture or ultra-wide strip: crop to center.
  if (ratio > 2.2 || ratio < 0.4) return "cover";
  return "contain";
}

/** Tiny async thumb for a card's local screenshot. */
export function MediaThumb(props: {
  image: string | undefined;
  className?: string;
  testId?: string;
  /**
   * Prefer fitting the whole image (T022 large cards).
   * Extreme aspect ratios fall back to centered cover.
   */
  preferContain?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [fit, setFit] = useState<"contain" | "cover">(
    props.preferContain ? "contain" : "cover",
  );
  const has = isLocalMediaRef(props.image);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFit(props.preferContain ? "contain" : "cover");
    if (!has) return;
    void resolveMediaUrl(props.image).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [props.image, has, props.preferContain]);

  if (!has || !url) return null;
  const className = [
    props.className ?? "media-thumb",
    props.preferContain ? `is-fit-${fit}` : null,
  ].filter(Boolean).join(" ");
  return (
    <img
      class={className}
      src={url}
      alt=""
      data-testid={props.testId}
      draggable={false}
      onLoad={props.preferContain
        ? (event) => {
          const img = event.currentTarget;
          setFit(fitForNaturalSize(img.naturalWidth, img.naturalHeight));
        }
        : undefined}
    />
  );
}
