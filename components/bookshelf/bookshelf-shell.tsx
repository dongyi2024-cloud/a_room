"use client";

import Link from "next/link";
import { useState } from "react";
import type { BookshelfItem } from "@/types/bookshelf";
import { BookUploadControl } from "@/components/bookshelf/book-upload-control";
import { BookshelfGrid } from "@/components/reader/bookshelf-grid";

type BookshelfShellProps = {
  items: BookshelfItem[];
  userEmail: string | null;
};

export function BookshelfShell({ items, userEmail }: BookshelfShellProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [uploadedBookId, setUploadedBookId] = useState<string | null>(null);

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
          <Link className="secondary-link" href="/settings/preferences">
            <span className="action-copy">
              <span className="action-copy-zh">阅读设置</span>
              <span className="action-copy-en">Preferences</span>
            </span>
          </Link>
          <Link className="secondary-link" href="/">
            <span className="action-copy">
              <span className="action-copy-zh">返回首页</span>
              <span className="action-copy-en">Home</span>
            </span>
          </Link>
          <BookUploadControl
            onError={setErrorMessage}
            onUploadComplete={(result) => setUploadedBookId(result.bookId)}
            onStatus={setStatusMessage}
            renderTrigger={({ isUploading, openPicker }) => (
              <button className="primary-link button-reset" disabled={isUploading} onClick={openPicker} type="button">
                <span className="action-copy">
                  <span className="action-copy-zh">{isUploading ? "正在上传" : "上传 EPUB"}</span>
                  <span className="action-copy-en">{isUploading ? "Uploading..." : "Upload EPUB"}</span>
                </span>
              </button>
            )}
          />
        </div>
      </header>

      {errorMessage ? <p className="form-error page-feedback">{errorMessage}</p> : null}
      {statusMessage ? <p className="form-success page-feedback">{statusMessage}</p> : null}
      {uploadedBookId ? (
        <div className="upload-next-step" role="status">
          <p>下一步：进入阅读器，选中一句话试试 Ask Woolf。</p>
          <Link className="primary-link" href={`/reader/${uploadedBookId}`}>
            开始阅读
          </Link>
        </div>
      ) : null}

      {items.length === 0 ? (
        <section className="soft-card empty-state">
          <div className="state-bilingual">
            <h2 className="state-title">书架里还没有书</h2>
          </div>
          <div className="state-text bilingual-block">
            <p className="bilingual-primary">上传一本属于你的 EPUB 文件，系统会先写入私有书架，再解析章节和段落，完成后才会送进阅读器。</p>
          </div>
        </section>
      ) : (
        <BookshelfGrid books={items} />
      )}
    </>
  );
}
