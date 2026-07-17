import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ColumnSchema = z.object({
  name: z.string().min(1).max(60),
  type: z.enum(["text", "number", "boolean", "date", "url"]),
  required: z.boolean().optional().default(false),
});
export type SiteColumn = z.infer<typeof ColumnSchema>;

const TableSchema = z.object({
  name: z.string().min(1).max(60),
  columns: z.array(ColumnSchema).min(1).max(20),
});

const DESIGN_PROMPT = `You are a database architect. Given an app description, output a JSON object describing the tables needed.

Rules:
- Return ONLY raw JSON, no markdown fences, no commentary.
- Shape: {"tables":[{"name":"snake_case_plural","columns":[{"name":"snake_case","type":"text|number|boolean|date|url","required":true|false}]}]}
- Include an "id" column ONLY implicitly (system-managed); do not add it.
- 1 to 6 tables. Each table: 2 to 10 columns.
- Use realistic column names (e.g. title, price, description, image_url, published_at).
- Never use SQL keywords or spaces in names.`;

export const designSiteSchema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ siteId: z.string().uuid(), prompt: z.string().min(3).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    // Verify ownership
    const { data: site, error: siteErr } = await context.supabase
      .from("sites").select("id, owner_id").eq("id", data.siteId).maybeSingle();
    if (siteErr) throw new Error(siteErr.message);
    if (!site || site.owner_id !== context.userId) throw new Error("Site not found");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: DESIGN_PROMPT },
          { role: "user", content: data.prompt },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI request failed [${res.status}]: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    let raw: string = json?.choices?.[0]?.message?.content ?? "{}";
    raw = raw.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed: { tables: z.infer<typeof TableSchema>[] };
    try {
      const obj = JSON.parse(raw);
      parsed = z.object({ tables: z.array(TableSchema).min(1).max(6) }).parse(obj);
    } catch (e: any) {
      throw new Error(`Schema parse failed: ${e.message}`);
    }

    // Upsert tables: delete removed ones by name, insert/update each
    const { data: existing } = await context.supabase
      .from("site_tables").select("id, name").eq("site_id", data.siteId);
    const existingByName = new Map((existing ?? []).map((t: any) => [t.name, t.id as string]));
    const keepNames = new Set(parsed.tables.map((t) => t.name));

    // Delete tables no longer in the design
    const toDelete = (existing ?? []).filter((t: any) => !keepNames.has(t.name)).map((t: any) => t.id);
    if (toDelete.length) {
      await context.supabase.from("site_tables").delete().in("id", toDelete);
    }

    for (const t of parsed.tables) {
      const id = existingByName.get(t.name);
      if (id) {
        await context.supabase.from("site_tables").update({ columns: t.columns }).eq("id", id);
      } else {
        await context.supabase.from("site_tables").insert({
          site_id: data.siteId, name: t.name, columns: t.columns as any,
        });
      }
    }

    const { data: final } = await context.supabase
      .from("site_tables").select("id, name, columns").eq("site_id", data.siteId).order("name");
    return { tables: final ?? [] };
  });

export const getSiteSchema = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ siteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: tables } = await context.supabase
      .from("site_tables").select("id, name, columns").eq("site_id", data.siteId).order("name");
    return { tables: tables ?? [] };
  });

export const listRows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tableId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("site_rows").select("id, data, created_at, updated_at")
      .eq("table_id", data.tableId).order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const insertRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    siteId: z.string().uuid(),
    tableId: z.string().uuid(),
    data: z.record(z.string(), z.any()),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("site_rows").insert({ site_id: data.siteId, table_id: data.tableId, data: data.data as any })
      .select("id, data, created_at, updated_at").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ rowId: z.string().uuid(), data: z.record(z.string(), z.any()) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("site_rows").update({ data: data.data as any }).eq("id", data.rowId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ rowId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("site_rows").delete().eq("id", data.rowId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
