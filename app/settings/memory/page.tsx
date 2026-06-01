import Link from "next/link";
import { MemoryManagementPanel } from "@/components/memory/memory-management-panel";
import { getUserMemorySettings, listUserMemories } from "@/lib/memory/data";
import { requireUser } from "@/lib/supabase/auth";

export default async function MemorySettingsPage() {
  const user = await requireUser("/settings/memory");

  let settings;
  let memories;
  let loadError = false;

  try {
    [settings, memories] = await Promise.all([
      getUserMemorySettings(user.id),
      listUserMemories(user.id)
    ]);
  } catch (error) {
    loadError = true;
    console.error("Unable to load memory management page", error);
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">
            <span className="eyebrow-zh">我的记忆</span>
            <span className="eyebrow-en">Memory</span>
          </p>
          <h1 className="page-title">长期记忆管理</h1>
          <p className="page-subtitle">
            查看、删除或关闭 AI 关于你阅读偏好和关键疑问的长期记忆。这里的内容只属于当前账号。
          </p>
        </div>
        <div className="header-actions">
          <Link className="secondary-link" href="/">
            返回首页
          </Link>
        </div>
      </header>

      {loadError || !settings || !memories ? (
        <section className="soft-card memory-empty">
          <h2 className="state-title">长期记忆暂时不可用</h2>
          <p className="state-text">当前无法加载你的长期记忆设置。请稍后再试，或确认记忆数据库已完成初始化。</p>
        </section>
      ) : (
        <MemoryManagementPanel initialMemories={memories} initialSettings={settings} />
      )}
    </main>
  );
}
