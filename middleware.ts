import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/supabase";

function shouldSkipAuthRefresh(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname === "/api/home/summary" ||
    pathname === "/reader/sample-sheng-si-chang" ||
    pathname.startsWith("/reader/sample-sheng-si-chang/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

export async function middleware(request: NextRequest) {
  if (shouldSkipAuthRefresh(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request
  });
  const { url, anonKey } = getPublicSupabaseEnv();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookieEntries) {
        cookieEntries.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
