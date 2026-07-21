export type ParsedCapture = {
  title: string;
  body?: string;
  url?: string;
};

/** Pull the first http(s) URL out of a capture line. */
function takeUrl(text: string): { rest: string; url?: string } {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!match || match.index === undefined) return { rest: text };
  const raw = match[0].replace(/[),.\]]+$/, "");
  const rest = `${text.slice(0, match.index)} ${
    text.slice(match.index + match[0].length)
  }`
    .replace(/\s+/g, " ")
    .trim();
  return { rest, url: raw };
}

function titleFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

/**
 * Parse a one-line capture into title / optional body / optional source URL.
 * - `title // note` → body after the first `//`
 * - first `http(s)://…` → `url`, removed from the line before title/body split
 * - URL-only → hostname as a temporary title
 */
export function parseCaptureLine(raw: string): ParsedCapture | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const { rest, url } = takeUrl(trimmed);
  let title = rest;
  let body: string | undefined;
  const sep = rest.indexOf("//");
  if (sep >= 0) {
    title = rest.slice(0, sep).trim();
    const note = rest.slice(sep + 2).trim();
    body = note || undefined;
  }

  if (!title) {
    if (!url) return null;
    title = titleFromUrl(url);
  }

  return {
    title,
    ...(body ? { body } : {}),
    ...(url ? { url } : {}),
  };
}
