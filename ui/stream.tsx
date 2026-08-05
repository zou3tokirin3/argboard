import { useRef } from "preact/hooks";
import { CardRoleToggle } from "./card-role-toggle.tsx";
import { DigClearViaButton, DigStartButton } from "./digging-controls.tsx";
import {
  buildFoundViaForest,
  cardFoundViaDepth,
  flattenFoundViaForest,
} from "./project.ts";
import {
  clearCardFoundVia,
  clearFocusView,
  collapsedStreamBranches,
  diggingCardId,
  expandFocusHops,
  filteredCards,
  focusHops,
  focusOrigin,
  isReplaying,
  openExploreCompose,
  placedOnly,
  removeCard,
  search,
  selectCardFromStream,
  selectedCardId,
  selectedCardIds,
  selectSingleCard,
  setFocusViewByTag,
  shrinkFocusHops,
  startDigging,
  streamTreeView,
  toggleStreamBranchCollapsed,
  toggleStreamTreeView,
  unplacedOnly,
  viewProject,
} from "./state.ts";
import { MediaThumb } from "./media-thumb.tsx";
import { isLocalMediaRef } from "./media.ts";
import { StreamStickyTrail } from "./stream-sticky-trail.tsx";
import { collectTagUsage } from "./tags.ts";
import type { Card } from "./types.ts";
import { CARD_MIME } from "./types.ts";

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
});

function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

function streamCardStatus(
  card: { id: string; image?: string },
  boardCardIds: Set<string>,
): string {
  const parts = [boardCardIds.has(card.id) ? "ボード済" : "未配置"];
  if (isLocalMediaRef(card.image)) parts.push("画像");
  return parts.join(" · ");
}

function streamMetaLabel(
  card: { role?: "finding" | "thought" },
  status: string,
  childCount: number,
): string {
  const role = card.role === "thought" ? "考察" : "発見";
  const branch = childCount > 0 ? ` · 枝${childCount}` : "";
  return `${role} · ${status}${branch}`;
}

function FoundViaLink(props: {
  parentId: string;
  parentTitle: string | undefined;
  onSelect: (id: string) => void;
}) {
  const label = props.parentTitle ?? "（削除済み）";
  if (!props.parentTitle) {
    return (
      <span class="stream-card__via stream-card__via--missing">
        <span class="stream-card__via-mark" aria-hidden="true">↳</span>
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      class="stream-card__via"
      data-testid="stream-card-via"
      title={`発見元: ${label}`}
      onClick={(event) => {
        event.stopPropagation();
        props.onSelect(props.parentId);
      }}
    >
      <span class="stream-card__via-mark" aria-hidden="true">↳</span>
      <span class="stream-card__via-title">{label}</span>
    </button>
  );
}

function isMetaToolTarget(target: EventTarget | null): boolean {
  return Boolean(
    (target as HTMLElement | null)?.closest(
      "button, .inspector__size-toggle, .stream-card__meta-tools, .dig-act, .stream__branch-toggle",
    ),
  );
}

type StreamCardRowProps = {
  card: Card;
  depth: number;
  treeView: boolean;
  branchCollapsed: boolean;
  childCount: number;
  boardCardIds: Set<string>;
  canDrag: boolean;
  replaying: boolean;
  isContemplate: boolean;
  allCards: readonly Card[];
  onToggleBranch?: () => void;
};

function StreamCardRow(props: StreamCardRowProps) {
  const {
    card,
    depth,
    treeView,
    branchCollapsed,
    childCount,
    boardCardIds,
    canDrag,
    replaying,
    isContemplate,
    allCards,
    onToggleBranch,
  } = props;
  const selected = selectedCardIds.value.includes(card.id) ||
    selectedCardId.value === card.id;
  const status = streamCardStatus(card, boardCardIds);
  const digging = diggingCardId.value === card.id;
  const viaCard = card.foundVia
    ? allCards.find((item) => item.id === card.foundVia)
    : undefined;

  return (
    <div
      class={`stream-row${treeView ? " stream-row--tree" : ""}`}
      data-card-id={card.id}
      data-dig-depth={depth}
      style={{ "--dig-depth": String(depth) }}
    >
      <div
        class={`stream-card ${selected ? "is-selected" : ""} ${
          card.role === "thought" ? "is-thought" : ""
        } ${!treeView && card.foundVia ? "has-via" : ""} ${
          childCount > 0 ? "has-children" : ""
        } ${canDrag ? "is-draggable" : ""}`}
        data-testid="stream-card"
        data-card-id={card.id}
        data-role={card.role === "thought" ? "thought" : "finding"}
      >
        <div
          class="stream-card__meta-row"
          onClick={(event) => {
            if (isMetaToolTarget(event.target)) return;
            selectCardFromStream(card.id);
          }}
        >
          {treeView && childCount > 0
            ? (
              <button
                type="button"
                class="stream__branch-toggle"
                data-testid="stream-branch-toggle"
                aria-expanded={!branchCollapsed}
                aria-label={branchCollapsed ? "枝を開く" : "枝を畳む"}
                title={branchCollapsed ? "枝を開く" : "枝を畳む"}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleBranch?.();
                }}
              >
                {branchCollapsed ? "▸" : "▾"}
              </button>
            )
            : null}
          <time>{timeFormatter.format(card.foundAt)}</time>
          {selected && !replaying
            ? (
              <span class="stream-card__meta-tools">
                <CardRoleToggle
                  cardId={card.id}
                  role={card.role}
                  testIdPrefix="stream"
                />
                <DigStartButton
                  active={digging}
                  onClick={digging ? undefined : (event) => {
                    event.stopPropagation();
                    startDigging(card.id);
                  }}
                />
                {card.foundVia
                  ? (
                    <DigClearViaButton
                      title={viaCard
                        ? `「${viaCard.title}」からの発見を埋める`
                        : "間違えて掘った分を埋める"}
                      onClick={(event) => {
                        event.stopPropagation();
                        void clearCardFoundVia(card.id);
                      }}
                    />
                  )
                  : null}
                <span class="stream-card__status">{status}</span>
                <button
                  type="button"
                  class="stream-card__delete-inline"
                  data-testid="stream-card-delete"
                  onClick={(event) => {
                    event.stopPropagation();
                    void removeCard(card.id);
                  }}
                >
                  削除
                </button>
              </span>
            )
            : (
              <span class="stream-card__meta-label">
                {streamMetaLabel(card, status, childCount)}
              </span>
            )}
        </div>
        {!treeView && card.foundVia
          ? (
            <FoundViaLink
              parentId={card.foundVia}
              parentTitle={viaCard?.title}
              onSelect={selectCardFromStream}
            />
          )
          : null}
        <button
          type="button"
          class="stream-card__main"
          draggable={canDrag}
          onDragStart={(event) => {
            if (!canDrag) return;
            globalThis.getSelection?.()?.removeAllRanges();
            event.dataTransfer?.setData(CARD_MIME, card.id);
            event.dataTransfer!.effectAllowed = "copy";
          }}
          onDragEnd={() => globalThis.getSelection?.()?.removeAllRanges()}
          onClick={() => selectCardFromStream(card.id)}
        >
          <span class="stream-card__body-row">
            <span class="stream-card__text">
              <strong>{card.title}</strong>
              {card.body ? <small>{card.body}</small> : null}
              {card.tags?.length
                ? (
                  <span class="tags">
                    {card.tags.map((tag) => <i key={tag}>#{tag}</i>)}
                  </span>
                )
                : null}
            </span>
            {isLocalMediaRef(card.image)
              ? (
                <button
                  type="button"
                  class="stream-card__thumb-btn"
                  data-testid="stream-card-thumb"
                  title="追記モードで開く"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (isContemplate) return;
                    if (selectedCardId.value !== card.id) {
                      selectSingleCard(card.id);
                    }
                    openExploreCompose(card.id);
                  }}
                >
                  <MediaThumb
                    image={card.image}
                    className="stream-card__thumb"
                  />
                </button>
              )
              : null}
          </span>
        </button>
        {card.url
          ? (
            <a
              class="stream-card__url"
              data-testid="stream-card-url"
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {sourceLabel(card.url)}
            </a>
          )
          : null}
      </div>
    </div>
  );
}

function TagFocusControls() {
  const current = viewProject.value;
  const usage = current ? collectTagUsage(current.cards) : [];
  if (usage.length === 0) return null;
  const origin = focusOrigin.value;
  const tagFocus = origin?.kind === "tag" ? origin.tag : null;
  const hops = focusHops.value;
  return (
    <div class="stream__tag-focus">
      <div class="stream__tag-focus-list" role="group" aria-label="タグで視点">
        {usage.map((entry) => (
          <button
            key={entry.name}
            type="button"
            class={`stream__tag-focus-btn${
              tagFocus === entry.name ? " is-active" : ""
            }`}
            data-testid="stream-tag-focus-btn"
            data-tag={entry.name}
            aria-pressed={tagFocus === entry.name}
            title={`「${entry.name}」の視点で見る（${entry.count}件）`}
            onClick={() => setFocusViewByTag(entry.name)}
          >
            #{entry.name}
            <span class="stream__tag-focus-count">{entry.count}</span>
          </button>
        ))}
      </div>
      {tagFocus
        ? (
          <div class="stream__tag-focus-ops" aria-label={`視点 #${tagFocus}`}>
            <span class="board__focus-meta" aria-live="polite">
              視点 · {hops}
            </span>
            <button
              type="button"
              class="board__focus-icon"
              disabled={hops <= 1}
              aria-label="一周戻す"
              title="一周戻す"
              onClick={() => shrinkFocusHops()}
            >
              −
            </button>
            <button
              type="button"
              class="board__focus-icon"
              aria-label="もう一周広げる"
              title="もう一周広げる"
              onClick={() => expandFocusHops()}
            >
              ＋
            </button>
            <button
              type="button"
              class="board__focus-icon"
              data-testid="tag-focus-clear"
              aria-label="視点をやめる"
              title="視点をやめる"
              onClick={() => clearFocusView()}
            >
              ×
            </button>
          </div>
        )
        : null}
    </div>
  );
}

type StreamTreeBranchProps = {
  card: Card;
  depth: number;
  forest: ReturnType<typeof buildFoundViaForest>;
  collapsed: ReadonlySet<string>;
  childCountByParent: ReadonlyMap<string, number>;
  boardCardIds: Set<string>;
  canDrag: boolean;
  replaying: boolean;
  isContemplate: boolean;
  allCards: readonly Card[];
};

function StreamTreeBranch(props: StreamTreeBranchProps) {
  const {
    card,
    depth,
    forest,
    collapsed,
    childCountByParent,
    boardCardIds,
    canDrag,
    replaying,
    isContemplate,
    allCards,
  } = props;
  const childCount = childCountByParent.get(card.id) ?? 0;
  const branchCollapsed = collapsed.has(card.id);
  const children = branchCollapsed
    ? []
    : forest.childrenByParent.get(card.id) ?? [];

  return (
    <>
      <StreamCardRow
        card={card}
        depth={depth}
        treeView
        branchCollapsed={branchCollapsed}
        childCount={childCount}
        boardCardIds={boardCardIds}
        canDrag={canDrag}
        replaying={replaying}
        isContemplate={isContemplate}
        allCards={allCards}
        onToggleBranch={() => toggleStreamBranchCollapsed(card.id)}
      />
      {children.map((child) => (
        <StreamTreeBranch
          key={child.id}
          card={child}
          depth={depth + 1}
          forest={forest}
          collapsed={collapsed}
          childCountByParent={childCountByParent}
          boardCardIds={boardCardIds}
          canDrag={canDrag}
          replaying={replaying}
          isContemplate={isContemplate}
          allCards={allCards}
        />
      ))}
    </>
  );
}

export function Stream() {
  const current = viewProject.value;
  const replaying = isReplaying.value;
  const boardCardIds = new Set(current?.boards[0]?.cardIds ?? []);
  const isContemplate = (current?.ui?.mode ?? "explore") === "contemplate";
  const canDrag = isContemplate && !replaying;
  const cards = current?.cards ?? [];
  const cardById = new Map(cards.map((item) => [item.id, item]));
  const filtered = filteredCards.value;
  const visibleIds = new Set(filtered.map((item) => item.id));
  const treeView = streamTreeView.value;
  const collapsed = collapsedStreamBranches.value;
  const childCountByParent = new Map<string, number>();
  for (const card of filtered) {
    if (!card.foundVia || !visibleIds.has(card.foundVia)) continue;
    childCountByParent.set(
      card.foundVia,
      (childCountByParent.get(card.foundVia) ?? 0) + 1,
    );
  }
  const forest = treeView ? buildFoundViaForest(filtered) : null;
  const displayCards = treeView && forest
    ? flattenFoundViaForest(forest, collapsed)
    : filtered;
  const listRef = useRef<HTMLDivElement>(null);

  return (
    <section class="stream" aria-label="発見ログ">
      <div class="section-heading">
        <div>
          <span class="eyebrow">タイムライン</span>
          <h2>発見ログ</h2>
        </div>
        <span class="count">{current?.cards.length ?? 0}</span>
      </div>
      <label class="search">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={search.value}
          onInput={(event) => {
            search.value = event.currentTarget.value;
            if (!search.value.trim() && focusOrigin.value?.kind === "tag") {
              clearFocusView();
            }
          }}
          placeholder="手がかりを検索"
          aria-label="手がかりを検索"
        />
      </label>
      <div class="stream__filters">
        <button
          type="button"
          class={`stream__filter-btn${unplacedOnly.value ? " is-active" : ""}`}
          data-testid="stream-unplaced-only"
          aria-pressed={unplacedOnly.value}
          title="ボードに未配置のカードだけを表示"
          onClick={() => {
            const next = !unplacedOnly.value;
            unplacedOnly.value = next;
            if (next) placedOnly.value = false;
          }}
        >
          未配置のみ
        </button>
        <button
          type="button"
          class={`stream__filter-btn${placedOnly.value ? " is-active" : ""}`}
          data-testid="stream-placed-only"
          aria-pressed={placedOnly.value}
          title="ボードに配置済みのカードだけを表示"
          onClick={() => {
            const next = !placedOnly.value;
            placedOnly.value = next;
            if (next) unplacedOnly.value = false;
          }}
        >
          配置済のみ
        </button>
        <button
          type="button"
          class={`stream__filter-btn${treeView ? " is-active" : ""}`}
          data-testid="stream-tree-view"
          aria-pressed={treeView}
          title="発見元の親子で入れ子表示し、枝を畳める"
          onClick={() => toggleStreamTreeView()}
        >
          ツリー
        </button>
      </div>
      <TagFocusControls />
      <div class="stream__list" ref={listRef}>
        <StreamStickyTrail
          listRef={listRef}
          visibleCards={displayCards}
          cardById={cardById}
          visibleIds={visibleIds}
        />
        {treeView && forest
          ? forest.roots.map((card) => (
            <StreamTreeBranch
              key={card.id}
              card={card}
              depth={0}
              forest={forest}
              collapsed={collapsed}
              childCountByParent={childCountByParent}
              boardCardIds={boardCardIds}
              canDrag={canDrag}
              replaying={replaying}
              isContemplate={isContemplate}
              allCards={cards}
            />
          ))
          : filtered.map((card) => {
            const childCount = childCountByParent.get(card.id) ?? 0;
            const digDepth = cardFoundViaDepth(card, cardById, 12, visibleIds);
            return (
              <StreamCardRow
                key={card.id}
                card={card}
                depth={digDepth}
                treeView={false}
                branchCollapsed={false}
                childCount={childCount}
                boardCardIds={boardCardIds}
                canDrag={canDrag}
                replaying={replaying}
                isContemplate={isContemplate}
                allCards={cards}
              />
            );
          })}
      </div>
    </section>
  );
}
