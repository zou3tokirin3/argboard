import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { t } from "../src/i18n/index.ts";
import { CardRoleToggle } from "./card-role-toggle.tsx";
import { DigClearViaButton, DigStartButton } from "./digging-controls.tsx";
import { IconTip } from "./icon-tip.tsx";
import { ImageEnlargeButton } from "./image-overlay.tsx";
import { isLocalMediaRef } from "./media.ts";
import { MediaThumb } from "./media-thumb.tsx";
import { normalizePanelPhase } from "./panel-phase.ts";
import { buildFoundViaForest, flattenFoundViaForest } from "./project.ts";
import {
  clearCardFoundVia,
  clearFocusView,
  collapsedStreamBranches,
  diggingCardId,
  expandFocusHops,
  exploreComposeCard,
  exploreComposeCardId,
  filteredCards,
  findingOnly,
  focusHops,
  focusOrigin,
  isReplaying,
  openExploreCompose,
  openOutcomeOnly,
  placedOnly,
  registerPendingEditFlusher,
  removeCard,
  revealStreamCardId,
  type StoryWhenFilter,
  search,
  selectCardFromStream,
  selectedCardId,
  selectedCardIds,
  selectSingleCard,
  setFocusViewByTag,
  shrinkFocusHops,
  startDigging,
  storyWhenFilter,
  thoughtOnly,
  toggleStreamBranchCollapsed,
  unplacedOnly,
  updateCard,
  viewProject,
} from "./state.ts";
import { formatStoryWhenLabel, hasStoryWhen } from "./story-when.ts";
import { StreamStickyTrail } from "./stream-sticky-trail.tsx";
import { collectTagUsage } from "./tags.ts";
import { thoughtOutcomeLabel, thoughtOutcomeShort } from "./thought-outcome.ts";
import { ThoughtOutcomeField } from "./thought-outcome-field.tsx";
import { ThoughtOutcomeIcon } from "./thought-outcome-icon.tsx";
import type { Card } from "./types.ts";
import { CARD_MIME } from "./types.ts";

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
});

function streamEmptyReason(input: {
  total: number;
  query: string;
  unplacedOnly: boolean;
  placedOnly: boolean;
  findingOnly: boolean;
  thoughtOnly: boolean;
  openOutcomeOnly: boolean;
  storyWhenFilter: StoryWhenFilter;
}): string {
  if (input.total === 0) return t("stream.empty.initial");
  if (input.query) return t("stream.empty.query", { query: input.query });
  const filters: string[] = [];
  if (input.unplacedOnly) filters.push(t("stream.filter.unplaced"));
  if (input.placedOnly) filters.push(t("stream.filter.placed"));
  if (input.findingOnly) filters.push(t("stream.filter.finding"));
  if (input.thoughtOnly) filters.push(t("stream.filter.thought"));
  if (input.openOutcomeOnly) filters.push(t("stream.filter.open"));
  if (input.storyWhenFilter === "with") filters.push(t("stream.when.with"));
  if (input.storyWhenFilter === "without")
    filters.push(t("stream.when.without"));
  if (filters.length > 0) {
    return t("stream.empty.filters", { filters: filters.join("・") });
  }
  return t("stream.empty.fallback");
}

type PlacementFilter = "all" | "unplaced" | "placed";
type RoleFilter = "all" | "finding" | "thought";

function placementFilterOf(
  unplaced: boolean,
  placed: boolean,
): PlacementFilter {
  if (unplaced) return "unplaced";
  if (placed) return "placed";
  return "all";
}

function cyclePlacementFilter(): void {
  const cur = placementFilterOf(unplacedOnly.value, placedOnly.value);
  if (cur === "all") {
    unplacedOnly.value = true;
    placedOnly.value = false;
  } else if (cur === "unplaced") {
    unplacedOnly.value = false;
    placedOnly.value = true;
  } else {
    unplacedOnly.value = false;
    placedOnly.value = false;
  }
}

function roleFilterOf(finding: boolean, thought: boolean): RoleFilter {
  if (finding) return "finding";
  if (thought) return "thought";
  return "all";
}

function cycleRoleFilter(): void {
  const cur = roleFilterOf(findingOnly.value, thoughtOnly.value);
  if (cur === "all") {
    findingOnly.value = true;
    thoughtOnly.value = false;
  } else if (cur === "finding") {
    findingOnly.value = false;
    thoughtOnly.value = true;
  } else {
    findingOnly.value = false;
    thoughtOnly.value = false;
  }
}

function cycleStoryWhenFilter(): void {
  const cur = storyWhenFilter.value;
  storyWhenFilter.value =
    cur === "off" ? "with" : cur === "with" ? "without" : "off";
}

function placementFilterLabel(state: PlacementFilter): string {
  if (state === "unplaced") return t("stream.placement.unplaced");
  if (state === "placed") return t("stream.placement.placed");
  return t("stream.filter.all");
}

function roleFilterLabel(state: RoleFilter): string {
  if (state === "finding") return t("stream.role.finding");
  if (state === "thought") return t("stream.role.thought");
  return t("stream.filter.all");
}

function storyWhenFilterLabel(state: StoryWhenFilter): string {
  if (state === "with") return t("stream.when.with");
  if (state === "without") return t("stream.when.without");
  return t("stream.filter.all");
}

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
  const parts = [
    boardCardIds.has(card.id)
      ? t("stream.status.placed")
      : t("stream.status.unplaced"),
  ];
  if (isLocalMediaRef(card.image)) parts.push(t("stream.status.image"));
  return parts.join(" · ");
}

function streamMetaLabel(
  card: { role?: "finding" | "thought"; outcome?: Card["outcome"] },
  status: string,
  childCount: number,
): string {
  const role =
    card.role === "thought"
      ? t("stream.role.thought")
      : t("stream.role.finding");
  const outcome = card.outcome ? ` · ${thoughtOutcomeLabel(card.outcome)}` : "";
  const branch =
    childCount > 0 ? t("stream.meta.branch", { count: childCount }) : "";
  return `${role}${outcome} · ${status}${branch}`;
}

function isMetaToolTarget(target: EventTarget | null): boolean {
  return Boolean(
    (target as HTMLElement | null)?.closest(
      "button, .inspector__size-toggle, .inspector__outcome-toggle, .stream-card__meta-tools, .dig-act, .stream__branch-toggle, .stream-card__title-input",
    ),
  );
}

/** Controls that must not start stream→board card drag. */
function isStreamCardDragIgnoredTarget(target: EventTarget | null): boolean {
  return Boolean(
    (target as HTMLElement | null)?.closest(
      "button, a, input, textarea, select, [contenteditable='true']",
    ),
  );
}

function scrollStreamRowIntoView(list: HTMLElement, cardId: string): boolean {
  if (list.clientHeight <= 0) return false;
  const row = list.querySelector<HTMLElement>(
    `.stream-row[data-card-id="${CSS.escape(cardId)}"]`,
  );
  if (!row) return false;
  const listRect = list.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const delta =
    rowRect.top + rowRect.height / 2 - (listRect.top + listRect.height / 2);
  list.scrollTo({
    top: list.scrollTop + delta,
    behavior: "smooth",
  });
  return true;
}

function StreamCardTitle(props: {
  card: Pick<Card, "id" | "title" | "body" | "url">;
  editable: boolean;
}) {
  const { card, editable } = props;
  const [draft, setDraft] = useState(card.title);
  const draftRef = useRef(draft);
  const startRef = useRef(card.title);
  const dirtyRef = useRef(false);
  const focusedRef = useRef(false);
  const composingRef = useRef(false);

  function resetDraft(value: string) {
    draftRef.current = value;
    setDraft(value);
  }

  useEffect(() => {
    if (!focusedRef.current && !dirtyRef.current) resetDraft(card.title);
  }, [card.title]);

  const commitNow = useCallback(async () => {
    const current = viewProject.value?.cards.find(
      (item) => item.id === card.id,
    );
    if (!current) return;
    const next = draftRef.current.trim();
    const changed = dirtyRef.current && next && next !== startRef.current;
    dirtyRef.current = false;
    startRef.current = changed ? next : current.title;
    resetDraft(startRef.current);
    if (changed && next !== current.title)
      await updateCard(current.id, { title: next });
  }, [card.id]);

  useEffect(() => {
    const unregister = registerPendingEditFlusher(commitNow);
    return () => {
      unregister();
      void commitNow();
    };
  }, [commitNow]);

  if (!editable) {
    return <strong>{card.title}</strong>;
  }

  return (
    <input
      type="text"
      class="stream-card__title-input"
      data-testid="stream-card-title-input"
      value={draft}
      aria-label={t("stream.title.label")}
      onFocus={() => {
        focusedRef.current = true;
        composingRef.current = false;
        startRef.current = draftRef.current;
      }}
      onInput={(event) => {
        dirtyRef.current = true;
        resetDraft(event.currentTarget.value);
      }}
      // Preact preserves casing when the DOM lacks an oncomposition* property.
      {...{
        oncompositionstart: () => {
          composingRef.current = true;
        },
        oncompositionend: () => {
          composingRef.current = false;
        },
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.isComposing || event.keyCode === 229 || composingRef.current)
          return;
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          dirtyRef.current = false;
          const latest = viewProject.value?.cards.find((c) => c.id === card.id);
          resetDraft(latest?.title ?? card.title);
          event.currentTarget.value = draftRef.current;
          event.currentTarget.blur();
        }
      }}
      onBlur={() => {
        focusedRef.current = false;
        composingRef.current = false;
        void commitNow();
      }}
    />
  );
}

type StreamCardRowProps = {
  card: Card;
  depth: number;
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
    branchCollapsed,
    childCount,
    boardCardIds,
    canDrag,
    replaying,
    isContemplate,
    allCards,
    onToggleBranch,
  } = props;
  const selected =
    selectedCardIds.value.includes(card.id) || selectedCardId.value === card.id;
  const status = streamCardStatus(card, boardCardIds);
  const digging = diggingCardId.value === card.id;
  const viaCard = card.foundVia
    ? allCards.find((item) => item.id === card.foundVia)
    : undefined;
  const canEditTitle = selected && !replaying && !isContemplate;

  return (
    <div
      class="stream-row stream-row--tree"
      data-card-id={card.id}
      data-dig-depth={depth}
      style={{ "--dig-depth": String(depth) }}
    >
      <div
        class={`stream-card ${selected ? "is-selected" : ""} ${
          card.role === "thought" ? "is-thought" : ""
        } ${card.outcome ? `has-outcome is-outcome-${card.outcome}` : ""} ${
          childCount > 0 ? "has-children" : ""
        } ${canDrag ? "is-draggable" : ""}`}
        data-testid="stream-card"
        data-card-id={card.id}
        data-role={card.role === "thought" ? "thought" : "finding"}
        draggable={canDrag}
        onPointerDown={(event) => {
          if (!canDrag) return;
          if (isStreamCardDragIgnoredTarget(event.target)) return;
          globalThis.getSelection?.()?.removeAllRanges();
        }}
        onDragStart={(event) => {
          if (!canDrag) return;
          if (isStreamCardDragIgnoredTarget(event.target)) {
            event.preventDefault();
            return;
          }
          globalThis.getSelection?.()?.removeAllRanges();
          event.dataTransfer?.setData(CARD_MIME, card.id);
          event.dataTransfer!.effectAllowed = "copy";
        }}
        onDragEnd={() => globalThis.getSelection?.()?.removeAllRanges()}
      >
        <div
          class="stream-card__meta-row"
          onClick={(event) => {
            if (isMetaToolTarget(event.target)) return;
            selectCardFromStream(card.id);
          }}
        >
          {childCount > 0 ? (
            <IconTip
              align="start"
              label={
                branchCollapsed
                  ? t("stream.branch.expand")
                  : t("stream.branch.collapse")
              }
            >
              <button
                type="button"
                class="stream__branch-toggle"
                data-testid="stream-branch-toggle"
                aria-expanded={!branchCollapsed}
                aria-label={
                  branchCollapsed
                    ? t("stream.branch.expand")
                    : t("stream.branch.collapse")
                }
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleBranch?.();
                }}
              >
                {branchCollapsed ? "▸" : "▾"}
              </button>
            </IconTip>
          ) : depth > 0 ? (
            <span class="stream-tree__leaf-spacer" aria-hidden="true" />
          ) : null}
          {depth > 0 ? (
            <span class="stream-tree__nest-mark" aria-hidden="true">
              ↳
            </span>
          ) : null}
          <time>{timeFormatter.format(card.foundAt)}</time>
          {hasStoryWhen(card) ? (
            <span
              class="stream-card__story-when"
              title={t("stream.storyWhen.label")}
            >
              {formatStoryWhenLabel(card)}
            </span>
          ) : null}
          {selected && !replaying ? (
            <span class="stream-card__meta-tools">
              <CardRoleToggle
                cardId={card.id}
                role={card.role}
                testIdPrefix="stream"
                tipAlign="end"
              />
              {card.role === "thought" ? (
                <ThoughtOutcomeField
                  cardId={card.id}
                  outcome={card.outcome}
                  testIdPrefix="stream"
                  compact
                  tipAlign="end"
                />
              ) : null}
              <DigStartButton
                active={digging}
                tipAlign="end"
                onClick={
                  digging
                    ? undefined
                    : (event) => {
                        event.stopPropagation();
                        startDigging(card.id);
                      }
                }
              />
              {card.foundVia ? (
                <DigClearViaButton
                  tipAlign="end"
                  title={
                    viaCard
                      ? t("stream.via.clearFrom", { title: viaCard.title })
                      : t("stream.via.clear")
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    void clearCardFoundVia(card.id);
                  }}
                />
              ) : null}
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
                {t("stream.delete.label")}
              </button>
            </span>
          ) : (
            <span class="stream-card__meta-label">
              {streamMetaLabel(card, status, childCount)}
            </span>
          )}
        </div>
        {canEditTitle ? (
          <div
            class="stream-card__main stream-card__main--editable"
            onClick={() => selectCardFromStream(card.id)}
          >
            <span class="stream-card__body-row">
              <span class="stream-card__text">
                <StreamCardTitle card={card} editable />
                {card.body ? <small>{card.body}</small> : null}
                {card.tags?.length ? (
                  <span class="tags">
                    {card.tags.map((tag) => (
                      <i key={tag}>#{tag}</i>
                    ))}
                  </span>
                ) : null}
                {card.outcome ? (
                  <IconTip
                    align="start"
                    label={t("stream.outcome.tipLabel", {
                      outcome: thoughtOutcomeLabel(card.outcome),
                    })}
                  >
                    <span
                      class={`stream-card__outcome is-${card.outcome}`}
                      aria-label={thoughtOutcomeLabel(card.outcome)}
                    >
                      <ThoughtOutcomeIcon outcome={card.outcome} />
                      <span class="stream-card__outcome-label">
                        {thoughtOutcomeShort(card.outcome)}
                      </span>
                    </span>
                  </IconTip>
                ) : null}
              </span>
              {isLocalMediaRef(card.image) ? (
                <span class="stream-card__thumb-wrap">
                  <IconTip align="end" label={t("stream.image.edit.tip")}>
                    <button
                      type="button"
                      class="stream-card__thumb-btn"
                      data-testid="stream-card-thumb"
                      aria-label={t("stream.image.edit.label")}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (selectedCardId.value !== card.id) {
                          selectSingleCard(card.id);
                        }
                        openExploreCompose(card.id);
                      }}
                    >
                      <MediaThumb
                        image={card.image}
                        className="stream-card__thumb"
                        width={88}
                        height={66}
                      />
                    </button>
                  </IconTip>
                  <ImageEnlargeButton
                    cardId={card.id}
                    className="stream-card__enlarge"
                    testId="stream-card-enlarge"
                  />
                </span>
              ) : null}
            </span>
          </div>
        ) : (
          <div
            class="stream-card__main"
            role="button"
            tabIndex={0}
            onClick={() => selectCardFromStream(card.id)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              selectCardFromStream(card.id);
            }}
          >
            <span class="stream-card__body-row">
              <span class="stream-card__text">
                <StreamCardTitle card={card} editable={false} />
                {card.body ? <small>{card.body}</small> : null}
                {card.tags?.length ? (
                  <span class="tags">
                    {card.tags.map((tag) => (
                      <i key={tag}>#{tag}</i>
                    ))}
                  </span>
                ) : null}
                {card.outcome ? (
                  <IconTip
                    align="start"
                    label={t("stream.outcome.tipLabel", {
                      outcome: thoughtOutcomeLabel(card.outcome),
                    })}
                  >
                    <span
                      class={`stream-card__outcome is-${card.outcome}`}
                      aria-label={thoughtOutcomeLabel(card.outcome)}
                    >
                      <ThoughtOutcomeIcon outcome={card.outcome} />
                      <span class="stream-card__outcome-label">
                        {thoughtOutcomeShort(card.outcome)}
                      </span>
                    </span>
                  </IconTip>
                ) : null}
              </span>
              {isLocalMediaRef(card.image) ? (
                <span class="stream-card__thumb-wrap">
                  <IconTip align="end" label={t("stream.image.edit.tip")}>
                    <button
                      type="button"
                      class="stream-card__thumb-btn"
                      data-testid="stream-card-thumb"
                      aria-label={t("stream.image.edit.label")}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (selectedCardId.value !== card.id) {
                          selectSingleCard(card.id);
                        }
                        openExploreCompose(card.id);
                      }}
                    >
                      <MediaThumb
                        image={card.image}
                        className="stream-card__thumb"
                        width={88}
                        height={66}
                      />
                    </button>
                  </IconTip>
                  <ImageEnlargeButton
                    cardId={card.id}
                    className="stream-card__enlarge"
                    testId="stream-card-enlarge"
                  />
                </span>
              ) : null}
            </span>
          </div>
        )}
        {card.url ? (
          <a
            class="stream-card__url"
            data-testid="stream-card-url"
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {sourceLabel(card.url)}
          </a>
        ) : null}
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
      <div class="stream__tag-focus-head">
        <span class="stream__tag-focus-label">{t("stream.focus.label")}</span>
        <div
          class="stream__tag-focus-list"
          role="group"
          aria-label={t("stream.focus.tags.label")}
        >
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
              title={t("stream.focus.tag.title", {
                name: entry.name,
                count: entry.count,
              })}
              onClick={() => setFocusViewByTag(entry.name)}
            >
              #{entry.name}
              <span class="stream__tag-focus-count">{entry.count}</span>
            </button>
          ))}
        </div>
      </div>
      {tagFocus ? (
        <div
          class="stream__tag-focus-ops"
          aria-label={t("stream.focus.active.label", { tag: tagFocus })}
        >
          <span class="board__focus-meta" aria-live="polite">
            {t("stream.focus.hops", { hops })}
          </span>
          <IconTip label={t("stream.focus.shrink.tip")}>
            <button
              type="button"
              class="board__focus-icon"
              disabled={hops <= 1}
              aria-label={t("stream.focus.shrink.label")}
              onClick={() => shrinkFocusHops()}
            >
              −
            </button>
          </IconTip>
          <IconTip label={t("stream.focus.expand.tip")}>
            <button
              type="button"
              class="board__focus-icon"
              aria-label={t("stream.focus.expand.label")}
              onClick={() => expandFocusHops()}
            >
              ＋
            </button>
          </IconTip>
          <IconTip label={t("stream.focus.clear.tip")}>
            <button
              type="button"
              class="board__focus-icon"
              data-testid="tag-focus-clear"
              aria-label={t("stream.focus.clear.label")}
              onClick={() => clearFocusView()}
            >
              ×
            </button>
          </IconTip>
        </div>
      ) : null}
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
    : (forest.childrenByParent.get(card.id) ?? []);

  return (
    <>
      <StreamCardRow
        card={card}
        depth={depth}
        branchCollapsed={branchCollapsed}
        childCount={childCount}
        boardCardIds={boardCardIds}
        canDrag={canDrag}
        replaying={replaying}
        isContemplate={isContemplate}
        allCards={allCards}
        onToggleBranch={() => toggleStreamBranchCollapsed(card.id)}
      />
      {children.length > 0 ? (
        <div class="stream-tree__branch" data-branch-depth={depth + 1}>
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
        </div>
      ) : null}
    </>
  );
}

export function Stream() {
  const current = viewProject.value;
  const replaying = isReplaying.value;
  const boardCardIds = new Set(current?.boards[0]?.cardIds ?? []);
  const phase = normalizePanelPhase(current?.ui);
  const isContemplate = phase !== "wide";
  const canDrag = !replaying && phase !== "closed";
  const cards = current?.cards ?? [];
  const cardById = new Map(cards.map((item) => [item.id, item]));
  const filtered = filteredCards.value;
  const visibleIds = new Set(filtered.map((item) => item.id));
  const collapsed = collapsedStreamBranches.value;
  const childCountByParent = new Map<string, number>();
  for (const card of filtered) {
    if (!card.foundVia || !visibleIds.has(card.foundVia)) continue;
    childCountByParent.set(
      card.foundVia,
      (childCountByParent.get(card.foundVia) ?? 0) + 1,
    );
  }
  const forest = buildFoundViaForest(filtered);
  const displayCards = flattenFoundViaForest(forest, collapsed);
  const listRef = useRef<HTMLDivElement>(null);
  const revealId = revealStreamCardId.value;
  const imageReferenceActive = Boolean(
    exploreComposeCardId.value &&
      exploreComposeCard.value &&
      isLocalMediaRef(exploreComposeCard.value.image),
  );
  const placement = placementFilterOf(unplacedOnly.value, placedOnly.value);
  const role = roleFilterOf(findingOnly.value, thoughtOnly.value);
  const when = storyWhenFilter.value;
  const outcomeOn = openOutcomeOnly.value;

  useEffect(() => {
    if (!revealId) return;
    // Clear immediately so the same card can be revealed again; do NOT cancel
    // a follow-up rAF in this effect's cleanup when revealId becomes null.
    revealStreamCardId.value = null;
    const list = listRef.current;
    if (!list) return;
    if (scrollStreamRowIntoView(list, revealId)) return;
    requestAnimationFrame(() => {
      scrollStreamRowIntoView(list, revealId);
    });
  }, [revealId]);

  return (
    <section class="stream" aria-label={t("stream.label")}>
      <div
        class={`stream__chrome${imageReferenceActive ? " is-dimmed" : ""}`}
        inert={imageReferenceActive ? true : undefined}
        aria-hidden={imageReferenceActive ? true : undefined}
      >
        <div class="section-heading">
          <div>
            <span class="eyebrow">{t("stream.eyebrow")}</span>
            <h2>{t("stream.label")}</h2>
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
            placeholder={t("stream.search.label")}
            aria-label={t("stream.search.label")}
          />
        </label>
        <div
          class="stream__filters"
          role="toolbar"
          aria-label={t("stream.filters.label")}
        >
          <div
            class="stream__filter-group stream__filter-group--placement"
            role="group"
            aria-label={t("stream.placement.label")}
          >
            <span class="stream__filter-group-label">
              {t("stream.placement.label")}
            </span>
            <IconTip align="start" label={t("stream.placement.tip")}>
              <button
                type="button"
                class={`stream__filter-btn stream__filter-btn--chip stream__filter-btn--text${
                  placement !== "all" ? " is-active" : ""
                }`}
                data-testid="stream-placement-filter"
                aria-pressed={placement !== "all"}
                aria-label={t("stream.placement.active.label", {
                  label: placementFilterLabel(placement),
                })}
                onClick={cyclePlacementFilter}
              >
                <span class="stream__filter-btn-label">
                  {placementFilterLabel(placement)}
                </span>
              </button>
            </IconTip>
          </div>
          <div
            class="stream__filter-group stream__filter-group--role"
            role="group"
            aria-label={t("stream.role.label")}
          >
            <span class="stream__filter-group-label">
              {t("stream.role.label")}
            </span>
            <IconTip align="start" label={t("stream.role.tip")}>
              <button
                type="button"
                class={`stream__filter-btn stream__filter-btn--chip${
                  role === "finding"
                    ? " stream__filter-btn--finding is-active"
                    : role === "thought"
                      ? " stream__filter-btn--thought is-active"
                      : " stream__filter-btn--text"
                }`}
                data-testid="stream-role-filter"
                aria-pressed={role !== "all"}
                aria-label={t("stream.role.active.label", {
                  label: roleFilterLabel(role),
                })}
                onClick={cycleRoleFilter}
              >
                {role === "finding" ? (
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="8" cy="8" r="3.5" fill="currentColor" />
                  </svg>
                ) : role === "thought" ? (
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <rect
                      x="3.5"
                      y="3.5"
                      width="9"
                      height="9"
                      rx="2"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-dasharray="2.5 2"
                    />
                  </svg>
                ) : null}
                <span class="stream__filter-btn-label">
                  {roleFilterLabel(role)}
                </span>
              </button>
            </IconTip>
          </div>
          <div
            class="stream__filter-group stream__filter-group--outcome"
            role="group"
            aria-label={t("stream.outcome.label")}
          >
            <span class="stream__filter-group-label">
              {t("stream.outcome.label")}
            </span>
            <IconTip align="start" label={t("stream.outcome.tip")}>
              <button
                type="button"
                class={`stream__filter-btn stream__filter-btn--chip${
                  outcomeOn
                    ? " stream__filter-btn--open is-active"
                    : " stream__filter-btn--text"
                }`}
                data-testid="stream-open-outcome-only"
                aria-pressed={outcomeOn}
                aria-label={t("stream.outcome.active.label", {
                  label: outcomeOn
                    ? t("stream.outcome.open")
                    : t("stream.filter.all"),
                })}
                onClick={() => {
                  openOutcomeOnly.value = !openOutcomeOnly.value;
                }}
              >
                {outcomeOn ? <ThoughtOutcomeIcon outcome="open" /> : null}
                <span class="stream__filter-btn-label">
                  {outcomeOn
                    ? t("stream.outcome.open")
                    : t("stream.filter.all")}
                </span>
              </button>
            </IconTip>
          </div>
          <div
            class="stream__filter-group stream__filter-group--story-when"
            role="group"
            aria-label={t("stream.storyWhen.label")}
          >
            <span class="stream__filter-group-label">
              {t("stream.when.label")}
            </span>
            <IconTip align="start" label={t("stream.when.tip")}>
              <button
                type="button"
                class={`stream__filter-btn stream__filter-btn--chip${
                  when === "with"
                    ? " stream__filter-btn--story-when is-active"
                    : when === "without"
                      ? " stream__filter-btn--no-story-when is-active"
                      : " stream__filter-btn--text"
                }`}
                data-testid="stream-story-when-filter"
                aria-pressed={when !== "off"}
                aria-label={t("stream.when.active.label", {
                  label: storyWhenFilterLabel(when),
                })}
                onClick={cycleStoryWhenFilter}
              >
                {when === "with" ? (
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M2 8h12"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.4"
                      stroke-linecap="round"
                    />
                    <path
                      d="M3 5.5v5M13 5.5v5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.3"
                      stroke-linecap="round"
                    />
                    <circle cx="8" cy="8" r="2" fill="currentColor" />
                  </svg>
                ) : when === "without" ? (
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M2 8h12"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.4"
                      stroke-linecap="round"
                      stroke-dasharray="2.2 1.8"
                    />
                    <path
                      d="M3 5.5v5M13 5.5v5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.3"
                      stroke-linecap="round"
                      opacity="0.55"
                    />
                  </svg>
                ) : null}
                <span class="stream__filter-btn-label">
                  {storyWhenFilterLabel(when)}
                </span>
              </button>
            </IconTip>
          </div>
        </div>
        <TagFocusControls />
        <div class="stream__list" ref={listRef}>
          {filtered.length === 0 ? (
            <p class="stream__empty" data-testid="stream-empty">
              {streamEmptyReason({
                total: cards.length,
                query: search.value.trim(),
                unplacedOnly: unplacedOnly.value,
                placedOnly: placedOnly.value,
                findingOnly: findingOnly.value,
                thoughtOnly: thoughtOnly.value,
                openOutcomeOnly: openOutcomeOnly.value,
                storyWhenFilter: storyWhenFilter.value,
              })}
            </p>
          ) : (
            <>
              <StreamStickyTrail
                listRef={listRef}
                visibleCards={displayCards}
                cardById={cardById}
                visibleIds={visibleIds}
              />
              {forest.roots.map((card) => (
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
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
