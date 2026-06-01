import Link from "next/link";
import { CommunityShareNoteAction } from "@/components/notes/community-share-note-action";
import { listPersonalNotes, PersonalNoteSchemaError } from "@/lib/notes/data";
import { requireUser } from "@/lib/supabase/auth";
import type { PersonalNote, PersonalNoteSourceType } from "@/types/personal-notes";
import type { Json } from "@/types/supabase";

const SOURCE_TYPE_LABELS: Record<PersonalNoteSourceType, string> = {
  ai_answer: "AI 回答",
  smart_mark_explanation: "智能标记解释",
  selected_text: "选中文本",
  reflection: "阅读感悟",
  dialogue_summary: "对话摘要"
};

function formatCreatedAt(value: string) {
  try {
    return new Date(value).toLocaleString("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return value;
  }
}

function getPrimaryContent(note: PersonalNote) {
  if (note.sourceType === "dialogue_summary") {
    return note.noteContent || note.aiContent || "";
  }

  if (note.sourceType === "selected_text") {
    return note.aiContent || note.noteContent || "";
  }

  return note.aiContent || note.noteContent || note.sourceText || "";
}

function isJsonObject(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getMetadataText(note: PersonalNote, key: string) {
  if (!isJsonObject(note.metadata)) {
    return "";
  }

  const value = note.metadata[key];
  return typeof value === "string" ? value : "";
}

function getDialogueTurns(note: PersonalNote) {
  if (!isJsonObject(note.metadata)) {
    return [];
  }

  const rawTurns = note.metadata.conversationTurns;

  if (!Array.isArray(rawTurns)) {
    return [];
  }

  return rawTurns
    .map((turn) => {
      if (!isJsonObject(turn)) {
        return null;
      }

      const question = typeof turn.question === "string" ? turn.question : "";
      const answer = typeof turn.answer === "string" ? turn.answer : "";

      return question && answer ? { question, answer } : null;
    })
    .filter((turn): turn is { question: string; answer: string } => Boolean(turn))
    .slice(0, 8);
}

function getReaderHref(note: PersonalNote) {
  if (note.chapterOrder <= 0 || note.paragraphOrder <= 0) {
    return null;
  }

  return `/reader/${note.bookId}?chapter=${note.chapterOrder}&paragraphId=${encodeURIComponent(note.paragraphId)}`;
}

function getDialogueHref(note: PersonalNote) {
  const readerHref = getReaderHref(note);

  if (!readerHref || note.sourceType !== "dialogue_summary") {
    return null;
  }

  const conversationReference = getMetadataText(note, "conversationReference");

  if (!conversationReference) {
    return null;
  }

  return `${readerHref}&ask=1&dialogueSummary=${encodeURIComponent(note.id)}`;
}

type PersonalNotesPageProps = {
  searchParams?: {
    book?: string;
  };
};

type NoteBookGroup = {
  bookId: string;
  bookTitle: string;
  notes: PersonalNote[];
  latestCreatedAt: string;
};

function groupNotesByBook(notes: PersonalNote[]) {
  const groups = new Map<string, NoteBookGroup>();

  notes.forEach((note) => {
    const existingGroup = groups.get(note.bookId);

    if (!existingGroup) {
      groups.set(note.bookId, {
        bookId: note.bookId,
        bookTitle: note.bookTitle,
        notes: [note],
        latestCreatedAt: note.createdAt
      });
      return;
    }

    existingGroup.notes.push(note);

    if (new Date(note.createdAt).getTime() > new Date(existingGroup.latestCreatedAt).getTime()) {
      existingGroup.latestCreatedAt = note.createdAt;
    }
  });

  return Array.from(groups.values()).sort(
    (left, right) => new Date(right.latestCreatedAt).getTime() - new Date(left.latestCreatedAt).getTime()
  );
}

export default async function PersonalNotesPage({ searchParams }: PersonalNotesPageProps) {
  const user = await requireUser("/settings/notes");
  let notes: PersonalNote[] = [];
  let loadError = "";

  try {
    notes = await listPersonalNotes(user.id);
  } catch (error) {
    if (error instanceof PersonalNoteSchemaError) {
      loadError = "笔记数据库还没有初始化，请先在 Supabase 执行最新 schema。";
    } else {
      loadError = "当前无法加载你的笔记，请稍后再试。";
    }
    console.error("Unable to load personal notes page", error);
  }

  const bookGroups = groupNotesByBook(notes);
  const selectedBookId = searchParams?.book ?? "";
  const selectedBook = selectedBookId ? bookGroups.find((group) => group.bookId === selectedBookId) ?? null : null;

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">
            <span className="eyebrow-zh">我的笔记</span>
            <span className="eyebrow-en">Notes</span>
          </p>
          <h1 className="page-title">个人笔记</h1>
          <p className="page-subtitle">
            这里保存你从 AI 回答、对话摘要、智能标记、选中文本和阅读感悟中留下的私人笔记。
          </p>
        </div>
        <div className="header-actions">
          <Link className="secondary-link" href="/">
            返回首页
          </Link>
        </div>
      </header>

      {loadError ? (
        <section className="soft-card state-card">
          <h2 className="state-title">笔记暂时不可用</h2>
          <p className="state-text">{loadError}</p>
        </section>
      ) : null}

      {!loadError && notes.length === 0 ? (
        <section className="soft-card state-card">
          <h2 className="state-title">还没有保存笔记</h2>
          <p className="state-text">在阅读器里选中文字、查看 AI 回答或智能标记解释时，可以点击“加入笔记”。</p>
        </section>
      ) : null}

      {!loadError && notes.length > 0 && !selectedBookId ? (
        <section className="note-book-grid" aria-label="有笔记的书籍">
          {bookGroups.map((group) => (
            <Link className="note-book-card soft-card" href={`/settings/notes?book=${encodeURIComponent(group.bookId)}`} key={group.bookId}>
              <div>
                <p className="page-eyebrow">Book notes</p>
                <h2 className="note-book-title">{group.bookTitle}</h2>
              </div>
              <div className="note-book-meta">
                <span>{group.notes.length} 条笔记</span>
                <span>最近保存：{formatCreatedAt(group.latestCreatedAt)}</span>
              </div>
            </Link>
          ))}
        </section>
      ) : null}

      {!loadError && selectedBookId && !selectedBook ? (
        <section className="soft-card state-card">
          <h2 className="state-title">这本书暂无可见笔记</h2>
          <p className="state-text">这本书可能已被删除，或当前账号没有对应的笔记。</p>
          <div className="state-actions">
            <Link className="secondary-link" href="/settings/notes">
              返回书籍列表
            </Link>
          </div>
        </section>
      ) : null}

      {!loadError && selectedBook ? (
        <>
          <section className="note-book-selected soft-card">
            <div>
              <p className="page-eyebrow">Selected book</p>
              <h2 className="note-book-title">{selectedBook.bookTitle}</h2>
              <p className="note-book-meta">{selectedBook.notes.length} 条笔记</p>
            </div>
            <Link className="secondary-link" href="/settings/notes">
              返回书籍列表
            </Link>
          </section>

          <section className="notes-list" aria-label={`${selectedBook.bookTitle} 的笔记列表`}>
            {selectedBook.notes.map((note) => {
              const readerHref = getReaderHref(note);
              const dialogueHref = getDialogueHref(note);
              const dialogueTurns = getDialogueTurns(note);
              const primaryContent = getPrimaryContent(note);

              return (
                <article className="note-card soft-card" key={note.id}>
                  <div className="note-card-header">
                    <div>
                      <p className="page-eyebrow">{SOURCE_TYPE_LABELS[note.sourceType]}</p>
                      <h2 className="note-card-title">{note.bookTitle}</h2>
                    </div>
                    <time className="note-card-time" dateTime={note.createdAt}>
                      {formatCreatedAt(note.createdAt)}
                    </time>
                  </div>
                  <p className="note-card-context">
                    {note.chapterTitle} · 第 {note.paragraphOrder > 0 ? note.paragraphOrder : "?"} 段
                  </p>
                  <p className="note-card-excerpt">“{note.sourceText || note.paragraphExcerpt}”</p>
                  {primaryContent ? <p className="note-card-content">{primaryContent}</p> : null}
                  {note.sourceType === "dialogue_summary" && dialogueTurns.length > 0 ? (
                    <details className="note-dialogue-source">
                      <summary>原始对话</summary>
                      <div className="note-dialogue-turns">
                        {dialogueTurns.map((turn, index) => (
                          <div className="note-dialogue-turn" key={`${note.id}-${index}`}>
                            <p>
                              <strong>Question</strong> {turn.question}
                            </p>
                            <p>
                              <strong>Answer</strong> {turn.answer}
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                  <div className="note-card-actions">
                    {dialogueHref ? (
                      <Link className="primary-link" href={dialogueHref}>
                        回到对话位置
                      </Link>
                    ) : null}
                    {readerHref ? (
                      <Link className={dialogueHref ? "secondary-link" : "primary-link"} href={readerHref}>
                        回到原文
                      </Link>
                    ) : (
                      <span className="note-source-unavailable">原文位置暂不可用</span>
                    )}
                    {note.sourceType === "dialogue_summary" && dialogueTurns.length === 0 ? (
                      <span className="note-source-unavailable">原始对话暂不可恢复</span>
                    ) : null}
                  </div>
                  <CommunityShareNoteAction
                    note={{
                      id: note.id,
                      sourceType: note.sourceType,
                      sourceText: note.sourceText,
                      aiContent: note.aiContent,
                      noteContent: note.noteContent,
                      bookTitle: note.bookTitle,
                      chapterTitle: note.chapterTitle,
                      paragraphOrder: note.paragraphOrder,
                      paragraphExcerpt: note.paragraphExcerpt
                    }}
                  />
                </article>
              );
            })}
          </section>
        </>
      ) : null}
    </main>
  );
}
