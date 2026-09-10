import type { ThoughtOutcome } from "./thought-outcome.ts";

type ThoughtOutcomeIconProps = {
  outcome: ThoughtOutcome;
};

export function ThoughtOutcomeIcon({ outcome }: ThoughtOutcomeIconProps) {
  switch (outcome) {
    case "open":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle
            cx="8"
            cy="8"
            r="5.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-dasharray="2.5 2"
          />
        </svg>
      );
    case "held":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M4 8.5l3 3 5-6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      );
    case "failed":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M5 5l6 6M11 5l-6 6"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
          />
        </svg>
      );
  }
}
