"use client";

import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();

    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button className="secondary-link button-reset" onClick={handleSignOut} type="button">
      <span className="action-copy">
        <span className="action-copy-zh">退出登录</span>
        <span className="action-copy-en">Sign out</span>
      </span>
    </button>
  );
}
