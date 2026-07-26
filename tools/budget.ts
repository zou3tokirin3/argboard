/**
 * Budget signal measurement (PLAN §4). Prints a Markdown table for packets.
 * Usage: deno task budget [--since <ref>]
 * Definitions live only in PLAN §4 — keep this file aligned.
 */

type Metrics = {
  bodyLines: number;
  bodyLinesTs: number;
  bodyFiles: number;
  testLines: number;
  smokeCount: number;
  gzipBytes: number;
  operations: number;
  concepts: number;
};

type MetricKey = keyof Metrics;

type Row = {
  key: MetricKey;
  label: string;
  format: (n: number) => string;
};

const ROWS: Row[] = [
  {
    key: "bodyLines",
    label: "本体行数",
    format: (n) => String(n),
  },
  {
    key: "bodyLinesTs",
    label: "本体行数（TS/TSX・参考）",
    format: (n) => String(n),
  },
  {
    key: "bodyFiles",
    label: "本体ファイル数",
    format: (n) => String(n),
  },
  {
    key: "testLines",
    label: "テスト行数",
    format: (n) => String(n),
  },
  {
    key: "smokeCount",
    label: "スモーク本数",
    format: (n) => String(n),
  },
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
  {
    key: "concepts",
    label: "概念の数",
    format: (n) => String(n),
  },
];

function parseSince(args: string[]): string | null {
  const filtered = args.filter((arg) => arg !== "--");
  const index = filtered.indexOf("--since");
  if (index < 0) return null;
  const value = filtered[index + 1];
  if (value == null || value.startsWith("--")) return "main";
  return value;
}

function lineCount(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") n++;
  }
  return n;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function countConcepts(typesSrc: string, stateSrc: string): number {
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

function countOperations(tsxFiles: string[]): number {
  const ids = new Set<string>();
  for (const text of tsxFiles) {
    for (const match of text.matchAll(/data-testid="([^"]+)"/g)) {
      ids.add(match[1]);
    }
  }
  return ids.size;
}

function countSmoke(smokeSrc: string): number {
  const marks = new Set(
    [...smokeSrc.matchAll(/\/\/\s*([①②③④⑤⑥⑦⑧⑨⑩])/g)].map((m) => m[1]),
  );
  return marks.size;
}

async function run(
  cmd: string[],
  cwd: string,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const result = await new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  return {
    ok: result.success,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  };
}

async function buildGzipBytes(cwd: string): Promise<number> {
  const built = await run(["deno", "task", "build"], cwd);
  if (!built.ok) {
    throw new Error(`deno task build failed in ${cwd}:\n${built.stderr}`);
  }
  const gzipped = await new Deno.Command("gzip", {
    args: ["-c", `${cwd}/dist/bundle.js`],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!gzipped.success) {
    throw new Error(
      `gzip failed:\n${new TextDecoder().decode(gzipped.stderr)}`,
    );
  }
  return gzipped.stdout.byteLength;
}

async function gitShow(ref: string, path: string): Promise<string | null> {
  const result = await run(["git", "show", `${ref}:${path}`], Deno.cwd());
  if (!result.ok) return null;
  return result.stdout;
}

async function gitList(ref: string, dir: string): Promise<string[]> {
  const result = await run(
    ["git", "ls-tree", "--name-only", `${ref}:${dir}`],
    Deno.cwd(),
  );
  if (!result.ok) {
    throw new Error(`git ls-tree ${ref}:${dir} failed:\n${result.stderr}`);
  }
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function readWorking(path: string): Promise<string> {
  return await Deno.readTextFile(path);
}

async function listWorking(dir: string): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (entry.isFile) names.push(entry.name);
  }
  return names.toSorted();
}

type TreeReader = {
  read: (path: string) => Promise<string | null>;
  list: (dir: string) => Promise<string[]>;
  gzip: () => Promise<number>;
};

function workingTreeReader(root: string): TreeReader {
  return {
    read: async (path) => {
      try {
        return await readWorking(`${root}/${path}`);
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) return null;
        throw error;
      }
    },
    list: (dir) => listWorking(`${root}/${dir}`),
    gzip: () => buildGzipBytes(root),
  };
}

async function refTreeReader(ref: string): Promise<{
  reader: TreeReader;
  cleanup: () => Promise<void>;
}> {
  const tmp = await Deno.makeTempDir({ prefix: "argboard-budget-" });
  const added = await run(
    ["git", "worktree", "add", "--detach", tmp, ref],
    Deno.cwd(),
  );
  if (!added.ok) {
    await Deno.remove(tmp, { recursive: true });
    throw new Error(`git worktree add ${ref} failed:\n${added.stderr}`);
  }
  return {
    reader: {
      read: (path) => gitShow(ref, path),
      list: (dir) => gitList(ref, dir),
      gzip: () => buildGzipBytes(tmp),
    },
    cleanup: async () => {
      await run(["git", "worktree", "remove", "--force", tmp], Deno.cwd());
      try {
        await Deno.remove(tmp, { recursive: true });
      } catch {
        // worktree remove already deleted it
      }
    },
  };
}

async function measure(reader: TreeReader): Promise<Metrics> {
  const uiNames = await reader.list("ui");
  const uiPaths = uiNames.map((name) => `ui/${name}`);
  const bodyPaths = ["serve.ts", ...uiPaths];

  let bodyLines = 0;
  let bodyLinesTs = 0;
  let bodyFiles = 0;
  const tsxTexts: string[] = [];

  for (const path of bodyPaths) {
    const text = await reader.read(path);
    if (text == null) continue;
    bodyFiles++;
    const lines = lineCount(text);
    bodyLines += lines;
    if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      bodyLinesTs += lines;
    }
    if (path.endsWith(".tsx")) tsxTexts.push(text);
  }

  const unitNames = await reader.list("tests/unit");
  let testLines = 0;
  const smokeSrc = (await reader.read("tests/smoke.ts")) ?? "";
  testLines += lineCount(smokeSrc);
  for (const name of unitNames) {
    const text = await reader.read(`tests/unit/${name}`);
    if (text == null) continue;
    testLines += lineCount(text);
  }

  const typesSrc = (await reader.read("ui/types.ts")) ?? "";
  const stateSrc = (await reader.read("ui/state.ts")) ?? "";

  return {
    bodyLines,
    bodyLinesTs,
    bodyFiles,
    testLines,
    smokeCount: countSmoke(smokeSrc),
    gzipBytes: await reader.gzip(),
    operations: countOperations(tsxTexts),
    concepts: countConcepts(typesSrc, stateSrc),
  };
}

function formatDelta(n: number): string {
  if (n > 0) return `+${n.toLocaleString("en-US")}`;
  if (n < 0) return n.toLocaleString("en-US");
  return "0";
}

function renderTable(
  stock: Metrics,
  flow: Metrics | null,
  since: string | null,
): string {
  const lines: string[] = [
    "### 1. 状況（数字）",
    "",
  ];
  if (flow && since) {
    lines.push(`| 指標 | stock | Δ (\`${since}\`..) |`);
    lines.push("| --- | ---: | ---: |");
    for (const row of ROWS) {
      const delta = stock[row.key] - flow[row.key];
      const deltaText = row.key === "gzipBytes"
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
      ? `計測: \`deno task budget --since ${since}\` / 定義正本: PLAN §4`
      : "計測: `deno task budget` / 定義正本: PLAN §4",
  );
  return lines.join("\n");
}

async function main(): Promise<void> {
  const since = parseSince(Deno.args);
  const root = Deno.cwd();
  const stock = await measure(workingTreeReader(root));

  let baseline: Metrics | null = null;
  if (since) {
    const { reader, cleanup } = await refTreeReader(since);
    try {
      baseline = await measure(reader);
    } finally {
      await cleanup();
    }
  }

  console.log(renderTable(stock, baseline, since));
}

if (import.meta.main) {
  await main();
}
