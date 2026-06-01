import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function sanitizeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/bookshelf";
  }

  return nextPath;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(new URL(`/login?message=${encodeURIComponent(errorDescription)}`, requestUrl.origin));
  }

  if (code) {
    const supabase = getSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
