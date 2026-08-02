import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "send_mail",
  title: "Send Weave Mail",
  description:
    "Send a Weave Mail message from the signed-in user to another Weave user, addressed by their Weave ID (username or username@weave.com).",
  inputSchema: {
    to: z.string().trim().min(1).describe("Recipient Weave ID, e.g. alice or alice@weave.com."),
    subject: z.string().trim().max(200).optional().describe("Message subject."),
    body: z.string().trim().min(1).max(10000).describe("Message body."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ to, subject, body }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const username = to.toLowerCase().replace(/@weave\.com$/, "");
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("username", username)
      .maybeSingle();
    if (pErr) throw new ToolError(pErr.message);
    if (!profile) throw new ToolError(`No Weave user named ${username}`);

    const { data: message, error } = await supabase
      .from("mail_messages")
      .insert({
        sender_id: ctx.getUserId(),
        recipient_id: profile.id,
        subject: subject ?? "(no subject)",
        body,
      })
      .select("id, subject, created_at")
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: `Sent to ${profile.username}@weave.com` }],
      structuredContent: { message },
    };
  },
});
