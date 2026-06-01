import Link from "next/link";
import { ReadingPreferencesPanel } from "@/components/settings/reading-preferences-panel";
import { getUserReadingPreferences } from "@/lib/settings/reading-preferences";
import { requireUser } from "@/lib/supabase/auth";

export default async function ReadingPreferencesPage() {
  const user = await requireUser("/settings/preferences");

  let preferences;
  let loadError = false;

  try {
    preferences = await getUserReadingPreferences(user.id);
  } catch (error) {
    loadError = true;
    console.error("Unable to load reading preferences page", error);
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">
            <span className="eyebrow-zh">阅读设置</span>
            <span className="eyebrow-en">Preferences</span>
          </p>
          <h1 className="page-title">阅读偏好</h1>
          <p className="page-subtitle">调整日间/夜间模式，并决定是否启用阅读低迷检测和救急包提醒。</p>
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

      {loadError || !preferences ? (
        <section className="soft-card memory-empty">
          <h2 className="state-title">阅读设置暂时不可用</h2>
          <p className="state-text">当前无法加载你的阅读偏好。请稍后再试，或确认设置数据表已完成初始化。</p>
          <div className="state-actions">
            <Link className="secondary-link" href="/bookshelf">
              返回书架
            </Link>
            <Link className="secondary-link" href="/">
              返回首页
            </Link>
          </div>
        </section>
      ) : (
        <ReadingPreferencesPanel initialPreferences={preferences} />
      )}
    </main>
  );
}
