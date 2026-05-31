"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FeedbackReportAction } from "@/components/feedback/feedback-report-action";
import { SaveNoteButton } from "@/components/notes/save-note-button";
import type {
  ReflectionCard,
  ReflectionDeleteApiResponse,
  ReflectionFeedApiResponse,
  ReflectionFeedContext,
  ReflectionLikeApiResponse
} from "@/types/reflections";

const EMPTY_REFLECTION_CARDS: ReflectionCard[] = [];

type ReflectionFeedPanelProps = {
  bookId: string;
  chapterOrder: number;
  currentUserId?: string;
  paragraphOrder: number;
  initialContext?: ReflectionFeedContext | null;
  initialCards?: ReflectionCard[];
  variant: "reader" | "community" | "overlay";
};

function formatCreatedAt(value: string) {
  try {
    return new Date(value).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return value;
  }
}

export function ReflectionFeedPanel({
  bookId,
  chapterOrder,
  currentUserId = "",
  paragraphOrder,
  initialContext = null,
  initialCards = EMPTY_REFLECTION_CARDS,
  variant
}: ReflectionFeedPanelProps) {
  const router = useRouter();
  const [context, setContext] = useState<ReflectionFeedContext | null>(initialContext);
  const [cards, setCards] = useState<ReflectionCard[]>(initialCards);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(variant !== "community" && !initialContext);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likePendingCardId, setLikePendingCardId] = useState("");
  const [deletePendingCardId, setDeletePendingCardId] = useState("");
  const [confirmingDeleteCardId, setConfirmingDeleteCardId] = useState("");
  const [error, setError] = useState("");
  const communityHref = "/community";

  useEffect(() => {
    setContext(initialContext);
    setCards(initialCards);
    setDraft("");
    setError("");
    setIsLoading(variant !== "community" && !initialContext);
    setDeletePendingCardId("");
    setConfirmingDeleteCardId("");
  }, [bookId, chapterOrder, paragraphOrder, initialContext, initialCards, variant]);

  useEffect(() => {
    if (variant === "community" || initialContext) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/reflections?book=${encodeURIComponent(bookId)}&chapter=${chapterOrder}&paragraph=${paragraphOrder}`,
          {
            method: "GET",
            cache: "no-store"
          }
        );
        const payload = (await response.json()) as ReflectionFeedApiResponse;

        if (cancelled) {
          return;
        }

        if (!response.ok || "error" in payload) {
          throw new Error("error" in payload ? payload.error : "Unable to load reflections.");
        }

        setContext(payload.context);
        setCards(payload.cards);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Unable to load reflections.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookId, chapterOrder, paragraphOrder, initialContext, variant]);

  async function submitReflection() {
    const content = draft.trim();

    if (!content) {
      setError("先写下一点感受，再发布。");
      return;
    }

    if (content.length < 2) {
      setError("感悟内容太短了，至少写下两三个字。");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/reflections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bookId,
          chapterOrder,
          paragraphOrder,
          content
        })
      });
      const payload = (await response.json()) as ReflectionFeedApiResponse;

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Unable to publish this reflection.");
      }

      setContext(payload.context);
      setCards(payload.cards);
      setDraft("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to publish this reflection.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleLike(cardId: string) {
    setLikePendingCardId(cardId);
    setError("");

    try {
      const response = await fetch("/api/reflections/likes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ cardId })
      });
      const payload = (await response.json()) as ReflectionLikeApiResponse;

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Unable to update this like.");
      }

      setCards((currentCards) =>
        currentCards.map((card) =>
          card.id === payload.cardId
            ? {
                ...card,
                likeCount: payload.likeCount,
                likedByCurrentUser: payload.likedByCurrentUser
              }
            : card
        )
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update this like.");
    } finally {
      setLikePendingCardId("");
    }
  }

  async function confirmDelete(cardId: string) {
    setDeletePendingCardId(cardId);
    setError("");

    try {
      const response = await fetch("/api/reflections/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ cardId })
      });
      const payload = (await response.json()) as ReflectionDeleteApiResponse;

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Unable to delete this reflection.");
      }

      setCards((currentCards) => currentCards.filter((card) => card.id !== payload.cardId));
      setConfirmingDeleteCardId("");
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete this reflection.");
    } finally {
      setDeletePendingCardId("");
    }
  }

  return (
    <section
      className={`reflection-panel ${
        variant === "community" ? "is-community" : variant === "overlay" ? "is-overlay" : "is-reader"
      } ${variant === "overlay" ? "" : "soft-card"}`.trim()}
    >
      <div className="reflection-panel-header">
        <div>
          <p className="page-eyebrow">
            {variant === "community" ? "Community reflections" : variant === "overlay" ? "Reflection" : "段落感悟"}
          </p>
          <h4 className="reflection-panel-title">
            {variant === "community" ? "所有段落里的阅读感受" : "围绕这一段写下感受"}
          </h4>
        </div>
      </div>

      {context && variant !== "community" ? (
        <div className="reflection-context">
          <p className="reflection-context-book">
            {context.bookTitle} · 第 {context.chapterOrder} 章
          </p>
          <p className="reflection-context-excerpt">“{context.paragraphExcerpt}”</p>
        </div>
      ) : null}

      {variant !== "community" ? (
        <div className="reflection-composer">
          <label className="field-stack">
            <span className="field-label">写下你的感受</span>
            <span className="field-label-english">Your reflection</span>
            <textarea
              className="text-input reflection-textarea"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="这一段让你停下来的地方，可能正值得写下一句。"
              rows={4}
              value={draft}
            />
          </label>
          <div className="reflection-actions">
            <button
              className="primary-link button-reset"
              disabled={isSubmitting}
              onClick={submitReflection}
              type="button"
            >
              {isSubmitting ? "正在发布..." : "发布感悟"}
            </button>
            <Link className="secondary-link" href={communityHref}>
              社区页
            </Link>
            {context && draft.trim().length > 0 ? (
              <SaveNoteButton
                payload={{
                  bookId: context.bookId,
                  chapterId: context.chapterId,
                  paragraphId: context.paragraphId,
                  sourceType: "reflection",
                  sourceText: context.paragraphExcerpt,
                  noteContent: draft,
                  metadata: {
                    chapterOrder: context.chapterOrder,
                    paragraphOrder: context.paragraphOrder,
                    draftOnly: true
                  }
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      {isLoading ? <p className="reflection-loading">正在加载这一段的感悟卡片...</p> : null}

      {!isLoading && cards.length === 0 ? (
        <div className="reflection-empty soft-card">
          <p className="page-eyebrow">{variant === "community" ? "No cards yet" : "No reflections yet"}</p>
          <p className="reflection-empty-copy">
            {variant === "community"
              ? "社区页里还没有感悟卡片。等第一位读者写下停留的那一句，这里就会亮起来。"
              : "这段文字还没有人留下感悟，你可以成为第一个停下来的人。"}
          </p>
        </div>
      ) : null}

      {cards.length > 0 ? (
        <div className="reflection-card-list">
          {cards.map((card) => (
            <article className="reflection-card soft-card" key={card.id}>
              <div className="reflection-card-header">
                <div className="reflection-card-meta">
                  <p className="reflection-card-author">{card.displayName}</p>
                  <p className="reflection-card-time">{formatCreatedAt(card.createdAt)}</p>
                  {card.moderationStatus === "pending_review" ? (
                    <p className="reflection-card-review-state">待审核</p>
                  ) : null}
                </div>
                {currentUserId && card.userId === currentUserId ? (
                  <button
                    className="button-reset reflection-delete-entry"
                    disabled={deletePendingCardId === card.id}
                    onClick={() =>
                      setConfirmingDeleteCardId((currentCardId) => (currentCardId === card.id ? "" : card.id))
                    }
                    type="button"
                  >
                    删除
                  </button>
                ) : null}
              </div>
              <p className="reflection-card-context">
                {card.bookTitle} · 第 {card.chapterOrder} 章 · 第 {card.paragraphOrder} 段
              </p>
              <p className="reflection-card-excerpt">“{card.paragraphExcerpt}”</p>
              <p className="reflection-card-content">{card.content}</p>
              <div className="reflection-card-footer">
                <button
                  className={`button-reset reflection-like-button ${card.likedByCurrentUser ? "is-liked" : ""}`.trim()}
                  disabled={likePendingCardId === card.id}
                  onClick={() => toggleLike(card.id)}
                  type="button"
                >
                  <span>{card.likedByCurrentUser ? "已点赞" : "点赞"}</span>
                  <span className="reflection-like-count">{card.likeCount}</span>
                </button>
                {currentUserId && card.userId === currentUserId ? (
                  <SaveNoteButton
                    payload={{
                      bookId: card.bookId,
                      chapterId: card.chapterId,
                      paragraphId: card.paragraphId,
                      sourceType: "reflection",
                      sourceText: card.paragraphExcerpt,
                      noteContent: card.content,
                      metadata: {
                        reflectionCardId: card.id,
                        chapterOrder: card.chapterOrder,
                        paragraphOrder: card.paragraphOrder
                      }
                    }}
                  />
                ) : null}
                {currentUserId ? (
                  <FeedbackReportAction
                    buttonLabel="举报"
                    mode="report"
                    targetId={card.id}
                    targetLabel="这张社区感悟卡片"
                    targetType="reflection_card"
                    metadata={{
                      surface: variant === "community" ? "community_feed" : "paragraph_reflection_feed",
                      bookId: card.bookId,
                      chapterId: card.chapterId,
                      chapterOrder: card.chapterOrder,
                      paragraphId: card.paragraphId,
                      paragraphOrder: card.paragraphOrder,
                      cardAuthorId: card.userId,
                      cardContentExcerpt: card.content.slice(0, 500)
                    }}
                  />
                ) : null}
              </div>
              {confirmingDeleteCardId === card.id ? (
                <div className="reflection-delete-confirm">
                  <p className="reflection-delete-copy">确定要删除这条感悟吗？删除后将不再展示。</p>
                  <div className="reflection-delete-actions">
                    <button
                      className="button-reset secondary-link"
                      disabled={deletePendingCardId === card.id}
                      onClick={() => setConfirmingDeleteCardId("")}
                      type="button"
                    >
                      取消
                    </button>
                    <button
                      className="button-reset reflection-delete-confirm-button"
                      disabled={deletePendingCardId === card.id}
                      onClick={() => confirmDelete(card.id)}
                      type="button"
                    >
                      {deletePendingCardId === card.id ? "删除中..." : "确认删除"}
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
