import { APP_NAME } from "@/lib/constants";

export function ConfigureView() {
  return (
    <main className="configure-shell">
      <div className="auth-identity">
        <span className="identity-mark" aria-hidden="true" />
        <span>{APP_NAME}</span>
      </div>
      <section>
        <p className="micro-label">CONNECTION</p>
        <h1>Finish the Supabase setup.</h1>
        <p>
          Add the public project URL and anon key to <code>.env.local</code>, then run the migrations in <code>supabase/migrations</code>.
        </p>
      </section>
    </main>
  );
}
