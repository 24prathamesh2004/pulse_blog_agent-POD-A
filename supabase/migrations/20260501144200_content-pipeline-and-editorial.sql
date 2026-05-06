-- ============================================================
-- CONTENT PIPELINE + EDITORIAL STRUCTURE
-- Tables: categories, sources, keywords, posts, post_chunks,
--         candidates, storylines, storyline_events
-- Functions: match_posts(), match_post_chunks()
-- ============================================================

-- ─── ENUMS ───────────────────────────────────────────────────

CREATE TYPE public.autonomy_mode AS ENUM ('auto_publish', 'draft_only', 'off');
CREATE TYPE public.source_type AS ENUM ('rss', 'web');
CREATE TYPE public.post_status AS ENUM ('draft', 'published', 'rejected', 'archived');
CREATE TYPE public.candidate_status AS ENUM (
  'discovered', 'scraped', 'rejected', 'duplicate', 'published', 'approved'
);
CREATE TYPE public.agent_kind AS ENUM (
  'orchestrator', 'keyword', 'discovery', 'scraper', 'curator', 'editor', 'publisher'
);
CREATE TYPE public.run_status AS ENUM ('running', 'succeeded', 'failed', 'cancelled');

-- ─── CATEGORIES ──────────────────────────────────────────────

CREATE TABLE public.categories (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE,
  name             text NOT NULL,
  description      text,
  color            text NOT NULL DEFAULT '#7c3aed',
  gradient_from    text NOT NULL DEFAULT '#7c3aed',
  gradient_to      text NOT NULL DEFAULT '#06b6d4',
  icon             text NOT NULL DEFAULT 'sparkles',
  autonomy_mode    public.autonomy_mode NOT NULL DEFAULT 'draft_only',
  schedule_cron    text NOT NULL DEFAULT '0 */4 * * *',
  quality_threshold int NOT NULL DEFAULT 70,
  max_per_run      int NOT NULL DEFAULT 3,
  dedup_window_hours int NOT NULL DEFAULT 48,
  enabled          boolean NOT NULL DEFAULT true,
  sort_order       int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_categories_touch
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Default category seed data
INSERT INTO public.categories
  (slug, name, description, color, gradient_from, gradient_to, icon, sort_order)
VALUES
  ('ai',          'Artificial Intelligence', 'Models, research, products, policy.',    '#8b5cf6', '#7c3aed', '#06b6d4', 'cpu',            1),
  ('climate',     'Climate & Energy',        'Earth systems, energy transition, policy.','#10b981','#065f46', '#fbbf24', 'leaf',           2),
  ('markets',     'Markets',                 'Equities, macro, crypto, deals.',         '#f59e0b', '#0f172a', '#f59e0b', 'trending-up',    3),
  ('geopolitics', 'Geopolitics',             'States, conflict, diplomacy, trade.',     '#ef4444', '#7f1d1d', '#fb923c', 'globe',          4),
  ('science',     'Science',                 'Physics, biology, space, longevity.',     '#06b6d4', '#0e7490', '#a78bfa', 'flask-conical',  5),
  ('culture',     'Culture',                 'Film, music, internet, ideas.',           '#ec4899', '#be185d', '#fde047', 'sparkles',       6);

-- ─── SOURCES ─────────────────────────────────────────────────

CREATE TABLE public.sources (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name         text NOT NULL,
  url          text NOT NULL UNIQUE,
  type         public.source_type NOT NULL DEFAULT 'rss',
  enabled      boolean NOT NULL DEFAULT true,
  last_ok_at   timestamptz,
  last_error   text,
  error_count  int NOT NULL DEFAULT 0,
  trust_score  int NOT NULL DEFAULT 50,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_sources_touch
  BEFORE UPDATE ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── KEYWORDS ────────────────────────────────────────────────

CREATE TABLE public.keywords (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  term            text NOT NULL,
  score           numeric NOT NULL DEFAULT 0,
  trend_direction text,
  related         jsonb DEFAULT '[]'::jsonb,
  captured_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.keywords (category_id, captured_at DESC);

-- ─── STORYLINES ──────────────────────────────────────────────

CREATE TABLE public.storylines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  entity        text,
  summary       text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  last_event_at timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── POSTS ───────────────────────────────────────────────────

CREATE TABLE public.posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  title         text NOT NULL,
  subtitle      text,
  body_md       text NOT NULL DEFAULT '',
  hero_url      text,
  hero_prompt   text,
  summary       text,
  takeaways     jsonb DEFAULT '[]'::jsonb,
  category_id   uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  storyline_id  uuid REFERENCES public.storylines(id) ON DELETE SET NULL,
  status        public.post_status NOT NULL DEFAULT 'draft',
  quality_score int NOT NULL DEFAULT 0,
  source_url    text,
  source_name   text,
  reasoning     text,
  published_at  timestamptz,
  embedding     extensions.vector(768),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_posts_touch
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX posts_published_idx  ON public.posts (status, published_at DESC);
CREATE INDEX posts_category_idx   ON public.posts (category_id, published_at DESC);
CREATE UNIQUE INDEX posts_slug_unique ON public.posts (slug);
CREATE INDEX posts_published_at_idx ON public.posts (published_at DESC) WHERE status = 'published';
CREATE INDEX posts_embedding_idx  ON public.posts
  USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);

-- ─── POST CHUNKS (for RAG) ───────────────────────────────────

CREATE TABLE public.post_chunks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  idx        int NOT NULL,
  content    text NOT NULL,
  embedding  extensions.vector(768),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX post_chunks_embedding_idx ON public.post_chunks
  USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);
CREATE INDEX post_chunks_post_idx ON public.post_chunks (post_id, idx);

-- ─── STORYLINE EVENTS ────────────────────────────────────────

CREATE TABLE public.storyline_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storyline_id uuid NOT NULL REFERENCES public.storylines(id) ON DELETE CASCADE,
  post_id      uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storyline_id, post_id)
);

-- ─── CANDIDATES ──────────────────────────────────────────────

CREATE TABLE public.candidates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url          text NOT NULL UNIQUE,
  title        text,
  source_id    uuid REFERENCES public.sources(id) ON DELETE SET NULL,
  keyword_id   uuid REFERENCES public.keywords(id) ON DELETE SET NULL,
  category_id  uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  raw_text     text,
  raw_html     text,
  hero_url     text,
  status       public.candidate_status NOT NULL DEFAULT 'discovered',
  reason       text,
  discovered_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX candidates_status_idx     ON public.candidates (status, discovered_at DESC);
CREATE INDEX candidates_status_cat_idx ON public.candidates (category_id, status);

-- ─── RLS ─────────────────────────────────────────────────────

ALTER TABLE public.categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storylines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_chunks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storyline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates      ENABLE ROW LEVEL SECURITY;

-- Categories: public read, admin write
CREATE POLICY "categories public read"  ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories admin write"  ON public.categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Sources: public read, admin write
CREATE POLICY "sources public read"  ON public.sources FOR SELECT USING (true);
CREATE POLICY "sources admin write"  ON public.sources FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Keywords: admin only
CREATE POLICY "keywords admin all" ON public.keywords FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storylines: public read, admin write
CREATE POLICY "storylines public read"  ON public.storylines FOR SELECT USING (true);
CREATE POLICY "storylines admin write"  ON public.storylines FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Posts: published posts public, admin sees all
CREATE POLICY "posts public read published" ON public.posts FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "posts admin write" ON public.posts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Post chunks: readable if parent post is published
CREATE POLICY "post_chunks public read" ON public.post_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id
        AND (p.status = 'published' OR public.has_role(auth.uid(), 'admin'))
    )
  );
CREATE POLICY "post_chunks admin write" ON public.post_chunks FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storyline events: public read, admin write
CREATE POLICY "storyline_events public read" ON public.storyline_events FOR SELECT USING (true);
CREATE POLICY "storyline_events admin write" ON public.storyline_events FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Candidates: admin only
CREATE POLICY "candidates admin all" ON public.candidates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── PGVECTOR SEARCH FUNCTIONS ───────────────────────────────

CREATE OR REPLACE FUNCTION public.match_post_chunks(
  query_embedding extensions.vector(768),
  match_count     int DEFAULT 8,
  filter_post_id  uuid DEFAULT NULL
)
RETURNS TABLE (
  id         uuid,
  post_id    uuid,
  idx        int,
  content    text,
  similarity float
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.id, c.post_id, c.idx, c.content,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.post_chunks c
  JOIN public.posts p ON p.id = c.post_id
  WHERE p.status = 'published'
    AND (filter_post_id IS NULL OR c.post_id = filter_post_id)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.match_posts(
  query_embedding    extensions.vector(768),
  match_count        int DEFAULT 5,
  similarity_threshold float DEFAULT 0.0
)
RETURNS TABLE (id uuid, title text, similarity float)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.id, p.title,
         1 - (p.embedding <=> query_embedding) AS similarity
  FROM public.posts p
  WHERE p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Lock down function execution to authenticated + service_role only
REVOKE EXECUTE ON FUNCTION public.match_post_chunks(extensions.vector, integer, uuid)
  FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_posts(extensions.vector, integer, double precision)
  FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.match_post_chunks(extensions.vector, integer, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.match_posts(extensions.vector, integer, double precision)
  TO service_role;
