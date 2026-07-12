import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Inbox, Send, PenSquare, Loader2, AtSign, ArrowLeft, Trash2, MailOpen } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-client";

export const Route = createFileRoute("/_authenticated/mail")({ component: MailPage });

type Msg = {
  id: string; sender_id: string; recipient_id: string;
  subject: string; body: string; is_read: boolean; created_at: string;
};
type Folder = "inbox" | "sent";

function MailPage() {
  const { userId, profile } = useAuth();
  const [folder, setFolder] = useState<Folder>("inbox");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Msg | null>(null);
  const [composing, setComposing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    const col = folder === "inbox" ? "recipient_id" : "sender_id";
    const { data } = await supabase.from("mail_messages").select("*").eq(col, userId).order("created_at", { ascending: false });
    const list = (data as Msg[]) ?? [];
    setMsgs(list);
    // Load usernames
    const ids = Array.from(new Set(list.flatMap((m) => [m.sender_id, m.recipient_id])));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,username").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = p.username; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); setSelected(null); }, [folder, userId]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel("mail")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mail_messages", filter: `recipient_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, folder]);

  const openMsg = async (m: Msg) => {
    setSelected(m);
    if (folder === "inbox" && !m.is_read) {
      await supabase.from("mail_messages").update({ is_read: true }).eq("id", m.id);
      setMsgs((prev) => prev.map((x) => x.id === m.id ? { ...x, is_read: true } : x));
    }
  };

  const delMsg = async (id: string) => {
    await supabase.from("mail_messages").delete().eq("id", id);
    setMsgs((prev) => prev.filter((x) => x.id !== id));
    setSelected(null);
    toast.success("Deleted");
  };

  const unread = msgs.filter((m) => folder === "inbox" && !m.is_read).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">Weave Mail</h1>
          <p className="text-sm text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
            <AtSign className="h-3 w-3" />{profile?.username}@weave.com
          </p>
        </div>
        <button onClick={() => setComposing(true)}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2 hover:opacity-90 glow-primary">
          <PenSquare className="h-4 w-4" /> Compose
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
        <aside className="space-y-1">
          <FolderBtn active={folder === "inbox"} onClick={() => setFolder("inbox")}>
            <Inbox className="h-4 w-4" /> Inbox {unread > 0 && <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-2">{unread}</span>}
          </FolderBtn>
          <FolderBtn active={folder === "sent"} onClick={() => setFolder("sent")}>
            <Send className="h-4 w-4" /> Sent
          </FolderBtn>
        </aside>

        <div className="rounded-xl bg-gradient-card border border-border overflow-hidden min-h-[500px]">
          {selected ? (
            <MessageView msg={selected} folder={folder} profiles={profiles} onBack={() => setSelected(null)} onDelete={() => delMsg(selected.id)} />
          ) : loading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          ) : msgs.length === 0 ? (
            <div className="p-12 text-center">
              <MailOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{folder === "inbox" ? "Inbox is empty" : "No sent messages"}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {msgs.map((m) => {
                const otherId = folder === "inbox" ? m.sender_id : m.recipient_id;
                const uname = profiles[otherId] ?? "unknown";
                return (
                  <li key={m.id}>
                    <button onClick={() => openMsg(m)} className={`w-full text-left px-4 py-3 hover:bg-card/60 flex items-center gap-3 ${folder === "inbox" && !m.is_read ? "bg-primary/5" : ""}`}>
                      <div className={`h-2 w-2 rounded-full shrink-0 ${folder === "inbox" && !m.is_read ? "bg-primary" : "bg-transparent"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm truncate ${folder === "inbox" && !m.is_read ? "font-semibold" : ""}`}>
                            {folder === "inbox" ? uname : `to: ${uname}`}<span className="text-muted-foreground font-mono">@weave.com</span>
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">{new Date(m.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="text-sm text-muted-foreground truncate">{m.subject || "(no subject)"}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {composing && <Compose onClose={() => { setComposing(false); load(); }} />}
    </div>
  );
}

function FolderBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${active ? "bg-card text-foreground" : "text-muted-foreground hover:bg-card/60"}`}>
      {children}
    </button>
  );
}

function MessageView({ msg, folder, profiles, onBack, onDelete }: { msg: Msg; folder: Folder; profiles: Record<string, string>; onBack: () => void; onDelete: () => void }) {
  const from = profiles[msg.sender_id] ?? "unknown";
  const to = profiles[msg.recipient_id] ?? "unknown";
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Back</button>
        <button onClick={onDelete} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
      </div>
      <h2 className="text-xl font-bold">{msg.subject || "(no subject)"}</h2>
      <div className="mt-3 text-xs text-muted-foreground font-mono">
        From: <span className="text-foreground">{from}@weave.com</span> • To: <span className="text-foreground">{to}@weave.com</span>
      </div>
      <div className="text-xs text-muted-foreground mt-1">{new Date(msg.created_at).toLocaleString()}</div>
      <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed">{msg.body}</div>
    </div>
  );
}

function Compose({ onClose }: { onClose: () => void }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const uname = to.trim().toLowerCase().replace(/@weave\.com$/, "");
      if (!uname) { toast.error("Recipient required"); return; }
      const { data: recip } = await supabase.from("profiles").select("id").eq("username", uname).maybeSingle();
      if (!recip) { toast.error(`No user ${uname}@weave.com`); return; }
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { toast.error("Not signed in"); return; }
      const { error } = await supabase.from("mail_messages").insert({
        sender_id: u.user.id, recipient_id: (recip as any).id,
        subject: subject.trim().slice(0, 200), body: body.slice(0, 10000),
      });
      if (error) throw error;
      toast.success("Sent 📬");
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <form onSubmit={send} className="w-full max-w-xl rounded-t-2xl sm:rounded-2xl bg-card border border-border shadow-2xl">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">New message</h3>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Close</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <span className="text-xs text-muted-foreground w-14">To</span>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="username" required
              className="flex-1 bg-transparent text-sm outline-none" />
            <span className="text-xs text-muted-foreground font-mono">@weave.com</span>
          </div>
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <span className="text-xs text-muted-foreground w-14">Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none" />
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={10}
            placeholder="Write your message…"
            className="w-full bg-transparent text-sm outline-none resize-none" />
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end">
          <button type="submit" disabled={busy}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:opacity-90 disabled:opacity-50 glow-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
