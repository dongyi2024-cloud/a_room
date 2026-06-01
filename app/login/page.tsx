import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/supabase/auth";

type LoginPageProps = {
  searchParams?: {
    next?: string;
  };
};

function sanitizeNextPath(nextPath?: string) {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/";
  }

  return nextPath;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  const nextPath = sanitizeNextPath(searchParams?.next);

  if (user) {
    redirect(nextPath);
  }

  return (
    <main className="app-shell auth-page">
      <LoginForm nextPath={nextPath} />
    </main>
  );
}
