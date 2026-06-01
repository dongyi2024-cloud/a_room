import { NextResponse } from "next/server";
import {
  BookDeletionAccessError,
  BookDeletionDatabaseError,
  BookDeletionNotFoundError,
  BookDeletionStorageError,
  deleteBookForUser
} from "@/lib/bookshelf/delete-book";
import { getCurrentUser } from "@/lib/supabase/auth";

export const runtime = "nodejs";

type BookDeleteRouteContext = {
  params: {
    bookId: string;
  };
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function DELETE(_request: Request, context: BookDeleteRouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Login is required before deleting books.", 401);
    }

    const bookId = context.params.bookId?.trim();

    if (!bookId) {
      return errorResponse("Missing bookId.", 400);
    }

    const result = await deleteBookForUser({
      bookId,
      userId: user.id
    });

    return NextResponse.json({
      ok: true,
      bookId: result.bookId
    });
  } catch (error) {
    if (error instanceof BookDeletionNotFoundError) {
      return errorResponse("Book was not found.", 404);
    }

    if (error instanceof BookDeletionAccessError) {
      return errorResponse("You cannot delete this book.", 403);
    }

    if (error instanceof BookDeletionStorageError) {
      console.warn("Book deletion storage cleanup failed", { error });
      return errorResponse("删除失败，请稍后重试。", 500);
    }

    if (error instanceof BookDeletionDatabaseError) {
      console.error("Book deletion database cleanup failed", { error });
      return errorResponse("删除失败，请稍后重试。", 500);
    }

    console.error("Book deletion route failed", { error });
    return errorResponse("删除失败，请稍后重试。", 500);
  }
}
