import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_site",
  title: "Get site",
  description: "Fetch one of the signed-in user's sites, including its generated HTML.",
  inputSchema: {
    siteId: z.string().uuid().describe("The site id, as returned by list_sites."),
    includeHtml: z.boolean().optional().describe("Include the full HTML document (default true)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ siteId, includeHtml = true }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("sites")
      .select("id, title, slug, prompt, is_published, html, created_at, updated_at")
      .eq("id", siteId)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("Site not found");
    const site = includeHtml ? data : { ...data, html: undefined };
    return {
      content: [{ type: "text", text: JSON.stringify(site) }],
      structuredContent: { site },
    };
  },
});
