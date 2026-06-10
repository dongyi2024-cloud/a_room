import { NextResponse } from "next/server";
import { getPersonalNoteHomeSummary, PersonalNoteSchemaError } from "@/lib/notes/data";
import { countVisibleReflectionCards } from "@/lib/reflections/data";
import { getCurrentUser } from "@/lib/supabase/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadNoteSummary(userId: string) {
  try {
    return await getPersonalNoteHomeSummary(userId);
  } catch (error) {
    if (!(error instanceof PersonalNoteSchemaError)) {
      console.error("Unable to load homepage note summary", error);
    }

    return {
      latestNote: null,
      noteCount: 0
    };
  }
}

async function loadCommunityCount() {
  try {
    return await countVisibleReflectionCards();
  } catch (error) {
    console.error("Unable to load homepage community count", error);
    return 0;
  }
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Login is required before loading homepage summary." }, { status: 401 });
  }

  const [noteSummary, communityCount] = await Promise.all([
    loadNoteSummary(user.id),
    loadCommunityCount()
  ]);

  return NextResponse.json({
    latestNote: noteSummary.latestNote,
    noteCount: noteSummary.noteCount,
    communityCount
  });
}
