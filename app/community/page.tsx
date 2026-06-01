import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { ReflectionFeedPanel } from "@/components/reflections/reflection-feed-panel";
import { listAllReflectionCards } from "@/lib/reflections/data";
import { requireUser } from "@/lib/supabase/auth";

function CommunityState({
  title,
  text
}: {
  title: string;
  text: string;
}) {
  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">Community</p>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{text}</p>
        </div>
      </header>
      <section className="soft-card state-card">
        <h2 className="state-title">{title}</h2>
        <p className="state-text">{text}</p>
        <div className="state-actions">
          <Link className="secondary-link" href="/bookshelf">
            返回书架
          </Link>
          <Link className="secondary-link" href="/">
            返回首页
          </Link>
        </div>
      </section>
    </main>
  );
}

export default async function CommunityPage() {
  noStore();
  const user = await requireUser("/community");

  try {
    const cards = await listAllReflectionCards(user.id);

    return (
      <main className="app-shell">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Community</p>
            <h1 className="page-title">句边札记</h1>
            <p className="page-subtitle">为打动你的那一段，留下一点自己的声音</p>
          </div>
          <div className="header-actions">
            <Link className="secondary-link" href="/bookshelf">
              返回书架
            </Link>
            <Link className="secondary-link" href="/">
              返回首页
            </Link>
          </div>
        </header>

        <ReflectionFeedPanel
          bookId=""
          chapterOrder={0}
          currentUserId={user.id}
          initialCards={cards}
          paragraphOrder={0}
          variant="community"
        />
      </main>
    );
  } catch (error) {
    return (
      <CommunityState
        title="社区页暂时打不开"
        text={error instanceof Error ? error.message : "Community feed is temporarily unavailable."}
      />
    );
  }
}
