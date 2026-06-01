"use client";

import { useState } from "react";
import type { CreatePersonalNoteRequest, PersonalNoteApiResponse } from "@/types/personal-notes";

type SaveNoteButtonProps = {
  payload: CreatePersonalNoteRequest;
  className?: string;
  disabled?: boolean;
  label?: string;
};

function isNoteCreateResponse(payload: PersonalNoteApiResponse): payload is Extract<PersonalNoteApiResponse, { note: unknown }> {
  return "note" in payload;
}

export function SaveNoteButton({
  payload,
  className = "secondary-link button-reset",
  disabled = false,
  label = "加入笔记"
}: SaveNoteButtonProps) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function saveNote() {
    if (disabled || status === "saving") {
      return;
    }

    setStatus("saving");
    setError("");

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const responsePayload = (await response.json()) as PersonalNoteApiResponse;

      if (!response.ok || !isNoteCreateResponse(responsePayload)) {
        throw new Error("error" in responsePayload ? responsePayload.error : "保存笔记失败，请稍后重试。");
      }

      setStatus("saved");
    } catch (nextError) {
      setStatus("error");
      setError(nextError instanceof Error ? nextError.message : "保存笔记失败，请稍后重试。");
    }
  }

  return (
    <span className="note-save-inline">
      <button className={className} disabled={disabled || status === "saving"} onClick={saveNote} type="button">
        {status === "saving" ? "保存中..." : status === "saved" ? "已加入笔记" : label}
      </button>
      {status === "error" ? (
        <span className="note-save-error" role="status">
          {error}
        </span>
      ) : null}
    </span>
  );
}
