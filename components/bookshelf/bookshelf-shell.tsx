"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthorStatusCard } from "@/components/books/author-status-card";
import { getAuthorStatusCardContent } from "@/lib/books/author-status-card";
import { isSupportedEpubFile } from "@/lib/bookshelf/helpers";
import { getMostRecentProgressBookId } from "@/lib/reader/progress-store";
import type { BookshelfItem } from "@/types/bookshelf";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { BookshelfGrid } from "@/components/reader/bookshelf-grid";

type BookshelfShellProps = {
  items: BookshelfItem[];
  userEmail: string | null;
};

export function BookshelfShell({ items, userEmail }: BookshelfShellProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const readyBooks = items.filter((item) => item.importStatus === "ready");
  const fallbackFeaturedBook = readyBooks[0] ?? null;
  const readyBookIds = readyBooks.map((book) => book.id);
  const readyBookSignature = readyBookIds.join("|");
  const [featuredBookId, setFeaturedBookId] = useState<string | null>(fallbackFeaturedBook?.id ?? null);
  const featuredBook = readyBooks.find((book) => book.id === featuredBookId) ?? fallbackFeaturedBook;

  useEffect(() => {
    const recentBookId = getMostRecentProgressBookId(readyBookIds);
    setFeaturedBookId(recentBookId ?? fallbackFeaturedBook?.id ?? null);
  }, [fallbackFeaturedBook?.id, readyBookSignature]);

  function openPicker() {
    inputRef.current?.click();
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    let createdImportRecord = false;

    if (!file) {
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);

    if (!isSupportedEpubFile(file.name, file.type)) {
      setErrorMessage("Only EPUB files are supported in the current ingestion flow.");
      event.target.value = "";
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/books/upload", {
        method: "POST",
        body: formData
      });
      const uploadPayload = (await uploadResponse.json()) as { bookId?: string; error?: string };

      if (!uploadResponse.ok || !uploadPayload.bookId) {
        throw new Error(uploadPayload.error || "Unable to upload the selected EPUB.");
      }

      createdImportRecord = true;
      setStatusMessage("Upload received. Parsing, chunking, and embedding have started.");
      const processResponse = await fetch("/api/books/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ bookId: uploadPayload.bookId })
      });
      const processPayload = (await processResponse.json()) as {
        error?: string;
        ragStatus?: "processing" | "ready" | "failed";
      };

      if (!processResponse.ok) {
        throw new Error(processPayload.error || "Parsing failed.");
      }

      setStatusMessage(
        processPayload.ragStatus === "ready"
          ? "Book parsed successfully and added to your private shelf. AI is ready."
          : processPayload.ragStatus === "failed"
            ? "Book parsed successfully, but AI preparation failed. You can still open the reader."
            : "Book parsed successfully. AI preparation is still processing."
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to upload this EPUB.");

      if (createdImportRecord) {
        router.refresh();
      }
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="page-eyebrow">
            <span className="eyebrow-zh">个人书架</span>
            <span className="eyebrow-en">Bookshelf</span>
          </p>
          <h1 className="page-title">A Room of One&apos;s Own</h1>
          <div className="page-subtitle bilingual-block">
            <p className="bilingual-primary">
              {items.length === 0
                ? "你的书架还空着。上传一本 EPUB，让阅读从属于你自己的路径开始。"
                : "你的书架已经和账户绑定。可阅读的书会进入阅读器，处理中或失败的书会继续停留在这里。"}
            </p>
          </div>
          {userEmail ? (
            <div className="page-subtitle subtle-inline bilingual-inline">
              <span className="bilingual-primary">当前登录邮箱：{userEmail}</span>
            </div>
          ) : null}
        </div>

        <div className="header-actions">
          <Link className="secondary-link" href="/community">
            <span className="action-copy">
              <span className="action-copy-zh">社区</span>
              <span className="action-copy-en">Community</span>
            </span>
          </Link>
          <Link className="secondary-link" href="/settings/memory">
            <span className="action-copy">
              <span className="action-copy-zh">记忆</span>
              <span className="action-copy-en">Memory</span>
            </span>
          </Link>
          <Link className="secondary-link" href="/settings/preferences">
            <span className="action-copy">
              <span className="action-copy-zh">阅读设置</span>
              <span className="action-copy-en">Preferences</span>
            </span>
          </Link>
          <Link className="secondary-link" href="/settings/notes">
            <span className="action-copy">
              <span className="action-copy-zh">笔记</span>
              <span className="action-copy-en">Notes</span>
            </span>
          </Link>
          <button className="primary-link button-reset" disabled={isUploading} onClick={openPicker} type="button">
            <span className="action-copy">
              <span className="action-copy-zh">{isUploading ? "正在上传" : "上传 EPUB"}</span>
              <span className="action-copy-en">{isUploading ? "Uploading..." : "Upload EPUB"}</span>
            </span>
          </button>
          <SignOutButton />
        </div>
      </header>

      <input
        accept=".epub,application/epub+zip"
        className="hidden-input"
        onChange={handleFileSelected}
        ref={inputRef}
        type="file"
      />

      {errorMessage ? <p className="form-error page-feedback">{errorMessage}</p> : null}
      {statusMessage ? <p className="form-success page-feedback">{statusMessage}</p> : null}
      {featuredBook ? (
        <section className="bookshelf-author-status">
          <AuthorStatusCard bookId={featuredBook.id} content={getAuthorStatusCardContent(featuredBook)} />
        </section>
      ) : null}

      {items.length === 0 ? (
        <section className="soft-card empty-state">
          <div className="state-bilingual">
            <h2 className="state-title">书架里还没有书</h2>
          </div>
          <div className="state-text bilingual-block">
            <p className="bilingual-primary">上传一本属于你的 EPUB 文件，系统会先写入私有书架，再解析章节和段落，完成后才会送进阅读器。</p>
          </div>
          <div className="state-actions">
            <button className="primary-link button-reset" disabled={isUploading} onClick={openPicker} type="button">
              <span className="action-copy">
                <span className="action-copy-zh">上传第一本 EPUB</span>
                <span className="action-copy-en">Upload your first EPUB</span>
              </span>
            </button>
          </div>
        </section>
      ) : (
        <BookshelfGrid books={items} />
      )}
    </>
  );
}
