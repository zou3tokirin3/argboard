import { useEffect, useState } from "preact/hooks";
import { isLocalMediaRef } from "./media.ts";
import { resolveMediaUrl } from "./state.ts";

/** Tiny async thumb for a card's local screenshot. */
export function MediaThumb(props: {
  image: string | undefined;
  className?: string;
  testId?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const has = isLocalMediaRef(props.image);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (!has) return;
    void resolveMediaUrl(props.image).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [props.image, has]);

  if (!has || !url) return null;
  return (
    <img
      class={props.className ?? "media-thumb"}
      src={url}
      alt=""
      data-testid={props.testId}
      draggable={false}
    />
  );
}
