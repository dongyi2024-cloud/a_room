"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AcademicRecommendationList } from "@/components/academic-recommendations/academic-recommendation-list";
import { FeedbackReportAction } from "@/components/feedback/feedback-report-action";
import { SaveNoteButton } from "@/components/notes/save-note-button";
import { ReflectionFeedPanel } from "@/components/reflections/reflection-feed-panel";
import { RescuePackReminder } from "@/components/reader/rescue-pack-reminder";
import { buildChapterEndFallbackQuestionForReader } from "@/lib/ai/chapter-end-fallback";
import { getCurrentReaderUserId, getReadingProgress, saveReadingProgress } from "@/lib/reader/progress-store";
import type {
  ChapterEndAiApiResponse,
  ChapterEndAiQuestionApiResponse,
  DialogueSummaryApiResponse,
  DialogueSummaryDraft,
  SelectionAiApiResponse,
  SelectionAiCitation,
  SelectionAiExplanationContext,
  SelectionAiExplanationMode,
  SelectionAiSuccessResponse,
  SelectionAiTurn
} from "@/types/ai";
import type { ReaderBookDetail, ReaderParagraph, ReaderProgressRecord, ReaderSmartMark } from "@/types/reader";
import type { ReadingBehaviorEventType } from "@/types/reading-slump";

type ReaderShellProps = {
  book: ReaderBookDetail;
  initialChapterIndex: number;
  initialParagraphId?: string;
  openAiHint?: boolean;
  readerUserId?: string;
};

type RestoreTarget = {
  chapterIndex: number;
  paragraphOrder: number;
  scrollOffset: number;
};

type ActiveExplanation = {
  key: string;
  chapterOrder: number;
  paragraphId: string;
  paragraphOrder: number;
  targetText: string;
  markType: ReaderSmartMark["markType"];
  explanation: string;
};

type ReaderSelectionContext = {
  selectedText: string;
  chapterOrder: number;
  chapterId: string;
  paragraphId: string | null;
  paragraphOrder: number | null;
  explanationContext: SelectionAiExplanationContext | null;
  anchorRect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
};

type ReflectionSelectionContext = ReaderSelectionContext & {
  paragraphId: string;
  paragraphOrder: number;
};

type DialogueSummaryReviewState = {
  status: "idle" | "generating" | "review" | "saving" | "saved" | "error";
  draft: DialogueSummaryDraft | null;
  editableSummary: string;
  error: string;
};

const READER_SELECTION_HIGHLIGHT_NAME = "reader-selection";
const READER_AI_MODE_STORAGE_KEY = "reader-selection-ai-mode";
const READER_LAST_OPEN_SIGNATURE_KEY = "woolf-room.reader-last-open.v1";
const READER_AI_REQUEST_TIMEOUT_MS = 95000;
const SMART_MARK_LONG_PRESS_MS = 450;
const SMART_MARK_HIDE_DELAY_MS = 260;

function clampIndex(index: number, max: number) {
  return Math.min(Math.max(index, 0), max);
}

function isSelectionAiSuccessResponse(payload: unknown): payload is SelectionAiSuccessResponse {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as {
    answer?: unknown;
    truncated?: unknown;
    citations?: unknown;
    academicRecommendations?: unknown;
    academicSourceLeads?: unknown;
    insufficientEvidence?: unknown;
  };

  return (
    typeof candidate.answer === "string" &&
    typeof candidate.truncated === "boolean" &&
    Array.isArray(candidate.citations) &&
    Array.isArray(candidate.academicRecommendations) &&
    Array.isArray(candidate.academicSourceLeads) &&
    typeof candidate.insufficientEvidence === "boolean"
  );
}

function isDialogueSummarySuccessResponse(payload: unknown): payload is { draft: DialogueSummaryDraft } {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as {
    draft?: {
      coreQuestions?: unknown;
      answerPoints?: unknown;
      relatedSourceText?: unknown;
      followUpQuestions?: unknown;
      editableSummary?: unknown;
    };
  };

  return (
    Boolean(candidate.draft) &&
    Array.isArray(candidate.draft?.coreQuestions) &&
    Array.isArray(candidate.draft?.answerPoints) &&
    typeof candidate.draft?.relatedSourceText === "string" &&
    Array.isArray(candidate.draft?.followUpQuestions) &&
    typeof candidate.draft?.editableSummary === "string"
  );
}

function getParagraphSegments(paragraph: ReaderParagraph) {
  if (paragraph.smartMarks.length === 0) {
    return [{ text: paragraph.content, mark: null }] as const;
  }

  const segments: Array<{ text: string; mark: ReaderParagraph["smartMarks"][number] | null }> = [];
  let cursor = 0;

  paragraph.smartMarks.forEach((mark) => {
    if (mark.startOffset > cursor) {
      segments.push({
        text: paragraph.content.slice(cursor, mark.startOffset),
        mark: null
      });
    }

    segments.push({
      text: paragraph.content.slice(mark.startOffset, mark.endOffset),
      mark
    });
    cursor = mark.endOffset;
  });

  if (cursor < paragraph.content.length) {
    segments.push({
      text: paragraph.content.slice(cursor),
      mark: null
    });
  }

  return segments;
}

function getMarkKey(mark: ReaderSmartMark) {
  return `${mark.chapterOrder}:${mark.paragraphId}:${mark.startOffset}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isInteractiveSelectionTarget(element: Element | null) {
  if (!element) {
    return false;
  }

  return Boolean(
    element.closest(
      "textarea, input, select, option, button, a, label, [contenteditable='true'], .reflection-panel, .reader-ai-panel, .reader-chapter-end-panel"
    )
  );
}

function getSelectionThreadKey(selectionContext: ReaderSelectionContext) {
  return [
    selectionContext.chapterOrder,
    selectionContext.paragraphId ?? "no-paragraph-id",
    selectionContext.paragraphOrder ?? "none",
    selectionContext.selectedText,
    selectionContext.explanationContext?.targetText ?? "no-explanation"
  ].join(":");
}

function getEntryStyle(selectionContext: ReaderSelectionContext) {
  if (typeof window === "undefined") {
    return undefined;
  }

  const entryWidth = Math.min(420, window.innerWidth - 20);
  const entryHeight = 72;
  const anchor = selectionContext.anchorRect;
  const left = clampNumber(
    anchor.left + anchor.width / 2 - entryWidth / 2,
    10,
    Math.max(10, window.innerWidth - entryWidth - 10)
  );
  const preferredTop = anchor.top - entryHeight - 8;
  const fallbackTop = anchor.bottom + 8;
  const top =
    preferredTop >= 10
      ? preferredTop
      : clampNumber(fallbackTop, 10, Math.max(10, window.innerHeight - entryHeight - 10));

  return {
    width: `${entryWidth}px`,
    left: `${left}px`,
    top: `${top}px`
  };
}

function getPanelStyle(selectionContext: ReaderSelectionContext) {
  if (typeof window === "undefined") {
    return undefined;
  }

  const viewportPadding = 12;
  const anchorGap = 10;
  const panelWidth = Math.min(680, window.innerWidth - 20);
  const maxPanelHeight = Math.min(760, window.innerHeight - viewportPadding * 2);
  const comfortableHeight = 340;
  const anchor = selectionContext.anchorRect;
  const left = clampNumber(
    anchor.left + anchor.width / 2 - panelWidth / 2,
    viewportPadding,
    Math.max(viewportPadding, window.innerWidth - panelWidth - viewportPadding)
  );
  const availableAbove = Math.max(0, anchor.top - anchorGap - viewportPadding);
  const availableBelow = Math.max(0, window.innerHeight - anchor.bottom - anchorGap - viewportPadding);
  const prefersAbove =
    availableAbove >= comfortableHeight && availableAbove >= availableBelow;

  if (prefersAbove) {
    const bottom = Math.max(viewportPadding, window.innerHeight - anchor.top + anchorGap);

    return {
      width: `${panelWidth}px`,
      left: `${left}px`,
      bottom: `${bottom}px`,
      maxHeight: `${Math.min(maxPanelHeight, availableAbove)}px`
    };
  }

  const top = clampNumber(
    anchor.bottom + anchorGap,
    viewportPadding,
    Math.max(viewportPadding, window.innerHeight - Math.min(maxPanelHeight, availableBelow) - viewportPadding)
  );

  return {
    width: `${panelWidth}px`,
    left: `${left}px`,
    top: `${top}px`,
    maxHeight: `${Math.min(maxPanelHeight, Math.max(availableBelow, 260))}px`
  };
}

type ChapterNavigationProps = {
  previousChapterIndex: number | null;
  nextChapterIndex: number | null;
  onSelect: (nextIndex: number) => void;
};

function ChapterNavigation({
  previousChapterIndex,
  nextChapterIndex,
  onSelect
}: ChapterNavigationProps) {
  if (previousChapterIndex === null && nextChapterIndex === null) {
    return null;
  }

  return (
    <nav className="reader-nav" aria-label="Chapter navigation">
      {previousChapterIndex !== null ? (
        <button
          className="secondary-link button-reset"
          onClick={() => onSelect(previousChapterIndex)}
          type="button"
        >
          Previous chapter
        </button>
      ) : null}
      {nextChapterIndex !== null ? (
        <button
          className="primary-link button-reset"
          onClick={() => onSelect(nextChapterIndex)}
          type="button"
        >
          Next chapter
        </button>
      ) : null}
    </nav>
  );
}

export function ReaderShell({
  book,
  initialChapterIndex,
  initialParagraphId,
  openAiHint = false,
  readerUserId
}: ReaderShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeChapterIndex, setActiveChapterIndex] = useState(
    clampIndex(initialChapterIndex, Math.max(book.chapters.length - 1, 0))
  );
  const [progressLabel, setProgressLabel] = useState("Progress will save automatically.");
  const [activeExplanation, setActiveExplanation] = useState<ActiveExplanation | null>(null);
  const [selectionContext, setSelectionContext] = useState<ReaderSelectionContext | null>(null);
  const [activeSelectionPanel, setActiveSelectionPanel] = useState<"ai" | "reflection" | null>(null);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiExplanationMode, setAiExplanationMode] = useState<SelectionAiExplanationMode>("plain");
  const [aiTurns, setAiTurns] = useState<SelectionAiTurn[]>([]);
  const [aiError, setAiError] = useState("");
  const [isAiSubmitting, setIsAiSubmitting] = useState(false);
  const [dialogueSummary, setDialogueSummary] = useState<DialogueSummaryReviewState>({
    status: "idle",
    draft: null,
    editableSummary: "",
    error: ""
  });
  const [isChapterEndPanelOpen, setIsChapterEndPanelOpen] = useState(false);
  const [chapterEndPromptQuestion, setChapterEndPromptQuestion] = useState("");
  const [chapterEndQuestion, setChapterEndQuestion] = useState("");
  const [chapterEndTurns, setChapterEndTurns] = useState<SelectionAiTurn[]>([]);
  const [chapterEndError, setChapterEndError] = useState("");
  const [isChapterEndSubmitting, setIsChapterEndSubmitting] = useState(false);
  const [showAiEntryHint, setShowAiEntryHint] = useState(openAiHint);
  const [isRescuePackOpen, setIsRescuePackOpen] = useState(false);

  const userIdRef = useRef<string | null>(null);
  const readerBodyRef = useRef<HTMLDivElement | null>(null);
  const rescuePackRef = useRef<HTMLElement | null>(null);
  const paragraphRefs = useRef<Map<number, HTMLElement>>(new Map());
  const restoreTargetRef = useRef<RestoreTarget | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const skipNextScrollResetRef = useRef(false);
  const lastSavedSignatureRef = useRef("");
  const restoredBookIdRef = useRef<string | null>(null);
  const pendingChapterIndexRef = useRef<number | null>(null);
  const isSelectionPanelOpenRef = useRef(false);
  const selectionSyncTimerRef = useRef<number | null>(null);
  const aiThreadKeyRef = useRef<string | null>(null);
  const aiPanelRef = useRef<HTMLElement | null>(null);
  const aiConversationRef = useRef<HTMLDivElement | null>(null);
  const selectionRangeRef = useRef<Range | null>(null);
  const chapterEndQuestionRequestIdRef = useRef(0);
  const smartMarkLongPressTimerRef = useRef<number | null>(null);
  const smartMarkHideTimerRef = useRef<number | null>(null);
  const lastChapterViewEventRef = useRef("");

  const activeChapter = book.chapters[activeChapterIndex];
  const hasReadableChapter = activeChapter.paragraphs.length > 0;

  function recordReaderBehavior(
    eventType: ReadingBehaviorEventType,
    options: {
      chapterOrder?: number | null;
      paragraphOrder?: number | null;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    if (typeof window === "undefined") {
      return;
    }

    void fetch("/api/reading-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bookId: book.id,
        eventType,
        chapterOrder: options.chapterOrder ?? null,
        paragraphOrder: options.paragraphOrder ?? null,
        metadata: options.metadata ?? {}
      })
    }).catch(() => {
      // Reading analytics must never interrupt the reading surface.
    });
  }

  function readLastOpenSignature() {
    if (typeof window === "undefined") {
      return "";
    }

    try {
      return window.localStorage.getItem(READER_LAST_OPEN_SIGNATURE_KEY) ?? "";
    } catch {
      return "";
    }
  }

  function writeLastOpenSignature(signature: string) {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(READER_LAST_OPEN_SIGNATURE_KEY, signature);
    } catch {
      // Ignore storage failures; server-side event capture still records the open.
    }
  }

  function updateChapterInUrl(chapterNumber: number) {
    router.replace(`${pathname}?chapter=${chapterNumber}`, { scroll: false });
  }

  function saveProgressForCurrentView() {
    if (typeof window === "undefined") {
      return;
    }

    const userId = userIdRef.current;
    if (!userId || !activeChapter || activeChapter.paragraphs.length === 0) {
      return;
    }

    const paragraphEntries = Array.from(paragraphRefs.current.entries()).sort((left, right) => left[0] - right[0]);
    if (paragraphEntries.length === 0) {
      return;
    }

    let selectedOrder = paragraphEntries[0][0];
    let selectedTop = paragraphEntries[0][1].getBoundingClientRect().top;

    for (const [order, element] of paragraphEntries) {
      const top = element.getBoundingClientRect().top;
      if (top <= 160) {
        selectedOrder = order;
        selectedTop = top;
      } else {
        break;
      }
    }

    const record: ReaderProgressRecord = {
      version: 1,
      userId,
      bookId: book.id,
      chapterOrder: activeChapter.orderIndex,
      paragraphOrder: selectedOrder,
      scrollOffset: Math.max(0, Math.round(-selectedTop)),
      updatedAt: new Date().toISOString()
    };
    const signature = `${record.bookId}:${record.chapterOrder}:${record.paragraphOrder}:${record.scrollOffset}`;

    if (signature === lastSavedSignatureRef.current) {
      return;
    }

    saveReadingProgress(record);
    lastSavedSignatureRef.current = signature;
    recordReaderBehavior("progress_saved", {
      chapterOrder: record.chapterOrder,
      paragraphOrder: record.paragraphOrder,
      metadata: {
        scrollOffset: record.scrollOffset
      }
    });
    setProgressLabel(
      `Saved chapter ${record.chapterOrder}, paragraph ${record.paragraphOrder} at ${new Date(
        record.updatedAt
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
    );
  }

  function scheduleProgressSave() {
    if (typeof window === "undefined") {
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveProgressForCurrentView();
    }, 180);
  }

  function applyRestoreTarget() {
    if (typeof window === "undefined") {
      return;
    }

    const restoreTarget = restoreTargetRef.current;
    if (!restoreTarget || !activeChapter) {
      return;
    }

    const paragraph = activeChapter.paragraphs.find((entry) => entry.orderIndex === restoreTarget.paragraphOrder);
    const safeParagraphOrder = paragraph?.orderIndex ?? activeChapter.paragraphs[0]?.orderIndex ?? 1;
    const element = paragraphRefs.current.get(safeParagraphOrder);

    if (!element) {
      return;
    }

    const top = element.getBoundingClientRect().top + window.scrollY + restoreTarget.scrollOffset;
    window.scrollTo({ top: Math.max(0, top - 24), behavior: "auto" });
    restoreTargetRef.current = null;
    setProgressLabel(`Restored progress to chapter ${activeChapter.orderIndex}, paragraph ${safeParagraphOrder}.`);
    window.setTimeout(() => {
      saveProgressForCurrentView();
    }, 80);
  }

  function clearPersistentSelectionHighlight() {
    const highlights = (CSS as typeof CSS & { highlights?: { delete: (name: string) => void } }).highlights;
    highlights?.delete(READER_SELECTION_HIGHLIGHT_NAME);
  }

  function applyPersistentSelectionHighlight() {
    const selectionRange = selectionRangeRef.current;
    const highlightCtor = globalThis.Highlight as (new (range: Range) => unknown) | undefined;
    const highlights = (CSS as typeof CSS & { highlights?: { set: (name: string, value: unknown) => void } }).highlights;

    if (!selectionRange || !highlightCtor || !highlights) {
      return;
    }

    highlights.set(READER_SELECTION_HIGHLIGHT_NAME, new highlightCtor(selectionRange));
  }

  function handleChapterSelect(nextIndex: number) {
    cancelSmartMarkLongPress();
    cancelSmartMarkHide();
    clearPersistentSelectionHighlight();
    selectionRangeRef.current = null;
    const safeIndex = clampIndex(nextIndex, book.chapters.length - 1);
    pendingChapterIndexRef.current = safeIndex;
    setActiveChapterIndex(safeIndex);
    updateChapterInUrl(book.chapters[safeIndex].orderIndex);
    skipNextScrollResetRef.current = false;
    setActiveExplanation(null);
    setSelectionContext(null);
    setActiveSelectionPanel(null);
    setAiQuestion("");
    setAiTurns([]);
    resetDialogueSummary();
    setIsChapterEndPanelOpen(false);
    setChapterEndPromptQuestion("");
    setChapterEndQuestion("");
    setChapterEndTurns([]);
    setChapterEndError("");
    paragraphRefs.current.clear();
    aiThreadKeyRef.current = null;
  }

  function resetDialogueSummary() {
    setDialogueSummary({
      status: "idle",
      draft: null,
      editableSummary: "",
      error: ""
    });
  }

  function revealExplanation(mark: ReaderSmartMark) {
    if (!mark.explanation) {
      return;
    }

    cancelSmartMarkHide();

    setActiveExplanation({
      key: getMarkKey(mark),
      chapterOrder: mark.chapterOrder,
      paragraphId: mark.paragraphId,
      paragraphOrder: mark.paragraphOrder,
      targetText: mark.targetText,
      markType: mark.markType,
      explanation: mark.explanation
    });
  }

  function cancelSmartMarkLongPress() {
    if (typeof window === "undefined" || smartMarkLongPressTimerRef.current === null) {
      return;
    }

    window.clearTimeout(smartMarkLongPressTimerRef.current);
    smartMarkLongPressTimerRef.current = null;
  }

  function cancelSmartMarkHide() {
    if (typeof window === "undefined" || smartMarkHideTimerRef.current === null) {
      return;
    }

    window.clearTimeout(smartMarkHideTimerRef.current);
    smartMarkHideTimerRef.current = null;
  }

  function scheduleSmartMarkHide() {
    if (typeof window === "undefined") {
      return;
    }

    cancelSmartMarkHide();
    smartMarkHideTimerRef.current = window.setTimeout(() => {
      setActiveExplanation(null);
      smartMarkHideTimerRef.current = null;
    }, SMART_MARK_HIDE_DELAY_MS);
  }

  function startSmartMarkLongPress(mark: ReaderSmartMark, pointerType: string) {
    if (typeof window === "undefined" || pointerType === "mouse") {
      return;
    }

    cancelSmartMarkLongPress();
    smartMarkLongPressTimerRef.current = window.setTimeout(() => {
      revealExplanation(mark);
      smartMarkLongPressTimerRef.current = null;
    }, SMART_MARK_LONG_PRESS_MS);
  }

  function normalizeAnchorRect(rect: DOMRect): ReaderSelectionContext["anchorRect"] {
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    };
  }

  function getSelectionContextFromDocument() {
    if (typeof window === "undefined") {
      return null;
    }

    const selection = window.getSelection();
    const readerBody = readerBodyRef.current;

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !readerBody) {
      return null;
    }

    const selectedText = selection.toString().replace(/\s+/g, " ").trim();

    if (selectedText.length < 2) {
      return null;
    }

    const range = selection.getRangeAt(0);

    if (!readerBody.contains(range.commonAncestorContainer)) {
      return null;
    }

    selectionRangeRef.current = range.cloneRange();

    const startElement =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : range.startContainer.parentElement;

    if (isInteractiveSelectionTarget(startElement)) {
      return null;
    }

    const paragraphElement = startElement?.closest<HTMLElement>("[data-reader-paragraph]");
    const paragraphOrder = paragraphElement?.dataset.paragraphOrder
      ? Number.parseInt(paragraphElement.dataset.paragraphOrder, 10)
      : null;
    const paragraphId = paragraphElement?.dataset.paragraphId ?? null;

    if (!paragraphElement) {
      return null;
    }

    return {
      selectedText: selectedText.slice(0, 1800),
      chapterOrder: activeChapter.orderIndex,
      chapterId: activeChapter.id,
      paragraphId,
      paragraphOrder: Number.isFinite(paragraphOrder) ? paragraphOrder : null,
      explanationContext: null,
      anchorRect: normalizeAnchorRect(range.getBoundingClientRect())
    };
  }

  function syncReaderSelection() {
    if (isSelectionPanelOpenRef.current) {
      return;
    }

    const nextSelectionContext = getSelectionContextFromDocument();

    if (!nextSelectionContext) {
      selectionRangeRef.current = null;
      clearPersistentSelectionHighlight();
    }

    setSelectionContext(nextSelectionContext);
  }

  function scheduleSelectionSync(delay = 0) {
    if (typeof window === "undefined") {
      return;
    }

    if (selectionSyncTimerRef.current !== null) {
      window.clearTimeout(selectionSyncTimerRef.current);
    }

    selectionSyncTimerRef.current = window.setTimeout(() => {
      syncReaderSelection();
      selectionSyncTimerRef.current = null;
    }, delay);
  }

  function openAiPanel() {
    if (!selectionContext) {
      return;
    }

    applyPersistentSelectionHighlight();
    aiThreadKeyRef.current = getSelectionThreadKey(selectionContext);
    isSelectionPanelOpenRef.current = true;
    setAiError("");
    resetDialogueSummary();
    setActiveSelectionPanel("ai");
  }

  function openAiPanelFromExplanation(explanation: ActiveExplanation, anchorRect: DOMRect) {
    const nextSelectionContext: ReaderSelectionContext = {
      selectedText: explanation.targetText,
      chapterOrder: explanation.chapterOrder,
      chapterId: activeChapter.id,
      paragraphId: explanation.paragraphId,
      paragraphOrder: explanation.paragraphOrder,
      explanationContext: {
        targetText: explanation.targetText,
        explanation: explanation.explanation
      },
      anchorRect: normalizeAnchorRect(anchorRect)
    };

    clearPersistentSelectionHighlight();
    selectionRangeRef.current = null;
    setSelectionContext(nextSelectionContext);
    aiThreadKeyRef.current = getSelectionThreadKey(nextSelectionContext);
    isSelectionPanelOpenRef.current = true;
    setAiError("");
    resetDialogueSummary();
    setActiveSelectionPanel("ai");
  }

  function openReflectionFromSelection() {
    if (!selectionContext || selectionContext.paragraphOrder === null) {
      return;
    }

    applyPersistentSelectionHighlight();
    aiThreadKeyRef.current = getSelectionThreadKey(selectionContext);
    isSelectionPanelOpenRef.current = true;
    setAiError("");
    setActiveSelectionPanel("reflection");
  }

  function openReflectionPanelFromAi() {
    if (!selectionContext || selectionContext.paragraphOrder === null) {
      return;
    }

    applyPersistentSelectionHighlight();
    aiThreadKeyRef.current = getSelectionThreadKey(selectionContext);
    isSelectionPanelOpenRef.current = true;
    setActiveSelectionPanel("reflection");
  }

  function reopenAiPanelFromReflection() {
    if (!selectionContext) {
      return;
    }

    applyPersistentSelectionHighlight();
    aiThreadKeyRef.current = getSelectionThreadKey(selectionContext);
    isSelectionPanelOpenRef.current = true;
    setActiveSelectionPanel("ai");
  }

  function closeSelectionPanel() {
    clearPersistentSelectionHighlight();
    selectionRangeRef.current = null;
    if (typeof window !== "undefined") {
      window.getSelection()?.removeAllRanges();
    }
    isSelectionPanelOpenRef.current = false;
    setActiveSelectionPanel(null);
    setSelectionContext(null);
    setAiQuestion("");
    setAiTurns([]);
    setAiError("");
    resetDialogueSummary();
    aiThreadKeyRef.current = null;
  }

  function getCurrentSelectionParagraphText() {
    if (!selectionContext) {
      return "";
    }

    const byId = selectionContext.paragraphId
      ? activeChapter.paragraphs.find((paragraph) => paragraph.id === selectionContext.paragraphId)
      : null;
    const byOrder =
      selectionContext.paragraphOrder !== null
        ? activeChapter.paragraphs.find((paragraph) => paragraph.orderIndex === selectionContext.paragraphOrder)
        : null;

    return byId?.content || byOrder?.content || selectionContext.selectedText;
  }

  function getCompletedAiTurnsForSummary() {
    return aiTurns
      .filter((turn) => turn.status === "done" && turn.question.trim() && turn.answer.trim())
      .map((turn) => ({
        question: turn.question,
        answer: turn.answer
      }));
  }

  async function generateDialogueSummary() {
    if (!selectionContext || !selectionContext.paragraphId || selectionContext.paragraphOrder === null) {
      setDialogueSummary({
        status: "error",
        draft: null,
        editableSummary: "",
        error: "这段对话缺少可保存的段落上下文。"
      });
      return;
    }

    const turns = getCompletedAiTurnsForSummary();

    if (turns.length === 0) {
      setDialogueSummary({
        status: "error",
        draft: null,
        editableSummary: "",
        error: "至少需要一轮完整回答后才能生成摘要。"
      });
      return;
    }

    setDialogueSummary({
      status: "generating",
      draft: null,
      editableSummary: "",
      error: ""
    });

    try {
      const response = await fetch("/api/ai/dialogue-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bookId: book.id,
          bookTitle: book.title,
          chapterId: selectionContext.chapterId,
          chapterOrder: selectionContext.chapterOrder,
          chapterTitle: activeChapter.title,
          paragraphId: selectionContext.paragraphId,
          paragraphOrder: selectionContext.paragraphOrder,
          paragraphText: getCurrentSelectionParagraphText(),
          selectedText: selectionContext.selectedText,
          conversationReference: getSelectionThreadKey(selectionContext),
          turns
        })
      });
      const payload = (await response.json()) as DialogueSummaryApiResponse;

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "暂时无法生成对话摘要。");
      }

      if (!isDialogueSummarySuccessResponse(payload)) {
        throw new Error("摘要结果不完整。");
      }

      setDialogueSummary({
        status: "review",
        draft: payload.draft,
        editableSummary: payload.draft.editableSummary,
        error: ""
      });
    } catch (error) {
      setDialogueSummary({
        status: "error",
        draft: null,
        editableSummary: "",
        error: error instanceof Error ? error.message : "暂时无法生成对话摘要。"
      });
    }
  }

  async function saveDialogueSummaryNote() {
    if (
      !selectionContext ||
      !selectionContext.paragraphId ||
      selectionContext.paragraphOrder === null ||
      !dialogueSummary.draft ||
      !dialogueSummary.editableSummary.trim()
    ) {
      return;
    }

    const completedTurns = getCompletedAiTurnsForSummary();

    setDialogueSummary((current) => ({
      ...current,
      status: "saving",
      error: ""
    }));

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bookId: book.id,
          chapterId: selectionContext.chapterId,
          paragraphId: selectionContext.paragraphId,
          sourceType: "dialogue_summary",
          sourceText: dialogueSummary.draft.relatedSourceText || selectionContext.selectedText,
          noteContent: dialogueSummary.editableSummary,
          metadata: {
            noteKind: "dialogue_summary",
            conversationReference: getSelectionThreadKey(selectionContext),
            chapterOrder: selectionContext.chapterOrder,
            paragraphOrder: selectionContext.paragraphOrder,
            selectedText: selectionContext.selectedText,
            summaryDraft: dialogueSummary.draft,
            conversationTurns: completedTurns.slice(-8)
          }
        })
      });
      const payload = await response.json();

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "暂时无法保存摘要。");
      }

      setDialogueSummary((current) => ({
        ...current,
        status: "saved",
        error: ""
      }));
    } catch (error) {
      setDialogueSummary((current) => ({
        ...current,
        status: "review",
        error: error instanceof Error ? error.message : "暂时无法保存摘要。"
      }));
    }
  }

  function jumpToCitation(citation: SelectionAiCitation) {
    const chapterIndex = book.chapters.findIndex((chapter) => chapter.id === citation.chapterId);

    if (chapterIndex === -1) {
      return;
    }

    const chapter = book.chapters[chapterIndex];
    const paragraphId = citation.paragraphIds[0] ?? citation.startParagraphId;
    const paragraph = chapter.paragraphs.find((entry) => entry.id === paragraphId);
    const paragraphOrder = paragraph?.orderIndex ?? citation.startParagraphOrder;

    restoreTargetRef.current = {
      chapterIndex,
      paragraphOrder,
      scrollOffset: 0
    };
    skipNextScrollResetRef.current = true;

    if (chapterIndex === activeChapterIndex && typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        applyRestoreTarget();
      });
      return;
    }

    pendingChapterIndexRef.current = chapterIndex;
    setActiveChapterIndex(chapterIndex);
    updateChapterInUrl(chapter.orderIndex);
  }

  function openChapterEndPanel() {
    if (!hasReadableChapter) {
      return;
    }

    if (isSelectionPanelOpenRef.current) {
      closeSelectionPanel();
    }

    setChapterEndError("");
    setIsChapterEndPanelOpen(true);
  }

  function closeChapterEndPanel() {
    setIsChapterEndPanelOpen(false);
    setChapterEndQuestion("");
    setChapterEndTurns([]);
    setChapterEndError("");
  }

  function openRescuePack() {
    setIsRescuePackOpen(true);

    if (typeof window === "undefined") {
      return;
    }

    window.history.replaceState(null, "", `${pathname}?chapter=${activeChapter.orderIndex}&rescue=1#rescue-pack`);
    window.requestAnimationFrame(() => {
      rescuePackRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function submitAiQuestion() {
    const question = aiQuestion.trim();

    if (!selectionContext || !question) {
      return;
    }

    const currentThreadKey = getSelectionThreadKey(selectionContext);
    const priorTurns = aiThreadKeyRef.current === currentThreadKey ? aiTurns : [];

    if (aiThreadKeyRef.current !== currentThreadKey) {
      aiThreadKeyRef.current = currentThreadKey;
      setAiTurns([]);
    }

    resetDialogueSummary();
    setAiTurns((currentTurns) => [
      ...(aiThreadKeyRef.current === currentThreadKey ? currentTurns : []),
      {
        question,
        answer: "",
        truncated: false,
        citations: [],
        academicRecommendations: [],
        academicSourceLeads: [],
        insufficientEvidence: false,
        status: "pending"
      }
    ]);
    setIsAiSubmitting(true);
    setAiError("");

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, READER_AI_REQUEST_TIMEOUT_MS);

      let response: Response;
      let payload: SelectionAiApiResponse;

      try {
        response = await fetch("/api/ai/selection", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          signal: controller.signal,
          body: JSON.stringify({
            bookId: book.id,
            chapterOrder: selectionContext.chapterOrder,
            paragraphOrder: selectionContext.paragraphOrder,
            selectedText: selectionContext.selectedText,
            explanationMode: aiExplanationMode,
            explanationContext: selectionContext.explanationContext,
            question,
            priorTurns
          })
        });
        const rawText = await response.text();

        if (!rawText.trim()) {
          throw new Error("AI returned an empty response.");
        }

        try {
          payload = JSON.parse(rawText) as SelectionAiApiResponse;
        } catch {
          throw new Error("AI returned an unreadable response.");
        }
      } finally {
        window.clearTimeout(timeoutId);
      }

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Unable to ask AI about this selection.");
      }

      if (!isSelectionAiSuccessResponse(payload) || payload.answer.trim().length === 0) {
        throw new Error("AI returned an incomplete answer.");
      }

      setAiTurns((currentTurns) => {
        const baseTurns = aiThreadKeyRef.current === currentThreadKey ? currentTurns : [];
        let replaced = false;
        const nextTurns = baseTurns.map((turn, index, turns) => {
          const isLastPendingTurn =
            index === turns.length - 1 && turn.status === "pending" && turn.question === question;

          if (!isLastPendingTurn) {
            return turn;
          }

          replaced = true;
          return {
            question,
            answer: payload.answer,
            truncated: payload.truncated,
            citations: payload.citations,
            academicRecommendations: payload.academicRecommendations,
            academicSourceLeads: payload.academicSourceLeads,
            insufficientEvidence: payload.insufficientEvidence,
            status: "done" as const
          };
        });

        if (replaced) {
          return nextTurns;
        }

        return [
          ...baseTurns,
          {
            question,
            answer: payload.answer,
            truncated: payload.truncated,
            citations: payload.citations,
            academicRecommendations: payload.academicRecommendations,
            academicSourceLeads: payload.academicSourceLeads,
            insufficientEvidence: payload.insufficientEvidence,
            status: "done" as const
          }
        ];
      });
      setAiQuestion("");
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "AI 请求超时了，请再试一次。"
          : error instanceof Error
            ? error.message
            : "Unable to ask AI about this selection.";
      setAiTurns((currentTurns) => {
        const baseTurns = aiThreadKeyRef.current === currentThreadKey ? currentTurns : [];
        let replaced = false;
        const nextTurns = baseTurns.map((turn, index, turns) => {
          const isLastPendingTurn =
            index === turns.length - 1 && turn.status === "pending" && turn.question === question;

          if (!isLastPendingTurn) {
            return turn;
          }

          replaced = true;
          return {
            question,
            answer: "",
            truncated: false,
            citations: [],
            academicRecommendations: [],
            academicSourceLeads: [],
            insufficientEvidence: false,
            status: "error" as const,
            errorMessage: message
          };
        });

        if (replaced) {
          return nextTurns;
        }

        return [
          ...baseTurns,
          {
            question,
            answer: "",
            truncated: false,
            citations: [],
            academicRecommendations: [],
            academicSourceLeads: [],
            insufficientEvidence: false,
            status: "error" as const,
            errorMessage: message
          }
        ];
      });
      setAiError(message);
    } finally {
      setIsAiSubmitting(false);
    }
  }

  async function submitChapterEndQuestion() {
    const question = chapterEndQuestion.trim();

    if (!question || !hasReadableChapter) {
      return;
    }

    setIsChapterEndSubmitting(true);
    setChapterEndError("");

    try {
      const response = await fetch("/api/ai/chapter-end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bookId: book.id,
          chapterOrder: activeChapter.orderIndex,
          question
        })
      });
      const payload = (await response.json()) as ChapterEndAiApiResponse;

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Unable to chat with Woolf about this chapter.");
      }

      setChapterEndTurns((currentTurns) => [
        ...currentTurns,
        {
          question,
          answer: payload.answer,
          truncated: payload.truncated
        }
      ]);
      setChapterEndQuestion("");
    } catch (error) {
      setChapterEndError(error instanceof Error ? error.message : "Unable to chat with Woolf about this chapter.");
    } finally {
      setIsChapterEndSubmitting(false);
    }
  }

  function formatCitationParagraphRange(citation: SelectionAiCitation) {
    if (citation.startParagraphOrder === citation.endParagraphOrder) {
      return `段落 ${citation.startParagraphOrder}`;
    }

    return `段落 ${citation.startParagraphOrder}-${citation.endParagraphOrder}`;
  }

  function getSourceLeadGroups(turn: SelectionAiTurn) {
    const leads = turn.academicSourceLeads ?? [];
    const displayOrder = ["background_lead", "bibliography_information", "publication_information", "archive_lead"] as const;

    return displayOrder
      .map((displayClass) => {
        const items = leads.filter((lead) => lead.displayClass === displayClass);
        return {
          displayClass,
          label: items[0]?.label ?? "",
          items
        };
      })
      .filter((group) => group.items.length > 0);
  }

  useEffect(() => {
    if (restoredBookIdRef.current === book.id) {
      return;
    }

    userIdRef.current = readerUserId ?? getCurrentReaderUserId();
    const savedProgress = getReadingProgress(userIdRef.current, book.id);
    const initialParagraphTarget = initialParagraphId
      ? book.chapters
          .map((chapter, chapterIndex) => ({
            chapter,
            chapterIndex,
            paragraph: chapter.paragraphs.find((entry) => entry.id === initialParagraphId)
          }))
          .find((entry) => entry.paragraph)
      : null;

    if (initialParagraphTarget?.paragraph) {
      restoreTargetRef.current = {
        chapterIndex: initialParagraphTarget.chapterIndex,
        paragraphOrder: initialParagraphTarget.paragraph.orderIndex,
        scrollOffset: 0
      };
      skipNextScrollResetRef.current = true;
      setActiveChapterIndex(initialParagraphTarget.chapterIndex);
      updateChapterInUrl(initialParagraphTarget.chapter.orderIndex);
      writeLastOpenSignature(`${book.id}:${initialParagraphTarget.chapter.orderIndex}:${initialParagraphTarget.paragraph.orderIndex}`);
    } else if (savedProgress) {
      const restoredChapterIndex = clampIndex(savedProgress.chapterOrder - 1, book.chapters.length - 1);
      const chapter = book.chapters[restoredChapterIndex];
      const lastParagraphOrder = chapter.paragraphs[chapter.paragraphs.length - 1]?.orderIndex ?? 1;
      restoreTargetRef.current = {
        chapterIndex: restoredChapterIndex,
        paragraphOrder: Math.min(Math.max(savedProgress.paragraphOrder, 1), lastParagraphOrder),
        scrollOffset: Math.max(savedProgress.scrollOffset, 0)
      };
      skipNextScrollResetRef.current = true;
      setActiveChapterIndex(restoredChapterIndex);
      updateChapterInUrl(chapter.orderIndex);
      const restoredSignature = `${book.id}:${savedProgress.chapterOrder}:${savedProgress.paragraphOrder}`;
      const lastOpenSignature = readLastOpenSignature();

      if (lastOpenSignature === restoredSignature) {
        recordReaderBehavior("page_reopened_without_progress", {
          chapterOrder: savedProgress.chapterOrder,
          paragraphOrder: savedProgress.paragraphOrder
        });
      }

      writeLastOpenSignature(restoredSignature);
    } else {
      const chapter = book.chapters[clampIndex(initialChapterIndex, book.chapters.length - 1)];
      updateChapterInUrl(chapter.orderIndex);
      writeLastOpenSignature(`${book.id}:${chapter.orderIndex}:1`);
    }

    recordReaderBehavior("reader_opened", {
      chapterOrder: book.chapters[clampIndex(initialChapterIndex, book.chapters.length - 1)]?.orderIndex ?? null,
      paragraphOrder: savedProgress?.paragraphOrder ?? null
    });
    restoredBookIdRef.current = book.id;
    initializedRef.current = true;
  }, [book, initialChapterIndex, initialParagraphId, pathname, readerUserId, router]);

  useEffect(() => {
    if (!initializedRef.current) {
      return;
    }

    const safeInitialChapterIndex = clampIndex(initialChapterIndex, Math.max(book.chapters.length - 1, 0));

    if (restoreTargetRef.current) {
      return;
    }

    if (pendingChapterIndexRef.current !== null) {
      if (safeInitialChapterIndex === pendingChapterIndexRef.current) {
        pendingChapterIndexRef.current = null;
      }
      return;
    }

    if (safeInitialChapterIndex !== activeChapterIndex) {
      setActiveChapterIndex(safeInitialChapterIndex);
      skipNextScrollResetRef.current = false;
      paragraphRefs.current.clear();
    }
  }, [activeChapterIndex, book.chapters.length, initialChapterIndex]);

  useEffect(() => {
    if (!initializedRef.current || typeof window === "undefined") {
      return;
    }

    const chapterViewSignature = `${book.id}:${activeChapter.orderIndex}`;

    if (lastChapterViewEventRef.current !== chapterViewSignature) {
      lastChapterViewEventRef.current = chapterViewSignature;
      recordReaderBehavior("chapter_viewed", {
        chapterOrder: activeChapter.orderIndex,
        paragraphOrder: activeChapter.paragraphs[0]?.orderIndex ?? null,
        metadata: {
          paragraphCount: activeChapter.paragraphs.length
        }
      });
    }

    if (restoreTargetRef.current?.chapterIndex === activeChapterIndex) {
      window.requestAnimationFrame(() => {
        applyRestoreTarget();
      });
      return;
    }

    if (!skipNextScrollResetRef.current) {
      window.scrollTo({ top: 0, behavior: "auto" });
      window.setTimeout(() => {
        saveProgressForCurrentView();
      }, 60);
    }

    skipNextScrollResetRef.current = false;
  }, [activeChapterIndex, activeChapter.orderIndex, activeChapter.paragraphs.length, activeChapter.paragraphs[0]?.orderIndex, book.id]);

  useEffect(() => {
    if (!hasReadableChapter) {
      setChapterEndPromptQuestion("");
      return;
    }

    const requestId = chapterEndQuestionRequestIdRef.current + 1;
    chapterEndQuestionRequestIdRef.current = requestId;
    setChapterEndPromptQuestion(buildChapterEndFallbackQuestionForReader(activeChapter));

    void (async () => {
      try {
        const response = await fetch("/api/ai/chapter-end-question", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            bookId: book.id,
            chapterOrder: activeChapter.orderIndex
          })
        });
        const payload = (await response.json()) as ChapterEndAiQuestionApiResponse;

        if (requestId !== chapterEndQuestionRequestIdRef.current) {
          return;
        }

        if (!response.ok || "error" in payload) {
          setChapterEndPromptQuestion(buildChapterEndFallbackQuestionForReader(activeChapter));
          return;
        }

        setChapterEndPromptQuestion(payload.question);
      } catch {
        if (requestId === chapterEndQuestionRequestIdRef.current) {
          setChapterEndPromptQuestion(buildChapterEndFallbackQuestionForReader(activeChapter));
        }
      }
    })();
  }, [activeChapter, activeChapter.orderIndex, book.id, hasReadableChapter]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onScroll = () => {
      scheduleProgressSave();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveProgressForCurrentView();
      }
    };
    const onBeforeUnload = () => {
      saveProgressForCurrentView();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      cancelSmartMarkLongPress();
      cancelSmartMarkHide();
    };
  }, [activeChapterIndex, book.id]);

  useEffect(() => {
    isSelectionPanelOpenRef.current = activeSelectionPanel !== null;
  }, [activeSelectionPanel]);

  useEffect(() => {
    if (activeSelectionPanel !== "ai" || (aiTurns.length === 0 && !aiError)) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (aiConversationRef.current) {
        aiConversationRef.current.scrollTo({ top: aiConversationRef.current.scrollHeight, behavior: "smooth" });
        return;
      }

      if (aiPanelRef.current) {
        aiPanelRef.current.scrollTo({ top: aiPanelRef.current.scrollHeight, behavior: "smooth" });
      }
    });
  }, [activeSelectionPanel, aiTurns, aiError]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedMode = window.localStorage.getItem(READER_AI_MODE_STORAGE_KEY);

    if (storedMode === "plain" || storedMode === "close_reading") {
      setAiExplanationMode(storedMode);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(READER_AI_MODE_STORAGE_KEY, aiExplanationMode);
  }, [aiExplanationMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);

    if (url.searchParams.get("rescue") === "1" || url.hash === "#rescue-pack") {
      setIsRescuePackOpen(true);
      window.requestAnimationFrame(() => {
        rescuePackRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
      });
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const onSelectionChange = () => {
      scheduleSelectionSync(0);
    };
    const onSelectionSettled = () => {
      scheduleSelectionSync(80);
    };

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("mouseup", onSelectionSettled);
    document.addEventListener("keyup", onSelectionSettled);
    document.addEventListener("touchend", onSelectionSettled);
    document.addEventListener("pointerup", onSelectionSettled);

    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("mouseup", onSelectionSettled);
      document.removeEventListener("keyup", onSelectionSettled);
      document.removeEventListener("touchend", onSelectionSettled);
      document.removeEventListener("pointerup", onSelectionSettled);
      clearPersistentSelectionHighlight();
      if (selectionSyncTimerRef.current !== null) {
        window.clearTimeout(selectionSyncTimerRef.current);
      }
    };
  }, [activeChapterIndex, activeChapter.orderIndex]);

  const previousChapterIndex = activeChapterIndex > 0 ? activeChapterIndex - 1 : null;
  const nextChapterIndex = activeChapterIndex < book.chapters.length - 1 ? activeChapterIndex + 1 : null;
  const completedSummaryTurns = getCompletedAiTurnsForSummary();
  const canSummarizeDialogue =
    Boolean(selectionContext?.paragraphId) &&
    selectionContext?.paragraphOrder !== null &&
    completedSummaryTurns.length > 0 &&
    dialogueSummary.status !== "generating" &&
    dialogueSummary.status !== "saving";
  const aiEntryLayer =
    selectionContext && activeSelectionPanel === null && typeof document !== "undefined"
      ? createPortal(
          <div className="reader-ai-entry" role="status" style={getEntryStyle(selectionContext)}>
            <p className="reader-ai-entry-copy">"{selectionContext.selectedText}"</p>
            <div className="reader-ai-entry-actions">
              <button className="primary-link button-reset" onClick={openAiPanel} type="button">
                Ask Woolf
              </button>
              {selectionContext.paragraphOrder !== null ? (
                <button className="secondary-link button-reset" onClick={openReflectionFromSelection} type="button">
                  写下感受
                </button>
              ) : null}
              {selectionContext.paragraphId ? (
                <SaveNoteButton
                  payload={{
                    bookId: book.id,
                    chapterId: selectionContext.chapterId,
                    paragraphId: selectionContext.paragraphId,
                    sourceType: "selected_text",
                    sourceText: selectionContext.selectedText,
                    metadata: {
                      chapterOrder: selectionContext.chapterOrder,
                      paragraphOrder: selectionContext.paragraphOrder
                    }
                  }}
                />
              ) : null}
            </div>
          </div>,
          document.body
        )
      : null;
  const aiPanelLayer =
    activeSelectionPanel === "ai" && selectionContext && typeof document !== "undefined"
      ? createPortal(
          <aside
            className="reader-ai-panel"
            aria-label="Ask Woolf about selected text"
            ref={aiPanelRef}
            style={getPanelStyle(selectionContext)}
          >
            <div className="reader-ai-panel-header">
              <div>
                <p className="page-eyebrow">Selected text</p>
                <p className="reader-ai-selection">"{selectionContext.selectedText}"</p>
                {selectionContext.explanationContext ? (
                  <p className="reader-ai-context-note">
                    From explanation: {selectionContext.explanationContext.explanation}
                  </p>
                ) : null}
              </div>
              <div className="reader-ai-panel-header-actions">
                {selectionContext.paragraphOrder !== null ? (
                  <button className="reader-ai-panel-toggle button-reset" onClick={openReflectionPanelFromAi} type="button">
                    写感受
                  </button>
                ) : null}
                <button aria-label="关闭" className="reader-ai-panel-close button-reset" onClick={closeSelectionPanel} type="button">
                  ×
                </button>
              </div>
            </div>
            <div className="reader-ai-conversation" ref={aiConversationRef}>
              {aiTurns.length > 0 ? (
                <div className="reader-ai-transcript">
                  {aiTurns.map((turn, index) => (
                    <div className="reader-ai-turn" key={`${index}-${turn.question}`}>
                      <div className="reader-ai-turn-question">
                        <p className="page-eyebrow">Question</p>
                        <p>{turn.question}</p>
                      </div>
                      <div className="reader-ai-answer">
                        <p className="page-eyebrow">Answer</p>
                        {turn.status === "pending" ? <p>Thinking...</p> : null}
                        {turn.status === "error" ? (
                          <p className="reader-ai-error">{turn.errorMessage || "Unable to get an answer for this turn."}</p>
                        ) : null}
                        {turn.status !== "pending" && turn.status !== "error" ? <p>{turn.answer}</p> : null}
                        {turn.status === "done" && selectionContext.paragraphId ? (
                          <div className="reader-ai-answer-actions">
                            <div className="reader-ai-answer-actions-primary">
                              <SaveNoteButton
                                payload={{
                                  bookId: book.id,
                                  chapterId: selectionContext.chapterId,
                                  paragraphId: selectionContext.paragraphId,
                                  sourceType: "ai_answer",
                                  sourceText: selectionContext.selectedText,
                                  aiContent: turn.answer,
                                  metadata: {
                                    question: turn.question,
                                    chapterOrder: selectionContext.chapterOrder,
                                    paragraphOrder: selectionContext.paragraphOrder
                                  }
                                }}
                              />
                              <button
                                className="secondary-link button-reset"
                                disabled={!canSummarizeDialogue}
                                onClick={generateDialogueSummary}
                                type="button"
                              >
                                {dialogueSummary.status === "generating" ? "生成中..." : "生成摘要"}
                              </button>
                            </div>
                            <FeedbackReportAction
                              className="reader-ai-feedback"
                              mode="feedback"
                              targetId={`${getSelectionThreadKey(selectionContext)}:${index}`}
                              targetLabel="这条 AI 回答"
                              targetType="ai_answer"
                              metadata={{
                                surface: "selection_ai_panel",
                                bookId: book.id,
                                chapterId: selectionContext.chapterId,
                                chapterOrder: selectionContext.chapterOrder,
                                paragraphId: selectionContext.paragraphId,
                                paragraphOrder: selectionContext.paragraphOrder,
                                question: turn.question.slice(0, 500),
                                answerExcerpt: turn.answer.slice(0, 800),
                                selectedTextExcerpt: selectionContext.selectedText.slice(0, 500),
                                citationCount: turn.citations?.length ?? 0,
                                academicRecommendationCount: turn.academicRecommendations?.length ?? 0,
                                academicSourceLeadCount: turn.academicSourceLeads?.length ?? 0,
                                insufficientEvidence: turn.insufficientEvidence ?? false
                              }}
                            />
                          </div>
                        ) : null}
                        {turn.insufficientEvidence ? (
                          <p className="reader-ai-insufficient-note">
                            Evidence was insufficient for a stronger grounded answer, so no citation was returned for this turn.
                          </p>
                        ) : null}
                        {turn.status !== "pending" &&
                        turn.status !== "error" &&
                        ((turn.academicRecommendations?.length ?? 0) > 0 ||
                          (turn.academicSourceLeads?.length ?? 0) > 0 ||
                          (turn.citations?.length ?? 0) > 0) ? (
                          <details className="reader-ai-citations">
                            <summary>
                              Sources (
                              {(turn.academicRecommendations?.length ?? 0) +
                                (turn.academicSourceLeads?.length ?? 0) +
                                (turn.citations?.length ?? 0)}
                              )
                            </summary>
                            {(turn.academicRecommendations?.length ?? 0) > 0 ? (
                              <section className="reader-ai-source-section">
                                <p className="reader-ai-academic-section-title">学术关联</p>
                                <AcademicRecommendationList recommendations={turn.academicRecommendations ?? []} embedded />
                              </section>
                            ) : null}
                            {getSourceLeadGroups(turn).map((group) => (
                              <section className="reader-ai-source-section" key={group.displayClass}>
                                <p className="reader-ai-citation-section-title">{group.label}</p>
                                <div className="reader-ai-academic-list">
                                  {group.items.map((lead) => (
                                    <article className="reader-ai-academic-item" key={lead.id}>
                                      <div className="reader-ai-academic-heading">
                                        <p className="reader-ai-academic-title">{lead.title}</p>
                                        <p className="reader-ai-academic-meta">
                                          {lead.sourceName}
                                          {lead.year ? ` · ${lead.year}` : ""}
                                        </p>
                                      </div>
                                      {lead.summary ? <p className="reader-ai-academic-summary">{lead.summary}</p> : null}
                                      {lead.url ? (
                                        <a className="reader-ai-academic-link" href={lead.url} rel="noreferrer" target="_blank">
                                          查看来源
                                        </a>
                                      ) : null}
                                    </article>
                                  ))}
                                </div>
                              </section>
                            ))}
                            {turn.citations && turn.citations.length > 0 ? (
                              <section className="reader-ai-source-section">
                                <p className="reader-ai-citation-section-title">文章来源</p>
                                <div className="reader-ai-citation-list">
                                  {turn.citations.map((citation) => (
                                    <button
                                      className="reader-ai-citation button-reset"
                                      key={`${turn.question}-${citation.chunkId}`}
                                      onClick={() => jumpToCitation(citation)}
                                      type="button"
                                    >
                                      <span className="reader-ai-citation-meta">
                                        {citation.bookTitle} · {citation.chapterTitle || "Untitled chapter"} ·{" "}
                                        {formatCitationParagraphRange(citation)}
                                      </span>
                                      <span className="reader-ai-citation-quote">{citation.quote}</span>
                                    </button>
                                  ))}
                                </div>
                              </section>
                            ) : null}
                          </details>
                        ) : null}
                        {turn.status !== "pending" && turn.status !== "error" && turn.truncated ? (
                          <p className="reader-ai-truncation-note">
                            This answer was cut off by the model length limit. Ask a follow-up question to continue.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {aiError ? <p className="reader-ai-error">{aiError}</p> : null}
              {completedSummaryTurns.length > 0 &&
              selectionContext.paragraphId &&
              dialogueSummary.status !== "idle" ? (
                <section className="dialogue-summary-panel" aria-label="对话摘要">
                  {dialogueSummary.status === "generating" ? <p className="dialogue-summary-note">正在生成摘要...</p> : null}
                  {dialogueSummary.status === "saved" ? <p className="dialogue-summary-success">摘要已保存到个人笔记。</p> : null}
                  {dialogueSummary.error ? <p className="reader-ai-error">{dialogueSummary.error}</p> : null}
                  {dialogueSummary.draft && (dialogueSummary.status === "review" || dialogueSummary.status === "saving") ? (
                    <div className="dialogue-summary-review">
                      <div className="dialogue-summary-fields">
                        {dialogueSummary.draft.coreQuestions.length > 0 ? (
                          <div>
                            <p className="page-eyebrow">核心问题</p>
                            <ul>
                              {dialogueSummary.draft.coreQuestions.map((question) => (
                                <li key={question}>{question}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {dialogueSummary.draft.answerPoints.length > 0 ? (
                          <div>
                            <p className="page-eyebrow">回答要点</p>
                            <ul>
                              {dialogueSummary.draft.answerPoints.map((point) => (
                                <li key={point}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {dialogueSummary.draft.followUpQuestions.length > 0 ? (
                          <div>
                            <p className="page-eyebrow">继续思考</p>
                            <ul>
                              {dialogueSummary.draft.followUpQuestions.map((question) => (
                                <li key={question}>{question}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                      <label className="dialogue-summary-editor">
                        <span>编辑后保存为笔记</span>
                        <textarea
                          onChange={(event) =>
                            setDialogueSummary((current) => ({
                              ...current,
                              editableSummary: event.target.value
                            }))
                          }
                          rows={5}
                          value={dialogueSummary.editableSummary}
                        />
                      </label>
                      <div className="dialogue-summary-actions">
                        <button
                          className="primary-link button-reset"
                          disabled={dialogueSummary.status === "saving" || dialogueSummary.editableSummary.trim().length === 0}
                          onClick={saveDialogueSummaryNote}
                          type="button"
                        >
                          {dialogueSummary.status === "saving" ? "保存中..." : "保存为笔记"}
                        </button>
                        <button
                          className="secondary-link button-reset"
                          disabled={dialogueSummary.status === "saving"}
                          onClick={resetDialogueSummary}
                          type="button"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
            <div className="reader-ai-composer">
              {aiError ? <p className="reader-ai-inline-error">{aiError}</p> : null}
              <div className="reader-ai-mode-toggle" role="group" aria-label="Explanation mode">
                <button
                  className={`button-reset ${aiExplanationMode === "plain" ? "is-active" : ""}`}
                  onClick={() => setAiExplanationMode("plain")}
                  type="button"
                >
                  通俗解释
                </button>
                <button
                  className={`button-reset ${aiExplanationMode === "close_reading" ? "is-active" : ""}`}
                  onClick={() => setAiExplanationMode("close_reading")}
                  type="button"
                >
                  贴近原文
                </button>
              </div>
              <label className="reader-ai-question">
                <span>Your question</span>
                <textarea
                  onChange={(event) => setAiQuestion(event.target.value)}
                  placeholder="Ask about this passage"
                  rows={3}
                  value={aiQuestion}
                />
              </label>
              <div className="reader-ai-actions">
                <button
                  className="primary-link button-reset"
                  disabled={isAiSubmitting || aiQuestion.trim().length === 0}
                  onClick={submitAiQuestion}
                  type="button"
                >
                  {isAiSubmitting ? "Thinking..." : "Send question"}
                </button>
              </div>
            </div>
          </aside>,
          document.body
        )
      : null;
  const reflectionSelectionContext: ReflectionSelectionContext | null =
    activeSelectionPanel === "reflection" &&
    selectionContext !== null &&
    selectionContext.paragraphId !== null &&
    selectionContext.paragraphOrder !== null
      ? {
          selectedText: selectionContext.selectedText,
          chapterId: selectionContext.chapterId,
          chapterOrder: selectionContext.chapterOrder,
          paragraphId: selectionContext.paragraphId,
          paragraphOrder: selectionContext.paragraphOrder,
          explanationContext: selectionContext.explanationContext,
          anchorRect: selectionContext.anchorRect
        }
      : null;
  const reflectionPanelLayer =
    reflectionSelectionContext && typeof document !== "undefined"
      ? createPortal(
          <aside
            className="reader-ai-panel"
            aria-label="Write a reflection about selected text"
            style={getPanelStyle(reflectionSelectionContext)}
          >
            <div className="reader-ai-panel-header">
              <div>
                <p className="page-eyebrow">Selected text</p>
                <p className="reader-ai-selection">"{reflectionSelectionContext.selectedText}"</p>
              </div>
              <div className="reader-ai-panel-header-actions">
                <button className="reader-ai-panel-toggle button-reset" onClick={reopenAiPanelFromReflection} type="button">
                  Ask Woolf
                </button>
                <button aria-label="关闭" className="reader-ai-panel-close button-reset" onClick={closeSelectionPanel} type="button">
                  ×
                </button>
              </div>
            </div>
            <ReflectionFeedPanel
              bookId={book.id}
              chapterOrder={reflectionSelectionContext.chapterOrder}
              currentUserId={readerUserId}
              paragraphOrder={reflectionSelectionContext.paragraphOrder}
              variant="overlay"
            />
          </aside>,
          document.body
        )
      : null;

  return (
    <>
      <header className="page-header">
        <div>
          <p className="page-eyebrow">Reader</p>
          <h1 className="page-title">{book.title}</h1>
          <p className="page-subtitle">
            The reading surface remembers where this signed-in reader left off and restores the
            nearest valid place on re-entry.
          </p>
          {showAiEntryHint ? (
            <div className="reader-ai-deeplink-note" role="status">
              <p>Ask Woolf 已准备好。请先在正文中选中一段文字，再点击浮层里的 Ask Woolf 提问。</p>
              <button className="button-reset" onClick={() => setShowAiEntryHint(false)} type="button">
                Hide
              </button>
            </div>
          ) : null}
        </div>
        <Link className="secondary-link" href="/bookshelf">
          Back to bookshelf
        </Link>
      </header>

      <section className="reader-layout">
        <article className="soft-card reader-frame">
          <div className="reader-hero">
            <div className="reader-kicker">
              <span>{book.author}</span>
              <span>
                Chapter {activeChapterIndex + 1} / {book.chapters.length}
              </span>
            </div>
            <h2 className="reader-book-title">{book.title}</h2>
            <h3 className="reader-chapter-title">
              {activeChapter.title || `Chapter ${activeChapterIndex + 1}`}
            </h3>
            {book.description ? <p className="reader-description">{book.description}</p> : null}
          </div>

          <div className="reader-toolbar">
            <ChapterNavigation
              nextChapterIndex={nextChapterIndex}
              onSelect={handleChapterSelect}
              previousChapterIndex={previousChapterIndex}
            />
            <div className="reader-progress">
              <span>{activeChapter.paragraphs.length} paragraphs in this chapter</span>
              <span className="reader-progress-note">{progressLabel}</span>
            </div>
          </div>

          <RescuePackReminder
            bookId={book.id}
            bookTitle={book.title}
            chapterOrder={activeChapter.orderIndex}
            onOpenRescuePack={openRescuePack}
          />

          <div className="reader-body" ref={readerBodyRef}>
            {activeChapter.paragraphs.map((paragraph) => {
              const paragraphExplanation =
                activeExplanation?.chapterOrder === activeChapter.orderIndex &&
                activeExplanation.paragraphId === paragraph.id
                  ? activeExplanation
                  : null;

              return (
                <div className="reader-paragraph-group" key={`${activeChapter.orderIndex}-${paragraph.orderIndex}`}>
                  <div
                    className="reader-paragraph"
                    data-paragraph-id={paragraph.id}
                    data-paragraph-order={paragraph.orderIndex}
                    data-reader-paragraph="true"
                    id={`paragraph-${activeChapter.orderIndex}-${paragraph.orderIndex}`}
                    ref={(element) => {
                      if (element) {
                        paragraphRefs.current.set(paragraph.orderIndex, element);
                      } else {
                        paragraphRefs.current.delete(paragraph.orderIndex);
                      }
                    }}
                  >
                    {getParagraphSegments(paragraph).map((segment, index) => {
                      if (!segment.mark) {
                        return <span key={`${paragraph.id}-text-${index}`}>{segment.text}</span>;
                      }

                      const mark = segment.mark;
                      const markExplanation = paragraphExplanation?.key === getMarkKey(mark) ? paragraphExplanation : null;

                      return (
                        <span className="reader-smart-mark-wrap" key={`${paragraph.id}-mark-${mark.startOffset}-${index}`}>
                          <button
                            aria-expanded={Boolean(markExplanation)}
                            className={`reader-smart-mark button-reset is-${mark.markType}`}
                            data-mark-type={mark.markType}
                            onClick={(event) => event.preventDefault()}
                            onContextMenu={(event) => event.preventDefault()}
                            onFocus={() => revealExplanation(mark)}
                            onBlur={scheduleSmartMarkHide}
                            onMouseEnter={() => revealExplanation(mark)}
                            onMouseLeave={scheduleSmartMarkHide}
                            onPointerCancel={cancelSmartMarkLongPress}
                            onPointerDown={(event) => startSmartMarkLongPress(mark, event.pointerType)}
                            onPointerLeave={cancelSmartMarkLongPress}
                            onPointerUp={cancelSmartMarkLongPress}
                            type="button"
                          >
                            {segment.text}
                          </button>
                          {markExplanation ? (
                            <span
                              className="reader-explanation"
                              data-mark-type={markExplanation.markType}
                              onMouseEnter={cancelSmartMarkHide}
                              onMouseLeave={scheduleSmartMarkHide}
                              role="note"
                            >
                              <span className="reader-explanation-term">{markExplanation.targetText}</span>
                              <span className="reader-explanation-copy">{markExplanation.explanation}</span>
                              <span className="reader-explanation-actions">
                                <SaveNoteButton
                                  payload={{
                                    bookId: book.id,
                                    chapterId: activeChapter.id,
                                    paragraphId: markExplanation.paragraphId,
                                    sourceType: "smart_mark_explanation",
                                    sourceText: markExplanation.targetText,
                                    aiContent: markExplanation.explanation,
                                    metadata: {
                                      markType: markExplanation.markType,
                                      chapterOrder: markExplanation.chapterOrder,
                                      paragraphOrder: markExplanation.paragraphOrder
                                    }
                                  }}
                                />
                                <button
                                  className="secondary-link button-reset"
                                  onClick={(event) =>
                                    openAiPanelFromExplanation(markExplanation, event.currentTarget.getBoundingClientRect())
                                  }
                                  type="button"
                                >
                                  More
                                </button>
                              </span>
                            </span>
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {hasReadableChapter ? (
            <section
              className={`reader-rescue-pack${isRescuePackOpen ? " is-open" : ""}`}
              id="rescue-pack"
              ref={rescuePackRef}
              aria-label="阅读救急包"
            >
              <div>
                <p className="page-eyebrow">Rescue pack</p>
                <h4 className="reader-rescue-pack-title">3 分钟救急包</h4>
              </div>
              <p className="reader-rescue-pack-copy">
                救急包内容将在 F37 接入。现在你可以先把注意力放回本章：看一眼章节标题，回到当前段落，再问自己这一段正在推进哪个问题。
              </p>
              <div className="reader-rescue-pack-actions">
                <button className="secondary-link button-reset" onClick={() => setIsRescuePackOpen(false)} type="button">
                  收起
                </button>
              </div>
            </section>
          ) : null}

          {hasReadableChapter ? (
            <section className="reader-chapter-end">
              <div className="reader-chapter-end-intro">
                <div>
                  <p className="page-eyebrow">Chapter end</p>
                  <h4 className="reader-chapter-end-title">与伍尔夫聊聊</h4>
                </div>
                <p className="reader-chapter-end-copy">
                  读完这一章后，可以围绕本章内容停留片刻，向伍尔夫追问一句。
                </p>
              </div>
              {chapterEndPromptQuestion ? (
                <aside className="reader-chapter-end-question soft-card" aria-label="Chapter-end AI question">
                  <p className="page-eyebrow">A question from Woolf</p>
                  <p className="reader-chapter-end-question-copy">{chapterEndPromptQuestion}</p>
                </aside>
              ) : null}
              <div className="reader-chapter-end-controls">
                <button className="primary-link button-reset" onClick={openChapterEndPanel} type="button">
                  与伍尔夫聊聊
                </button>
              </div>

              {isChapterEndPanelOpen ? (
                <div className="reader-chapter-end-panel soft-card" aria-label="Chat with Woolf about this chapter">
                  <div className="reader-ai-panel-header">
                    <div>
                      <p className="page-eyebrow">Current chapter</p>
                      <p className="reader-ai-selection">
                        第 {activeChapter.orderIndex} 章
                        {activeChapter.title ? ` · ${activeChapter.title}` : ""}
                      </p>
                      <p className="reader-chapter-end-meta">
                        本章已读完 · {activeChapter.paragraphs.length} 段内容已载入
                      </p>
                    </div>
                    <button className="secondary-link button-reset" onClick={closeChapterEndPanel} type="button">
                      Close
                    </button>
                  </div>

                  <div className="reader-ai-conversation">
                    {chapterEndTurns.length > 0 ? (
                      <div className="reader-ai-transcript">
                        {chapterEndTurns.map((turn, index) => (
                          <div className="reader-ai-turn" key={`${activeChapter.orderIndex}-${index}-${turn.question}`}>
                            <div className="reader-ai-turn-question">
                              <p className="page-eyebrow">Question</p>
                              <p>{turn.question}</p>
                            </div>
                            <div className="reader-ai-answer">
                              <p className="page-eyebrow">Answer</p>
                              <p>{turn.answer}</p>
                              {turn.truncated ? (
                                <p className="reader-ai-truncation-note">
                                  This answer was cut off by the model length limit. Ask another question to continue.
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {chapterEndError ? <p className="reader-ai-error">{chapterEndError}</p> : null}
                  </div>

                  <div className="reader-ai-composer">
                    <label className="reader-ai-question">
                      <span>Your question</span>
                      <textarea
                        onChange={(event) => setChapterEndQuestion(event.target.value)}
                        placeholder="读完这一章后，你想继续追问伍尔夫什么？"
                        rows={3}
                        value={chapterEndQuestion}
                      />
                    </label>
                    <div className="reader-ai-actions">
                      <button
                        className="primary-link button-reset"
                        disabled={isChapterEndSubmitting || chapterEndQuestion.trim().length === 0}
                        onClick={submitChapterEndQuestion}
                        type="button"
                      >
                        {isChapterEndSubmitting ? "Thinking..." : "Send question"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="reader-bottom-nav">
            <ChapterNavigation
              nextChapterIndex={nextChapterIndex}
              onSelect={handleChapterSelect}
              previousChapterIndex={previousChapterIndex}
            />
          </div>
        </article>

        <aside className="soft-card reader-sidebar">
          <p className="page-eyebrow">Chapters</p>
          <div className="chapter-list">
            {book.chapters.map((entry, index) => (
              <button
                className={`chapter-link button-reset${index === activeChapterIndex ? " is-active" : ""}`}
                key={`${entry.orderIndex}-${entry.title}`}
                onClick={() => handleChapterSelect(index)}
                type="button"
              >
                {entry.title || `Chapter ${index + 1}`}
              </button>
            ))}
          </div>
        </aside>
      </section>
      {aiEntryLayer}
      {aiPanelLayer}
      {reflectionPanelLayer}
    </>
  );
}
