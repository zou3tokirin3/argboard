import { normalizePanelPhase } from "../../ui/panel-phase.ts";

Deno.test("normalize prefers panelPhase when present", () => {
  if (normalizePanelPhase({ panelPhase: "rail", mode: "explore" }) !== "rail") {
    throw new Error("panelPhase must win over legacy mode");
  }
});

Deno.test("legacy explore maps to wide", () => {
  if (normalizePanelPhase({ mode: "explore", sideOpen: false }) !== "wide") {
    throw new Error("explore must become wide");
  }
  if (normalizePanelPhase(undefined) !== "wide") {
    throw new Error("missing ui defaults to wide");
  }
});

Deno.test("legacy contemplate maps with sideOpen", () => {
  if (
    normalizePanelPhase({ mode: "contemplate", sideOpen: true }) !== "rail"
  ) {
    throw new Error("open contemplate must become rail");
  }
  if (
    normalizePanelPhase({ mode: "contemplate", sideOpen: false }) !== "closed"
  ) {
    throw new Error("closed contemplate must become closed");
  }
});
