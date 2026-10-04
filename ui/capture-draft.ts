import { parseCaptureLine, type ParsedCapture } from "./capture-notation.ts";

function readCaptureStoryWhen(): string | undefined {
  const el = document.querySelector<HTMLInputElement>(
    '[data-testid="capture-story-when"]',
  );
  const when = el?.value?.trim();
  return when || undefined;
}

function readCaptureStoryUntil(): string | undefined {
  const el = document.querySelector<HTMLInputElement>(
    '[data-testid="capture-story-until"]',
  );
  const until = el?.value?.trim();
  return until || undefined;
}

function withStoryFields(parsed: ParsedCapture): ParsedCapture {
  const storyWhen = readCaptureStoryWhen();
  const storyUntil = readCaptureStoryUntil();
  return {
    ...parsed,
    ...(storyWhen ? { storyWhen } : {}),
    ...(storyUntil ? { storyUntil } : {}),
  };
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
  return withStoryFields(parsed);
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
  const until = document.querySelector<HTMLInputElement>(
    '[data-testid="capture-story-until"]',
  );
  if (until) until.value = "";
}
