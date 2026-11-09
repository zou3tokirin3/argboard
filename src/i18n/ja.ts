/** Japanese is the canonical catalog. Keep complete sentences and stable keys. */
export const ja = {
  "imageOverlay.enlarge.label": "画像を拡大して見る（1×）",
  "imageOverlay.enlarge.title": "拡大して見る（1×）",
  "imageOverlay.image.alt": "添付スクショ（1×）",
  "imageOverlay.dialog.label": "{title} の画像",
  "imageOverlay.edit.hint": "1×・右で編集できます",
  "imageOverlay.close.label": "閉じる（Esc）",
} as const;

export type Messages = { [K in keyof typeof ja]: string };
export type MessageKey = keyof Messages;
