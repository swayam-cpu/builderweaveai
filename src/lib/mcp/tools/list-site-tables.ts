import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_site_tables",
  title: "List site tables",
  description: "List the database tables designed for one of the signed-in user's sites, with their columns.",
  inputSchema: { siteId: z.string().uuid().describe("The site id.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ siteId }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("site_tables")
      .select("id, name, columns")
      .eq("site_id", siteId)
      .order("name");
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { tables: data ?? [] },
    };
  },
});
