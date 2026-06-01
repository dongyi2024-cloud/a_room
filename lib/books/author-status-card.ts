import type { ReaderBookSummary } from "@/types/reader";
import type { AuthorStatusCardText } from "@/types/author-status";

export type AuthorStatusCardContent = AuthorStatusCardText;

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[''"]/g, "").replace(/\s+/g, " ").trim();
}

function includesAny(source: string, terms: string[]) {
  return terms.some((term) => source.includes(term));
}

export function getAuthorStatusCardContent(book: ReaderBookSummary): AuthorStatusCardContent {
  const title = book.title.trim() || "这本书";
  const author = book.author.trim() && book.author !== "Unknown author" ? book.author.trim() : "这位作者";
  const normalizedTitle = normalizeText(title);
  const normalizedAuthor = normalizeText(author);

  if (
    includesAny(normalizedTitle, ["a room of ones own", "一间属于自己的房间", "自己的房间"]) ||
    includesAny(normalizedAuthor, ["virginia woolf", "伍尔夫", "弗吉尼亚"])
  ) {
    return {
      woolf_status: "她似乎正停在金钱、房间与女性写作之间，观察自由如何被现实条件塑形",
      thought_title: "今日思绪",
      thought_body: `读《${title}》时，可以留意那些看似轻声、却不断回到空间与收入的问题。`,
      cta_hint: "进入阅读"
    };
  }

  return {
    woolf_status: `她把《${title}》放在手边，像是在等待一个问题从纸面上浮起。`,
    thought_title: "今日思绪",
    thought_body: `读《${title}》时，可以先问：这本书希望我放慢在哪些句子、人物或概念旁边？`,
    cta_hint: "进入阅读"
  };
}
