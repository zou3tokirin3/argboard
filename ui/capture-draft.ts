import { parseCaptureLine, type ParsedCapture } from "./capture-notation.ts";

/** Read the live explore capture line from the DOM (for global paste / drop). */
export function readCaptureDraft(): ParsedCapture | null {
  const el = document.querySelector<HTMLInputElement>(
    '[data-testid="capture-input"]',
  );
  const line = el?.value?.trim();
  if (!line) return null;
  return parseCaptureLine(line);
}

export function clearCaptureDraft(): void {
  const el = document.querySelector<HTMLInputElement>(
    '[data-testid="capture-input"]',
  );
  if (el) el.value = "";
}
