import { appTitle } from "./ui/release.ts";

const root = new URL("./dist/", import.meta.url);
const port = Number(Deno.env.get("PORT") ?? "8000");
const branch = gitBranch();
const title = appTitle(branch);

function gitBranch(): string {
  try {
    const result = new Deno.Command("git", {
      args: ["rev-parse", "--abbrev-ref", "HEAD"],
      stdout: "piped",
      stderr: "null",
    }).outputSync();
    const name = new TextDecoder().decode(result.stdout).trim();
    return result.success ? name.replace(/[^\w./-]/g, "") : "";
  } catch {
    return "";
  }
}

function contentTypeFor(path: string): string {
  const extension = path.split(".").pop();
  if (extension === "html") return "text/html; charset=utf-8";
  if (extension === "css") return "text/css; charset=utf-8";
  if (extension === "js") return "text/javascript; charset=utf-8";
  if (extension === "json") return "application/manifest+json";
  if (extension === "png") return "image/png";
  return "application/octet-stream";
}

Deno.serve({ port }, async (request) => {
  const pathname = new URL(request.url).pathname;
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const fileUrl = new URL(relativePath, root);

  try {
    let file = await Deno.readFile(fileUrl);
    if (relativePath === "index.html") {
      file = new TextEncoder().encode(
        new TextDecoder().decode(file)
          .replace("<title>ARGBoard</title>", `<title>${title}</title>`)
          .replace(
            'src="./bundle.js"',
            `src="./bundle.js?v=${encodeURIComponent(title)}"`,
          ),
      );
    }
    return new Response(file, {
      headers: {
        "content-type": contentTypeFor(relativePath),
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
});
