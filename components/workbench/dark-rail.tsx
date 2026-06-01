"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type RailItem = {
  href: string;
  labelZh: string;
  labelEn: string;
  icon: ReactNode;
};

type DarkRailProps = {
  askHref?: string;
};

function RailIcon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" className="dark-rail-svg" fill="none" viewBox="0 0 24 24">
      {children}
    </svg>
  );
}

const PRIMARY_ITEMS: RailItem[] = [
  {
    href: "/bookshelf",
    labelZh: "书架",
    labelEn: "Bookshelf",
    icon: (
      <RailIcon>
        <path d="M5 5.5h4.5v13H5zM9.5 5.5H14v13H9.5zM15 6.5l3.5 11.2" />
        <path d="M4 18.5h16" />
      </RailIcon>
    )
  },
  {
    href: "/settings/memory",
    labelZh: "记忆",
    labelEn: "Memory",
    icon: (
      <RailIcon>
        <path d="M12 5.5c-3 0-5.5 2-5.5 4.8 0 1.5.7 2.8 1.8 3.7v3.2h7.4V14c1.1-.9 1.8-2.2 1.8-3.7 0-2.8-2.5-4.8-5.5-4.8Z" />
        <path d="M9.3 18.8h5.4M9.5 10.5h.1M14.4 10.5h.1M10.5 13h3" />
      </RailIcon>
    )
  },
  {
    href: "/settings/notes",
    labelZh: "笔记",
    labelEn: "Notes",
    icon: (
      <RailIcon>
        <path d="M7 4.5h7.5L18 8v11.5H7z" />
        <path d="M14.5 4.5V8H18M9.5 12h5M9.5 15h5" />
      </RailIcon>
    )
  },
  {
    href: "/settings/preferences",
    labelZh: "阅读设置",
    labelEn: "Reading Settings",
    icon: (
      <RailIcon>
        <path d="M5 6.5h6.5c1.4 0 2.5 1.1 2.5 2.5v10H7.5A2.5 2.5 0 0 1 5 16.5z" />
        <path d="M14 9c0-1.4 1.1-2.5 2.5-2.5H19v10h-2.5A2.5 2.5 0 0 0 14 19" />
        <path d="M8 10h3M8 13h3" />
      </RailIcon>
    )
  },
  {
    href: "/community",
    labelZh: "社区",
    labelEn: "Community",
    icon: (
      <RailIcon>
        <path d="M7.5 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16.5 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M4 19c.4-3 2-5 4.5-5s4.1 2 4.5 5M11 19c.4-2.3 1.8-4 4.5-4 2.4 0 4 1.6 4.5 4" />
      </RailIcon>
    )
  }
];

const SETTINGS_ITEM: RailItem = {
  href: "/settings",
  labelZh: "设置",
  labelEn: "Settings",
  icon: (
    <RailIcon>
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
      <path d="M12 3.5v2M12 18.5v2M4.6 7.8l1.7 1M17.7 15.2l1.7 1M4.6 16.2l1.7-1M17.7 8.8l1.7-1" />
    </RailIcon>
  )
};

const SIGN_OUT_ITEM = {
  labelZh: "退出登录",
  labelEn: "Sign out",
  icon: (
    <RailIcon>
      <path d="M9.5 5.5H6.8A1.8 1.8 0 0 0 5 7.3v9.4a1.8 1.8 0 0 0 1.8 1.8h2.7" />
      <path d="M13 8.5 16.5 12 13 15.5M16.5 12H8.5" />
    </RailIcon>
  )
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DarkRail({ askHref = "/bookshelf" }: DarkRailProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const railItems = PRIMARY_ITEMS;

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();

    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <nav className={`dark-rail${isExpanded ? " is-expanded" : ""}`} aria-label="Primary">
        <button
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "收起导航" : "展开导航"}
          className="dark-rail-menu button-reset"
          onClick={() => setIsExpanded((current) => !current)}
          type="button"
        >
          <span className="dark-rail-menu-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        <div className="dark-rail-nav" aria-label="Main navigation">
          {railItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`dark-rail-link${isActive ? " is-active" : ""}`}
                href={item.href}
                key={`${item.href}-${item.labelEn}`}
                title={`${item.labelZh} / ${item.labelEn}`}
              >
                <span className="dark-rail-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="dark-rail-copy">
                  <span>{item.labelZh}</span>
                  <small>{item.labelEn}</small>
                </span>
              </Link>
            );
          })}
        </div>

        <div className="dark-rail-system">
          <Link
            className={`dark-rail-link${isActivePath(pathname, SETTINGS_ITEM.href) ? " is-active" : ""}`}
            href={SETTINGS_ITEM.href}
            title={`${SETTINGS_ITEM.labelZh} / ${SETTINGS_ITEM.labelEn}`}
          >
            <span className="dark-rail-icon" aria-hidden="true">
              {SETTINGS_ITEM.icon}
            </span>
            <span className="dark-rail-copy">
              <span>{SETTINGS_ITEM.labelZh}</span>
              <small>{SETTINGS_ITEM.labelEn}</small>
            </span>
          </Link>
          <button
            className="dark-rail-link dark-rail-sign-out button-reset"
            onClick={handleSignOut}
            title={`${SIGN_OUT_ITEM.labelZh} / ${SIGN_OUT_ITEM.labelEn}`}
            type="button"
          >
            <span className="dark-rail-icon" aria-hidden="true">
              {SIGN_OUT_ITEM.icon}
            </span>
            <span className="dark-rail-copy">
              <span>{SIGN_OUT_ITEM.labelZh}</span>
              <small>{SIGN_OUT_ITEM.labelEn}</small>
            </span>
          </button>
        </div>
      </nav>

      <header className="mobile-workbench-nav">
        <Link className="mobile-workbench-brand" href="/">
          Woolf Room
        </Link>
        <div className="mobile-workbench-links" aria-label="Mobile navigation">
          <Link href="/bookshelf">书架</Link>
          <Link href="/settings/memory">记忆</Link>
          <Link href="/settings/notes">笔记</Link>
          <Link href="/settings/preferences">阅读设置</Link>
          <Link href="/community">社区</Link>
          <Link href="/settings">设置</Link>
          <button className="button-reset" onClick={handleSignOut} type="button">
            退出登录
          </button>
        </div>
      </header>
    </>
  );
}
