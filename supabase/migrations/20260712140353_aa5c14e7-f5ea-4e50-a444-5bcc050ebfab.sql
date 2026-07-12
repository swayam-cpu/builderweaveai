
-- Profiles: one per auth user, stores signup info + unique username -> username@weave.com
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  dob DATE NOT NULL,
  gender TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Public can look up basic profile info (needed to resolve @weave.com IDs for mail)
CREATE POLICY "Profiles readable by anyone signed in" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Profiles readable public username" ON public.profiles FOR SELECT TO anon USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE INDEX profiles_username_lower_idx ON public.profiles (lower(username));

-- Sites: AI-generated websites
CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Site',
  slug TEXT NOT NULL UNIQUE,
  prompt TEXT NOT NULL DEFAULT '',
  html TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their sites" ON public.sites FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Anyone can view published sites" ON public.sites FOR SELECT TO anon USING (is_published = true);
CREATE POLICY "Authed can view published sites" ON public.sites FOR SELECT TO authenticated USING (is_published = true);

-- Mail messages (internal @weave.com mail)
CREATE TABLE public.mail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_messages TO authenticated;
GRANT ALL ON public.mail_messages TO service_role;
ALTER TABLE public.mail_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own mail (in or out)" ON public.mail_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users send as themselves" ON public.mail_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Recipients update read state" ON public.mail_messages FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);
CREATE POLICY "Users delete their own mail" ON public.mail_messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE INDEX mail_recipient_idx ON public.mail_messages(recipient_id, created_at DESC);
CREATE INDEX mail_sender_idx ON public.mail_messages(sender_id, created_at DESC);
