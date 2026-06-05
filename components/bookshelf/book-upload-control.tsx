"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BOOK_FILES_BUCKET } from "@/lib/bookshelf/constants";
import { isSupportedEpubFile } from "@/lib/bookshelf/helpers";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type UploadTriggerProps = {
  isUploading: boolean;
  openPicker: () => void;
};

type BookUploadControlProps = {
  onError?: (message: string | null) => void;
  onUploadComplete?: (result: { bookId: string; ragStatus: ProcessBookResponse["ragStatus"] }) => void;
  onStatus?: (message: string | null) => void;
  renderTrigger: (props: UploadTriggerProps) => ReactNode;
};

type InitiateUploadResponse = {
  bookId?: string;
  storagePath?: string;
  uploadToken?: string;
  error?: string;
};

type ProcessBookResponse = {
  bookId?: string;
  error?: string;
  importStatus?: "processing" | "ready" | "failed";
  ragStatus?: "processing" | "ready" | "failed";
};

async function readJsonResponse<T extends { error?: string }>(response: Response, fallbackMessage: string) {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const compactText = text.replace(/\s+/g, " ").trim();
    const message =
      compactText.includes("Request Entity Too Large") || response.status === 413
        ? "这个 EPUB 文件太大，不能通过当前上传通道发送。请稍后重试，或换一本较小的 EPUB。"
        : compactText || fallbackMessage;

    return { error: message } as T;
  }
}

async function cleanupCreatedBook(bookId: string) {
  try {
    await fetch(`/api/books/${bookId}`, {
      method: "DELETE"
    });
  } catch {
    // Best-effort cleanup only; the visible upload error is more important here.
  }
}

function getProcessStatusMessage(ragStatus: ProcessBookResponse["ragStatus"]) {
  if (ragStatus === "ready") {
    return "已完成切片并加入私人书架。AI 准备完成，可以开始阅读。";
  }

  if (ragStatus === "failed") {
    return "已完成切片，可以开始阅读；AI 准备失败，稍后可重试。";
  }

  return "已完成切片，可以开始阅读；AI 准备仍在处理中。";
}

export function BookUploadControl({ onError, onStatus, onUploadComplete, renderTrigger }: BookUploadControlProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  function openPicker() {
    inputRef.current?.click();
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    let bookId: string | null = null;

    if (!file) {
      return;
    }

    onError?.(null);
    onStatus?.(null);

    if (!isSupportedEpubFile(file.name, file.type)) {
      onError?.("Only EPUB files are supported in the current ingestion flow.");
      event.target.value = "";
      return;
    }

    setIsUploading(true);

    try {
      const initiateResponse = await fetch("/api/books/upload/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || "application/epub+zip"
        })
      });
      const initiatePayload = await readJsonResponse<InitiateUploadResponse>(
        initiateResponse,
        "Unable to prepare the selected EPUB upload."
      );

      if (!initiateResponse.ok || !initiatePayload.bookId || !initiatePayload.storagePath || !initiatePayload.uploadToken) {
        throw new Error(initiatePayload.error || "Unable to prepare the selected EPUB upload.");
      }

      bookId = initiatePayload.bookId;
      onStatus?.("Upload slot created. Sending EPUB to private storage.");

      const supabase = getSupabaseBrowserClient();
      const { error: storageError } = await supabase.storage
        .from(BOOK_FILES_BUCKET)
        .uploadToSignedUrl(initiatePayload.storagePath, initiatePayload.uploadToken, file, {
          contentType: file.type || "application/epub+zip",
          upsert: false
        });

      if (storageError) {
        throw storageError;
      }

      onStatus?.("Upload received. Parsing, chunking, and embedding have started.");
      const processResponse = await fetch("/api/books/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ bookId })
      });
      const processPayload = await readJsonResponse<ProcessBookResponse>(processResponse, "Parsing failed.");

      if (!processResponse.ok) {
        throw new Error(processPayload.error || "Parsing failed.");
      }

      onStatus?.(getProcessStatusMessage(processPayload.ragStatus));
      onUploadComplete?.({
        bookId: processPayload.bookId || bookId,
        ragStatus: processPayload.ragStatus
      });
      router.refresh();
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Unable to upload this EPUB.");

      if (bookId) {
        await cleanupCreatedBook(bookId);
        router.refresh();
      }
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  return (
    <>
      {renderTrigger({ isUploading, openPicker })}
      <input
        accept=".epub,application/epub+zip"
        className="hidden-input"
        onChange={handleFileSelected}
        ref={inputRef}
        type="file"
      />
    </>
  );
}
