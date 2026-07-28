import {
  buildZip,
  collectMediaIds,
  isLocalMediaRef,
  mediaFromZip,
  parseZip,
  projectJsonFromZip,
} from "../../ui/media.ts";

Deno.test("isLocalMediaRef rejects http(s) and empty", () => {
  if (isLocalMediaRef(undefined)) throw new Error("undefined");
  if (isLocalMediaRef("")) throw new Error("empty");
  if (isLocalMediaRef("https://example.com/a.png")) throw new Error("https");
  if (isLocalMediaRef("http://example.com/a.png")) throw new Error("http");
  if (!isLocalMediaRef("abc-123")) throw new Error("local id");
});

Deno.test("collectMediaIds unique local only", () => {
  const ids = collectMediaIds([
    { image: "a" },
    { image: "https://x" },
    { image: "a" },
    { image: "b" },
    {},
  ]);
  if (ids.length !== 2 || !ids.includes("a") || !ids.includes("b")) {
    throw new Error(`unexpected ids: ${ids.join(",")}`);
  }
});

Deno.test("zip roundtrip keeps project.json and media bytes", () => {
  const encoder = new TextEncoder();
  const files = new Map<string, Uint8Array>();
  files.set("project.json", encoder.encode('{"version":1,"id":"p"}'));
  files.set("media/mid1.webp", new Uint8Array([1, 2, 3, 4]));
  files.set("media/mid2.jpg", new Uint8Array([9, 8]));
  const zip = buildZip(files);
  const entries = parseZip(zip);
  const json = projectJsonFromZip(entries);
  if (json !== '{"version":1,"id":"p"}') {
    throw new Error(`bad project.json: ${json}`);
  }
  const media = mediaFromZip(entries);
  if (media.size !== 2) throw new Error(`media size ${media.size}`);
  const a = media.get("mid1");
  const b = media.get("mid2");
  if (!a || a.blob.type !== "image/webp") throw new Error("mid1 missing");
  if (!b || b.blob.type !== "image/jpeg") throw new Error("mid2 missing");
});

Deno.test("parseZip rejects missing local headers", () => {
  try {
    parseZip(new Uint8Array([0, 1, 2, 3]));
    throw new Error("expected failure");
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "zipとして読めません") {
      throw error;
    }
  }
});
