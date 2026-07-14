import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateSite, publishSite } from "@/lib/sites.functions";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import { Loader2, Sparkles, Globe, ExternalLink, EyeOff, Copy, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PromptInput } from "@/components/PromptInput";

export const Route = createFileRoute("/_authenticated/builder/$id")({ component: Builder });

type Site = {
  id: string; title: string; slug: string; html: string; prompt: string; is_published: boolean;
};

function Builder() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState<Site | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [pubBusy, setPubBusy] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const genFn = useServerFn(generateSite);
  const pubFn = useServerFn(publishSite);

  const load = async () => {
    const { data, error } = await supabase.from("sites").select("*").eq("id", id).maybeSingle();
    if (error || !data) { toast.error("Site not found"); navigate({ to: "/dashboard" }); return; }
    setSite(data as Site);
    setPrompt((data as Site).prompt);
  };
  useEffect(() => { load(); }, [id]);

  const generate = async () => {
    if (!prompt.trim()) { toast.error("Describe your site first"); return; }
    setBusy(true);
    try {
      const res = await genFn({ data: { siteId: id, prompt } });
      setSite((s) => s ? { ...s, html: res.html, title: res.title, prompt } : s);
      toast.success("Site generated ✨");
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    } finally { setBusy(false); }
  };

  const togglePublish = async () => {
    if (!site) return;
    setPubBusy(true);
    try {
      await pubFn({ data: { siteId: id, publish: !site.is_published } });
      setSite({ ...site, is_published: !site.is_published });
      toast.success(!site.is_published ? "Published 🚀" : "Unpublished");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setPubBusy(false); }
  };

  const publicUrl = site ? getPublicSiteUrl(site.slug) : "";

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-60px)]">
      {/* Prompt panel */}
      <aside className="w-full lg:w-96 border-r border-border bg-card/50 flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <button onClick={() => navigate({ to: "/dashboard" })} className="p-1.5 rounded-md hover:bg-card">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold truncate">{site?.title ?? "Loading…"}</h2>
            <p className="text-xs text-muted-foreground font-mono truncate">/s/{site?.slug}</p>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Describe your site</label>
            <div className="mt-2">
              <PromptInput
                value={prompt}
                onChange={setPrompt}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                placeholder="A modern portfolio for a photographer who shoots architecture in Tokyo. Dark theme, minimalist, big image grid, contact form."
                rows={10}
              />
            </div>
          </div>
          <button onClick={generate} disabled={busy}
            className="w-full rounded-md bg-primary text-primary-foreground font-medium py-2.5 text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 glow-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {site?.html ? "Regenerate" : "Generate site"}
          </button>

          {site && (
            <div className="pt-4 border-t border-border space-y-2">
              <button onClick={togglePublish} disabled={pubBusy || !site.html}
                className={`w-full rounded-md font-medium py-2 text-sm flex items-center justify-center gap-2 disabled:opacity-50 ${site.is_published ? "border border-border hover:bg-card" : "bg-accent text-accent-foreground hover:opacity-90 glow-accent"}`}>
                {pubBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : site.is_published ? <EyeOff className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                {site.is_published ? "Unpublish" : "Publish"}
              </button>
              {site.is_published && (
                <div className="rounded-md bg-muted/50 p-2.5 text-xs">
                  <div className="text-muted-foreground mb-1">Live URL</div>
                  <div className="flex items-center gap-2">
                    <a href={publicUrl} target="_blank" rel="noreferrer" className="flex-1 font-mono text-primary hover:underline truncate">
                      {publicUrl}
                    </a>
                    <button onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Copied"); }}
                      className="p-1 hover:bg-card rounded"><Copy className="h-3 w-3" /></button>
                    <a href={publicUrl} target="_blank" rel="noreferrer" className="p-1 hover:bg-card rounded"><ExternalLink className="h-3 w-3" /></a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Preview */}
      <section className="flex-1 bg-background flex flex-col min-h-[400px]">
        <div className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-destructive/50" />
            <div className="h-2.5 w-2.5 rounded-full bg-accent/50" />
            <div className="h-2.5 w-2.5 rounded-full bg-primary/50" />
          </div>
          <span className="ml-2 font-mono">Preview</span>
        </div>
        {site?.html ? (
          <iframe
            ref={iframeRef}
            srcDoc={site.html}
            title="Preview"
            sandbox="allow-scripts allow-forms allow-same-origin"
            className="flex-1 w-full bg-white"
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-center px-4">
            <div>
              <Sparkles className="h-10 w-10 mx-auto text-primary/60 mb-3" />
              <p className="text-muted-foreground">Write a prompt and click Generate</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
