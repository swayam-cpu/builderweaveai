import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { injectWeaveDB } from "@/lib/weave-db-injector";

const fetchPublishedSite = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const isNewSupabaseApiKey = publishableKey.startsWith("sb_publishable_") || publishableKey.startsWith("sb_secret_");
    const supabaseFetch: typeof fetch = (input, init) => {
      const headers = new Headers(
        typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
      );

      if (init?.headers) {
        new Headers(init.headers).forEach((value, key) => headers.set(key, value));
      }

      if (isNewSupabaseApiKey && headers.get("Authorization") === `Bearer ${publishableKey}`) {
        headers.delete("Authorization");
      }

      headers.set("apikey", publishableKey);
      return fetch(input, { ...init, headers });
    };
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { fetch: supabaseFetch },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: site, error } = await sb
      .from("sites").select("html,title,is_published")
      .eq("slug", data.slug).eq("is_published", true).maybeSingle();
    if (error) throw new Error(error.message);
    if (!site) return null;
    return site as { html: string; title: string; is_published: boolean };
  });

export const Route = createFileRoute("/s/$slug")({
  loader: async ({ params }) => {
    const site = await fetchPublishedSite({ data: { slug: params.slug } });
    if (!site) throw notFound();
    return site;
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: loaderData.title },
      { name: "description", content: `${loaderData.title} — published on Weave` },
    ] : [{ title: "Not found" }, { name: "robots", content: "noindex" }],
  }),
  component: PublishedSite,
  notFoundComponent: SiteNotFound,
  errorComponent: SiteNotFound,
});

function PublishedSite() {
  const site = Route.useLoaderData();
  const { slug } = Route.useParams();
  const html = injectWeaveDB(site.html, slug);
  return (
    <div className="min-h-screen bg-white">
      <iframe
        srcDoc={html}
        title={site.title}
        sandbox="allow-scripts allow-forms allow-popups"
        className="w-full h-screen border-0"
      />
    </div>
  );
}

function SiteNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-gradient">Site not found</h1>
        <p className="mt-3 text-muted-foreground">This site doesn't exist or has been unpublished.</p>
        <Link to="/" className="mt-6 inline-block rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">Home</Link>
      </div>
    </div>
  );
}
