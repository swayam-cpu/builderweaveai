import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { publishSite } from "@/lib/sites.functions";
import { generateProject, saveProjectDist } from "@/lib/project.functions";
import { designSiteSchema, getSiteSchema, listRows, insertRow, deleteRow } from "@/lib/site-data.functions";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import { Loader2, Sparkles, Globe, ExternalLink, EyeOff, Copy, ArrowLeft, Database, Wand2, Plus, Trash2, Layers, Play, FileCode } from "lucide-react";
import { toast } from "sonner";
import { PromptInput } from "@/components/PromptInput";

export const Route = createFileRoute("/_authenticated/builder/$id")({ component: Builder });

type Site = {
  id: string; title: string; slug: string; html: string; prompt: string; is_published: boolean;
  files: Record<string, string> | null; dist: Record<string, string> | null; kind: string | null;
};

type SiteColumn = { name: string; type: "text" | "number" | "boolean" | "date" | "url"; required?: boolean };
type SiteTable = { id: string; name: string; columns: SiteColumn[] };
type SiteRow = { id: string; data: Record<string, any>; created_at: string; updated_at?: string };

function Builder() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState<Site | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [pubBusy, setPubBusy] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [tab, setTab] = useState<"design" | "database">("design");
  const [tables, setTables] = useState<SiteTable[]>([]);
  const [designBusy, setDesignBusy] = useState(false);
  const wcWin = useRef<Window | null>(null);
  const filesRef = useRef<Record<string, string>>({});
  const [wcOpen, setWcOpen] = useState(false);

  const genFn = useServerFn(generateProject);
  const saveDistFn = useServerFn(saveProjectDist);
  const pubFn = useServerFn(publishSite);
  const designFn = useServerFn(designSiteSchema);
  const schemaFn = useServerFn(getSiteSchema);

  const load = async () => {
    const { data, error } = await supabase.from("sites").select("*").eq("id", id).maybeSingle();
    if (error || !data) { toast.error("Site not found"); navigate({ to: "/dashboard" }); return; }
    setSite(data as Site);
    filesRef.current = ((data as Site).files ?? {}) as Record<string, string>;
    setPrompt((data as Site).prompt);
    try {
      const s = await schemaFn({ data: { siteId: id } });
      setTables(s.tables as SiteTable[]);
    } catch { /* ignore */ }
  };
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "weave:wc-ready") {
        setWcOpen(true);
        event.source && (event.source as Window).postMessage({ type: "weave:files", files: filesRef.current }, "*");
      }
      if (msg.type === "weave:dist" && msg.dist) {
        try {
          const res = await saveDistFn({ data: { siteId: id, dist: msg.dist } });
          toast.success(`Build saved (${res.count} files) — ready to publish`);
        } catch (e: any) {
          toast.error(e.message ?? "Could not save build");
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [id]);

  const openPreview = () => {
    if (!Object.keys(filesRef.current).length) { toast.error("Generate your app first"); return; }
    if (wcWin.current && !wcWin.current.closed) {
      wcWin.current.focus();
      wcWin.current.postMessage({ type: "weave:files", files: filesRef.current }, "*");
      return;
    }
    wcWin.current = window.open("/api/public/wc", "weave-webcontainer", "width=1280,height=860");
    if (!wcWin.current) toast.error("Allow pop-ups to open the live preview");
  };

  const generate = async () => {
    if (!prompt.trim()) { toast.error("Describe your site first"); return; }
    setBusy(true);
    try {
      const res = await genFn({ data: { siteId: id, prompt, images: attachments } });
      filesRef.current = res.files;
      setSite((s) => s ? { ...s, files: res.files, title: res.title, kind: "multi", prompt } : s);
      setAttachments([]);
      toast.success(`Generated ${Object.keys(res.files).length} files ✨`);
      if (wcWin.current && !wcWin.current.closed) {
        wcWin.current.postMessage({ type: "weave:files", files: res.files }, "*");
      } else {
        openPreview();
      }
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    } finally { setBusy(false); }
  };

  const designSchema = async () => {
    if (!prompt.trim()) { toast.error("Describe your app first"); return; }
    setDesignBusy(true);
    try {
      const res = await designFn({ data: { siteId: id, prompt } });
      setTables(res.tables as SiteTable[]);
      toast.success(`Designed ${res.tables.length} table(s)`);
    } catch (e: any) {
      toast.error(e.message ?? "Schema design failed");
    } finally { setDesignBusy(false); }
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
  const fileList = Object.keys(site?.files ?? {}).sort();

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-60px)]">
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

        <div className="flex border-b border-border">
          <button onClick={() => setTab("design")}
            className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 ${tab === "design" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
            <Sparkles className="h-3.5 w-3.5" /> Design
          </button>
          <button onClick={() => setTab("database")}
            className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 ${tab === "database" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
            <Database className="h-3.5 w-3.5" /> Database
            {tables.length > 0 && <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-primary/20 text-primary">{tables.length}</span>}
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {tab === "design" ? (
            <>
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
                {fileList.length ? "Regenerate app" : "Generate app"}
              </button>

              {site && (
                <div className="pt-4 border-t border-border space-y-2">
                  <button onClick={openPreview} disabled={!fileList.length}
                    className="w-full rounded-md border border-border font-medium py-2 text-sm flex items-center justify-center gap-2 hover:bg-card disabled:opacity-50">
                    <Play className="h-4 w-4" /> {wcOpen ? "Focus live preview" : "Open live preview"}
                  </button>
                  <button onClick={togglePublish} disabled={pubBusy || !(site.dist && site.dist["index.html"])}
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
            </>
          ) : (
            <DatabasePanel
              siteId={id}
              tables={tables}
              designBusy={designBusy}
              onDesign={designSchema}
              hasPrompt={!!prompt.trim()}
            />
          )}
        </div>
      </aside>

      <section className="flex-1 bg-background flex flex-col min-h-[400px]">
        <div className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-destructive/50" />
            <div className="h-2.5 w-2.5 rounded-full bg-accent/50" />
            <div className="h-2.5 w-2.5 rounded-full bg-primary/50" />
          </div>
          <span className="ml-2 font-mono">Project</span>
        </div>
        {fileList.length ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-xl mx-auto">
              <button onClick={openPreview}
                className="w-full rounded-md bg-primary text-primary-foreground font-medium py-3 text-sm flex items-center justify-center gap-2 hover:opacity-90 glow-primary">
                <Play className="h-4 w-4" /> Run live preview in WebContainer
              </button>
              <p className="mt-3 text-xs text-muted-foreground text-center">
                Opens a real Node dev server in a new tab: installs dependencies, runs Vite, and hot-reloads.
                Use “Build &amp; save for publish” there before publishing.
              </p>
              <div className="mt-6 rounded-md border border-border divide-y divide-border">
                {fileList.map((f) => (
                  <div key={f} className="flex items-center gap-2 px-3 py-2 text-xs font-mono">
                    <FileCode className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                    <span className="truncate">{f}</span>
                    <span className="ml-auto text-muted-foreground">{(site?.files?.[f]?.length ?? 0)} B</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
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

function DatabasePanel({ siteId, tables, designBusy, onDesign, hasPrompt }: {
  siteId: string;
  tables: SiteTable[];
  designBusy: boolean;
  onDesign: () => void;
  hasPrompt: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tables.find((t) => t.id === selectedId) ?? tables[0] ?? null;

  useEffect(() => {
    if (!selectedId && tables[0]) setSelectedId(tables[0].id);
  }, [tables, selectedId]);

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
        <p className="mb-2">Weave designs a database for your app from your prompt. Generated pages read from it via <code className="text-primary font-mono">window.WeaveDB.list('table')</code>.</p>
      </div>
      <button onClick={onDesign} disabled={designBusy || !hasPrompt}
        className="w-full rounded-md bg-accent text-accent-foreground font-medium py-2 text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50">
        {designBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {tables.length ? "Redesign schema" : "Design schema from prompt"}
      </button>

      {tables.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <Layers className="h-6 w-6 mx-auto mb-2 opacity-60" />
          No tables yet. Click above to auto-design a schema from your prompt.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {tables.map((t) => (
              <button key={t.id} onClick={() => setSelectedId(t.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono border ${selected?.id === t.id ? "bg-primary/20 text-primary border-primary/50" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {t.name}
              </button>
            ))}
          </div>
          {selected && <TableView siteId={siteId} table={selected} />}
        </>
      )}
    </div>
  );
}

function TableView({ siteId, table }: { siteId: string; table: SiteTable }) {
  const [rows, setRows] = useState<SiteRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const listFn = useServerFn(listRows);
  const insertFn = useServerFn(insertRow);
  const deleteFn = useServerFn(deleteRow);

  const refresh = async () => {
    const res = await listFn({ data: { tableId: table.id } });
    setRows(res.rows as SiteRow[]);
  };
  useEffect(() => { refresh(); }, [table.id]);
  useEffect(() => { setForm({}); setAdding(false); }, [table.id]);

  const add = async () => {
    setBusy(true);
    try {
      const cleaned: Record<string, any> = {};
      for (const c of table.columns) {
        const v = form[c.name];
        if (v === undefined || v === "") continue;
        if (c.type === "number") cleaned[c.name] = Number(v);
        else if (c.type === "boolean") cleaned[c.name] = !!v;
        else cleaned[c.name] = v;
      }
      await insertFn({ data: { siteId, tableId: table.id, data: cleaned } });
      setForm({});
      setAdding(false);
      await refresh();
      toast.success("Row added");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  const removeRow = async (rowId: string) => {
    if (!confirm("Delete this row?")) return;
    await deleteFn({ data: { rowId } });
    await refresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          <span className="font-mono text-foreground">{table.name}</span> · {table.columns.length} cols · {rows?.length ?? "…"} rows
        </div>
        <button onClick={() => setAdding((v) => !v)} className="text-xs px-2 py-1 rounded border border-border hover:bg-card flex items-center gap-1">
          <Plus className="h-3 w-3" /> Row
        </button>
      </div>

      {adding && (
        <div className="rounded-md border border-border p-3 space-y-2 bg-card/50">
          {table.columns.map((c) => (
            <div key={c.name}>
              <label className="text-[10px] uppercase text-muted-foreground font-medium">{c.name} <span className="opacity-60">({c.type})</span></label>
              {c.type === "boolean" ? (
                <input type="checkbox" checked={!!form[c.name]} onChange={(e) => setForm({ ...form, [c.name]: e.target.checked })} className="mt-1 h-4 w-4" />
              ) : (
                <input
                  type={c.type === "number" ? "number" : c.type === "date" ? "date" : "text"}
                  value={form[c.name] ?? ""}
                  onChange={(e) => setForm({ ...form, [c.name]: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
              )}
            </div>
          ))}
          <button onClick={add} disabled={busy} className="w-full rounded-md bg-primary text-primary-foreground py-1.5 text-xs font-medium disabled:opacity-50">
            {busy ? "Saving…" : "Save row"}
          </button>
        </div>
      )}

      <div className="rounded-md border border-border overflow-hidden">
        <div className="overflow-x-auto max-h-[40vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                {table.columns.map((c) => (
                  <th key={c.name} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">{c.name}</th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr><td colSpan={table.columns.length + 1} className="px-2 py-3 text-center text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={table.columns.length + 1} className="px-2 py-3 text-center text-muted-foreground">No rows yet</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  {table.columns.map((c) => (
                    <td key={c.name} className="px-2 py-1.5 whitespace-nowrap max-w-[160px] truncate">
                      {formatCell(r.data?.[c.name], c.type)}
                    </td>
                  ))}
                  <td className="px-1">
                    <button onClick={() => removeRow(r.id)} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatCell(v: any, type: string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (type === "boolean") return v ? "✓" : "✗";
  return String(v);
}
