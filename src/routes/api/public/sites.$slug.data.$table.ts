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

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/sites/$slug/data/$table")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ params }) => {
        const sb = makeClient();
        const { data: site } = await sb
          .from("sites").select("id").eq("slug", params.slug).eq("is_published", true).maybeSingle();
        if (!site) return Response.json({ error: "Site not found" }, { status: 404, headers: cors });

        const { data: table } = await sb
          .from("site_tables").select("id").eq("site_id", site.id).eq("name", params.table).maybeSingle();
        if (!table) return Response.json({ error: "Table not found" }, { status: 404, headers: cors });

        const { data: rows, error } = await sb
          .from("site_rows").select("id, data, created_at").eq("table_id", table.id)
          .order("created_at", { ascending: false }).limit(500);
        if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });

        return Response.json({ rows: rows ?? [] }, { headers: cors });
      },
    },
  },
});
