import {
  createDemoProject,
  createEmptyProject,
  focusReachableIds,
  reachableCardIds,
  reachableFromCardIds,
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

Deno.test("reachableFromCardIds expands from multiple seeds", () => {
  const links = [
    { from: "a", to: "x" },
    { from: "b", to: "y" },
  ];
  const zero = [...reachableFromCardIds(links, ["a", "b"], 0)].toSorted()
    .join(",");
  if (zero !== "a,b") throw new Error(`0 extra hops expected a,b got ${zero}`);
  const one = [...reachableFromCardIds(links, ["a", "b"], 1)].toSorted()
    .join(",");
  if (one !== "a,b,x,y") {
    throw new Error(`1 extra hop expected a,b,x,y got ${one}`);
  }
});

Deno.test("focusReachableIds tag origin: 1 hop = tagged cards only", () => {
  const cards = [
    { id: "a", tags: ["17"] },
    { id: "b", tags: ["17"] },
    { id: "c", tags: ["other"] },
    { id: "d" },
  ];
  const links = [
    { from: "a", to: "c" },
    { from: "b", to: "d" },
  ];
  const one = [
    ...focusReachableIds(links, cards, { kind: "tag", tag: "17" }, 1),
  ]
    .toSorted().join(",");
  if (one !== "a,b") {
    throw new Error(`tag 1 hop expected a,b got ${one}`);
  }
  const two = [
    ...focusReachableIds(links, cards, { kind: "tag", tag: "17" }, 2),
  ]
    .toSorted().join(",");
  if (two !== "a,b,c,d") {
    throw new Error(`tag 2 hops expected a,b,c,d got ${two}`);
  }
});

Deno.test("focusReachableIds card origin matches reachableCardIds", () => {
  const links = [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
  ];
  const cards = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const viaFocus = [...focusReachableIds(
    links,
    cards,
    { kind: "card", cardId: "a" },
    1,
  )].toSorted().join(",");
  const viaReach = [...reachableCardIds(links, "a", 1)].toSorted().join(",");
  if (viaFocus !== viaReach) {
    throw new Error(`card origin mismatch: ${viaFocus} vs ${viaReach}`);
  }
});
