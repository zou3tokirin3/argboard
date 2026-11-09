/** Japanese is the canonical catalog. Keep complete sentences and stable keys. */
export const ja = {
  "imageOverlay.enlarge.label": "画像を拡大して見る（1×）",
  "imageOverlay.enlarge.title": "拡大して見る（1×）",
  "imageOverlay.image.alt": "添付スクショ（1×）",
  "imageOverlay.dialog.label": "{title} の画像",
  "imageOverlay.edit.hint": "1×・右で編集できます",
  "imageOverlay.close.label": "閉じる（Esc）",
  "cardImage.label": "スクショ",
  "cardImage.image.alt": "添付スクショ",
  "cardImage.attach.error": "画像を添付できませんでした",
  "cardImage.inline.hint": "画像",
  "cardImage.inline.pasteHint": "⌘V",
  "cardImage.compact.hint": "ファイルを選ぶ／貼り付け",
  "cardImage.desktop.hint": "ここに貼り付け（⌘V）またはドロップ",
  "cardImage.inline.replace.label": "差し替え",
  "cardImage.replace.label": "差し替え…",
  "cardImage.pick.label": "ファイルを選ぶ…",
  "cardImage.clear.label": "削除",
  "captureImage.pick.label": "スクショを選ぶ",
  "captureImage.paste.title": "スクショを貼る（⌘V）",
  "captureImage.paste.label": "スクショを貼り付け",
  "captureImage.file.label": "画像ファイルを選ぶ",
} as const;

export type Messages = { [K in keyof typeof ja]: string };
export type MessageKey = keyof Messages;
