import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Pulse" }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(""); const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) nav({ to: "/admin" }); });
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password: pw,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        setMsg("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        nav({ to: "/admin" });
      }
    } catch (err) { setMsg((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section className="mx-auto max-w-md px-6 py-20">
      <Link to="/" className="meta">← back to Pulse</Link>
      <h1 className="display-lg text-4xl mt-6">{mode === "signin" ? "Sign in" : "Create account"}</h1>
      <p className="mt-2 text-muted-foreground text-sm">First account becomes admin automatically.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="email"
          className="w-full rounded-xl border border-rule bg-card px-4 py-3 text-sm outline-none focus:border-primary" />
        <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" required minLength={6} placeholder="password"
          className="w-full rounded-xl border border-rule bg-card px-4 py-3 text-sm outline-none focus:border-primary" />
        <button disabled={busy} className="w-full inline-flex justify-center items-center gap-2 rounded-full bg-foreground text-background font-medium py-3 disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
      {msg && <p className="mt-4 text-sm text-muted-foreground">{msg}</p>}
      <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-6 text-sm text-primary underline">
        {mode === "signin" ? "Need an account? Create one" : "Have an account? Sign in"}
      </button>
    </section>
  );
}
