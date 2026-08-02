import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_site",
  title: "Create site",
  description:
    "Create a new empty Weave site for the signed-in user with a prompt describing it. Generate the HTML afterwards in the Weave builder.",
  inputSchema: {
    title: z.string().trim().min(1).max(120).describe("Site title."),
    prompt: z.string().trim().max(2000).optional().describe("Description of the site to build."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, prompt }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const slug = `site-${Math.random().toString(36).slice(2, 8)}`;
    const { data, error } = await supabase
      .from("sites")
      .insert({ owner_id: ctx.getUserId(), slug, title, prompt: prompt ?? "" })
      .select("id, title, slug, is_published")
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { site: data },
    };
  },
});
