"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AuthorStatusCardContent } from "@/lib/books/author-status-card";
import type { AuthorStatusApiResponse } from "@/types/author-status";

type AuthorStatusCardProps = {
  bookId: string | null;
  content: AuthorStatusCardContent;
};

function buildAuthorStatusUrl() {
  const params = new URLSearchParams();

  params.set("hour", String(new Date().getHours()));

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (timezone) {
      params.set("timezone", timezone);
    }
  } catch {
    // Browser timezone is a hint only. The API has a server-side fallback.
  }

  return `/api/author-status?${params.toString()}`;
}

export function AuthorStatusCard({ bookId, content }: AuthorStatusCardProps) {
  const [dynamicContent, setDynamicContent] = useState<AuthorStatusApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAuthorStatus() {
      try {
        const response = await fetch(buildAuthorStatusUrl(), {
          headers: { Accept: "application/json" }
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as AuthorStatusApiResponse;

        if (!cancelled) {
          setDynamicContent(payload);
        }
      } catch {
        if (!cancelled) {
          setDynamicContent(null);
        }
      }
    }

    void loadAuthorStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const display = dynamicContent ?? {
    ...content,
    book_id: bookId
  };
  const targetBookId = dynamicContent?.book_id ?? bookId;
  const readerHref = targetBookId ? `/reader/${targetBookId}` : "/bookshelf";
  const askHref = targetBookId ? `/reader/${targetBookId}?ask=1` : "/bookshelf";
  const primaryCta = useMemo(() => display.cta_hint || content.cta_hint || "进入阅读", [content.cta_hint, display.cta_hint]);

  return (
    <aside className="soft-card author-status-card" aria-label="Author status card">
      <div className="author-status-content">
        <p className="author-status-copy">
          <strong>Wloof：</strong>
          <span>{display.woolf_status}</span>
        </p>

        <div className="author-status-section">
          <span>{display.thought_title}</span>
          <p>{display.thought_body}</p>
        </div>

        <div className="state-actions">
          <Link className="primary-link" href={readerHref}>
            <span className="action-copy">
              <span className="action-copy-zh">{primaryCta}</span>
            </span>
          </Link>
          <Link className="secondary-link" href={askHref}>
            <span className="action-copy">
              <span className="action-copy-zh">Ask Woolf</span>
            </span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
