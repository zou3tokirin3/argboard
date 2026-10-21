/**
 * Budget signal measurement (PLAN §4). Prints a Markdown table for packets.
 * Usage: node tools/budget.js [--since <ref>]
 * Definitions live only in PLAN §4 — keep this file aligned.
 */

import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROWS = [
  { key: "bodyLines", label: "本体行数", format: (n) => String(n) },
  {
    key: "bodyLinesTs",
    label: "本体行数（TS/TSX・参考）",
    format: (n) => String(n),
  },
  { key: "bodyFiles", label: "本体ファイル数", format: (n) => String(n) },
  { key: "testLines", label: "テスト行数", format: (n) => String(n) },
  { key: "smokeCount", label: "スモーク本数", format: (n) => String(n) },
  {
    key: "gzipBytes",
    label: "配布サイズ（gzip）",
    format: (n) => `${n.toLocaleString("en-US")} B`,
  },
  {
    key: "operations",
    label: "操作の数（ユニーク testid）",
    format: (n) => String(n),
  },
  { key: "concepts", label: "概念の数", format: (n) => String(n) },
];

function parseSince(args) {
  const filtered = args.filter((arg) => arg !== "--");
  const index = filtered.indexOf("--since");
  if (index < 0) return null;
  const value = filtered[index + 1];
  if (value == null || value.startsWith("--")) return "main";
  return value;
}

function lineCount(text) {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") n++;
  }
  return n;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function countConcepts(typesSrc, stateSrc) {
  const events = new Set(
    [...typesSrc.matchAll(/type:\s*"([^"]+)"/g)].map((match) => match[1]),
  );
  const stripped = stripComments(typesSrc);
  const fields = [...stripped.matchAll(/(?:^|[;{|,])\s*(\w+)\??\s*:/gm)]
    .map((match) => match[1])
    .filter((key) => key !== "type");
  const signals = [
    ...stateSrc.matchAll(
      /(?:export\s+)?const\s+\w+\s*=\s*(?:signal|computed)\s*[<(]/g,
    ),
  ];
  return fields.length + events.size + signals.length;
}

function countOperations(tsxFiles) {
  const ids = new Set();
  for (const text of tsxFiles) {
    for (const match of text.matchAll(/data-testid="([^"]+)"/g)) {
      ids.add(match[1]);
    }
  }
  return ids.size;
}

function countSmoke(smokeSrc) {
  const marks = new Set(
    [...smokeSrc.matchAll(/\/\/\s*([①②③④⑤⑥⑦⑧⑨⑩])/g)].map((m) => m[1]),
  );
  return marks.size;
}

function run(cmd, cwd) {
  try {
    const result = cp.spawnSync(cmd[0], cmd.slice(1), {
      cwd,
      encoding: "utf8",
    });
    return {
      ok: result.status === 0,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } catch {
    return { ok: false, stdout: "", stderr: "spawn failed" };
  }
}

function buildGzipBytes(cwd) {
  const built = run(["pnpm", "run", "build"], cwd);
  if (!built.ok) {
    throw new Error(`pnpm run build failed in ${cwd}:\n${built.stderr}`);
  }
  const bundlePath = path.join(cwd, "dist", "bundle.js");
  const gzipped = run(["gzip", "-c", bundlePath], cwd);
  if (!gzipped.ok) {
    throw new Error(`gzip failed:\n${gzipped.stderr}`);
  }
  return Buffer.byteLength(gzipped.stdout, "binary");
}

function gitShow(ref, filePath) {
  const result = run(["git", "show", `${ref}:${filePath}`], process.cwd());
  if (!result.ok) return null;
  return result.stdout;
}

function gitList(ref, dir) {
  const result = run(
    ["git", "ls-tree", "--name-only", `${ref}:${dir}`],
    process.cwd(),
  );
  if (!result.ok) {
    throw new Error(
      `git ls-tree ${ref}:${dir} failed:\n${result.stderr}`,
    );
  }
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function readWorking(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

function listWorking(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .toSorted();
}

function workingTreeReader(root) {
  return {
    read: (p) => readWorking(path.join(root, p)),
    list: (dir) => listWorking(path.join(root, dir)),
    gzip: () => buildGzipBytes(root),
  };
}

function refTreeReader(ref) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "argboard-budget-"));
  const added = run(
    ["git", "worktree", "add", "--detach", tmp, ref],
    process.cwd(),
  );
  if (!added.ok) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error(`git worktree add ${ref} failed:\n${added.stderr}`);
  }
  return {
    reader: {
      read: (p) => gitShow(ref, p),
      list: (dir) => gitList(ref, dir),
      gzip: () => buildGzipBytes(tmp),
    },
    cleanup: () => {
      run(["git", "worktree", "remove", "--force", tmp], process.cwd());
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
      } catch {
        // worktree remove already deleted it
      }
    },
  };
}

function measure(reader) {
  const uiNames = reader.list("ui");
  const uiPaths = uiNames.map((name) => `ui/${name}`);
  const bodyPaths = ["serve.ts", ...uiPaths];

  let bodyLines = 0;
  let bodyLinesTs = 0;
  let bodyFiles = 0;
  const tsxTexts = [];

  for (const p of bodyPaths) {
    const text = reader.read(p);
    if (text == null) continue;
    bodyFiles++;
    const lines = lineCount(text);
    bodyLines += lines;
    if (p.endsWith(".ts") || p.endsWith(".tsx")) {
      bodyLinesTs += lines;
    }
    if (p.endsWith(".tsx")) tsxTexts.push(text);
  }

  const unitNames = reader.list("tests/unit");
  let testLines = 0;
  const smokeSrc = reader.read("tests/smoke.ts") ?? "";
  testLines += lineCount(smokeSrc);
  for (const name of unitNames) {
    const text = reader.read(`tests/unit/${name}`);
    if (text == null) continue;
    testLines += lineCount(text);
  }

  const typesSrc = reader.read("ui/types.ts") ?? "";
  const stateSrc = reader.read("ui/state.ts") ?? "";

  return {
    bodyLines,
    bodyLinesTs,
    bodyFiles,
    testLines,
    smokeCount: countSmoke(smokeSrc),
    gzipBytes: reader.gzip(),
    operations: countOperations(tsxTexts),
    concepts: countConcepts(typesSrc, stateSrc),
  };
}

function formatDelta(n) {
  if (n > 0) return `+${n.toLocaleString("en-US")}`;
  if (n < 0) return n.toLocaleString("en-US");
  return "0";
}

function renderTable(stock, flow, since) {
  const lines = ["### 1. 状況（数字）", ""];
  if (flow && since) {
    lines.push(`| 指標 | stock | Δ (\`${since}\`..) |`);
    lines.push("| --- | ---: | ---: |");
    for (const row of ROWS) {
      const delta = stock[row.key] - flow[row.key];
      const deltaText =
        row.key === "gzipBytes"
          ? `${formatDelta(delta)} B`
          : formatDelta(delta);
      lines.push(
        `| ${row.label} | ${row.format(stock[row.key])} | ${deltaText} |`,
      );
    }
  } else {
    lines.push("| 指標 | 値 |");
    lines.push("| --- | ---: |");
    for (const row of ROWS) {
      lines.push(`| ${row.label} | ${row.format(stock[row.key])} |`);
    }
  }
  lines.push("");
  lines.push(
    since
      ? `計測: \`node tools/budget.js --since ${since}\` / 定義正本: PLAN §4`
      : "計測: `node tools/budget.js` / 定義正本: PLAN §4",
  );
  return lines.join("\n");
}

function main() {
  const since = parseSince(process.argv.slice(2));
  const root = process.cwd();
  const stock = measure(workingTreeReader(root));

  let baseline = null;
  if (since) {
    const { reader, cleanup } = refTreeReader(since);
    try {
      baseline = measure(reader);
    } finally {
      cleanup();
    }
  }

  console.log(renderTable(stock, baseline, since));
}

const isMain =
  process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
