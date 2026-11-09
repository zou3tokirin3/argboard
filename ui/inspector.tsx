import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { t } from "../src/i18n/index.ts";
import { CardImageField } from "./card-image-field.tsx";
import { CardRoleToggle } from "./card-role-toggle.tsx";
import { IconTip } from "./icon-tip.tsx";
import { ImageOverlay } from "./image-overlay.tsx";
import { isLocalMediaRef } from "./media.ts";
import {
  attachTagToCards,
  clearCardSelection,
  clearReplay,
  closeImageOverlay,
  consumeInspectorTitleFocus,
  detachTagFromCards,
  diggingCardId,
  enterReplay,
  imageOverlayCardId,
  isReplaying,
  mergeProjectTags,
  openExploreCompose,
  openImageOverlay,
  registerPendingEditFlusher,
  removeCard,
  removeLink,
  renameProjectTag,
  replayStepList,
  selectedCard,
  selectedCardIds,
  selectedLink,
  selectedLinkId,
  startDigging,
  updateCard,
  updateCardSize,
  updateCardTags,
  updateLink,
  viewProject,
} from "./state.ts";
import {
  attachTag,
  buildTagSuggestions,
  collectTagUsage,
  commonTagsAmong,
  detachTag,
  normalizeTag,
  TAG_KIND_LIMIT,
  type TagSuggestItem,
  type TagUsage,
} from "./tags.ts";
import { ThoughtOutcomeField } from "./thought-outcome-field.tsx";

async function organizeTag(tag: string, usage: TagUsage[]): Promise<void> {
  const others = usage.filter((e) => e.name !== tag).map((e) => e.name);
  const next = globalThis.prompt(
    others.length
      ? t("inspector.tag.merge.prompt", { tag, others: others.join(" / ") })
      : t("inspector.tag.rename.prompt", { tag }),
    tag,
  );
  if (next == null) return;
  const name = normalizeTag(next);
  if (!name || name === tag) return;
  if (others.includes(name)) await mergeProjectTags(tag, name);
  else await renameProjectTag(tag, name);
}

function HistoryEntry() {
  const replaying = isReplaying.value;
  const steps = replayStepList.value;
  if (replaying) {
    return (
      <div class="inspector__history">
        <button
          type="button"
          data-testid="replay-exit"
          class="inspector__history-btn"
          onClick={() => clearReplay()}
        >
          {t("inspector.history.exit")}
        </button>
      </div>
    );
  }
  return (
    <div class="inspector__history">
      <button
        type="button"
        data-testid="replay-enter"
        class="inspector__history-btn"
        disabled={steps.length === 0}
        title={t("inspector.history.title")}
        onClick={() => enterReplay()}
      >
        {t("stream.eyebrow")}
      </button>
    </div>
  );
}

function TagField(props: {
  cardId: string;
  /** When longer than 1, attach to all and hide per-card chips. */
  cardIds?: string[];
  tags: string[] | undefined;
  disabled: boolean;
}) {
  const ids = props.cardIds ?? [props.cardId];
  const bulk = ids.length > 1;
  const usage = collectTagUsage(viewProject.value?.cards ?? []);
  const attached = props.tags ?? [];
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { items, atLimit } = buildTagSuggestions(draft, usage, attached);
  const q = normalizeTag(draft);
  const blocked =
    atLimit &&
    !!q &&
    !usage.some((e) => e.name === q) &&
    !attached.some((t) => normalizeTag(t) === q);
  const counts = new Map(usage.map((e) => [e.name, e.count]));
  const resetKey = bulk ? ids.join(",") : props.cardId;

  useEffect(() => {
    setDraft("");
    setOpen(false);
    setActive(0);
  }, [resetKey]);
  useEffect(() => setActive(0), [draft]);

  async function apply(item: TagSuggestItem) {
    if (props.disabled) return;
    if (bulk) await attachTagToCards(ids, item.name);
    else await updateCardTags(props.cardId, attachTag(attached, item.name));
    setDraft("");
    setOpen(false);
    setActive(0);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || !items.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + items.length) % items.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[active];
      if (item) void apply(item);
    }
  }

  return (
    <div class="inspector__field inspector__tags">
      <span>
        {bulk
          ? t("inspector.tag.bulk.label", { count: ids.length })
          : t("inspector.tag.label", { limit: TAG_KIND_LIMIT })}
      </span>
      {attached.length > 0 ? (
        <div class="inspector__tag-chips">
          {attached.map((tag) => {
            const unsettled = !bulk && (counts.get(tag) ?? 1) === 1;
            return (
              <span
                key={tag}
                class={`inspector__tag-chip${unsettled ? " is-unsettled" : ""}`}
                title={unsettled ? t("inspector.tag.unsettled.title") : tag}
              >
                <span class="inspector__tag-chip-label">#{tag}</span>
                {unsettled ? (
                  <button
                    type="button"
                    class="inspector__tag-organize-btn"
                    disabled={props.disabled}
                    title={t("inspector.tag.organize.title")}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!props.disabled) void organizeTag(tag, usage);
                    }}
                  >
                    {t("inspector.tag.organize.label")}
                  </button>
                ) : null}
                <button
                  type="button"
                  class="inspector__tag-chip-remove"
                  disabled={props.disabled}
                  aria-label={
                    bulk
                      ? t("inspector.tag.bulk.remove", { tag })
                      : t("inspector.tag.remove", { tag })
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (props.disabled) return;
                    if (bulk) void detachTagFromCards(ids, tag);
                    else {
                      void updateCardTags(
                        props.cardId,
                        detachTag(attached, tag) ?? [],
                      );
                    }
                  }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
      <div class="inspector__tag-input-wrap">
        <input
          type="text"
          data-testid="inspector-tag-input"
          value={draft}
          disabled={props.disabled}
          placeholder={
            bulk
              ? t("inspector.tag.bulk.placeholder")
              : t("inspector.tag.placeholder")
          }
          autocomplete="off"
          onInput={(event) => {
            setDraft(event.currentTarget.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        {open && (items.length || blocked) ? (
          <ul
            class="inspector__tag-suggest"
            data-testid="inspector-tag-suggest"
          >
            {items.map((item, index) => (
              <li key={`${item.kind}:${item.name}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  class={`inspector__tag-suggest-item${
                    index === active ? " is-active" : ""
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    void apply(item);
                  }}
                >
                  {item.kind === "create" ? (
                    t("inspector.tag.create", { name: item.name })
                  ) : (
                    <>
                      #{item.name}
                      {item.unsettled ? (
                        <small>{t("inspector.tag.unsettled")}</small>
                      ) : null}
                    </>
                  )}
                </button>
              </li>
            ))}
            {blocked ? (
              <li class="inspector__tag-suggest-hint">
                {t("inspector.tag.limit.hint")}
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export function Inspector() {
  // A separate editor owns each selection's refs, including its unmount flush.
  const key = `${selectedCardIds.value.join(",")}:${selectedLink.value?.id ?? ""}`;
  return <InspectorEditor key={key} />;
}

function InspectorEditor() {
  const multiIds = selectedCardIds.value;
  const card = selectedCard.value;
  const link = selectedLink.value;
  const replaying = isReplaying.value;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [ogpFetching, setOgpFetching] = useState(false);
  const [ogpImage, setOgpImage] = useState<string | null>(null);
  const pendingOgpImageRef = useRef<string | null | undefined>(undefined);
  const [storyWhen, setStoryWhen] = useState("");
  const [storyUntil, setStoryUntil] = useState("");
  const [label, setLabel] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const prevCardIdRef = useRef<string | undefined>();
  const prevLinkIdRef = useRef<string | undefined>();
  const fieldsRef = useRef({
    title: "",
    body: "",
    url: "",
    storyWhen: "",
    storyUntil: "",
  });
  const labelRef = useRef("");
  const labelDirtyRef = useRef(false);
  const labelStartRef = useRef("");
  const composingRef = useRef(false);
  type Field = keyof typeof fieldsRef.current;
  const startsRef = useRef<Partial<Record<Field, string>>>({});
  const setters = {
    title: setTitle,
    body: setBody,
    url: setUrl,
    storyWhen: setStoryWhen,
    storyUntil: setStoryUntil,
  };

  const singleCardEditId = !link && multiIds.length <= 1 ? card?.id : undefined;

  // Tracks which fields the inspector itself has modified since the last card load.
  // Only dirty fields are written back, so external edits (e.g. from the log) are never overwritten.
  const dirtyFieldsRef = useRef(
    new Set<"title" | "body" | "url" | "storyWhen" | "storyUntil">(),
  );

  const saveCardFields = useCallback(async (id: string, field?: Field) => {
    if (isReplaying.value) return;
    const patch: Parameters<typeof updateCard>[1] = {};
    const current = viewProject.value?.cards.find((item) => item.id === id);
    if (!current) return;
    for (const key of [...dirtyFieldsRef.current]) {
      if (field && key !== field) continue;
      dirtyFieldsRef.current.delete(key);
      const value = fieldsRef.current[key];
      const changed = value !== startsRef.current[key];
      delete startsRef.current[key];
      if (changed && value !== (current[key] ?? "")) patch[key] = value;
      const next = changed ? value : (current[key] ?? "");
      fieldsRef.current[key] = next;
      setters[key](next);
    }
    if (!field && pendingOgpImageRef.current !== undefined) {
      patch.ogpImage = pendingOgpImageRef.current;
      pendingOgpImageRef.current = undefined;
    }
    if (Object.keys(patch).length) await updateCard(id, patch);
  }, []);

  const saveLinkLabel = useCallback(async (linkId: string) => {
    if (isReplaying.value || !labelDirtyRef.current) return;
    labelDirtyRef.current = false;
    const current = viewProject.value?.links.find((item) => item.id === linkId);
    if (!current) return;
    const value = labelRef.current;
    const changed = value !== labelStartRef.current;
    labelRef.current = changed ? value : (current.label ?? "");
    setLabel(labelRef.current);
    if (changed && value !== (current.label ?? ""))
      await updateLink(linkId, { label: value });
  }, []);

  useEffect(
    () =>
      registerPendingEditFlusher(async () => {
        if (singleCardEditId) await saveCardFields(singleCardEditId);
        if (link?.id) await saveLinkLabel(link.id);
      }),
    [singleCardEditId, link?.id, saveCardFields, saveLinkLabel],
  );

  function confirmEnter(event: KeyboardEvent & { currentTarget: HTMLElement }) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing &&
      event.keyCode !== 229 &&
      !composingRef.current
    ) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  const compositionHandlers = {
    onCompositionStart: () => {
      composingRef.current = true;
    },
    onCompositionEnd: () => {
      composingRef.current = false;
    },
    onKeyDown: confirmEnter,
  };

  function fieldHandlers(field: Field) {
    return {
      ...compositionHandlers,
      onCompositionEnd: (event: Event & { currentTarget: HTMLElement }) => {
        composingRef.current = false;
        if (
          document.activeElement !== event.currentTarget &&
          singleCardEditId
        ) {
          void saveCardFields(singleCardEditId, field);
        }
      },
      onInput: (
        event: Event & {
          currentTarget: HTMLInputElement | HTMLTextAreaElement;
        },
      ) => {
        const value = event.currentTarget.value;
        if (!dirtyFieldsRef.current.has(field))
          startsRef.current[field] = fieldsRef.current[field];
        fieldsRef.current[field] = value;
        dirtyFieldsRef.current.add(field);
        setters[field](value);
      },
      onBlur: () => {
        if (!composingRef.current && singleCardEditId) {
          void saveCardFields(singleCardEditId, field);
        }
      },
    };
  }

  useEffect(() => {
    const id = card?.id;
    const idChanged = id !== prevCardIdRef.current;
    prevCardIdRef.current = id;
    if (replaying || idChanged) {
      dirtyFieldsRef.current.clear();
      pendingOgpImageRef.current = undefined;
      fieldsRef.current = {
        title: card?.title ?? "",
        body: card?.body ?? "",
        url: card?.url ?? "",
        storyWhen: card?.storyWhen ?? "",
        storyUntil: card?.storyUntil ?? "",
      };
      setTitle(card?.title ?? "");
      setBody(card?.body ?? "");
      setUrl(card?.url ?? "");
      setOgpImage(card?.ogpImage ?? null);
      setStoryWhen(card?.storyWhen ?? "");
      setStoryUntil(card?.storyUntil ?? "");
    } else {
      // Card data changed externally (e.g. from the log) — sync only non-dirty fields.
      for (const key of Object.keys(setters) as Field[]) {
        if (dirtyFieldsRef.current.has(key)) continue;
        fieldsRef.current[key] = card?.[key] ?? "";
        setters[key](fieldsRef.current[key]);
      }
    }
  }, [
    card?.id,
    card?.title,
    card?.body,
    card?.url,
    card?.storyWhen,
    card?.storyUntil,
    replaying,
  ]);

  useEffect(() => {
    const id = link?.id;
    const idChanged = id !== prevLinkIdRef.current;
    prevLinkIdRef.current = id;
    if (replaying || idChanged || !labelDirtyRef.current) {
      labelRef.current = link?.label ?? "";
      labelDirtyRef.current = false;
      setLabel(link?.label ?? "");
    }
  }, [link?.id, link?.label, replaying]);

  useEffect(() => {
    if (!singleCardEditId) return;
    const id = singleCardEditId;
    return () => {
      void saveCardFields(id);
    };
  }, [singleCardEditId, saveCardFields]);

  useEffect(() => {
    const linkId = link?.id;
    if (!linkId) return;
    return () => {
      void saveLinkLabel(linkId);
    };
  }, [link?.id, saveLinkLabel]);

  useEffect(() => {
    if (!card?.id) return;
    if (!consumeInspectorTitleFocus()) return;
    const focusTitle = () => {
      const input = titleRef.current;
      if (!input || isReplaying.value) return;
      input.focus();
      input.select();
    };
    focusTitle();
    const frame = requestAnimationFrame(focusTitle);
    return () => cancelAnimationFrame(frame);
  }, [card?.id]);

  if (link) {
    return (
      <aside class="inspector" aria-label={t("inspector.link.label")}>
        <div class="section-heading">
          <div>
            <span class="eyebrow">{t("inspector.link.eyebrow")}</span>
            <h2>
              {replaying
                ? t("inspector.link.view")
                : t("inspector.link.heading")}
            </h2>
          </div>
        </div>
        <label class="inspector__field">
          <span>{t("inspector.link.text.label")}</span>
          <input
            type="text"
            data-testid="link-label-input"
            value={label}
            placeholder={t("inspector.link.placeholder")}
            disabled={replaying}
            {...compositionHandlers}
            onCompositionEnd={(event) => {
              composingRef.current = false;
              if (document.activeElement !== event.currentTarget)
                void saveLinkLabel(link.id);
            }}
            onInput={(event) => {
              if (!labelDirtyRef.current)
                labelStartRef.current = labelRef.current;
              labelRef.current = event.currentTarget.value;
              labelDirtyRef.current = true;
              setLabel(event.currentTarget.value);
            }}
            onBlur={() => {
              if (!composingRef.current) void saveLinkLabel(link.id);
            }}
          />
        </label>
        <label class="inspector__field">
          <span>{t("inspector.link.kind.label")}</span>
          <select
            data-testid="link-kind-toggle"
            value={link.kind}
            disabled={replaying}
            onChange={(event) =>
              updateLink(link.id, {
                kind: event.currentTarget.value as "connects" | "contradicts",
              })
            }
          >
            <option value="connects">
              {t("inspector.link.kind.connects")}
            </option>
            <option value="contradicts">
              {t("inspector.link.kind.contradicts")}
            </option>
          </select>
        </label>
        {replaying ? (
          <p class="inspector__hint">{t("inspector.replay.hint")}</p>
        ) : (
          <>
            <button
              type="button"
              class="inspector__danger"
              data-testid="link-delete"
              onClick={() => removeLink(link.id)}
            >
              {t("inspector.link.delete")}
            </button>
            <p class="inspector__hint">{t("inspector.delete.hint")}</p>
          </>
        )}
        <HistoryEntry />
      </aside>
    );
  }

  if (multiIds.length > 1) {
    const commonTags = commonTagsAmong(
      viewProject.value?.cards ?? [],
      multiIds,
    );
    return (
      <aside class="inspector" aria-label={t("inspector.multi.label")}>
        <div class="section-heading">
          <div>
            <span class="eyebrow">{t("inspector.multi.eyebrow")}</span>
            <h2>{t("inspector.multi.heading", { count: multiIds.length })}</h2>
          </div>
        </div>
        <p class="inspector__hint">{t("inspector.multi.hint")}</p>
        <TagField
          cardId={multiIds[0]!}
          cardIds={multiIds}
          tags={commonTags}
          disabled={replaying}
        />
        <HistoryEntry />
      </aside>
    );
  }

  if (!card) {
    return (
      <aside class="inspector" aria-label={t("inspector.label")}>
        <p class="inspector__empty">{t("inspector.empty")}</p>
        <HistoryEntry />
      </aside>
    );
  }

  function flushCardFields() {
    if (singleCardEditId) void saveCardFields(singleCardEditId);
  }

  const cards = viewProject.value?.cards ?? [];
  const cardLinks =
    viewProject.value?.links.filter(
      (item) => item.from === card.id || item.to === card.id,
    ) ?? [];

  return (
    <aside class="inspector" aria-label={t("inspector.label")}>
      <div class="section-heading">
        <div>
          <span class="eyebrow">
            {replaying ? t("stream.eyebrow") : t("inspector.eyebrow")}
          </span>
          <h2>
            {card.role === "thought"
              ? t("inspector.card.thought")
              : t("inspector.card.finding")}
          </h2>
        </div>
        <div class="inspector__heading-tools">
          <CardRoleToggle
            cardId={card.id}
            role={card.role}
            disabled={replaying}
            testIdPrefix="inspector"
          />
          <div
            class="inspector__size-toggle"
            role="group"
            aria-label={t("inspector.size.label")}
          >
            <IconTip label={t("inspector.size.medium.tip")}>
              <button
                type="button"
                class={card.size === "l" ? undefined : "is-active"}
                data-testid="inspector-card-size-m"
                aria-pressed={card.size !== "l"}
                aria-label={t("inspector.size.medium")}
                disabled={replaying}
                onClick={() => void updateCardSize(card.id, "m")}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect
                    x="4"
                    y="5"
                    width="8"
                    height="6"
                    rx="1"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                </svg>
              </button>
            </IconTip>
            <IconTip label={t("inspector.size.large.tip")}>
              <button
                type="button"
                class={card.size === "l" ? "is-active" : undefined}
                data-testid="inspector-card-size-l"
                aria-pressed={card.size === "l"}
                aria-label={t("inspector.size.large")}
                disabled={replaying}
                onClick={() => void updateCardSize(card.id, "l")}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect
                    x="2"
                    y="3"
                    width="12"
                    height="10"
                    rx="1.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                </svg>
              </button>
            </IconTip>
          </div>
        </div>
      </div>
      <label class="inspector__field">
        <span>{t("capture.title.label")}</span>
        <input
          ref={titleRef}
          type="text"
          data-testid="inspector-title"
          value={title}
          disabled={replaying}
          {...fieldHandlers("title")}
        />
      </label>
      {card.role === "thought" ? (
        <ThoughtOutcomeField
          cardId={card.id}
          outcome={card.outcome}
          disabled={replaying}
        />
      ) : null}
      <TagField cardId={card.id} tags={card.tags} disabled={replaying} />
      <label class="inspector__field">
        <span>{t("capture.source.label")}</span>
        <div class="inspector__url-row">
          <input
            type="url"
            data-testid="inspector-url"
            value={url}
            placeholder="https://"
            disabled={replaying}
            {...fieldHandlers("url")}
          />
          {url?.startsWith("http") ? (
            <button
              type="button"
              class="inspector__ogp-btn"
              data-testid="inspector-ogp-fetch"
              disabled={ogpFetching || replaying}
              title={t("inspector.ogp.title")}
              onClick={async () => {
                setOgpFetching(true);
                try {
                  const res = await fetch(
                    `/api/ogp?url=${encodeURIComponent(url)}`,
                  );
                  const json = (await res.json()) as {
                    title: string | null;
                    image: string | null;
                  };
                  if (singleCardEditId) {
                    if (json.title) {
                      dirtyFieldsRef.current.add("title");
                      fieldsRef.current.title = json.title;
                      setTitle(json.title);
                    }
                    pendingOgpImageRef.current = json.image ?? null;
                    void saveCardFields(singleCardEditId);
                  }
                  setOgpImage(json.image ?? null);
                } catch {
                  // 失敗時は何もしない
                } finally {
                  setOgpFetching(false);
                }
              }}
            >
              {ogpFetching ? "…" : t("inspector.ogp.label")}
            </button>
          ) : null}
        </div>
      </label>
      {ogpImage ? (
        <div class="inspector__ogp-preview">
          <img src={ogpImage} alt="OGP preview" loading="lazy" />
        </div>
      ) : null}
      <div class="inspector__field">
        <span>{t("stream.storyWhen.label")}</span>
        <div class="inspector__story-when-row">
          <input
            type="text"
            data-testid="inspector-story-when"
            value={storyWhen}
            placeholder={t("inspector.storyWhen.placeholder")}
            disabled={replaying}
            aria-label={t("capture.storyWhen.label")}
            {...fieldHandlers("storyWhen")}
          />
          <span class="inspector__story-when-sep" aria-hidden="true">
            〜
          </span>
          <input
            type="text"
            data-testid="inspector-story-until"
            value={storyUntil}
            placeholder={t("inspector.storyUntil.placeholder")}
            disabled={replaying}
            aria-label={t("capture.storyUntil.label")}
            {...fieldHandlers("storyUntil")}
          />
        </div>
      </div>
      <p class="inspector__hint inspector__hint--inline">
        {t("inspector.storyWhen.hint")}
      </p>
      <label class="inspector__field">
        <span>{t("capture.body.label")}</span>
        <textarea
          data-testid="inspector-body"
          rows={6}
          value={body}
          disabled={replaying}
          {...fieldHandlers("body")}
        />
      </label>
      <div class="inspector__field">
        <CardImageField
          cardId={card.id}
          image={card.image}
          disabled={replaying}
          variant="compact"
          testId="inspector-image"
          onEnlarge={() => openImageOverlay(card.id)}
        />
        {isLocalMediaRef(card.image) ? (
          <button
            type="button"
            class="inspector__image-reference"
            data-testid="inspector-image-reference"
            disabled={replaying}
            onClick={() => openExploreCompose(card.id)}
          >
            {t("stream.image.edit.label")}
          </button>
        ) : null}
      </div>
      {imageOverlayCardId.value === card.id && isLocalMediaRef(card.image) ? (
        <ImageOverlay
          title={card.title}
          image={card.image}
          onClose={() => {
            flushCardFields();
            closeImageOverlay();
          }}
        />
      ) : null}
      {cardLinks.length ? (
        <label class="inspector__field">
          <span>{t("inspector.links.label")}</span>
          <select
            data-testid="card-links"
            value=""
            onChange={(event) => {
              const id = event.currentTarget.value;
              if (!id) return;
              selectedLinkId.value = id;
              clearCardSelection();
            }}
          >
            <option value="">{t("inspector.links.placeholder")}</option>
            {cardLinks.map((item) => {
              const other = cards.find(
                (c) => c.id === (item.from === card.id ? item.to : item.from),
              );
              return (
                <option key={item.id} value={item.id}>
                  {other?.title ?? "？"} ·{" "}
                  {item.label || t("inspector.link.unlabeled")} ·{" "}
                  {item.kind === "contradicts"
                    ? t("inspector.link.kind.contradicts")
                    : t("inspector.link.kind.connects")}
                </option>
              );
            })}
          </select>
        </label>
      ) : null}
      {replaying ? (
        <p class="inspector__hint">{t("inspector.replay.hint")}</p>
      ) : (
        <>
          {diggingCardId.value === card.id ? (
            <span
              class="inspector__dig is-active"
              data-testid="inspector-dig-active"
            >
              {t("inspector.dig.active")}
            </span>
          ) : (
            <button
              type="button"
              class="inspector__dig"
              data-testid="inspector-dig-start"
              onClick={() => startDigging(card.id)}
            >
              {t("inspector.dig.start")}
            </button>
          )}
          <button
            type="button"
            class="inspector__danger"
            data-testid="card-delete"
            onClick={() => removeCard(card.id)}
          >
            {t("inspector.card.delete")}
          </button>
          <p class="inspector__hint">{t("inspector.delete.hint")}</p>
        </>
      )}
      <HistoryEntry />
    </aside>
  );
}
