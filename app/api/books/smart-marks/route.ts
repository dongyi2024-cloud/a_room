import { NextResponse } from "next/server";
import {
  SmartMarkAccessError,
  SmartMarkNotFoundError,
  SmartMarkSourceUnavailableError,
  generateBookSmartMarksForUser
} from "@/lib/smart-marks/generation";
import { getCurrentUser } from "@/lib/supabase/auth";

export const runtime = "nodejs";

type GenerateSmartMarksApiResponse =
  | {
      ok: true;
      bookId: string;
      jobId: string;
      totalParagraphs: number;
      processedParagraphs: number;
      insertedMarks: number;
      status: "ready" | "failed";
    }
  | {
      error: string;
    };

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json<GenerateSmartMarksApiResponse>(
        { error: "Login is required before generating smart marks." },
        { status: 401 }
      );
    }

    const payload = (await request.json()) as { bookId?: string };

    if (!payload.bookId) {
      return NextResponse.json<GenerateSmartMarksApiResponse>({ error: "Missing bookId." }, { status: 400 });
    }

    const result = await generateBookSmartMarksForUser({
      bookId: payload.bookId,
      userId: user.id
    });

    return NextResponse.json<GenerateSmartMarksApiResponse>({
      ok: true,
      bookId: result.bookId,
      jobId: result.jobId,
      totalParagraphs: result.totalParagraphs,
      processedParagraphs: result.processedParagraphs,
      insertedMarks: result.insertedMarks,
      status: result.status
    });
  } catch (error) {
    if (error instanceof SmartMarkNotFoundError) {
      return NextResponse.json<GenerateSmartMarksApiResponse>({ error: error.message }, { status: 404 });
    }

    if (error instanceof SmartMarkAccessError) {
      return NextResponse.json<GenerateSmartMarksApiResponse>({ error: error.message }, { status: 403 });
    }

    if (error instanceof SmartMarkSourceUnavailableError) {
      return NextResponse.json<GenerateSmartMarksApiResponse>({ error: error.message }, { status: 400 });
    }

    return NextResponse.json<GenerateSmartMarksApiResponse>(
      { error: error instanceof Error ? error.message : "Unable to generate smart marks for this book right now." },
      { status: 500 }
    );
  }
}
