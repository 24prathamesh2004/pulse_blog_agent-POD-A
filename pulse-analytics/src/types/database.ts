export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      agent_runs: {
        Row: { agent: string; category_id: string | null; error: string | null; finished_at: string | null; id: string; input: Json | null; output: Json | null; parent_run_id: string | null; started_at: string; status: string; tokens_in: number | null; tokens_out: number | null };
        Insert: { agent: string; category_id?: string | null; finished_at?: string | null; id?: string; started_at?: string; status?: string };
        Update: { agent?: string; status?: string };
        Relationships: [];
      };
      candidates: {
        Row: { category_id: string | null; discovered_at: string; id: string; status: string; url: string };
        Insert: { status?: string; url: string };
        Update: { status?: string };
        Relationships: [];
      };
      categories: {
        Row: { color: string; gradient_from: string; gradient_to: string; id: string; name: string; slug: string };
        Insert: { name: string; slug: string };
        Update: { name?: string };
        Relationships: [];
      };
      posts: {
        Row: { body_md: string; category_id: string | null; created_at: string; id: string; published_at: string | null; quality_score: number; slug: string; source_name: string | null; status: string; title: string; updated_at: string };
        Insert: { slug: string; title: string };
        Update: { status?: string };
        Relationships: [];
      };
      rag_questions: {
        Row: { answer: string | null; created_at: string; id: string; question: string };
        Insert: { question: string };
        Update: { answer?: string };
        Relationships: [];
      };
      sources: {
        Row: { category_id: string | null; created_at: string; id: string; name: string; url: string };
        Insert: { name: string; url: string };
        Update: { name?: string };
        Relationships: [];
      };
      storylines: {
        Row: { created_at: string; id: string; last_event_at: string; started_at: string; title: string };
        Insert: { title: string };
        Update: { title?: string };
        Relationships: [];
      };
      visits: {
        Row: { count: number; day: string; post_id: string };
        Insert: { count?: number; day: string; post_id: string };
        Update: { count?: number };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
