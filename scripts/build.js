import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ui = path.join(root, "ui");
const dist = path.join(root, "dist");

fs.mkdirSync(path.join(dist, "icons"), { recursive: true });

await esbuild.build({
  entryPoints: [path.join(ui, "main.tsx")],
  bundle: true,
  outfile: path.join(dist, "bundle.js"),
  format: "esm",
  jsx: "automatic",
  jsxImportSource: "preact",
  platform: "browser",
  logLevel: "info",
});

for (const file of ["index.html", "styles.css", "manifest.json", "sw.js"]) {
  fs.copyFileSync(path.join(ui, file), path.join(dist, file));
}
for (const icon of ["icon-192.png", "icon-512.png"]) {
  fs.copyFileSync(path.join(ui, "icons", icon), path.join(dist, "icons", icon));
}
