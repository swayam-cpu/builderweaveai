import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "insert_site_row",
  title: "Insert site row",
  description: "Insert one row of data into one of the signed-in user's site tables.",
  inputSchema: {
    siteId: z.string().uuid().describe("The site id that owns the table."),
    tableId: z.string().uuid().describe("Table id, as returned by list_site_tables."),
    data: z.record(z.string(), z.unknown()).describe("Column name to value map matching the table columns."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ siteId, tableId, data }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data: row, error } = await supabase
      .from("site_rows")
      .insert({ site_id: siteId, table_id: tableId, data })
      .select("id, data, created_at")
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(row) }],
      structuredContent: { row },
    };
  },
});
