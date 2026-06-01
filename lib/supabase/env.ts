type PublicSupabaseEnv = {
  url: string;
  anonKey: string;
};

function missingEnvError(variableNames: string[]) {
  return new Error(
    `Missing Supabase environment variables: ${variableNames.join(", ")}. ` +
      "Add them to your local .env file before using Supabase-backed features."
  );
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const missing: string[] = [];

  if (!url) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!anonKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (missing.length > 0) {
    throw missingEnvError(missing);
  }

  return {
    url: url!,
    anonKey: anonKey!
  };
}

export function getSupabaseServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw missingEnvError(["SUPABASE_SERVICE_ROLE_KEY"]);
  }

  return serviceRoleKey;
}
