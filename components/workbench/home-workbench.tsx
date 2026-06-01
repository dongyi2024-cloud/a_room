"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { AuthorStatusCard } from "@/components/books/author-status-card";
import { DarkRail } from "@/components/workbench/dark-rail";
import { getAuthorStatusCardContent } from "@/lib/books/author-status-card";
import { getDefaultAuthorStatusCard } from "@/lib/author-status/time-mood";
import { getMostRecentProgressBookId } from "@/lib/reader/progress-store";
import type { BookshelfItem } from "@/types/bookshelf";
import type { PersonalNote } from "@/types/personal-notes";

type HomeWorkbenchProps = {
  books: BookshelfItem[];
  communityCount: number;
  latestNote: PersonalNote | null;
  noteCount: number;
  userEmail: string | null;
};

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

function HomeBookshelfShelf({ books }: { books: BookshelfItem[] }) {
  const displayBooks = books.slice(0, 7);

  return (
    <section aria-label="首页书架" className="home-bookshelf-shelf">
      <div className="home-bookshelf-stage">
        <div className="bookshelf-plank" />
        <div className="bookshelf-book-row">
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
          <Link
            aria-label="上传自己的 EPUB 书籍"
            className="home-book-link home-book-empty"
            href="/bookshelf"
            style={
              {
                "--book-accent": "#FFFFFF",
                "--book-delay": `${displayBooks.length * 40}ms`,
                "--book-height": "86%",
                "--book-width": "42px"
              } as CSSProperties
            }
          >
            <span className="home-book-2d">
              <span className="home-book-2d-title">上传 EPUB</span>
            </span>
            <span aria-hidden="true" className="home-book-plus">+</span>
          </Link>
        </div>
      </div>
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

export function HomeWorkbench({ books, latestNote, noteCount, userEmail }: HomeWorkbenchProps) {
  const readyBooks = books.filter((book) => book.importStatus === "ready");
  const askHref = getAskWoolfHref(books);
  const fallbackFeaturedBook = readyBooks[0] ?? null;
  const readyBookIds = readyBooks.map((book) => book.id);
  const readyBookSignature = readyBookIds.join("|");
  const [featuredBookId, setFeaturedBookId] = useState<string | null>(fallbackFeaturedBook?.id ?? null);
  const featuredBook = readyBooks.find((book) => book.id === featuredBookId) ?? fallbackFeaturedBook;

  useEffect(() => {
    const recentBookId = getMostRecentProgressBookId(readyBookIds);
    setFeaturedBookId(recentBookId ?? fallbackFeaturedBook?.id ?? null);
  }, [fallbackFeaturedBook?.id, readyBookSignature]);

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
          <HomeBookshelfShelf books={books} />
          <HomeNoteSticky latestNote={latestNote} noteCount={noteCount} />
        </div>
      </section>
    </main>
  );
}
