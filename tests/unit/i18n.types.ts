import { t } from "../../src/i18n/index.ts";
import { ja, type Messages } from "../../src/i18n/ja.ts";

// Compile-only checks, included in the root tsc project.
const catalog = { ...ja } satisfies Messages;
void catalog;
export function checkTranslationTypes() {
  t("imageOverlay.close.label");
  t("imageOverlay.dialog.label", { title: "A" });
  // @ts-expect-error unknown key
  t("unknown");
  // @ts-expect-error required parameter
  t("imageOverlay.dialog.label");
  // @ts-expect-error wrong parameter
  t("imageOverlay.dialog.label", { name: "A" });
  // @ts-expect-error unexpected parameter
  t("imageOverlay.dialog.label", { title: "A", extra: "B" });
  // @ts-expect-error parameterless message
  t("imageOverlay.close.label", { title: "A" });
  // @ts-expect-error missing locale key
  const missing: Messages = {};
  void missing;
}
