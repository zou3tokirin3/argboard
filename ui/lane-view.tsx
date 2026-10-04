import { laneMemberCards } from "./project.ts";
import { laneView, setLaneOrigin, viewProject } from "./state.ts";
import { formatStoryWhenLabel, sortLaneCards } from "./story-when.ts";

export function LaneWorkspace() {
  const current = viewProject.value;
  const { open, originId } = laneView.value;
  if (!current || !open) return null;

  const cards = current.cards.toSorted((a, b) =>
    a.title.localeCompare(b.title, "ja")
  );
  const origin = originId ? current.cards.find((c) => c.id === originId) : null;
  const members = origin
    ? sortLaneCards(laneMemberCards(current.links, current.cards, origin.id))
    : [];

  return (
    <div class="workspace workspace--lane">
      <div class="lane-panel">
        <h2>作中レーン</h2>
        <p class="lane-empty">
          起点に糸で繋がる作中時間つきカードを時間順に並べます（配置は覚えません）。
        </p>
        <label class="lane-origin">
          起点{" "}
          <select
            data-testid="lane-origin-pick"
            value={originId ?? ""}
            onChange={(event) => {
              setLaneOrigin(event.currentTarget.value || null);
            }}
          >
            <option value="">カードを選ぶ</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.title}
                {card.role === "thought" ? "（考察）" : ""}
              </option>
            ))}
          </select>
        </label>
        {!origin
          ? <p class="lane-empty">起点カードを選ぶと、ここに並びます</p>
          : (
            <>
              <h3>{origin.title}</h3>
              {members.length === 0
                ? (
                  <p class="lane-empty">
                    糸で繋がる作中時間つきカードがありません
                  </p>
                )
                : (
                  <ul class="lane-list">
                    {members.map((card) => (
                      <li key={card.id}>
                        <span class="lane-when">
                          {formatStoryWhenLabel(card) || "—"}
                        </span>
                        {card.title}
                      </li>
                    ))}
                  </ul>
                )}
            </>
          )}
      </div>
    </div>
  );
}
