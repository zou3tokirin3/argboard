import { isReplaying, updateCardRole } from "./state.ts";
import { IconTip, type IconTipAlign } from "./icon-tip.tsx";
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
      aria-label="種別"
      onClick={(event) => event.stopPropagation()}
    >
      <IconTip align={tipAlign} label="種別 · 発見（事実・手がかり）">
        <button
          type="button"
          class={`icon-labeled-btn${isThought ? "" : " is-active"}`}
          data-testid={`${testIdPrefix}-card-role-finding`}
          aria-pressed={!isThought}
          aria-label="発見"
          disabled={replaying}
          onClick={(event) => {
            event.stopPropagation();
            void updateCardRole(cardId, "finding");
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="6" r="3.5" fill="currentColor" />
          </svg>
          <span class="icon-labeled-btn__text">発見</span>
        </button>
      </IconTip>
      <IconTip align={tipAlign} label="種別 · 考察（仮説・解釈）">
        <button
          type="button"
          class={`icon-labeled-btn${isThought ? " is-active" : ""}`}
          data-testid={`${testIdPrefix}-card-role-thought`}
          aria-pressed={isThought}
          aria-label="考察"
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
          <span class="icon-labeled-btn__text">考察</span>
        </button>
      </IconTip>
    </div>
  );
}
