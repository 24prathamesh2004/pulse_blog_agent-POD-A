export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      agent_runs: { Row: { agent: string; category_id: string | null; finished_at: string | null; id: string; started_at: string; status: string; tokens_in: number | null; tokens_out: number | null; error: string | null; input: Json | null; output: Json | null; parent_run_id: string | null }; Insert: { agent: string; id?: string; started_at?: string; status?: string }; Update: { status?: string }; Relationships: [] };
      candidates: { Row: { category_id: string | null; discovered_at: string; id: string; status: string; url: string; hero_url: string | null; keyword_id: string | null; raw_html: string | null; raw_text: string | null; reason: string | null; source_id: string | null; title: string | null }; Insert: { url: string; status?: string }; Update: { status?: string }; Relationships: [] };
      categories: { Row: { color: string; gradient_from: string; gradient_to: string; id: string; name: string; slug: string; autonomy_mode: string; created_at: string; dedup_window_hours: number; description: string | null; enabled: boolean; icon: string; max_per_run: number; quality_threshold: number; schedule_cron: string; sort_order: number; updated_at: string }; Insert: { name: string; slug: string }; Update: { name?: string }; Relationships: [] };
      posts: { Row: { body_md: string; category_id: string | null; created_at: string; id: string; published_at: string | null; quality_score: number; slug: string; source_name: string | null; status: string; title: string; updated_at: string; embedding: string | null; hero_prompt: string | null; hero_url: string | null; reasoning: string | null; source_url: string | null; storyline_id: string | null; subtitle: string | null; summary: string | null; takeaways: Json | null }; Insert: { slug: string; title: string }; Update: { status?: string }; Relationships: [] };
      rag_questions: { Row: { answer: string | null; created_at: string; id: string; question: string; citations: Json | null; post_id: string | null; user_id: string | null }; Insert: { question: string }; Update: { answer?: string }; Relationships: [] };
      sources: { Row: { category_id: string | null; created_at: string; id: string; name: string; url: string; enabled: boolean; error_count: number; last_error: string | null; last_ok_at: string | null; trust_score: number; type: string; updated_at: string }; Insert: { name: string; url: string }; Update: { name?: string }; Relationships: [] };
      storylines: { Row: { created_at: string; id: string; last_event_at: string; started_at: string; title: string; entity: string | null; summary: string | null }; Insert: { title: string }; Update: { title?: string }; Relationships: [] };
      visits: { Row: { count: number; day: string; post_id: string }; Insert: { count?: number; day: string; post_id: string }; Update: { count?: number }; Relationships: [] };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
