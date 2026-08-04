import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROJECT_SYSTEM_PROMPT } from "@/lib/project-prompt";
import { mergeProject } from "@/lib/project-template";

export const generateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        siteId: z.string().uuid(),
        prompt: z.string().min(3).max(2000),
        images: z.array(z.string()).max(4).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const { data: tables } = await context.supabase
      .from("site_tables")
      .select("name, columns")
      .eq("site_id", data.siteId)
      .order("name");

    let schemaBlock = "";
    if (tables && tables.length) {
      schemaBlock =
        "\n\nDATABASE TABLES available via window.WeaveDB:\n" +
        tables
          .map(
            (t: any) =>
              `- ${t.name}: ${(t.columns as any[]).map((c) => `${c.name} (${c.type})`).join(", ")}`,
          )
          .join("\n");
    }

    const userContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text:
          data.prompt +
          (data.images?.length
            ? "\n\nUse the attached image(s) as strong visual reference — match their style, palette, and mood."
            : "") +
          schemaBlock,
      },
    ];
    for (const url of data.images ?? []) {
      userContent.push({ type: "image_url", image_url: { url } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PROJECT_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI request failed [${res.status}]: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    let raw: string = json?.choices?.[0]?.message?.content ?? "{}";
    raw = raw
      .trim()
      .replace(/^```json?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed: { title?: string; files: Record<string, string> };
    try {
      parsed = z
        .object({ title: z.string().optional(), files: z.record(z.string(), z.string()) })
        .parse(JSON.parse(raw));
    } catch (e: any) {
      throw new Error(`Project parse failed: ${e.message}`);
    }
    if (!Object.keys(parsed.files).length) throw new Error("AI returned no files");

    const files = mergeProject(parsed.files);
    const title = (parsed.title ?? "Untitled App").slice(0, 120);

    const { error } = await context.supabase
      .from("sites")
      .update({
        files,
        kind: "multi",
        prompt: data.prompt,
        title,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.siteId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);

    return { files, title };
  });

export const saveProjectFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ siteId: z.string().uuid(), files: z.record(z.string(), z.string()) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sites")
      .update({ files: data.files, kind: "multi", updated_at: new Date().toISOString() })
      .eq("id", data.siteId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveProjectDist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ siteId: z.string().uuid(), dist: z.record(z.string(), z.string()) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!data.dist["index.html"]) throw new Error("Build output is missing index.html");
    const { error } = await context.supabase
      .from("sites")
      .update({ dist: data.dist, updated_at: new Date().toISOString() })
      .eq("id", data.siteId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true, count: Object.keys(data.dist).length };
  });
