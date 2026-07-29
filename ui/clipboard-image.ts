/** Extract an image blob from clipboard or drag-and-drop. */

export function imageBlobFromClipboard(
  event: ClipboardEvent,
): Blob | undefined {
  const items = event.clipboardData?.items;
  if (!items) return undefined;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      return item.getAsFile() ?? undefined;
    }
  }
  return undefined;
}

export function imageBlobFromDataTransfer(
  event: DragEvent,
): Blob | undefined {
  const files = event.dataTransfer?.files;
  if (!files?.length) return undefined;
  return [...files].find((file) => file.type.startsWith("image/"));
}
