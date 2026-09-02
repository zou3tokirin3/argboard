import { updateCardOutcome } from "./state.ts";
import {
  THOUGHT_OUTCOMES,
  type ThoughtOutcome,
  thoughtOutcomeLabel,
} from "./thought-outcome.ts";

type ThoughtOutcomeFieldProps = {
  cardId: string;
  outcome: ThoughtOutcome | undefined;
  disabled?: boolean;
  testIdPrefix?: string;
  compact?: boolean;
};

export function ThoughtOutcomeField({
  cardId,
  outcome,
  disabled = false,
  testIdPrefix = "inspector",
  compact = false,
}: ThoughtOutcomeFieldProps) {
  async function pick(next: ThoughtOutcome) {
    if (disabled) return;
    await updateCardOutcome(cardId, next === outcome ? undefined : next);
  }

  return (
    <div
      class={`inspector__field inspector__outcome${
        compact ? " inspector__outcome--compact" : ""
      }`}
    >
      {!compact
        ? (
          <span>
            仮説の成否（任意・未設定＝解釈メモ）
          </span>
        )
        : null}
      <div
        class="inspector__outcome-chips"
        role="group"
        aria-label="仮説の成否"
        onClick={(event) => event.stopPropagation()}
      >
        {THOUGHT_OUTCOMES.map((value) => {
          const active = outcome === value;
          return (
            <button
              key={value}
              type="button"
              class={`inspector__outcome-chip${
                active ? " is-active" : ""
              } is-${value}`}
              data-testid={`${testIdPrefix}-outcome-${value}`}
              aria-pressed={active}
              title={active
                ? `${thoughtOutcomeLabel(value)}を外す`
                : thoughtOutcomeLabel(value)}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                void pick(value);
              }}
            >
              {thoughtOutcomeLabel(value)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
