"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { removeReadingProgressForBook } from "@/lib/reader/progress-store";
import type { BookshelfItem } from "@/types/bookshelf";

type BookshelfGridProps = {
  books: BookshelfItem[];
};

export function BookshelfGrid({ books }: BookshelfGridProps) {
  const router = useRouter();
  const [visibleBooks, setVisibleBooks] = useState(books);
  const [confirmingBookId, setConfirmingBookId] = useState<string | null>(null);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setVisibleBooks(books);
  }, [books]);

  async function deleteBook(book: BookshelfItem) {
    setDeletingBookId(book.id);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/books/${encodeURIComponent(book.id)}`, {
        method: "DELETE"
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "删除失败，请稍后重试。");
      }

      removeReadingProgressForBook(book.id);
      setVisibleBooks((currentBooks) => currentBooks.filter((item) => item.id !== book.id));
      setConfirmingBookId(null);
      setStatusMessage("书籍已删除");
      router.refresh();
    } catch {
      setErrorMessage("删除失败，请稍后重试。");
    } finally {
      setDeletingBookId(null);
    }
  }

  return (
    <>
      {errorMessage ? <p className="form-error page-feedback">{errorMessage}</p> : null}
      {statusMessage ? <p className="form-success page-feedback">{statusMessage}</p> : null}
      <section aria-label="个人书架" className="bookshelf-grid">
        {visibleBooks.map((book) => (
          <article className="book-card soft-card" key={book.id}>
            <div className="book-card-topline">
              <span className={`book-badge status-${book.ragStatus}`}>
                {book.ragStatus === "ready" ? "Ready" : book.ragStatus === "processing" ? "Processing" : "Failed"}
              </span>
              <details className="book-action-menu">
                <summary aria-label={`${book.title} 更多操作`} className="book-action-trigger">
                  <span aria-hidden="true">...</span>
                </summary>
                <div className="book-action-menu-panel">
                  {book.importStatus === "ready" ? (
                    <Link className="book-action-menu-item" href={`/reader/${book.id}`}>
                      继续阅读
                    </Link>
                  ) : (
                    <span className="book-action-menu-item is-disabled">继续阅读</span>
                  )}
                  <span className="book-action-menu-item is-disabled">查看详情</span>
                  <span className="book-action-menu-item is-disabled">重命名</span>
                  <button
                    className="book-action-menu-item is-danger button-reset"
                    disabled={deletingBookId === book.id}
                    onClick={() => {
                      setConfirmingBookId(book.id);
                      setErrorMessage(null);
                      setStatusMessage(null);
                    }}
                    type="button"
                  >
                    删除书籍
                  </button>
                </div>
              </details>
            </div>

            <div>
              <h2 className="book-title">{book.title}</h2>
              <p className="book-author">{book.author}</p>
            </div>

            <p className="book-description">
              {book.description ||
                (book.importStatus === "ready"
                  ? "这本书已经准备好进入阅读器。"
                  : book.importStatus === "processing"
                    ? "这本书正在解析，完成后会自动出现在阅读器中。"
                    : "这本书暂时不可用，请查看导入错误。")}
            </p>

            <div className="book-meta">
              <span>
                <strong>{book.chapterCount}</strong>
                <small>Chapters</small>
              </span>
              <span>
                <strong>{book.paragraphCount}</strong>
                <small>Paragraphs</small>
              </span>
              <span>
                <strong>{book.language.toUpperCase()}</strong>
                <small>Language</small>
              </span>
            </div>

            {book.importError || book.ragError ? (
              <p className="book-inline-error">{book.importError || book.ragError}</p>
            ) : null}

            <div className="book-card-actions">
              {book.importStatus === "ready" ? (
                <Link className="primary-link" href={`/reader/${book.id}`}>
                  继续阅读
                </Link>
              ) : (
                <span className="secondary-link is-disabled">{book.importStatus === "processing" ? "正在解析" : "暂不可用"}</span>
              )}
            </div>

            {confirmingBookId === book.id ? (
              <div aria-modal="true" className="book-delete-confirmation" role="dialog">
                <p className="book-delete-title">确认删除这本书？</p>
                <p className="book-delete-copy">
                  删除后，该书籍将从你的书架中移除，相关阅读进度、标记、笔记、感悟、AI
                  记录和文件也可能被删除。此操作不可恢复，是否确认删除？
                </p>
                <div className="book-delete-actions">
                  <button
                    className="secondary-link button-reset"
                    disabled={deletingBookId === book.id}
                    onClick={() => setConfirmingBookId(null)}
                    type="button"
                  >
                    取消
                  </button>
                  <button
                    className="book-delete-confirm-button button-reset"
                    disabled={deletingBookId === book.id}
                    onClick={() => deleteBook(book)}
                    type="button"
                  >
                    {deletingBookId === book.id ? "删除中..." : "确认删除"}
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </>
  );
}
