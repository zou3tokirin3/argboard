/** Discovery-log width phase (T078). Replaces ui.mode + sideOpen. */
export type PanelPhase = "wide" | "rail" | "closed";

/** Wire shape before / during migrate from mode+sideOpen. */
export type ProjectUiWire = {
  panelPhase?: PanelPhase;
  mode?: "explore" | "contemplate";
  sideOpen?: boolean;
};

export function normalizePanelPhase(ui?: ProjectUiWire | null): PanelPhase {
  if (
    ui?.panelPhase === "wide" || ui?.panelPhase === "rail" ||
    ui?.panelPhase === "closed"
  ) {
    return ui.panelPhase;
  }
  if ((ui?.mode ?? "explore") === "explore") return "wide";
  return ui?.sideOpen ? "rail" : "closed";
}

export function withPanelPhase(phase: PanelPhase): { panelPhase: PanelPhase } {
  return { panelPhase: phase };
}
