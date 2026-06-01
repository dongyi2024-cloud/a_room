import "server-only";

import type { ReaderChapter, ReaderParagraph, ReaderSmartMark, SmartMarkType } from "@/types/reader";

type SmartMarkSeed = {
  chapterOrder: number;
  paragraphOrder: number;
  targetText: string;
  markType: SmartMarkType;
  explanation?: string;
};

export type PersistedSmartMarkRow = {
  chapter_id: string;
  paragraph_id: string;
  target_text: string;
  mark_type: SmartMarkType;
  explanation: string | null;
  start_offset: number;
  end_offset: number;
};

const PRELOADED_SMART_MARKS: Record<string, SmartMarkSeed[]> = {
  roomofonesown: [
    {
      chapterOrder: 1,
      paragraphOrder: 1,
      targetText: "Fanny Burney",
      markType: "person",
      explanation: "Frances Burney was an eighteenth-century English novelist and diarist. Woolf invokes her as part of a women's literary lineage."
    },
    {
      chapterOrder: 1,
      paragraphOrder: 1,
      targetText: "Jane Austen",
      markType: "person",
      explanation: "Jane Austen wrote novels of social observation and domestic life. Woolf treats her as a major predecessor in women's fiction."
    },
    {
      chapterOrder: 1,
      paragraphOrder: 1,
      targetText: "Haworth Parsonage",
      markType: "place",
      explanation: "Haworth Parsonage was the Yorkshire home of the Bronte family. It stands here for the cramped domestic setting behind a major literary tradition."
    },
    {
      chapterOrder: 1,
      paragraphOrder: 1,
      targetText: "George Eliot",
      markType: "person",
      explanation: "George Eliot was the pen name of Mary Ann Evans, a major Victorian novelist. Woolf places her among women who expanded the possibilities of fiction."
    },
    {
      chapterOrder: 1,
      paragraphOrder: 2,
      targetText: "Mary Beton",
      markType: "person",
      explanation: "Mary Beton is one of Woolf's invented speaker names in this essay. The shifting name lets Woolf discuss women's lives without pretending to speak as only one fixed self."
    },
    {
      chapterOrder: 1,
      paragraphOrder: 3,
      targetText: "Beadle",
      markType: "historical-context",
      explanation: "A beadle was a university or college official who enforced rules. In this scene he represents institutional authority controlling where women may walk."
    }
  ],
  生死场萧红小说精选集: [
    {
      chapterOrder: 1,
      paragraphOrder: 1,
      targetText: "山羊",
      markType: "background",
      explanation: "这里的山羊不是单纯景物，它把乡村生活的贫乏、迟缓和生计压力带进开篇。"
    },
    {
      chapterOrder: 1,
      paragraphOrder: 1,
      targetText: "榆树",
      markType: "place",
      explanation: "榆树在东北乡土叙事里常作为村庄空间的标记。它让场景落到具体地方，而不是抽象的乡村。"
    },
    {
      chapterOrder: 1,
      paragraphOrder: 2,
      targetText: "大道",
      markType: "place",
      explanation: "大道连接村庄与外部世界，也暴露人物在公共空间中的贫困和不安。"
    },
    {
      chapterOrder: 1,
      paragraphOrder: 2,
      targetText: "榆树",
      markType: "place",
      explanation: "反复出现的榆树像一个固定坐标，衬出人物生活范围的狭窄。"
    },
    {
      chapterOrder: 1,
      paragraphOrder: 3,
      targetText: "胰子",
      markType: "difficult-term",
      explanation: "胰子是旧时对肥皂一类清洁用品的称呼。这个词保留了时代和地域口语的质感。"
    },
    {
      chapterOrder: 1,
      paragraphOrder: 4,
      targetText: "蚱虫",
      markType: "difficult-term",
      explanation: "蚱虫通常指蚂蚱、蝗虫一类小虫。萧红常用这类细小生物写出乡村环境的粗粝与生命感。"
    }
  ]
};

function normalizeBookTitleKey(title: string) {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s'":：，,。.?!！？;；、—-]+/g, "")
    .replace(/[()（）]/g, "");
}

function buildParagraphLookup(chapters: ReaderChapter[]) {
  const lookup = new Map<string, ReaderParagraph>();

  chapters.forEach((chapter) => {
    chapter.paragraphs.forEach((paragraph) => {
      lookup.set(`${chapter.orderIndex}:${paragraph.orderIndex}`, paragraph);
    });
  });

  return lookup;
}

function buildParagraphIdLookup(chapters: ReaderChapter[]) {
  const lookup = new Map<string, { chapter: ReaderChapter; paragraph: ReaderParagraph }>();

  chapters.forEach((chapter) => {
    chapter.paragraphs.forEach((paragraph) => {
      lookup.set(paragraph.id, { chapter, paragraph });
    });
  });

  return lookup;
}

function normalizeMarksForParagraph(content: string, marks: ReaderSmartMark[]) {
  const normalized: ReaderSmartMark[] = [];
  const sortedMarks = [...marks].sort((left, right) => left.startOffset - right.startOffset);
  let occupiedUntil = -1;

  sortedMarks.forEach((mark) => {
    const markLength = mark.endOffset - mark.startOffset;

    if (mark.startOffset < 0 || mark.endOffset > content.length || markLength <= 0) {
      return;
    }

    if (content.slice(mark.startOffset, mark.endOffset) !== mark.targetText) {
      return;
    }

    if (mark.startOffset < occupiedUntil) {
      return;
    }

    normalized.push(mark);
    occupiedUntil = mark.endOffset;
  });

  return normalized;
}

function normalizeExplanation(explanation: string | undefined) {
  const normalized = explanation?.replace(/\s+/g, " ").trim();

  return normalized ? normalized : null;
}

export function getReaderSmartMarkMap(bookTitle: string, chapters: ReaderChapter[]) {
  const seeds = PRELOADED_SMART_MARKS[normalizeBookTitleKey(bookTitle)] ?? [];
  const paragraphLookup = buildParagraphLookup(chapters);
  const markMap = new Map<string, ReaderSmartMark[]>();

  seeds.forEach((seed) => {
    const paragraph = paragraphLookup.get(`${seed.chapterOrder}:${seed.paragraphOrder}`);

    if (!paragraph) {
      return;
    }

    const startOffset = paragraph.content.indexOf(seed.targetText);

    if (startOffset === -1) {
      return;
    }

    const record: ReaderSmartMark = {
      chapterOrder: seed.chapterOrder,
      paragraphId: paragraph.id,
      paragraphOrder: seed.paragraphOrder,
      targetText: seed.targetText,
      markType: seed.markType,
      explanation: normalizeExplanation(seed.explanation),
      startOffset,
      endOffset: startOffset + seed.targetText.length
    };
    const paragraphKey = `${seed.chapterOrder}:${seed.paragraphOrder}`;
    const existing = markMap.get(paragraphKey) ?? [];

    existing.push(record);
    markMap.set(paragraphKey, existing);
  });

  markMap.forEach((marks, key) => {
    const [chapterOrderText, paragraphOrderText] = key.split(":");
    const paragraph = paragraphLookup.get(`${chapterOrderText}:${paragraphOrderText}`);

    if (!paragraph) {
      markMap.delete(key);
      return;
    }

    markMap.set(key, normalizeMarksForParagraph(paragraph.content, marks));
  });

  return markMap;
}

export function getReaderSmartMarkMapFromRows(chapters: ReaderChapter[], rows: PersistedSmartMarkRow[]) {
  const paragraphLookup = buildParagraphIdLookup(chapters);
  const paragraphOrderLookup = buildParagraphLookup(chapters);
  const markMap = new Map<string, ReaderSmartMark[]>();

  rows.forEach((row) => {
    const paragraphMatch = paragraphLookup.get(row.paragraph_id);

    if (!paragraphMatch || row.chapter_id !== paragraphMatch.chapter.id) {
      return;
    }

    const { chapter, paragraph } = paragraphMatch;
    const record: ReaderSmartMark = {
      chapterOrder: chapter.orderIndex,
      paragraphId: paragraph.id,
      paragraphOrder: paragraph.orderIndex,
      targetText: row.target_text,
      markType: row.mark_type,
      explanation: normalizeExplanation(row.explanation ?? undefined),
      startOffset: row.start_offset,
      endOffset: row.end_offset
    };
    const paragraphKey = `${chapter.orderIndex}:${paragraph.orderIndex}`;
    const existing = markMap.get(paragraphKey) ?? [];

    existing.push(record);
    markMap.set(paragraphKey, existing);
  });

  markMap.forEach((marks, key) => {
    const [chapterOrderText, paragraphOrderText] = key.split(":");
    const paragraph = paragraphOrderLookup.get(`${chapterOrderText}:${paragraphOrderText}`);

    if (!paragraph) {
      markMap.delete(key);
      return;
    }

    markMap.set(key, normalizeMarksForParagraph(paragraph.content, marks));
  });

  return markMap;
}
