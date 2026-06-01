import "server-only";

import type { ReaderChapter } from "@/types/reader";

export function buildBoundedChapterContext(chapter: ReaderChapter) {
  const normalizedParagraphs = chapter.paragraphs
    .map((paragraph) => paragraph.content.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (normalizedParagraphs.length === 0) {
    return "";
  }

  const openingParagraphs = normalizedParagraphs.slice(0, 3);
  const closingParagraphs =
    normalizedParagraphs.length > 5 ? normalizedParagraphs.slice(-2) : normalizedParagraphs.slice(3);

  const sections = [
    `Paragraph count: ${normalizedParagraphs.length}`,
    `Opening passages: ${openingParagraphs.join(" ")}`,
    closingParagraphs.length > 0 ? `Closing passages: ${closingParagraphs.join(" ")}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  return sections.length > 2600 ? `${sections.slice(0, 2600).trimEnd()}...` : sections;
}

