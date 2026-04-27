import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div>
            <strong>Social Media Review Portal</strong>
            <div className="muted">{user.email}</div>
          </div>
          <nav className="nav">
            <Link href="/">Submissions</Link>
            <Link href="/settings/style">Learning Area</Link>
            <Link href="/settings/instagram">Instagram</Link>
            <form action={signOut}>
              <button className="secondary" type="submit">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
