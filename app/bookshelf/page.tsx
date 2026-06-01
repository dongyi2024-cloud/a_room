import { BookshelfShell } from "@/components/bookshelf/bookshelf-shell";
import { requireUser } from "@/lib/supabase/auth";
import { getUserBookshelfItems } from "@/lib/bookshelf/data";

export default async function BookshelfPage() {
  const user = await requireUser("/bookshelf");
  try {
    const books = await getUserBookshelfItems(user.id);

    return (
      <main className="app-shell bookshelf-page">
        <BookshelfShell items={books} userEmail={user.email ?? null} />
      </main>
    );
  } catch (error) {
    return (
      <main className="app-shell bookshelf-page">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Bookshelf</p>
            <h1 className="page-title">Shelf setup is incomplete.</h1>
            <p className="page-subtitle">
              Supabase is connected, but the bookshelf tables or policies are not ready yet.
            </p>
          </div>
        </header>

        <section className="soft-card state-card">
          <h2 className="state-title">Run the Supabase bootstrap SQL.</h2>
          <p className="state-text">
            Apply <code>supabase/schema.sql</code> in your Supabase SQL editor, then refresh this
            page.
          </p>
          <p className="form-error page-feedback">
            {error instanceof Error ? error.message : "Unknown Supabase setup error."}
          </p>
        </section>
      </main>
    );
  }
}
