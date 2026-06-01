import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import WebSocket from "ws";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/supabase";

const nodeWebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

export function getSupabaseServerClient() {
  const cookieStore = cookies();
  const { url, anonKey } = getPublicSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    realtime: {
      transport: nodeWebSocket
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookieEntries) {
        try {
          cookieEntries.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components can read cookies but may not be able to persist them.
        }
      }
    }
  });
}
