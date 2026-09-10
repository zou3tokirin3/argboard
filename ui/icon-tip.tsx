import type { ComponentChildren } from "preact";

export type IconTipAlign = "start" | "center" | "end";

type IconTipProps = {
  label: string;
  align?: IconTipAlign;
  class?: string;
  children: ComponentChildren;
};

/** Hover/focus-visible help for icon-only controls. */
export function IconTip({
  label,
  align = "center",
  class: className,
  children,
}: IconTipProps) {
  const alignClass = align === "center" ? "" : ` icon-tip--align-${align}`;
  return (
    <span
      class={`icon-tip${alignClass}${className ? ` ${className}` : ""}`}
    >
      {children}
      <span class="icon-tip__bubble" role="tooltip">{label}</span>
    </span>
  );
}
