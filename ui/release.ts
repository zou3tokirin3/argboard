/**
 * Human-gated release label for verification.
 *
 * - APP_RELEASE: bump when marking a gate:human card done (0.60 → 0.61 …)
 * - APP_PREVIEW: ticket id while in review (e.g. T058); clear on done
 *
 * Display: `ARGBoard · 0.61+T063` (preview) / `ARGBoard · 0.61` (stable)
 * Local serve on a feature branch may append ` · task/T063`.
 */
export const APP_RELEASE = "0.61";
export const APP_PREVIEW: string | null = null;

export function appTitle(branch?: string): string {
  const label = APP_PREVIEW ? `${APP_RELEASE}+${APP_PREVIEW}` : APP_RELEASE;
  const base = `ARGBoard · ${label}`;
  const trimmed = branch?.trim();
  if (trimmed && trimmed !== "main") {
    return `${base} · ${trimmed}`;
  }
  return base;
}
