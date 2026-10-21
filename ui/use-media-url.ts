import { useEffect, useState } from "preact/hooks";
import { isLocalMediaRef } from "./media.ts";
import { resolveMediaUrl } from "./state.ts";

/** Object URL for a card's local screenshot; null while loading or absent. */
export function useMediaUrl(image: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (!isLocalMediaRef(image)) return;
    void resolveMediaUrl(image).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [image]);
  return url;
}
