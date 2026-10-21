import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  "dist",
);
const port = Number(process.env.PORT ?? "8000");

// Keep in sync with ui/release.ts
const APP_RELEASE = "0.75";
const APP_PREVIEW = null;

function appTitle(branch) {
  const label = APP_PREVIEW ? `${APP_RELEASE}+${APP_PREVIEW}` : APP_RELEASE;
  const base = `ARGBoard · ${label}`;
  const trimmed = branch?.trim();
  if (trimmed && trimmed !== "main") return `${base} · ${trimmed}`;
  return base;
}

function gitBranch() {
  try {
    const result = cp.spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8",
    });
    if (result.status !== 0) return "";
    return result.stdout.trim().replace(/[^\w./-]/g, "");
  } catch {
    return "";
  }
}

function contentTypeFor(filePath) {
  const ext = filePath.split(".").pop();
  if (ext === "html") return "text/html; charset=utf-8";
  if (ext === "css") return "text/css; charset=utf-8";
  if (ext === "js") return "text/javascript; charset=utf-8";
  if (ext === "json") return "application/manifest+json";
  if (ext === "png") return "image/png";
  return "application/octet-stream";
}

const branch = gitBranch();
const title = appTitle(branch);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const relative = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const filePath = path.join(root, relative);

  try {
    let body = fs.readFileSync(filePath);
    if (relative === "index.html") {
      body = Buffer.from(
        body
          .toString()
          .replace("<title>ARGBoard</title>", `<title>${title}</title>`)
          .replace(
            'src="./bundle.js"',
            `src="./bundle.js?v=${encodeURIComponent(title)}"`,
          ),
      );
    }
    res.writeHead(200, {
      "Content-Type": contentTypeFor(relative),
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
