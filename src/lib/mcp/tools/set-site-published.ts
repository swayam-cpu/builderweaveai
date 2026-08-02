import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "set_site_published",
  title: "Publish or unpublish site",
  description: "Publish or unpublish one of the signed-in user's sites. Published sites are readable by anyone.",
  inputSchema: {
    siteId: z.string().uuid().describe("The site id."),
    publish: z.boolean().describe("true to publish, false to unpublish."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ siteId, publish }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("sites")
      .update({ is_published: publish })
      .eq("id", siteId)
      .select("id, slug, is_published")
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("Site not found");
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { site: data },
    };
  },
});
