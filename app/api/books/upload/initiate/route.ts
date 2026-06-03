import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { BOOK_FILES_BUCKET } from "@/lib/bookshelf/constants";
import { getDisplayFileStem, isSupportedEpubFile, sanitizeStorageStem } from "@/lib/bookshelf/helpers";
import { ensureBookFilesBucket } from "@/lib/bookshelf/storage";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InitiateUploadPayload = {
  fileName?: unknown;
  fileType?: unknown;
};

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const serviceClient = getSupabaseServiceRoleClient();
  let bookId: string | null = null;
  let storagePath: string | null = null;

  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Login is required before uploading books.", 401);
    }

    const payload = (await request.json()) as InitiateUploadPayload;
    const fileName = normalizeText(payload.fileName, 260);
    const fileType = normalizeText(payload.fileType, 120) || "application/epub+zip";

    if (!fileName) {
      return errorResponse("No EPUB file name was provided.", 400);
    }

    if (!isSupportedEpubFile(fileName, fileType)) {
      return errorResponse("Only EPUB files are supported in the current ingestion flow.", 400);
    }

    await ensureBookFilesBucket(serviceClient);

    bookId = randomUUID();
    const displayStem = getDisplayFileStem(fileName) || "未命名书籍";
    const safeStorageStem = sanitizeStorageStem(fileName) || "uploaded-book";
    storagePath = `${user.id}/${bookId}/${safeStorageStem}.epub`;

    const { data: signedUpload, error: signedUploadError } = await serviceClient.storage
      .from(BOOK_FILES_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signedUploadError || !signedUpload?.token) {
      throw signedUploadError ?? new Error("Unable to create a signed upload URL.");
    }

    const { error: bookInsertError } = await serviceClient.from("books").insert({
      id: bookId,
      user_id: user.id,
      title: displayStem,
      author: "Unknown author",
      description: "",
      language: "unknown",
      source_file_name: fileName,
      source_file_type: fileType,
      source_storage_path: storagePath,
      import_status: "processing",
      rag_status: "processing",
      rag_error: null
    });

    if (bookInsertError) {
      throw bookInsertError;
    }

    const { error: shelfInsertError } = await serviceClient.from("user_bookshelves").insert({
      user_id: user.id,
      book_id: bookId
    });

    if (shelfInsertError) {
      await serviceClient.from("books").delete().eq("id", bookId);
      throw shelfInsertError;
    }

    return NextResponse.json(
      {
        bookId,
        storagePath,
        uploadToken: signedUpload.token
      },
      { status: 201 }
    );
  } catch (error) {
    if (bookId) {
      await serviceClient.from("user_bookshelves").delete().eq("book_id", bookId);
      await serviceClient.from("books").delete().eq("id", bookId);
    }

    if (storagePath) {
      await serviceClient.storage.from(BOOK_FILES_BUCKET).remove([storagePath]);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to prepare this EPUB upload right now." },
      { status: 500 }
    );
  }
}
