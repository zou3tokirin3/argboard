import {
  createDemoProject,
  createEmptyProject,
  reachableCardIds,
} from "../../ui/project.ts";

Deno.test("createEmptyProject starts with no cards and one board", () => {
  const project = createEmptyProject("テストケース", 1_700_000_000_000);
  if (project.name !== "テストケース") {
    throw new Error(`Unexpected name: ${project.name}`);
  }
  if (project.cards.length !== 0) {
    throw new Error("Empty project must start with zero cards");
  }
  if (project.boards.length !== 1) {
    throw new Error("M2-bound: exactly one board");
  }
  if (project.version !== 1) {
    throw new Error("Schema version must be 1");
  }
});

Deno.test("createEmptyProject falls back when name is blank", () => {
  const project = createEmptyProject("   ");
  if (project.name !== "新しいケース") {
    throw new Error(`Unexpected fallback name: ${project.name}`);
  }
});

Deno.test("createDemoProject keeps sample cards sorted by discovery", () => {
  const project = createDemoProject(1_700_000_000_000);
  if (project.cards.length < 2) {
    throw new Error("Demo project should include sample cards");
  }
  const newestFirst = [...project.cards].toSorted(
    (left, right) => right.foundAt - left.foundAt,
  );
  if (newestFirst[0].foundAt < newestFirst[1].foundAt) {
    throw new Error("Demo foundAt values must allow newest-first ordering");
  }
});

Deno.test("reachableCardIds includes start at 0 hops", () => {
  const set = reachableCardIds([{ from: "a", to: "b" }], "a", 0);
  if (set.size !== 1 || !set.has("a")) {
    throw new Error("0 hops must be start only");
  }
});

Deno.test("reachableCardIds walks undirected hops", () => {
  const links = [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
    { from: "c", to: "d" },
  ];
  const one = [...reachableCardIds(links, "a", 1)].toSorted().join(",");
  if (one !== "a,b") throw new Error(`1 hop from a expected a,b got ${one}`);
  const two = [...reachableCardIds(links, "a", 2)].toSorted().join(",");
  if (two !== "a,b,c") {
    throw new Error(`2 hops from a expected a,b,c got ${two}`);
  }
});

Deno.test("reachableCardIds includes thought neighbors the same way", () => {
  const links = [
    { from: "finding", to: "thought" },
    { from: "thought", to: "other" },
  ];
  const set = [...reachableCardIds(links, "thought", 1)].toSorted().join(",");
  if (set !== "finding,other,thought") {
    throw new Error(`thought 1 hop mismatch: ${set}`);
  }
});
