import { t } from "../src/i18n/index.ts";
import { IconTip, type IconTipAlign } from "./icon-tip.tsx";
import { isReplaying, updateCardRole } from "./state.ts";
import type { Card } from "./types.ts";

type CardRoleToggleProps = {
  cardId: string;
  role: Card["role"];
  disabled?: boolean;
  testIdPrefix?: string;
  tipAlign?: IconTipAlign;
};

export function CardRoleToggle({
  cardId,
  role,
  disabled,
  testIdPrefix = "card",
  tipAlign = "center",
}: CardRoleToggleProps) {
  const replaying = disabled ?? isReplaying.value;
  const isThought = role === "thought";
  return (
    <div
      class="inspector__size-toggle"
      role="group"
      aria-label={t("stream.role.label")}
      onClick={(event) => event.stopPropagation()}
    >
      <IconTip align={tipAlign} label={t("cardRole.finding.tip")}>
        <button
          type="button"
          class={`icon-labeled-btn${isThought ? "" : " is-active"}`}
          data-testid={`${testIdPrefix}-card-role-finding`}
          aria-pressed={!isThought}
          aria-label={t("stream.role.finding")}
          disabled={replaying}
          onClick={(event) => {
            event.stopPropagation();
            void updateCardRole(cardId, "finding");
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="6" r="3.5" fill="currentColor" />
          </svg>
          <span class="icon-labeled-btn__text">{t("stream.role.finding")}</span>
        </button>
      </IconTip>
      <IconTip align={tipAlign} label={t("cardRole.thought.tip")}>
        <button
          type="button"
          class={`icon-labeled-btn${isThought ? " is-active" : ""}`}
          data-testid={`${testIdPrefix}-card-role-thought`}
          aria-pressed={isThought}
          aria-label={t("capture.intent.thought.label")}
          disabled={replaying}
          onClick={(event) => {
            event.stopPropagation();
            void updateCardRole(cardId, "thought");
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect
              x="3.5"
              y="3.5"
              width="9"
              height="9"
              rx="2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-dasharray="2.5 2"
            />
          </svg>
          <span class="icon-labeled-btn__text">
            {t("capture.intent.thought.label")}
          </span>
        </button>
      </IconTip>
    </div>
  );
}
