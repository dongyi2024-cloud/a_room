import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { BOOK_FILES_BUCKET } from "@/lib/bookshelf/constants";
import { getDisplayFileStem, isSupportedEpubFile, sanitizeStorageStem } from "@/lib/bookshelf/helpers";
import { ensureBookFilesBucket } from "@/lib/bookshelf/storage";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Login is required before uploading books." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No EPUB file was provided." }, { status: 400 });
    }

    if (!isSupportedEpubFile(file.name, file.type)) {
      return NextResponse.json({ error: "Only EPUB files are supported in the current ingestion flow." }, { status: 400 });
    }

    const serviceClient = getSupabaseServiceRoleClient();
    await ensureBookFilesBucket(serviceClient);

    const bookId = randomUUID();
    const displayStem = getDisplayFileStem(file.name) || "未命名书籍";
    const safeStorageStem = sanitizeStorageStem(file.name) || "uploaded-book";
    const storagePath = `${user.id}/${bookId}/${safeStorageStem}.epub`;
    const uploadBuffer = Buffer.from(await file.arrayBuffer());

    const { error: storageError } = await serviceClient.storage.from(BOOK_FILES_BUCKET).upload(storagePath, uploadBuffer, {
      contentType: file.type || "application/epub+zip",
      upsert: false
    });

    if (storageError) {
      throw storageError;
    }

    const { error: bookInsertError } = await serviceClient.from("books").insert({
      id: bookId,
      user_id: user.id,
      title: displayStem,
      author: "Unknown author",
      description: "",
      language: "unknown",
      source_file_name: file.name,
      source_file_type: file.type || "application/epub+zip",
      source_storage_path: storagePath,
      import_status: "processing",
      rag_status: "processing",
      rag_error: null
    });

    if (bookInsertError) {
      await serviceClient.storage.from(BOOK_FILES_BUCKET).remove([storagePath]);
      throw bookInsertError;
    }

    const { error: shelfInsertError } = await serviceClient.from("user_bookshelves").insert({
      user_id: user.id,
      book_id: bookId
    });

    if (shelfInsertError) {
      await serviceClient.from("books").delete().eq("id", bookId);
      await serviceClient.storage.from(BOOK_FILES_BUCKET).remove([storagePath]);
      throw shelfInsertError;
    }

    return NextResponse.json({ bookId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload this EPUB right now." },
      { status: 500 }
    );
  }
}
