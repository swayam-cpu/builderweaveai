import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const fetchPublishedSite = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: site } = await sb
      .from("sites").select("html,title,is_published")
      .eq("slug", data.slug).eq("is_published", true).maybeSingle();
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
  return (
    <div className="min-h-screen bg-white">
      <iframe
        srcDoc={site.html}
        title={site.title}
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
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
