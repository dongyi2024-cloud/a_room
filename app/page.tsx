import { HomeWorkbench } from "@/components/workbench/home-workbench";
import { getUserBookshelfItems } from "@/lib/bookshelf/data";
import { listPersonalNotes } from "@/lib/notes/data";
import { listAllReflectionCards } from "@/lib/reflections/data";
import { getSampleShengSiChangSummary } from "@/lib/sample-books/sheng-si-chang";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { BookshelfItem } from "@/types/bookshelf";
import type { PersonalNote } from "@/types/personal-notes";

async function safelyLoadBooks(userId: string) {
  try {
    return await getUserBookshelfItems(userId);
  } catch (error) {
    console.error("Unable to load homepage bookshelf summary", error);
    return [] satisfies BookshelfItem[];
  }
}

async function safelyLoadNoteSummary(userId: string) {
  try {
    const notes = await listPersonalNotes(userId);
    return {
      latestNote: notes[0] ?? null,
      noteCount: notes.length
    };
  } catch (error) {
    console.error("Unable to load homepage note summary", error);
    return {
      latestNote: null,
      noteCount: 0
    } satisfies { latestNote: PersonalNote | null; noteCount: number };
  }
}

async function safelyLoadCommunityCount(userId: string) {
  try {
    const cards = await listAllReflectionCards(userId);
    return cards.length;
  } catch (error) {
    console.error("Unable to load homepage community summary", error);
    return 0;
  }
}

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <HomeWorkbench
        books={[]}
        communityCount={0}
        isGuest
        latestNote={null}
        noteCount={0}
        sampleBook={getSampleShengSiChangSummary()}
        userEmail={null}
      />
    );
  }

  const [books, noteSummary, communityCount] = await Promise.all([
    safelyLoadBooks(user.id),
    safelyLoadNoteSummary(user.id),
    safelyLoadCommunityCount(user.id)
  ]);

  return (
    <HomeWorkbench
      books={books}
      communityCount={communityCount}
      latestNote={noteSummary.latestNote}
      noteCount={noteSummary.noteCount}
      userEmail={user.email ?? null}
    />
  );
}
