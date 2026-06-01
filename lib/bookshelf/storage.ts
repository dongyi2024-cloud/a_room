import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { BOOK_FILES_BUCKET } from "@/lib/bookshelf/constants";
import type { Database } from "@/types/supabase";

let bucketReady = false;

export async function ensureBookFilesBucket(client: SupabaseClient<Database>) {
  if (bucketReady) {
    return;
  }

  const { data: bucket, error: bucketError } = await client.storage.getBucket(BOOK_FILES_BUCKET);

  if (bucketError && !bucketError.message.toLowerCase().includes("not found")) {
    throw bucketError;
  }

  if (!bucket) {
    const { error: createError } = await client.storage.createBucket(BOOK_FILES_BUCKET, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024,
      allowedMimeTypes: ["application/epub+zip", "application/octet-stream"]
    });

    if (createError && !createError.message.toLowerCase().includes("already exists")) {
      throw createError;
    }
  }

  bucketReady = true;
}
