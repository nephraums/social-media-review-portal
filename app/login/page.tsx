import { signInWithEmail } from "@/app/actions/auth";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <main className="page" style={{ maxWidth: 520 }}>
      <div className="card">
        <p className="pill">Reviewer portal</p>
        <h1>Sign in</h1>
        <p className="muted">Use a Supabase Auth reviewer or admin account.</p>
        {error ? <p className="notice">{error}</p> : null}
        <form action={signInWithEmail} className="grid">
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit">Sign in</button>
        </form>
      </div>
    </main>
  );
}
