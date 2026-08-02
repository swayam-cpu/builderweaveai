import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_mail",
  title: "List Weave Mail",
  description: "List the signed-in user's Weave Mail messages (inbox or sent).",
  inputSchema: {
    box: z.enum(["inbox", "sent"]).optional().describe("Which mailbox to read (default inbox)."),
    limit: z.number().int().optional().describe("Max messages (default 25, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ box = "inbox", limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const take = Math.min(Math.max(limit ?? 25, 1), 100);
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const column = box === "inbox" ? "recipient_id" : "sender_id";
    const { data, error } = await supabase
      .from("mail_messages")
      .select("id, subject, body, is_read, sender_id, recipient_id, created_at")
      .eq(column, userId!)
      .order("created_at", { ascending: false })
      .limit(take);
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { box, messages: data ?? [] },
    };
  },
});
