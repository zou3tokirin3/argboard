import { useEffect, useState } from "preact/hooks";

/** Coarse pointer or narrow shell — shorten desktop-only chrome hints (T061). */
export const COMPACT_CHROME_QUERY = "(pointer: coarse), (max-width: 800px)";

export function useCompactChromeHints(): boolean {
  const [compact, setCompact] = useState(() =>
    globalThis.matchMedia?.(COMPACT_CHROME_QUERY)?.matches ?? false
  );

  useEffect(() => {
    const mq = globalThis.matchMedia?.(COMPACT_CHROME_QUERY);
    if (!mq) return;
    const onChange = () => setCompact(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return compact;
}
