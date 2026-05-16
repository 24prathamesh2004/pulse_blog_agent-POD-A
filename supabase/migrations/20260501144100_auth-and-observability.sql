============================================================
-- AUTH + OBSERVABILITY

-- Tables: profiles, user_roles, agent_runs, tool_calls,
--         visits, rag_questions, settings
-- Functions: has_role(), handle_new_user()
-- ============================================================

-- ─── AUTH ENUMS ──────────────────────────────────────────────

CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- ─── PROFILES ────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text,
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── USER ROLES ──────────────────────────────────────────────

CREATE TABLE public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- ─── ROLE CHECK FUNCTION ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Restrict execution: only authenticated users and service_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  TO authenticated, service_role;

-- ─── AUTO-PROVISION NEW USERS ────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count int;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );

  SELECT COUNT(*) INTO user_count FROM public.user_roles;

  -- First user ever becomes admin, everyone else gets user role
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── AGENT RUNS ──────────────────────────────────────────────

CREATE TABLE public.agent_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent         public.agent_kind NOT NULL,
  parent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  category_id   uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  status        public.run_status NOT NULL DEFAULT 'running',
  input         jsonb,
  output        jsonb,
  error         text,
  tokens_in     int DEFAULT 0,
  tokens_out    int DEFAULT 0,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);

CREATE INDEX agent_runs_started_idx ON public.agent_runs (started_at DESC);

-- ─── TOOL CALLS ──────────────────────────────────────────────

CREATE TABLE public.tool_calls (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     uuid NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  tool       text NOT NULL,
  args       jsonb,
  result     jsonb,
  error      text,
  latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tool_calls_run_idx ON public.tool_calls (run_id, created_at);

-- ─── VISITS ──────────────────────────────────────────────────

CREATE TABLE public.visits (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  day     date NOT NULL,
  count   int NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, day)
);

-- ─── RAG QUESTIONS ───────────────────────────────────────────

CREATE TABLE public.rag_questions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  post_id    uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  question   text NOT NULL,
  answer     text,
  citations  jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── SETTINGS ────────────────────────────────────────────────

CREATE TABLE public.settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_settings_touch
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Default LLM + agent settings
INSERT INTO public.settings (key, value) VALUES
  ('llm', jsonb_build_object(
    'baseUrl',        'http://localhost:11434/v1',
    'model',          'qwen2.5:7b',
    'embeddingModel', 'nomic-embed-text',
    'apiKey',         'ollama'
  )),
  ('agents_enabled', to_jsonb(true));

-- ─── RLS ─────────────────────────────────────────────────────

ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_calls    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings      ENABLE ROW LEVEL SECURITY;

-- Profiles: user sees own, admin sees all
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- User roles: user sees own role, admin manages all
CREATE POLICY "roles self read"   ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "roles admin read"  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles admin write" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Agent runs: admin only
CREATE POLICY "agent_runs admin all" ON public.agent_runs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tool calls: admin only
CREATE POLICY "tool_calls admin all" ON public.tool_calls FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Visits: public read, admin write
CREATE POLICY "visits public read"  ON public.visits FOR SELECT USING (true);
CREATE POLICY "visits admin write"  ON public.visits FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RAG questions: user sees own, admin sees all, anyone can insert
CREATE POLICY "rag self read"  ON public.rag_questions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "rag insert"     ON public.rag_questions FOR INSERT
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);
CREATE POLICY "rag admin all"  ON public.rag_questions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Settings: admin manages, public can read non-sensitive keys
CREATE POLICY "settings admin all"       ON public.settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "settings public read llm" ON public.settings FOR SELECT
  USING (key IN ('llm', 'agents_enabled'));