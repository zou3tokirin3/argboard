import { t } from "../src/i18n/index.ts";
/** Hypothesis disposition on thought cards. Values may evolve later. */
export type ThoughtOutcome = "open" | "held" | "failed";

export const THOUGHT_OUTCOMES: ThoughtOutcome[] = ["open", "held", "failed"];

export function normalizeThoughtOutcome(
  value: string | undefined,
): ThoughtOutcome | undefined {
  if (value === "open" || value === "held" || value === "failed") return value;
  return undefined;
}

export function thoughtOutcomeLabel(value: ThoughtOutcome): string {
  switch (value) {
    case "open":
      return t("thoughtOutcome.open.label");
    case "held":
      return t("thoughtOutcome.held.label");
    case "failed":
      return t("thoughtOutcome.failed.label");
  }
}

export function thoughtOutcomeShort(value: ThoughtOutcome): string {
  switch (value) {
    case "open":
      return t("stream.outcome.open");
    case "held":
      return t("thoughtOutcome.held.label");
    case "failed":
      return t("thoughtOutcome.failed.label");
  }
}
