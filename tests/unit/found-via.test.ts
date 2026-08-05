import {
  appendEvent,
  buildFoundViaForest,
  cardFoundViaDepth,
  createEmptyProject,
  flattenFoundViaForest,
  sortCardsByFoundViaTree,
  viewThrough,
} from "../../ui/project.ts";
import type { Card } from "../../ui/types.ts";

Deno.test("foundVia roundtrips on card_added and clears via found_via_cleared", () => {
  const parentId = crypto.randomUUID();
  const childId = crypto.randomUUID();
  const parent: Card = {
    id: parentId,
    title: "資料",
    foundAt: 100,
  };
  const child: Card = {
    id: childId,
    title: "枝",
    foundAt: 200,
    foundVia: parentId,
  };
  let project = createEmptyProject("test", 50);
  project = appendEvent(
    { ...project, cards: [parent, child] },
    { type: "card_added", at: 100, card: parent },
  );
  project = appendEvent(project, {
    type: "card_added",
    at: 200,
    card: child,
  });

  const withVia = viewThrough(project, 1);
  const childLive = withVia.cards.find((item) => item.id === childId);
  if (childLive?.foundVia !== parentId) {
    throw new Error("foundVia must survive replay through card_added");
  }

  project = appendEvent(
    {
      ...project,
      cards: project.cards.map((item) => {
        if (item.id !== childId) return item;
        const { foundVia: _removed, ...rest } = item;
        return rest;
      }),
    },
    { type: "found_via_cleared", at: 300, cardId: childId },
  );

  const cleared = viewThrough(project, 2);
  const childCleared = cleared.cards.find((item) => item.id === childId);
  if ("foundVia" in (childCleared ?? {})) {
    throw new Error("found_via_cleared must remove foundVia on replay");
  }
});

Deno.test("sortCardsByFoundViaTree groups parent before children", () => {
  const parent = { id: "p", title: "資料", foundAt: 100 };
  const childOld = { id: "c1", title: "古い枝", foundAt: 101, foundVia: "p" };
  const childNew = { id: "c2", title: "新しい枝", foundAt: 200, foundVia: "p" };
  const other = { id: "o", title: "別ルート", foundAt: 150 };
  const ordered = sortCardsByFoundViaTree([childNew, other, parent, childOld]);
  const ids = ordered.map((item) => item.id);
  if (ids.join(",") !== "o,p,c1,c2") {
    throw new Error(
      `Expected newest root then parent subtree, got ${ids.join(",")}`,
    );
  }
});

Deno.test("cardFoundViaDepth counts foundVia hops", () => {
  const root = "root";
  const mid = "mid";
  const leaf = "leaf";
  const byId = new Map([
    [root, { foundVia: undefined }],
    [mid, { foundVia: root }],
    [leaf, { foundVia: mid }],
  ]);
  if (cardFoundViaDepth({ id: root }, byId) !== 0) {
    throw new Error("root depth must be 0");
  }
  if (cardFoundViaDepth({ id: mid, foundVia: root }, byId) !== 1) {
    throw new Error("child depth must be 1");
  }
  if (cardFoundViaDepth({ id: leaf, foundVia: mid }, byId) !== 2) {
    throw new Error("grandchild depth must be 2");
  }
});

Deno.test("buildFoundViaForest nests under filtered parents only", () => {
  const parent = { id: "p", title: "資料", foundAt: 100 };
  const child = { id: "c", title: "枝", foundAt: 200, foundVia: "p" };
  const orphan = { id: "o", title: "親なし", foundAt: 150 };
  const forest = buildFoundViaForest([child, orphan]);
  if (forest.roots.map((item) => item.id).join(",") !== "c,o") {
    throw new Error("Missing filtered parent makes child a root");
  }
  const nested = buildFoundViaForest([parent, child, orphan]);
  if (
    (nested.childrenByParent.get("p") ?? []).map((item) => item.id).join(
      ",",
    ) !== "c"
  ) {
    throw new Error("Visible parent must nest its child");
  }
});

Deno.test("flattenFoundViaForest skips collapsed subtrees", () => {
  const parent = { id: "p", title: "資料", foundAt: 100 };
  const child = { id: "c", title: "枝", foundAt: 200, foundVia: "p" };
  const forest = buildFoundViaForest([parent, child]);
  const flat = flattenFoundViaForest(forest, new Set(["p"]));
  if (flat.map((item) => item.id).join(",") !== "p") {
    throw new Error("Collapsed parent must hide descendants");
  }
});

Deno.test("import JSON without foundVia stays valid", () => {
  const card: Card = { id: "a", title: "旧", foundAt: 10 };
  const project = createEmptyProject("legacy", 1);
  const merged = { ...project, cards: [card] };
  const parsed = JSON.parse(JSON.stringify(merged));
  if (parsed.cards[0].foundVia !== undefined) {
    throw new Error("Legacy cards must not gain foundVia");
  }
});
