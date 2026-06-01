import "server-only";

import { toShortErrorMessage } from "@/lib/bookshelf/helpers";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type { SmartMarkType } from "@/types/reader";
import type { Database } from "@/types/supabase";

type BookRow = Database["public"]["Tables"]["books"]["Row"];
type ChapterRow = Database["public"]["Tables"]["chapters"]["Row"];
type ParagraphRow = Database["public"]["Tables"]["paragraphs"]["Row"];
type SmartMarkInsert = Database["public"]["Tables"]["smart_marks"]["Insert"];
type SmartMarkJobUpdate = Database["public"]["Tables"]["smart_mark_jobs"]["Update"];

type SmartMarkLexiconEntry = {
  terms: string[];
  markType: SmartMarkType;
  explanation: string;
  confidence: number;
};

type SourceParagraph = Pick<ParagraphRow, "id" | "book_id" | "chapter_id" | "order_index" | "content"> & {
  chapterOrder: number;
};

type SmartMarkCandidate = {
  bookId: string;
  chapterId: string;
  paragraphId: string;
  chapterOrder: number;
  paragraphOrder: number;
  targetText: string;
  normalizedTarget: string;
  markType: SmartMarkType;
  explanation: string;
  startOffset: number;
  endOffset: number;
  confidence: number;
};

export type GenerateBookSmartMarksResult = {
  bookId: string;
  jobId: string;
  totalParagraphs: number;
  processedParagraphs: number;
  insertedMarks: number;
  status: "ready" | "failed";
};

const SMART_MARK_SOURCE = "rule-lexicon";
const MIN_CONFIDENCE = 0.68;
const MAX_MARKS_PER_PARAGRAPH = 4;
const INSERT_BATCH_SIZE = 500;

const SMART_MARK_LEXICON: SmartMarkLexiconEntry[] = [
  {
    terms: ["Fanny Burney", "Jane Austen", "George Eliot", "Brontë", "Bronte", "Charlotte Brontë", "Emily Brontë"],
    markType: "person",
    explanation: "这些名字指向女性文学传统中的重要作者。标记它们有助于看见文本如何建立女性写作谱系。",
    confidence: 0.95
  },
  {
    terms: ["伍尔夫", "Virginia Woolf", "Woolf"],
    markType: "author-keyword",
    explanation: "这是与作者本人及其思想传统直接相关的关键词。它通常提示文本正在靠近作者的核心关切。",
    confidence: 0.92
  },
  {
    terms: ["Mary Beton", "Mary Seton", "Mary Carmichael", "Judith Shakespeare", "莎士比亚的妹妹"],
    markType: "literary-allusion",
    explanation: "这些人物常是文本中的虚构或象征性角色。它们帮助作者讨论女性处境，而不只是在讲单个真实人物。",
    confidence: 0.92
  },
  {
    terms: ["Oxbridge", "Fernham", "Haworth Parsonage", "British Museum", "大英博物馆", "奥克斯桥"],
    markType: "place",
    explanation: "这些地点不只是背景，也承载教育、阶层和知识制度的意味。理解地点能帮助把抽象议题落回具体空间。",
    confidence: 0.9
  },
  {
    terms: ["五百英镑", "five hundred pounds", "five hundred a year", "a room of one's own", "自己的房间"],
    markType: "abstract-concept",
    explanation: "这是文本的核心观念之一，指向女性写作所需的物质条件与精神空间。它不只是金钱或房间的字面意思。",
    confidence: 0.94
  },
  {
    terms: ["父权", "patriarchy", "财产", "property", "教育", "education", "传统", "tradition"],
    markType: "background",
    explanation: "这个词通常连接文本中的社会结构问题。它提示读者关注个人经验背后的制度性限制。",
    confidence: 0.76
  },
  {
    terms: ["beadle", "Beadle", "dean", "don", "fellow", "matron"],
    markType: "historical-context",
    explanation: "这是英国学院或社会制度中的身份称谓。它们常体现权力、规训或准入限制。",
    confidence: 0.82
  },
  {
    terms: ["隐喻", "metaphor", "象征", "symbol", "意识流", "stream of consciousness"],
    markType: "literary-allusion",
    explanation: "这类词提示文本正在使用文学技法或批评概念。理解它能帮助读者把局部句子和整体表达方式联系起来。",
    confidence: 0.72
  },
  {
    terms: ["胰子", "蚱虫", "榆树", "大道", "山羊"],
    markType: "difficult-term",
    explanation: "这个词带有地方、时代或生活经验色彩。它有助于读者进入文本的具体环境，而不是只理解字面情节。",
    confidence: 0.72
  },
  {
    terms: ["红玫瑰", "白玫瑰", "玫瑰", "镜子", "窗", "花园"],
    markType: "literary-allusion",
    explanation: "这类意象常承担情绪和主题提示功能。它不一定需要被解释成唯一含义，但值得停下来观察。",
    confidence: 0.7
  }
];

export class SmartMarkNotFoundError extends Error {
  constructor(message = "Book record was not found.") {
    super(message);
    this.name = "SmartMarkNotFoundError";
  }
}

export class SmartMarkAccessError extends Error {
  constructor(message = "This book does not belong to the current user's private bookshelf.") {
    super(message);
    this.name = "SmartMarkAccessError";
  }
}

export class SmartMarkSourceUnavailableError extends Error {
  constructor(message = "This book is not ready for smart mark generation.") {
    super(message);
    this.name = "SmartMarkSourceUnavailableError";
  }
}

function normalizeTerm(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}

function containsLatin(value: string) {
  return /[A-Za-z]/.test(value);
}

function isLatinWordChar(value: string | undefined) {
  return Boolean(value && /[A-Za-z0-9_]/.test(value));
}

function hasSafeLatinBoundary(content: string, startOffset: number, endOffset: number) {
  return !isLatinWordChar(content[startOffset - 1]) && !isLatinWordChar(content[endOffset]);
}

function findTermMatches(content: string, term: string) {
  const matches: Array<{ startOffset: number; endOffset: number; targetText: string }> = [];
  const searchContent = containsLatin(term) ? content.toLowerCase() : content;
  const searchTerm = containsLatin(term) ? term.toLowerCase() : term;
  let cursor = 0;

  while (cursor < searchContent.length) {
    const startOffset = searchContent.indexOf(searchTerm, cursor);

    if (startOffset === -1) {
      break;
    }

    const endOffset = startOffset + term.length;

    if (!containsLatin(term) || hasSafeLatinBoundary(content, startOffset, endOffset)) {
      matches.push({
        startOffset,
        endOffset,
        targetText: content.slice(startOffset, endOffset)
      });
    }

    cursor = Math.max(endOffset, startOffset + 1);
  }

  return matches;
}

async function getOwnedReadableBook(bookId: string, userId: string) {
  const serviceClient = getSupabaseServiceRoleClient();
  const { data: book, error: bookError } = await serviceClient
    .from("books")
    .select("id, user_id, import_status")
    .eq("id", bookId)
    .maybeSingle();

  if (bookError) {
    throw bookError;
  }

  if (!book) {
    throw new SmartMarkNotFoundError("Book record was not found.");
  }

  if (book.user_id !== userId) {
    throw new SmartMarkAccessError("This book does not belong to the current user's private bookshelf.");
  }

  const { data: shelfRecord, error: shelfError } = await serviceClient
    .from("user_bookshelves")
    .select("id")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .maybeSingle();

  if (shelfError) {
    throw shelfError;
  }

  if (!shelfRecord) {
    throw new SmartMarkAccessError("This book is not linked to the current user's private bookshelf.");
  }

  if (book.import_status !== "ready") {
    throw new SmartMarkSourceUnavailableError("This book is not readable yet, so smart marks cannot be generated.");
  }

  return book as Pick<BookRow, "id" | "user_id" | "import_status">;
}

async function loadSourceParagraphs(bookId: string) {
  const serviceClient = getSupabaseServiceRoleClient();
  const { data: chapters, error: chaptersError } = await serviceClient
    .from("chapters")
    .select("id, book_id, title, order_index, created_at, updated_at")
    .eq("book_id", bookId)
    .order("order_index", { ascending: true });

  if (chaptersError) {
    throw chaptersError;
  }

  const { data: paragraphs, error: paragraphsError } = await serviceClient
    .from("paragraphs")
    .select("id, book_id, chapter_id, order_index, content, created_at, updated_at")
    .eq("book_id", bookId);

  if (paragraphsError) {
    throw paragraphsError;
  }

  const chapterOrderById = new Map(((chapters ?? []) as ChapterRow[]).map((chapter) => [chapter.id, chapter.order_index]));

  return ((paragraphs ?? []) as ParagraphRow[])
    .map((paragraph) => ({
      ...paragraph,
      chapterOrder: chapterOrderById.get(paragraph.chapter_id) ?? Number.MAX_SAFE_INTEGER
    }))
    .sort((left, right) => left.chapterOrder - right.chapterOrder || left.order_index - right.order_index);
}

function extractCandidates(paragraph: SourceParagraph): SmartMarkCandidate[] {
  const candidates: SmartMarkCandidate[] = [];

  for (const entry of SMART_MARK_LEXICON) {
    if (entry.confidence < MIN_CONFIDENCE) {
      continue;
    }

    for (const term of entry.terms) {
      for (const match of findTermMatches(paragraph.content, term)) {
        candidates.push({
          bookId: paragraph.book_id,
          chapterId: paragraph.chapter_id,
          paragraphId: paragraph.id,
          chapterOrder: paragraph.chapterOrder,
          paragraphOrder: paragraph.order_index,
          targetText: match.targetText,
          normalizedTarget: normalizeTerm(match.targetText),
          markType: entry.markType,
          explanation: entry.explanation,
          startOffset: match.startOffset,
          endOffset: match.endOffset,
          confidence: entry.confidence
        });
      }
    }
  }

  return candidates;
}

function isValidCandidate(paragraph: SourceParagraph, candidate: SmartMarkCandidate) {
  if (candidate.startOffset < 0 || candidate.endOffset > paragraph.content.length) {
    return false;
  }

  if (candidate.endOffset <= candidate.startOffset) {
    return false;
  }

  if (candidate.confidence < MIN_CONFIDENCE) {
    return false;
  }

  return paragraph.content.slice(candidate.startOffset, candidate.endOffset) === candidate.targetText;
}

function selectCandidatesForParagraph(
  paragraph: SourceParagraph,
  candidates: SmartMarkCandidate[],
  previousParagraphTerms: Set<string>
) {
  const accepted: SmartMarkCandidate[] = [];

  const sorted = candidates
    .filter((candidate) => isValidCandidate(paragraph, candidate))
    .filter((candidate) => !previousParagraphTerms.has(candidate.normalizedTarget))
    .sort((left, right) => {
      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }

      return right.targetText.length - left.targetText.length || left.startOffset - right.startOffset;
    });

  for (const candidate of sorted) {
    if (accepted.length >= MAX_MARKS_PER_PARAGRAPH) {
      break;
    }

    const overlapsAccepted = accepted.some(
      (acceptedCandidate) =>
        candidate.startOffset < acceptedCandidate.endOffset && candidate.endOffset > acceptedCandidate.startOffset
    );

    if (overlapsAccepted) {
      continue;
    }

    accepted.push(candidate);
  }

  return accepted.sort((left, right) => left.startOffset - right.startOffset);
}

function buildSmartMarkRows(paragraphs: SourceParagraph[]): SmartMarkInsert[] {
  const rows: SmartMarkInsert[] = [];
  let previousParagraphTerms = new Set<string>();

  for (const paragraph of paragraphs) {
    const accepted = selectCandidatesForParagraph(paragraph, extractCandidates(paragraph), previousParagraphTerms);

    for (const candidate of accepted) {
      rows.push({
        book_id: candidate.bookId,
        chapter_id: candidate.chapterId,
        paragraph_id: candidate.paragraphId,
        target_text: candidate.targetText,
        mark_type: candidate.markType,
        explanation: candidate.explanation,
        start_offset: candidate.startOffset,
        end_offset: candidate.endOffset,
        confidence: candidate.confidence,
        source: SMART_MARK_SOURCE
      });
    }

    previousParagraphTerms = new Set(accepted.map((candidate) => candidate.normalizedTarget));
  }

  return rows;
}

async function createProcessingJob(bookId: string, totalParagraphs: number) {
  const serviceClient = getSupabaseServiceRoleClient();
  const { data: job, error } = await serviceClient
    .from("smart_mark_jobs")
    .insert({
      book_id: bookId,
      status: "processing",
      total_paragraphs: totalParagraphs,
      processed_paragraphs: 0,
      inserted_marks: 0,
      error_message: null,
      started_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return job.id;
}

async function updateJob(jobId: string, values: SmartMarkJobUpdate) {
  const serviceClient = getSupabaseServiceRoleClient();
  const { error } = await serviceClient.from("smart_mark_jobs").update(values).eq("id", jobId);

  if (error) {
    throw error;
  }
}

async function recordUnavailableJob(bookId: string, errorMessage: string) {
  const serviceClient = getSupabaseServiceRoleClient();
  await serviceClient.from("smart_mark_jobs").insert({
    book_id: bookId,
    status: "failed",
    total_paragraphs: 0,
    processed_paragraphs: 0,
    inserted_marks: 0,
    error_message: errorMessage,
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString()
  });
}

async function replaceSmartMarks(bookId: string, rows: SmartMarkInsert[]) {
  const serviceClient = getSupabaseServiceRoleClient();
  const { error: deleteError } = await serviceClient
    .from("smart_marks")
    .delete()
    .eq("book_id", bookId)
    .eq("source", SMART_MARK_SOURCE);

  if (deleteError) {
    throw deleteError;
  }

  for (let index = 0; index < rows.length; index += INSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + INSERT_BATCH_SIZE);
    const { error: insertError } = await serviceClient.from("smart_marks").insert(batch);

    if (insertError) {
      throw insertError;
    }
  }
}

export async function generateBookSmartMarksForUser(params: {
  bookId: string;
  userId: string;
}): Promise<GenerateBookSmartMarksResult> {
  const { bookId, userId } = params;
  await getOwnedReadableBook(bookId, userId);

  const paragraphs = await loadSourceParagraphs(bookId);

  if (paragraphs.length === 0) {
    const message = "This book has no readable paragraph content for smart mark generation.";
    await recordUnavailableJob(bookId, message);
    throw new SmartMarkSourceUnavailableError(message);
  }

  const jobId = await createProcessingJob(bookId, paragraphs.length);

  try {
    const rows = buildSmartMarkRows(paragraphs);
    await replaceSmartMarks(bookId, rows);

    await updateJob(jobId, {
      status: "ready",
      processed_paragraphs: paragraphs.length,
      inserted_marks: rows.length,
      error_message: null,
      finished_at: new Date().toISOString()
    });

    return {
      bookId,
      jobId,
      totalParagraphs: paragraphs.length,
      processedParagraphs: paragraphs.length,
      insertedMarks: rows.length,
      status: "ready"
    };
  } catch (error) {
    await updateJob(jobId, {
      status: "failed",
      processed_paragraphs: 0,
      inserted_marks: 0,
      error_message: toShortErrorMessage(error),
      finished_at: new Date().toISOString()
    });

    throw error;
  }
}
