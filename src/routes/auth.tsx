import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AtSign, Loader2 } from "lucide-react";

const searchSchema = z.object({ mode: z.enum(["login", "signup"]).catch("signup") });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  const dob =
    dobYear && dobMonth && dobDay
      ? `${dobYear}-${String(dobMonth).padStart(2, "0")}-${String(dobDay).padStart(2, "0")}`
      : "";
  const [gender, setGender] = useState("");

  const isSignup = mode === "signup";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const uname = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(uname)) {
        toast.error("Username must be 3–20 chars: a–z, 0–9, _");
        return;
      }
      const email = `${uname}@weave.com`;

      if (isSignup) {
        if (!fullName.trim() || !dob || !gender) {
          toast.error("Please fill in name, date of birth, and gender");
          return;
        }
        if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
        // Check username availability
        const { data: available } = await (supabase.rpc as any)("username_available", { _username: uname });
        if (available === false) { toast.error("That username is taken"); return; }

        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        const uid = data.user?.id;
        if (!uid) throw new Error("Signup failed");

        const { error: pErr } = await supabase.from("profiles").insert({
          id: uid, username: uname, full_name: fullName.trim(), dob, gender,
        });
        if (pErr) throw pErr;
        toast.success(`Welcome! Your Weave ID: ${uname}@weave.com`);
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="h-8 w-8 rounded-lg bg-gradient-hero glow-primary" />
          <span className="font-display font-bold text-lg">Weave</span>
        </Link>
        <div className="rounded-2xl bg-gradient-card border border-border p-8">
          <h1 className="text-2xl font-bold">{isSignup ? "Create your Weave account" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignup ? "Pick a username — it becomes your @weave.com ID." : "Sign in with your @weave.com ID."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="Username">
              <div className="flex rounded-md border border-border bg-input overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="yourname" required autoComplete="username"
                  className="flex-1 bg-transparent px-3 py-2 text-sm outline-none" />
                <span className="px-3 py-2 text-sm text-muted-foreground bg-muted flex items-center gap-1 font-mono">
                  <AtSign className="h-3 w-3" />weave.com
                </span>
              </div>
            </Field>

            {isSignup && (
              <>
                <Field label="Full name">
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} required
                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                </Field>
                <Field label="Date of birth">
                  <div className="grid grid-cols-3 gap-2">
                    <select value={dobDay} onChange={(e) => setDobDay(e.target.value)} required
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
                      <option value="">Day</option>
                      {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <select value={dobMonth} onChange={(e) => setDobMonth(e.target.value)} required
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
                      <option value="">Month</option>
                      {[
                        ["1", "Jan"], ["2", "Feb"], ["3", "Mar"], ["4", "Apr"],
                        ["5", "May"], ["6", "Jun"], ["7", "Jul"], ["8", "Aug"],
                        ["9", "Sep"], ["10", "Oct"], ["11", "Nov"], ["12", "Dec"],
                      ].map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                    <select value={dobYear} onChange={(e) => setDobYear(e.target.value)} required
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
                      <option value="">Year</option>
                      {Array.from({ length: 100 }, (_, i) => String(new Date().getFullYear() - i)).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </Field>
                <Field label="Gender">
                  <select value={gender} onChange={(e) => setGender(e.target.value)} required
                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Select…</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="nonbinary">Non-binary</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_say">Prefer not to say</option>
                  </select>
                </Field>
              </>
            )}

            <Field label="Password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                autoComplete={isSignup ? "new-password" : "current-password"} minLength={8}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </Field>

            <button type="submit" disabled={busy}
              className="w-full rounded-md bg-primary text-primary-foreground font-medium py-2.5 text-sm hover:opacity-90 disabled:opacity-50 glow-primary flex items-center justify-center gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSignup ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignup ? "Have an account? " : "New here? "}
            <Link to="/auth" search={{ mode: isSignup ? "login" : "signup" }} className="text-primary hover:underline">
              {isSignup ? "Sign in" : "Create one"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
