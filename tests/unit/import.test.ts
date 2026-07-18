import { createDemoProject, parseProjectJson } from "../../ui/project.ts";

Deno.test("parseProjectJson restores a version-1 demo project", () => {
  const source = createDemoProject(1_700_000_000_000);
  const parsed = parseProjectJson(JSON.stringify(source));
  if (JSON.stringify(parsed) !== JSON.stringify(source)) {
    throw new Error("Roundtrip JSON must match the source project");
  }
});

Deno.test("parseProjectJson rejects invalid JSON without throwing SyntaxError", () => {
  try {
    parseProjectJson("{");
    throw new Error("Expected parseProjectJson to fail");
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "JSONとして読めません") {
      throw error;
    }
  }
});

Deno.test("parseProjectJson rejects unsupported version", () => {
  const source = createDemoProject(1_700_000_000_000);
  try {
    parseProjectJson(JSON.stringify({ ...source, version: 2 }));
    throw new Error("Expected unsupported version to fail");
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== "未対応の形式か version です"
    ) {
      throw error;
    }
  }
});
