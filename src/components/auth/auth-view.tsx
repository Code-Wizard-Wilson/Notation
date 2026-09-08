"use client";

import { FormEvent, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { getPublicSiteUrl } from "@/lib/env";

type Mode = "login" | "signup";

export function AuthView() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setNotice("");

    const supabase = createClient();
    if (mode === "login") {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message === "Invalid login credentials" ? "Email or password is incorrect." : authError.message);
        setPending(false);
        return;
      }
      router.refresh();
      return;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${getPublicSiteUrl()}/auth/callback` },
    });
    if (authError) {
      setError(authError.message);
    } else if (!data.session) {
      setNotice("Check your inbox to confirm your account.");
    } else {
      router.refresh();
    }
    setPending(false);
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  return (
    <main className="auth-shell">
      <div className="auth-identity" aria-label={APP_NAME}>
        <span className="identity-mark" aria-hidden="true" />
        <span>{APP_NAME}</span>
      </div>

      <section className="auth-editorial" aria-hidden="true">
        <p className="micro-label">PRIVATE NOTES / 001</p>
        <h1>Write it down.<br />Keep it close.</h1>
        <p className="auth-date">
          {new Intl.DateTimeFormat("en", {
            weekday: "long",
            month: "long",
            day: "numeric",
          }).format(new Date())}
        </p>
      </section>

      <motion.section
        className="auth-form-wrap"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="auth-mode" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            onClick={() => changeMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            onClick={() => changeMode("signup")}
          >
            Create account
          </button>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            <p className="micro-label auth-kicker">
              {mode === "login" ? "WELCOME BACK" : "YOUR PRIVATE WORKSPACE"}
            </p>
            <h2>{mode === "login" ? "Continue writing" : "Begin with a note"}</h2>

            <form onSubmit={submit} className="auth-form">
              <label>
                <span>Email address</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoFocus
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>

              <div className="auth-message" aria-live="polite">
                {error && <p className="form-error">{error}</p>}
                {notice && <p>{notice}</p>}
              </div>

              <button className="auth-submit" type="submit" disabled={pending}>
                <span>{pending ? "Please wait" : mode === "login" ? "Enter workspace" : "Create account"}</span>
                {pending ? (
                  <LoaderCircle size={17} className="spin" aria-hidden="true" />
                ) : (
                  <ArrowRight size={17} aria-hidden="true" />
                )}
              </button>
            </form>
          </motion.div>
        </AnimatePresence>
      </motion.section>
    </main>
  );
}
