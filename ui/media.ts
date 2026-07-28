/** Local card image helpers: zip pack/unpack, media ref checks. */

export function isLocalMediaRef(image: string | undefined): boolean {
  if (!image) return false;
  const t = image.trim();
  if (!t) return false;
  return !/^https?:\/\//i.test(t);
}

export function mediaExtFromType(type: string): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "bin";
}

export function mediaTypeFromExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "png") return "image/png";
  if (e === "webp") return "image/webp";
  if (e === "gif") return "image/gif";
  return "application/octet-stream";
}

export function collectMediaIds(
  cards: ReadonlyArray<{ image?: string }>,
): string[] {
  const ids = new Set<string>();
  for (const card of cards) {
    if (isLocalMediaRef(card.image)) ids.add(card.image!.trim());
  }
  return [...ids];
}

// --- minimal store-method ZIP (no compression) ---

const te = new TextEncoder();
const td = new TextDecoder();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]!;
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, n, true);
  return out;
}

function u32(n: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n, true);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Build an uncompressed ZIP from path → bytes. */
export function buildZip(files: Map<string, Uint8Array>): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  let count = 0;

  for (const [name, data] of files) {
    const nameBytes = te.encode(name);
    const crc = crc32(data);
    const localHeader = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
    ]);
    localParts.push(localHeader, data);
    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    centralParts.push(central);
    offset += localHeader.length + data.length;
    count += 1;
  }

  const centralDir = concat(centralParts);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(count),
    u16(count),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);
  return concat([...localParts, centralDir, end]);
}

export type ZipEntry = { name: string; data: Uint8Array };

/** Parse store-method (and deflate-stored) ZIP local entries. */
export function parseZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries: ZipEntry[] = [];
  let i = 0;
  while (i + 30 <= bytes.length) {
    const sig = view.getUint32(i, true);
    if (sig === 0x02014b50 || sig === 0x06054b50) break;
    if (sig !== 0x04034b50) {
      throw new Error("zipとして読めません");
    }
    const method = view.getUint16(i + 8, true);
    const compSize = view.getUint32(i + 18, true);
    const nameLen = view.getUint16(i + 26, true);
    const extraLen = view.getUint16(i + 28, true);
    const nameStart = i + 30;
    const name = td.decode(bytes.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > bytes.length) throw new Error("zipとして読めません");
    if (method !== 0) {
      throw new Error("圧縮されたzipは未対応です");
    }
    entries.push({ name, data: bytes.subarray(dataStart, dataEnd) });
    i = dataEnd;
  }
  if (entries.length === 0) throw new Error("zipとして読めません");
  return entries;
}

export function projectJsonFromZip(entries: ZipEntry[]): string {
  const hit = entries.find((e) =>
    e.name === "project.json" || e.name.endsWith("/project.json")
  );
  if (!hit) throw new Error("zipに project.json がありません");
  return td.decode(hit.data);
}

export function mediaFromZip(
  entries: ZipEntry[],
): Map<string, { blob: Blob; ext: string }> {
  const out = new Map<string, { blob: Blob; ext: string }>();
  for (const entry of entries) {
    const m = entry.name.match(/(?:^|\/)media\/([^/]+)\.([a-z0-9]+)$/i);
    if (!m) continue;
    const id = m[1]!;
    const ext = m[2]!.toLowerCase();
    out.set(id, {
      blob: new Blob([entry.data.slice()], { type: mediaTypeFromExt(ext) }),
      ext,
    });
  }
  return out;
}

const objectUrls = new Map<string, string>();

export function peekMediaObjectUrl(id: string): string | undefined {
  return objectUrls.get(id);
}

export function rememberMediaObjectUrl(id: string, url: string): void {
  const prev = objectUrls.get(id);
  if (prev && prev !== url) URL.revokeObjectURL(prev);
  objectUrls.set(id, url);
}

export function forgetMediaObjectUrl(id: string): void {
  const prev = objectUrls.get(id);
  if (prev) {
    URL.revokeObjectURL(prev);
    objectUrls.delete(id);
  }
}

export function clearAllMediaObjectUrls(): void {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
}
