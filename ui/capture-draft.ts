import { parseCaptureLine, type ParsedCapture } from "./capture-notation.ts";

function readCaptureStoryWhen(): string | undefined {
  const el = document.querySelector<HTMLInputElement>(
    '[data-testid="capture-story-when"]',
  );
  const when = el?.value?.trim();
  return when || undefined;
}

/** Read the live explore capture line from the DOM (for global paste / drop). */
export function readCaptureDraft(): ParsedCapture | null {
  const el = document.querySelector<HTMLInputElement>(
    '[data-testid="capture-input"]',
  );
  const line = el?.value?.trim();
  if (!line) return null;
  const parsed = parseCaptureLine(line);
  if (!parsed) return null;
  const storyWhen = readCaptureStoryWhen();
  return storyWhen ? { ...parsed, storyWhen } : parsed;
}

export function clearCaptureDraft(): void {
  const el = document.querySelector<HTMLInputElement>(
    '[data-testid="capture-input"]',
  );
  if (el) el.value = "";
  const when = document.querySelector<HTMLInputElement>(
    '[data-testid="capture-story-when"]',
  );
  if (when) when.value = "";
}
