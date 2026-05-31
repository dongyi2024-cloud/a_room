import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "A Room of One's Own",
  description: "A reading room for Woolf, close reading, and quiet companionship."
};

type RootLayoutProps = {
  children: ReactNode;
};

const themeBootScript = `
try {
  var theme = window.localStorage.getItem("woolf-room.theme-mode.v1");
  if (theme === "dark" || theme === "light") {
    document.documentElement.dataset.theme = theme;
  }
} catch (_) {}
`;

export default function RootLayout({ children }: RootLayoutProps) {
  const themeCookie = cookies().get("woolf-room-theme-mode")?.value;
  const initialTheme = themeCookie === "dark" || themeCookie === "light" ? themeCookie : undefined;

  return (
    <html lang="en" data-theme={initialTheme} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {children}
      </body>
    </html>
  );
}
