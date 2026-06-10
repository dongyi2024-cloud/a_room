"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { AuthorStatusCard } from "@/components/books/author-status-card";
import { BookUploadControl } from "@/components/bookshelf/book-upload-control";
import { DarkRail } from "@/components/workbench/dark-rail";
import { getAuthorStatusCardContent } from "@/lib/books/author-status-card";
import { getDefaultAuthorStatusCard } from "@/lib/author-status/time-mood";
import { getMostRecentProgressBookId } from "@/lib/reader/progress-store";
import type { BookshelfItem } from "@/types/bookshelf";
import type { PersonalNote } from "@/types/personal-notes";
import type { ReaderBookSummary } from "@/types/reader";

type HomeWorkbenchProps = {
  books: BookshelfItem[];
  communityCount: number;
  isGuest?: boolean;
  latestNote: PersonalNote | null;
  noteCount: number;
  sampleBook?: ReaderBookSummary | null;
  userEmail: string | null;
};

type HomeSummaryResponse = {
  latestNote: PersonalNote | null;
  noteCount: number;
  communityCount: number;
};

function isHomeSummaryResponse(value: HomeSummaryResponse | { error?: string }): value is HomeSummaryResponse {
  return "latestNote" in value && typeof value.noteCount === "number" && typeof value.communityCount === "number";
}

const HOME_BOOK_STYLES = [
  { accent: "var(--color-bg)", height: 98, width: 44 },
  { accent: "var(--color-bg)", height: 92, width: 38 },
  { accent: "var(--color-bg)", height: 100, width: 42 },
  { accent: "var(--color-bg)", height: 88, width: 36 },
  { accent: "var(--color-bg)", height: 96, width: 40 },
  { accent: "var(--color-bg)", height: 100, width: 46 },
  { accent: "var(--color-bg)", height: 90, width: 34 }
];

function formatNoteDate(value: string) {
  try {
    return new Date(value).toLocaleDateString("zh-CN", {
      month: "numeric",
      day: "numeric"
    });
  } catch {
    return value;
  }
}

function getNotePreview(note: PersonalNote | null) {
  if (!note) {
    return "还没有保存笔记。";
  }

  if (note.sourceType === "dialogue_summary") {
    return note.noteContent || note.aiContent || note.sourceText || note.paragraphExcerpt;
  }

  if (note.sourceType === "selected_text") {
    return note.aiContent || note.noteContent || note.sourceText || note.paragraphExcerpt;
  }

  return note.aiContent || note.noteContent || note.sourceText || note.paragraphExcerpt;
}

function HomeBookshelfShelf({
  books,
  isGuest = false,
  onUploadError,
  onUploadComplete,
  onUploadStatus,
  sampleBook
}: {
  books: BookshelfItem[];
  isGuest?: boolean;
  onUploadError: (message: string | null) => void;
  onUploadComplete?: (result: { bookId: string; ragStatus?: "processing" | "ready" | "failed" }) => void;
  onUploadStatus: (message: string | null) => void;
  sampleBook?: ReaderBookSummary | null;
}) {
  const displayBooks = books.slice(0, 7);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  return (
    <section aria-label="首页书架" className="home-bookshelf-shelf">
      <div className="home-bookshelf-stage">
        <div className="bookshelf-plank" />
        <div className="bookshelf-book-row">
          {isGuest && sampleBook ? (
            <Link
              aria-label={`进入样例阅读 ${sampleBook.title}`}
              className="home-book-link is-sample-book"
              href={`/reader/${sampleBook.id}`}
              style={
                {
                  "--book-accent": "var(--color-bg)",
                  "--book-delay": "0ms",
                  "--book-height": "100%",
                  "--book-width": "46px"
                } as CSSProperties
              }
            >
              <span className="home-book-2d">
                <span className="home-book-2d-band" />
                <span className="home-book-2d-title">{sampleBook.title}</span>
                <span className="home-book-2d-author">{sampleBook.author}</span>
              </span>
            </Link>
          ) : null}
          {displayBooks.map((book, index) => (
            <Link
              aria-label={book.importStatus === "ready" ? `进入阅读 ${book.title}` : `${book.title} 正在处理`}
              className={`home-book-link ${book.importStatus !== "ready" ? "is-pending" : ""}`}
              href={book.importStatus === "ready" ? `/reader/${book.id}` : "/bookshelf"}
              key={book.id}
              style={
                {
                  "--book-accent": HOME_BOOK_STYLES[index % HOME_BOOK_STYLES.length].accent,
                  "--book-delay": `${index * 40}ms`,
                  "--book-height": `${HOME_BOOK_STYLES[index % HOME_BOOK_STYLES.length].height}%`,
                  "--book-width": `${HOME_BOOK_STYLES[index % HOME_BOOK_STYLES.length].width}px`
                } as CSSProperties
              }
            >
              <span className="home-book-2d">
                <span className="home-book-2d-band" />
                <span className="home-book-2d-title">{book.title}</span>
                {book.author ? <span className="home-book-2d-author">{book.author}</span> : null}
              </span>
            </Link>
          ))}
          {isGuest ? (
            <button
              aria-label="登录后上传自己的 EPUB 书籍"
              className="home-book-link home-book-empty button-reset"
              onClick={() => {
                onUploadError(null);
                onUploadStatus(null);
                setShowLoginPrompt(true);
              }}
              style={
                {
                  "--book-accent": "#FFFFFF",
                  "--book-delay": `${(displayBooks.length + (sampleBook ? 1 : 0)) * 40}ms`,
                  "--book-height": "86%",
                  "--book-width": "42px"
                } as CSSProperties
              }
              type="button"
            >
              <span className="home-book-2d">
                <span className="home-book-2d-title">上传 EPUB</span>
              </span>
              <span aria-hidden="true" className="home-book-plus">+</span>
            </button>
          ) : (
            <BookUploadControl
              onError={onUploadError}
              onUploadComplete={onUploadComplete}
              onStatus={onUploadStatus}
              renderTrigger={({ isUploading, openPicker }) => (
              <button
                aria-label="上传自己的 EPUB 书籍"
                className="home-book-link home-book-empty button-reset"
                disabled={isUploading}
                onClick={openPicker}
                style={
                  {
                    "--book-accent": "#FFFFFF",
                    "--book-delay": `${displayBooks.length * 40}ms`,
                    "--book-height": "86%",
                    "--book-width": "42px"
                  } as CSSProperties
                }
                type="button"
              >
                <span className="home-book-2d">
                  <span className="home-book-2d-title">{isUploading ? "上传中" : "上传 EPUB"}</span>
                </span>
                <span aria-hidden="true" className="home-book-plus">+</span>
              </button>
              )}
            />
          )}
        </div>
      </div>
      {showLoginPrompt ? (
        <div className="login-required-panel" role="dialog" aria-modal="true" aria-label="上传 EPUB 需要登录">
          <div className="login-required-card">
            <p className="page-eyebrow">Upload EPUB</p>
            <h3>登录后上传自己的书</h3>
            <p>样例书可以直接阅读；上传 EPUB 会写入你的私人书架，因此需要先登录或注册。</p>
            <div className="login-required-actions">
              <Link className="primary-link" href="/login?next=%2F%3Fupload%3D1">
                登录 / 注册
              </Link>
              <button className="secondary-link button-reset" onClick={() => setShowLoginPrompt(false)} type="button">
                继续看样例
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function HomeNoteSticky({ latestNote, noteCount }: { latestNote: PersonalNote | null; noteCount: number }) {
  const notePreview = getNotePreview(latestNote);

  return (
    <article className="home-note-sticky" data-entry="notes">
      <div className="home-note-pin" aria-hidden="true" />
      <div className="home-note-sticky-header">
        <span>Notes / 笔记</span>
        <strong>{noteCount > 0 ? `${noteCount} saved notes` : "No saved notes yet"}</strong>
      </div>
      <div className="home-note-sticky-body">
        {latestNote ? (
          <>
            <p className="home-note-book">{latestNote.bookTitle}</p>
            <p className="home-note-preview">{notePreview}</p>
            <p className="home-note-time">{formatNoteDate(latestNote.createdAt)}</p>
          </>
        ) : (
          <p className="home-note-preview">{notePreview}</p>
        )}
      </div>
      <Link className="home-note-entry-link" href="/settings/notes">
        点击进入<span aria-hidden="true">-&gt;</span>
      </Link>
    </article>
  );
}

function getAskWoolfHref(books: BookshelfItem[]) {
  const readyBooks = books.filter((book) => book.importStatus === "ready");
  const readyBookIds = readyBooks.map((book) => book.id);
  const recentBookId = getMostRecentProgressBookId(readyBookIds);
  const fallbackBookId = readyBooks[0]?.id ?? "";
  const targetBookId = recentBookId || fallbackBookId;

  return targetBookId ? `/reader/${targetBookId}?ask=1` : "/bookshelf";
}

export function HomeWorkbench({
  books,
  communityCount,
  isGuest = false,
  latestNote,
  noteCount,
  sampleBook = null,
  userEmail
}: HomeWorkbenchProps) {
  const readyBooks = books.filter((book) => book.importStatus === "ready");
  const askHref = getAskWoolfHref(books);
  const fallbackFeaturedBook = readyBooks[0] ?? null;
  const readyBookIds = readyBooks.map((book) => book.id);
  const readyBookSignature = readyBookIds.join("|");
  const [featuredBookId, setFeaturedBookId] = useState<string | null>(fallbackFeaturedBook?.id ?? null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [uploadStatusMessage, setUploadStatusMessage] = useState<string | null>(null);
  const [uploadedBookId, setUploadedBookId] = useState<string | null>(null);
  const [homeSummary, setHomeSummary] = useState<HomeSummaryResponse>({
    latestNote,
    noteCount,
    communityCount
  });
  const featuredBook = readyBooks.find((book) => book.id === featuredBookId) ?? fallbackFeaturedBook;

  useEffect(() => {
    const recentBookId = getMostRecentProgressBookId(readyBookIds);
    setFeaturedBookId(recentBookId ?? fallbackFeaturedBook?.id ?? null);
  }, [fallbackFeaturedBook?.id, readyBookSignature]);

  useEffect(() => {
    if (isGuest) {
      return;
    }

    const controller = new AbortController();

    fetch("/api/home/summary", {
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = (await response.json()) as HomeSummaryResponse | { error?: string };

        if (!response.ok || !isHomeSummaryResponse(payload)) {
          return;
        }

        setHomeSummary(payload);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      });

    return () => {
      controller.abort();
    };
  }, [isGuest]);

  return (
    <main className="home-workbench">
      <DarkRail askHref={askHref} />

      <section className="woolf-motion-column" aria-label="Woolf Room image panel">
        <div className="home-image-panel" aria-hidden="true" />
        <div className="home-author-status">
          <AuthorStatusCard
            bookId={featuredBook?.id ?? null}
            content={featuredBook ? getAuthorStatusCardContent(featuredBook) : getDefaultAuthorStatusCard(14)}
          />
        </div>
      </section>

      <section className="content-entry-column" aria-label="Primary page entries">
        <div className="entry-column-header">
          <p className="workbench-kicker">Archive Index</p>
          <h2>A Room of One&apos;s Own</h2>
          <p>
            Notes, bookshelf, and reflections stay separate, but the room keeps them in the same line of sight.
          </p>
          {userEmail ? <span className="entry-user-chip">{userEmail}</span> : null}
        </div>

        <div className="entry-card-list entry-card-split home-entry-shelf-layout">
          <HomeBookshelfShelf
            books={books}
            isGuest={isGuest}
            onUploadError={setUploadErrorMessage}
            onUploadComplete={(result) => setUploadedBookId(result.bookId)}
            onUploadStatus={setUploadStatusMessage}
            sampleBook={sampleBook}
          />
          <HomeNoteSticky latestNote={homeSummary.latestNote} noteCount={homeSummary.noteCount} />
        </div>
        {uploadErrorMessage ? <p className="form-error page-feedback">{uploadErrorMessage}</p> : null}
        {uploadStatusMessage ? <p className="form-success page-feedback">{uploadStatusMessage}</p> : null}
        {uploadedBookId ? (
          <div className="upload-next-step" role="status">
            <p>下一步：进入阅读器，选中一句话试试 Ask Woolf。</p>
            <Link className="primary-link" href={`/reader/${uploadedBookId}`}>
              开始阅读
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
