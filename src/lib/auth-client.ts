import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  username: string;
  full_name: string;
  dob: string;
  gender: string;
};

export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async (uid: string | null) => {
      if (!uid) { setProfile(null); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (mounted) setProfile(data as Profile | null);
    };
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      load(uid).finally(() => mounted && setLoading(false));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user.id ?? null;
      setUserId(uid);
      load(uid);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return { userId, profile, loading, email: profile ? `${profile.username}@weave.com` : null };
}
