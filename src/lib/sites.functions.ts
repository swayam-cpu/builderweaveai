import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `You are an expert web designer. Given a description, output ONE complete self-contained HTML document.

STRICT RULES:
- Return ONLY the raw HTML starting with <!DOCTYPE html>. No markdown fences, no commentary, no prose before or after.
- Include a full <head> with title, viewport meta, and inline <style> using modern CSS (flexbox/grid, custom properties, subtle gradients, smooth transitions).
- Include realistic content: hero, features, testimonials, footer as appropriate. Never use lorem ipsum.
- Use Google Fonts via <link> if it improves design.
- Use images from https://images.unsplash.com/ with keyword URLs like https://source.unsplash.com/1200x800/?keyword.
- Design must be beautiful, modern, and responsive. Not generic. Not purple. Distinctive palette per site.
- All JS interactivity inline in a <script> tag if needed.
- Do not use external CSS/JS frameworks (no Tailwind CDN, no React).
- If DATABASE TABLES are provided below, the site has a live backend accessible via window.WeaveDB.
  Use it to render dynamic data. Example: window.WeaveDB.list('products').then(rows => { ... render rows ... }).
  Each row has an id, created_at, and the fields from the table columns.
  Prefer real data fetches over hardcoded placeholders when a matching table exists.`;

export const generateSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      siteId: z.string().uuid(),
      prompt: z.string().min(3).max(2000),
      images: z.array(z.string()).max(4).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const userContent: Array<Record<string, unknown>> = [
      { type: "text", text: data.prompt + (data.images?.length ? "\n\nUse the attached image(s) as strong visual/design reference — match their style, palette, and mood." : "") },
    ];
    for (const url of data.images ?? []) {
      userContent.push({ type: "image_url", image_url: { url } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI request failed [${res.status}]: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    let html: string = json?.choices?.[0]?.message?.content ?? "";
    // Strip accidental fences
    html = html.trim().replace(/^```html?\s*/i, "").replace(/```\s*$/i, "").trim();
    if (!html.toLowerCase().includes("<!doctype")) {
      html = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>Generated</title></head><body>${html}</body></html>`;
    }

    // Extract title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = (titleMatch?.[1] ?? "Untitled Site").slice(0, 120);

    const { error } = await context.supabase
      .from("sites")
      .update({ html, prompt: data.prompt, title, updated_at: new Date().toISOString() })
      .eq("id", data.siteId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);

    return { html, title };
  });

export const publishSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ siteId: z.string().uuid(), publish: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sites")
      .update({ is_published: data.publish })
      .eq("id", data.siteId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
