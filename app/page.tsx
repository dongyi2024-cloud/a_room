import { HomeWorkbench } from "@/components/workbench/home-workbench";
import { getUserBookshelfItems } from "@/lib/bookshelf/data";
import { getSampleShengSiChangSummary } from "@/lib/sample-books/sheng-si-chang";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { BookshelfItem } from "@/types/bookshelf";

async function safelyLoadBooks(userId: string) {
  try {
    return await getUserBookshelfItems(userId);
  } catch (error) {
    console.error("Unable to load homepage bookshelf summary", error);
    return [] satisfies BookshelfItem[];
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

  const books = await safelyLoadBooks(user.id);

  return (
    <HomeWorkbench
      books={books}
      communityCount={0}
      latestNote={null}
      noteCount={0}
      userEmail={user.email ?? null}
    />
  );
}
