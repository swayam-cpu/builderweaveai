import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-client";
import { LayoutDashboard, Mail, LogOut, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: "login" } });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { profile, email } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
          <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="h-7 w-7 rounded-lg bg-gradient-hero glow-primary" />
            <span className="font-display font-bold">Weave</span>
          </Link>
          <nav className="flex items-center gap-1 ml-4">
            <NavLink to="/dashboard" active={pathname === "/dashboard" || pathname.startsWith("/builder")}>
              <LayoutDashboard className="h-4 w-4" /> Projects
            </NavLink>
            <NavLink to="/mail" active={pathname.startsWith("/mail")}>
              <Mail className="h-4 w-4" /> Mail
            </NavLink>
          </nav>
          <div className="flex-1" />
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="font-mono text-muted-foreground">{email ?? "…"}</span>
          </div>
          <button onClick={signOut} className="p-2 rounded-md hover:bg-card text-muted-foreground hover:text-foreground" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link to={to} className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${active ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-card/60"}`}>
      {children}
    </Link>
  );
}
