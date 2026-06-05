import sampleBookJson from "@/epub/output/生死场_萧红小说精选集_萧红_z-library.sk_1lib.sk_z-lib.sk.json";
import type { ReaderBookDetail, ReaderBookSummary } from "@/types/reader";

type SampleParagraphJson = {
  order_index: number;
  content: string;
};

type SampleChapterJson = {
  order_index: number;
  title: string;
  paragraphs: SampleParagraphJson[];
};

type SampleBookJson = {
  language?: string;
  description?: string;
  chapters: SampleChapterJson[];
};

export const SAMPLE_SHENG_SI_CHANG_ID = "sample-sheng-si-chang";
export const SAMPLE_SHENG_SI_CHANG_TITLE = "生死场";
export const SAMPLE_SHENG_SI_CHANG_AUTHOR = "萧红";

const sampleData = sampleBookJson as SampleBookJson;

export function getSampleShengSiChangSummary(): ReaderBookSummary {
  const paragraphCount = sampleData.chapters.reduce((count, chapter) => count + chapter.paragraphs.length, 0);

  return {
    id: SAMPLE_SHENG_SI_CHANG_ID,
    title: SAMPLE_SHENG_SI_CHANG_TITLE,
    author: SAMPLE_SHENG_SI_CHANG_AUTHOR,
    language: sampleData.language || "zh",
    description: "一段可直接体验划线共读的样例阅读。",
    coverPath: null,
    chapterCount: sampleData.chapters.length,
    paragraphCount
  };
}

export function getSampleShengSiChangBook(): ReaderBookDetail {
  const summary = getSampleShengSiChangSummary();

  return {
    ...summary,
    chapters: sampleData.chapters.map((chapter) => ({
      id: `${SAMPLE_SHENG_SI_CHANG_ID}-chapter-${chapter.order_index}`,
      orderIndex: chapter.order_index,
      title: chapter.title,
      paragraphs: chapter.paragraphs.map((paragraph) => ({
        id: `${SAMPLE_SHENG_SI_CHANG_ID}-chapter-${chapter.order_index}-paragraph-${paragraph.order_index}`,
        orderIndex: paragraph.order_index,
        content: paragraph.content,
        smartMarks: []
      }))
    }))
  };
}
