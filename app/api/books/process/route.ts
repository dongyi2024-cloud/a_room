import { NextResponse } from "next/server";
import { BookImportAccessError, BookImportNotFoundError, processUploadedBookForUser } from "@/lib/bookshelf/importer";
import { getCurrentUser } from "@/lib/supabase/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Login is required before processing books." }, { status: 401 });
    }

    const payload = (await request.json()) as { bookId?: string };

    if (!payload.bookId) {
      return NextResponse.json({ error: "Missing bookId." }, { status: 400 });
    }

    const result = await processUploadedBookForUser({
      bookId: payload.bookId,
      userId: user.id
    });

    return NextResponse.json({
      ok: true,
      bookId: result.bookId,
      importStatus: result.importStatus,
      smartMarkStatus: result.smartMarkStatus,
      ragStatus: result.ragStatus
    });
  } catch (error) {
    if (error instanceof BookImportNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof BookImportAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to process this EPUB right now." },
      { status: 500 }
    );
  }
}
