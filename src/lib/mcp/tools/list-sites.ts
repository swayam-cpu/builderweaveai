import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_sites",
  title: "List sites",
  description: "List the signed-in Weave user's sites with their slug, title and publish state.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new ToolError("Not authenticated");
    const { data, error } = await supabase
      .from("sites")
      .select("id, title, slug, is_published, prompt, updated_at")
      .eq("owner_id", u.user.id)
      .order("updated_at", { ascending: false });
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { sites: data ?? [] },
    };
  },
});
