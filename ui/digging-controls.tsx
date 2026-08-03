/** Icon-only digging controls — orange chips, distinct from text meta buttons. */

export function DigShovelIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        class="dig-shovel-handle"
        d="M8.3 1.4v6.2"
        fill="none"
        stroke-width="2.4"
        stroke-linecap="round"
      />
      <path
        class="dig-shovel-neck"
        d="M8.3 7.6H6.6"
        fill="none"
        stroke-width="1.35"
        stroke-linecap="round"
      />
      <path
        class="dig-shovel-blade"
        d="M3.8 8.1h8.8l-1.35 5.2c0 0-1.45 1.15-3.05 1.15s-3.05-1.15-3.05-1.15L3.8 8.1z"
      />
      <path
        class="dig-shovel-blade-edge"
        d="M3.8 8.1h8.8"
        fill="none"
        stroke-width="1.15"
        stroke-linecap="round"
      />
    </svg>
  );
}

/** @deprecated alias */
export const DigPickIcon = DigShovelIcon;

export function DigFillIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        class="dig-fill-ground"
        d="M1.8 12h12.4"
        fill="none"
        stroke-width="1.3"
        stroke-linecap="round"
      />
      <path
        class="dig-fill-mound"
        d="M3.8 12 5.2 8.4c.8-1.6 2-2.5 2.8-2.5s2 .9 2.8 2.5L13.2 12H3.8z"
      />
      <path
        class="dig-fill-tool"
        d="M5.4 5.8h5.2"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
      />
      <path
        class="dig-fill-tool-neck"
        d="M8 5.8V3.2"
        fill="none"
        stroke-width="1.6"
        stroke-linecap="round"
      />
    </svg>
  );
}

/** Capture bar cancel (×). */
export const DigStopIcon = DigCancelIcon;

export function DigCancelIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M5 5l6 6M11 5 5 11"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      />
    </svg>
  );
}

type DigStartButtonProps = {
  active?: boolean;
  testId?: string;
  title?: string;
  onClick?: (event: Event) => void;
};

export function DigStartButton({
  active = false,
  testId = "stream-dig-start",
  title = "ここから掘る",
  onClick,
}: DigStartButtonProps) {
  if (active) {
    return (
      <span
        class="dig-act is-active"
        data-testid="stream-dig-active"
        aria-label="掘り中"
        title="掘り中"
      >
        <DigShovelIcon />
      </span>
    );
  }
  return (
    <button
      type="button"
      class="dig-act"
      data-testid={testId}
      aria-label={title}
      title={title}
      onClick={onClick}
    >
      <DigShovelIcon />
    </button>
  );
}

type DigStopButtonProps = {
  testId?: string;
  title?: string;
  onClick?: () => void;
};

export function DigStopButton({
  testId = "capture-digging-stop",
  title = "掘り中を外す",
  onClick,
}: DigStopButtonProps) {
  return (
    <button
      type="button"
      class="dig-act dig-act--stop"
      data-testid={testId}
      aria-label={title}
      title={title}
      onClick={onClick}
    >
      <DigCancelIcon />
    </button>
  );
}

type DigClearViaButtonProps = {
  testId?: string;
  title?: string;
  onClick?: (event: Event) => void;
};

export function DigClearViaButton({
  testId = "stream-clear-found-via",
  title = "間違えて掘った分を埋める",
  onClick,
}: DigClearViaButtonProps) {
  return (
    <button
      type="button"
      class="dig-act dig-act--fill"
      data-testid={testId}
      aria-label={title}
      title={title}
      onClick={onClick}
    >
      <DigFillIcon />
    </button>
  );
}
