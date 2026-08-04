import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function makeClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const isNewKey = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  const shim: typeof fetch = (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (isNewKey && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
  return createClient<Database>(url, key, {
    global: { fetch: shim },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function contentType(path: string) {
  if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "text/plain; charset=utf-8";
}

export const Route = createFileRoute("/api/public/sites/$slug/f/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const filePath = (params as any)._splat as string;
        const sb = makeClient();
        const { data: site } = await sb
          .from("sites")
          .select("dist")
          .eq("slug", params.slug)
          .eq("is_published", true)
          .maybeSingle();
        const dist = (site?.dist ?? {}) as Record<string, string>;
        const body = dist[filePath];
        if (typeof body !== "string") return new Response("Not found", { status: 404 });
        return new Response(body, {
          headers: {
            "Content-Type": contentType(filePath),
            "Access-Control-Allow-Origin": "*",
            "Cross-Origin-Resource-Policy": "cross-origin",
            "Cache-Control": "public, max-age=60",
          },
        });
      },
    },
  },
});
