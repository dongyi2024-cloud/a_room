import "server-only";

import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { getPublicSupabaseEnv, getSupabaseServiceRoleKey } from "@/lib/supabase/env";
import type { Database } from "@/types/supabase";

const nodeWebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

export function getSupabaseServiceRoleClient() {
  const { url } = getPublicSupabaseEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    realtime: {
      transport: nodeWebSocket
    }
  });
}
