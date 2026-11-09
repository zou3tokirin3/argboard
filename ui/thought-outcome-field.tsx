import { t } from "../src/i18n/index.ts";
import { IconTip, type IconTipAlign } from "./icon-tip.tsx";
import { updateCardOutcome } from "./state.ts";
import {
  THOUGHT_OUTCOMES,
  type ThoughtOutcome,
  thoughtOutcomeLabel,
  thoughtOutcomeShort,
} from "./thought-outcome.ts";
import { ThoughtOutcomeIcon } from "./thought-outcome-icon.tsx";

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
  if (active) return t("thoughtOutcome.clear.tip", { label });
  switch (value) {
    case "open":
      return t("thoughtOutcome.open.tip");
    case "held":
      return t("thoughtOutcome.held.tip");
    case "failed":
      return t("thoughtOutcome.failed.tip");
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
      {!compact ? <span>{t("thoughtOutcome.field.label")}</span> : null}
      <div
        class="inspector__outcome-toggle"
        role="group"
        aria-label={t("thoughtOutcome.field.group")}
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
