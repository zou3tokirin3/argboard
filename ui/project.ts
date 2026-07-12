import type { Card, Project } from "./types.ts";

export function createEmptyProject(
  name: string,
  now = Date.now(),
): Project {
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: name.trim() || "新しいケース",
    createdAt: now,
    cards: [],
    links: [],
    boards: [{
      id: "main-board",
      name: "メインボード",
      cardIds: [],
      positions: {},
    }],
    ui: { mode: "explore", sideOpen: false },
  };
}

export function createDemoProject(now = Date.now()): Project {
  const cards: Card[] = [
    {
      id: "radio-signal",
      title: "23:17の短波ラジオ",
      body: "毎晩同じ時刻に数字列が流れる。",
      tags: ["音声", "時刻"],
      foundAt: now - 3600000,
    },
    {
      id: "station-locker",
      title: "東口ロッカー B-17",
      body: "動画の背景に一瞬だけ映り込んだ。",
      tags: ["場所"],
      foundAt: now - 2800000,
    },
    {
      id: "missing-poster",
      title: "消えた告知ポスター",
      body: "アーカイブにはあるが、現地では剥がされていた。",
      tags: ["矛盾"],
      foundAt: now - 1900000,
    },
    {
      id: "seventeen-theory",
      title: "17は集合時刻ではなく番号？",
      body: "時刻、ロッカー、投稿IDに17が繰り返し現れる。",
      tags: ["仮説"],
      foundAt: now - 900000,
    },
  ];

  return {
    version: 1,
    id: crypto.randomUUID(),
    name: "CASE 017 / 夜の放送",
    createdAt: now,
    cards,
    links: [
      {
        id: "signal-theory",
        from: "radio-signal",
        to: "seventeen-theory",
        label: "17が反復",
        kind: "connects",
        createdAt: now,
      },
      {
        id: "locker-theory",
        from: "station-locker",
        to: "seventeen-theory",
        label: "B-17",
        kind: "connects",
        createdAt: now,
      },
      {
        id: "poster-signal",
        from: "missing-poster",
        to: "radio-signal",
        label: "日付が矛盾",
        kind: "contradicts",
        createdAt: now,
      },
    ],
    boards: [{
      id: "main-board",
      name: "メインボード",
      cardIds: cards.map((card) => card.id),
      positions: {
        "radio-signal": { x: 90, y: 90 },
        "station-locker": { x: 480, y: 70 },
        "missing-poster": { x: 95, y: 345 },
        "seventeen-theory": { x: 470, y: 330 },
      },
    }],
    ui: { mode: "explore", sideOpen: false },
  };
}
