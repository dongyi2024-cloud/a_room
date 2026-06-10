import Link from "next/link";
import { ReaderShell } from "@/components/reader/reader-shell";
import { getAccessibleReaderBook } from "@/lib/reader/books";
import { getSampleShengSiChangBook, SAMPLE_SHENG_SI_CHANG_ID } from "@/lib/sample-books/sheng-si-chang";
import { getCurrentUser, requireUser } from "@/lib/supabase/auth";

type ReaderPageProps = {
  params: {
    bookId: string;
  };
  searchParams?: {
    ask?: string;
    chapter?: string;
    paragraphId?: string;
  };
};

function ReaderState({
  title,
  text,
  showShelfLink = true
}: {
  title: string;
  text: string;
  showShelfLink?: boolean;
}) {
  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">Reader</p>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{text}</p>
        </div>
      </header>
      <section className="soft-card state-card">
        <h2 className="state-title">{title}</h2>
        <p className="state-text">{text}</p>
        {showShelfLink ? (
          <div className="state-actions">
            <Link className="primary-link" href="/bookshelf">
              Return to bookshelf
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default async function ReaderPage({ params, searchParams }: ReaderPageProps) {
  if (params.bookId === SAMPLE_SHENG_SI_CHANG_ID) {
    const user = await getCurrentUser();
    const sampleBook = getSampleShengSiChangBook();
    const requestedChapter = Number.parseInt(searchParams?.chapter ?? "1", 10);
    const chapterIndex = Number.isFinite(requestedChapter)
      ? Math.min(Math.max(requestedChapter, 1), sampleBook.chapters.length) - 1
      : 0;

    return (
      <main className="app-shell">
        <ReaderShell
          book={sampleBook}
          initialChapterIndex={chapterIndex}
          initialParagraphId={searchParams?.paragraphId}
          isSampleReader
          openAiHint={searchParams?.ask === "1"}
          readerUserId={user?.id}
        />
      </main>
    );
  }

  const user = await requireUser(`/reader/${params.bookId}`);
  let book = null;

  try {
    book = await getAccessibleReaderBook(user.id, params.bookId);
  } catch (error) {
    return (
      <ReaderState
        title="Reader unavailable"
        text={
          error instanceof Error
            ? error.message
            : "The reader could not load this bookshelf book from Supabase."
        }
      />
    );
  }

  if (!book) {
    return (
      <ReaderState
        title="Book unavailable"
        text="This reader route does not map to a ready book in your private bookshelf. The book may still be processing, may have failed ingestion, or may not belong to your account."
      />
    );
  }

  if (book.chapters.length === 0) {
    return (
      <ReaderState
        title="No readable chapters"
        text="The book record exists, but no persisted chapter content is available for reading yet."
      />
    );
  }

  const requestedChapter = Number.parseInt(searchParams?.chapter ?? "1", 10);
  const chapterIndex = Number.isFinite(requestedChapter)
    ? Math.min(Math.max(requestedChapter, 1), book.chapters.length) - 1
    : 0;
  return (
    <main className="app-shell">
      <ReaderShell
        book={book}
        initialChapterIndex={chapterIndex}
        initialParagraphId={searchParams?.paragraphId}
        openAiHint={searchParams?.ask === "1"}
        readerUserId={user.id}
      />
    </main>
  );
}
