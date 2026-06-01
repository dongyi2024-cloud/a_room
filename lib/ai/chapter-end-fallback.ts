import { getQuestionMark, inferResponseLanguage } from "@/lib/ai/response-language";
import type { ReaderChapter } from "@/types/reader";

type ChapterEndFallbackInput = {
  chapterTitle: string;
  chapterContext: string;
};

function normalizeTitle(title: string) {
  const normalized = title.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  if (/^(chapter|chapitre|section)\s+\d+$/i.test(normalized)) {
    return "";
  }

  if (/^第[0-9一二三四五六七八九十百千]+章$/.test(normalized)) {
    return "";
  }

  return normalized;
}

export function buildChapterEndFallbackQuestion(input: ChapterEndFallbackInput) {
  const chapterTitle = normalizeTitle(input.chapterTitle);
  const normalizedContext = input.chapterContext.replace(/\s+/g, " ").trim();
  const responseLanguage = inferResponseLanguage([input.chapterTitle, input.chapterContext], "zh");
  const questionMark = getQuestionMark(responseLanguage);

  if (chapterTitle) {
    return responseLanguage === "en"
      ? `After finishing "${chapterTitle}", which line is still lingering with you${questionMark}`
      : `读完「${chapterTitle}」这一章后，哪一句还在你心里轻轻回响？`;
  }

  if (normalizedContext.includes("Closing passages:")) {
    return responseLanguage === "en"
      ? `At the point where this chapter paused, which image would you carry away${questionMark}`
      : "读到这一章停下来的地方，你最想带走的是哪一个画面？";
  }

  return responseLanguage === "en"
    ? `After finishing this chapter, which line felt like a quiet knock on the door${questionMark}`
    : "读完这一章后，哪一句最像突然轻轻敲了你一下？";
}

export function buildChapterEndFallbackQuestionForReader(chapter: ReaderChapter) {
  const chapterContext = chapter.paragraphs
    .map((paragraph) => paragraph.content.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(-2)
    .join(" ");

  return buildChapterEndFallbackQuestion({
    chapterTitle: chapter.title,
    chapterContext
  });
}
