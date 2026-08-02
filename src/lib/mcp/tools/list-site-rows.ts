import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_site_rows",
  title: "List site rows",
  description: "Read rows stored in one of the signed-in user's site tables.",
  inputSchema: {
    tableId: z.string().uuid().describe("Table id, as returned by list_site_tables."),
    limit: z.number().int().optional().describe("Max rows to return (default 50, max 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tableId, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const take = Math.min(Math.max(limit ?? 50, 1), 200);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("site_rows")
      .select("id, data, created_at")
      .eq("table_id", tableId)
      .order("created_at", { ascending: false })
      .limit(take);
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { rows: data ?? [] },
    };
  },
});
