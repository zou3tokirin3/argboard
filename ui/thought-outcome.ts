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
      return "未検証";
    case "held":
      return "採用";
    case "failed":
      return "棄却";
  }
}
