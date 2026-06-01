"use client";

import type { ReaderProgressRecord } from "@/types/reader";

const PROGRESS_STORAGE_KEY = "woolf-room.reader-progress.v1";
const USER_ID_STORAGE_KEY = "woolf-room.reader-user-id";

type ProgressIndex = Record<string, ReaderProgressRecord>;

function buildProgressKey(userId: string, bookId: string) {
  return `${userId}::${bookId}`;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readProgressIndex(): ProgressIndex {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as ProgressIndex;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeProgressIndex(index: ProgressIndex) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(index));
}

function createLocalUserId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `reader-user-${Date.now()}`;
}

export function getCurrentReaderUserId() {
  if (!canUseStorage()) {
    return "reader-user-server";
  }

  const existing = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = createLocalUserId();
  window.localStorage.setItem(USER_ID_STORAGE_KEY, created);
  return created;
}

export function getReadingProgress(userId: string, bookId: string): ReaderProgressRecord | null {
  const index = readProgressIndex();
  return index[buildProgressKey(userId, bookId)] ?? null;
}

export function getMostRecentProgressBookId(bookIds: string[]) {
  const allowedBookIds = new Set(bookIds);
  const records = Object.values(readProgressIndex()).filter((record) => allowedBookIds.has(record.bookId));

  records.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

  return records[0]?.bookId ?? null;
}

export function saveReadingProgress(record: ReaderProgressRecord) {
  const index = readProgressIndex();
  index[buildProgressKey(record.userId, record.bookId)] = record;
  writeProgressIndex(index);
}

export function removeReadingProgressForBook(bookId: string) {
  const index = readProgressIndex();
  let changed = false;

  for (const [key, record] of Object.entries(index)) {
    if (record.bookId === bookId) {
      delete index[key];
      changed = true;
    }
  }

  if (changed) {
    writeProgressIndex(index);
  }
}
