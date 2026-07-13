import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import { Plus, ExternalLink, Globe, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

type Site = {
  id: string; title: string; slug: string; is_published: boolean;
  created_at: string; prompt: string;
};

function Dashboard() {
  const [sites, setSites] = useState<Site[] | null>(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    const { data } = await supabase.from("sites").select("id,title,slug,is_published,created_at,prompt").order("created_at", { ascending: false });
    setSites((data as Site[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const createNew = async () => {
    setCreating(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authed");
      const slug = `site-${Math.random().toString(36).slice(2, 8)}`;
      const { data, error } = await supabase.from("sites").insert({
        owner_id: u.user.id, slug, title: "Untitled Site",
      }).select("id").single();
      if (error) throw error;
      navigate({ to: "/builder/$id", params: { id: data.id } });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setCreating(false); }
  };

  const deleteSite = async (id: string) => {
    if (!confirm("Delete this site?")) return;
    await supabase.from("sites").delete().eq("id", id);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Your projects</h1>
          <p className="text-sm text-muted-foreground mt-1">Build a new site with AI, or open an existing one.</p>
        </div>
        <button onClick={createNew} disabled={creating}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2 hover:opacity-90 glow-primary disabled:opacity-50">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New site
        </button>
      </div>

      {sites === null ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : sites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Globe className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">No sites yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Click "New site" to prompt the AI to build your first one.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((s) => (
            <div key={s.id} className="rounded-xl bg-gradient-card border border-border p-5 hover:border-primary/40 transition-colors group">
              <div className="flex items-start justify-between">
                <Link to="/builder/$id" params={{ id: s.id }} className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{s.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.prompt || "No prompt yet"}</p>
                </Link>
                <button onClick={() => deleteSite(s.id)} className="p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                {s.is_published ? (
                  <a href={getPublicSiteUrl(s.slug)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline font-mono">
                    /s/{s.slug} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">Draft</span>
                )}
                <span className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
