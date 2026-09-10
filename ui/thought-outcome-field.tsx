import { IconTip, type IconTipAlign } from "./icon-tip.tsx";
import { updateCardOutcome } from "./state.ts";
import { ThoughtOutcomeIcon } from "./thought-outcome-icon.tsx";
import {
  THOUGHT_OUTCOMES,
  type ThoughtOutcome,
  thoughtOutcomeLabel,
  thoughtOutcomeShort,
} from "./thought-outcome.ts";

type ThoughtOutcomeFieldProps = {
  cardId: string;
  outcome: ThoughtOutcome | undefined;
  disabled?: boolean;
  testIdPrefix?: string;
  compact?: boolean;
  tipAlign?: IconTipAlign;
};

function outcomeTip(value: ThoughtOutcome, active: boolean): string {
  const label = thoughtOutcomeLabel(value);
  if (active) return `仮説 · ${label}を外す`;
  switch (value) {
    case "open":
      return "仮説 · 未検証（まだ確定していない）";
    case "held":
      return "仮説 · 採用（有力と判断）";
    case "failed":
      return "仮説 · 棄却（却下）";
  }
}

export function ThoughtOutcomeField({
  cardId,
  outcome,
  disabled = false,
  testIdPrefix = "inspector",
  compact = false,
  tipAlign = "center",
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
        class="inspector__outcome-toggle"
        role="group"
        aria-label="仮説の成否"
        onClick={(event) => event.stopPropagation()}
      >
        {THOUGHT_OUTCOMES.map((value) => {
          const active = outcome === value;
          return (
            <IconTip
              key={value}
              align={tipAlign}
              label={outcomeTip(value, active)}
            >
              <button
                type="button"
                class={`inspector__outcome-toggle-btn icon-labeled-btn${
                  active ? " is-active" : ""
                } is-${value}`}
                data-testid={`${testIdPrefix}-outcome-${value}`}
                aria-pressed={active}
                aria-label={thoughtOutcomeLabel(value)}
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  void pick(value);
                }}
              >
                <ThoughtOutcomeIcon outcome={value} />
                <span class="icon-labeled-btn__text">
                  {thoughtOutcomeShort(value)}
                </span>
              </button>
            </IconTip>
          );
        })}
      </div>
    </div>
  );
}
