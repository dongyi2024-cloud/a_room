"use client";

import Link from "next/link";
import { useState } from "react";
import { buildCommunityShareDraftContent } from "@/lib/notes/community-share";
import type { CommunityShareApiResponse, CommunityShareDraft } from "@/types/community-share";
import type { PersonalNote } from "@/types/personal-notes";

type CommunityShareNoteActionProps = {
  note: Pick<
    PersonalNote,
    | "id"
    | "sourceType"
    | "sourceText"
    | "aiContent"
    | "noteContent"
    | "bookTitle"
    | "chapterTitle"
    | "paragraphOrder"
    | "paragraphExcerpt"
  >;
};

type ShareState = "idle" | "loading" | "reviewing" | "publishing" | "published" | "error";

function getErrorMessage(payload: CommunityShareApiResponse, fallback: string) {
  return "error" in payload ? payload.error : fallback;
}

export function CommunityShareNoteAction({ note }: CommunityShareNoteActionProps) {
  const localDraft = buildCommunityShareDraftContent(note);
  const [shareState, setShareState] = useState<ShareState>("idle");
  const [draft, setDraft] = useState<CommunityShareDraft | null>(null);
  const [content, setContent] = useState(localDraft);
  const [error, setError] = useState("");

  if (!localDraft) {
    return null;
  }

  async function startShare() {
    setShareState("loading");
    setError("");

    try {
      const response = await fetch(`/api/notes/share?noteId=${encodeURIComponent(note.id)}`);
      const payload = (await response.json()) as CommunityShareApiResponse;

      if (!response.ok || !("draft" in payload)) {
        throw new Error(getErrorMessage(payload, "暂时无法生成分享草稿。"));
      }

      setDraft(payload.draft);
      setContent(payload.draft.content);
      setShareState("reviewing");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "暂时无法生成分享草稿。");
      setShareState("error");
    }
  }

  function cancelShare() {
    setDraft(null);
    setContent(localDraft);
    setError("");
    setShareState("idle");
  }

  async function publishShare() {
    setShareState("publishing");
    setError("");

    try {
      const response = await fetch("/api/notes/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          noteId: note.id,
          content
        })
      });
      const payload = (await response.json()) as CommunityShareApiResponse;

      if (!response.ok || !("card" in payload)) {
        throw new Error(getErrorMessage(payload, "暂时无法发布到社区。"));
      }

      setDraft(payload.draft);
      setContent(payload.draft.content);
      setShareState("published");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "暂时无法发布到社区。");
      setShareState("reviewing");
    }
  }

  const isBusy = shareState === "loading" || shareState === "publishing";
  const trimmedContent = content.replace(/\s+/g, " ").trim();

  return (
    <div className="note-community-share">
      {shareState === "idle" || shareState === "loading" || shareState === "error" ? (
        <button className="button-reset secondary-link note-share-entry" disabled={isBusy} onClick={startShare} type="button">
          {shareState === "loading" ? "生成草稿中..." : "分享到社区"}
        </button>
      ) : null}

      {error && shareState === "error" ? <p className="note-share-error">{error}</p> : null}

      {shareState === "reviewing" || shareState === "publishing" ? (
        <div className="note-share-editor" aria-label="社区分享确认">
          <div className="note-share-context">
            <p className="page-eyebrow">Share draft</p>
            <p>
              {draft?.context.bookTitle ?? note.bookTitle} · {draft?.context.chapterTitle ?? note.chapterTitle} · 第{" "}
              {draft?.context.paragraphOrder ?? note.paragraphOrder} 段
            </p>
          </div>
          <p className="note-share-privacy">默认只发布下方确认内容，不公开完整原始 AI 对话。</p>
          <textarea
            className="text-input note-share-textarea"
            disabled={isBusy}
            maxLength={600}
            onChange={(event) => setContent(event.target.value)}
            value={content}
          />
          {error ? <p className="note-share-error">{error}</p> : null}
          <div className="note-share-actions">
            <button className="button-reset primary-link" disabled={isBusy || trimmedContent.length < 2} onClick={publishShare} type="button">
              {shareState === "publishing" ? "发布中..." : "确认发布"}
            </button>
            <button className="button-reset secondary-link" disabled={isBusy} onClick={cancelShare} type="button">
              取消
            </button>
          </div>
        </div>
      ) : null}

      {shareState === "published" ? (
        <div className="note-share-success">
          <p>已分享到社区。</p>
          <Link className="secondary-link" href="/community">
            查看社区
          </Link>
        </div>
      ) : null}
    </div>
  );
}
