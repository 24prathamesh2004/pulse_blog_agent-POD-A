export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          agent: Database["public"]["Enums"]["agent_kind"]
          category_id: string | null
          error: string | null
          finished_at: string | null
          id: string
          input: Json | null
          output: Json | null
          parent_run_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["run_status"]
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          agent: Database["public"]["Enums"]["agent_kind"]
          category_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          parent_run_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          agent?: Database["public"]["Enums"]["agent_kind"]
          category_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          parent_run_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_parent_run_id_fkey"
            columns: ["parent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          category_id: string | null
          discovered_at: string
          hero_url: string | null
          id: string
          keyword_id: string | null
          raw_html: string | null
          raw_text: string | null
          reason: string | null
          source_id: string | null
          status: Database["public"]["Enums"]["candidate_status"]
          title: string | null
          url: string
        }
        Insert: {
          category_id?: string | null
          discovered_at?: string
          hero_url?: string | null
          id?: string
          keyword_id?: string | null
          raw_html?: string | null
          raw_text?: string | null
          reason?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
          title?: string | null
          url: string
        }
        Update: {
          category_id?: string | null
          discovered_at?: string
          hero_url?: string | null
          id?: string
          keyword_id?: string | null
          raw_html?: string | null
          raw_text?: string | null
          reason?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          autonomy_mode: Database["public"]["Enums"]["autonomy_mode"]
          color: string
          created_at: string
          dedup_window_hours: number
          description: string | null
          enabled: boolean
          gradient_from: string
          gradient_to: string
          icon: string
          id: string
          max_per_run: number
          name: string
          quality_threshold: number
          schedule_cron: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          autonomy_mode?: Database["public"]["Enums"]["autonomy_mode"]
          color?: string
          created_at?: string
          dedup_window_hours?: number
          description?: string | null
          enabled?: boolean
          gradient_from?: string
          gradient_to?: string
          icon?: string
          id?: string
          max_per_run?: number
          name: string
          quality_threshold?: number
          schedule_cron?: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          autonomy_mode?: Database["public"]["Enums"]["autonomy_mode"]
          color?: string
          created_at?: string
          dedup_window_hours?: number
          description?: string | null
          enabled?: boolean
          gradient_from?: string
          gradient_to?: string
          icon?: string
          id?: string
          max_per_run?: number
          name?: string
          quality_threshold?: number
          schedule_cron?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      keywords: {
        Row: {
          captured_at: string
          category_id: string | null
          id: string
          related: Json | null
          score: number
          term: string
          trend_direction: string | null
        }
        Insert: {
          captured_at?: string
          category_id?: string | null
          id?: string
          related?: Json | null
          score?: number
          term: string
          trend_direction?: string | null
        }
        Update: {
          captured_at?: string
          category_id?: string | null
          id?: string
          related?: Json | null
          score?: number
          term?: string
          trend_direction?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "keywords_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      post_chunks: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          idx: number
          post_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          idx: number
          post_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          idx?: number
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_chunks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          body_md: string
          category_id: string | null
          created_at: string
          embedding: string | null
          hero_prompt: string | null
          hero_url: string | null
          id: string
          published_at: string | null
          quality_score: number
          reasoning: string | null
          slug: string
          source_name: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["post_status"]
          storyline_id: string | null
          subtitle: string | null
          summary: string | null
          takeaways: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          body_md?: string
          category_id?: string | null
          created_at?: string
          embedding?: string | null
          hero_prompt?: string | null
          hero_url?: string | null
          id?: string
          published_at?: string | null
          quality_score?: number
          reasoning?: string | null
          slug: string
          source_name?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          storyline_id?: string | null
          subtitle?: string | null
          summary?: string | null
          takeaways?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          body_md?: string
          category_id?: string | null
          created_at?: string
          embedding?: string | null
          hero_prompt?: string | null
          hero_url?: string | null
          id?: string
          published_at?: string | null
          quality_score?: number
          reasoning?: string | null
          slug?: string
          source_name?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          storyline_id?: string | null
          subtitle?: string | null
          summary?: string | null
          takeaways?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_storyline_id_fkey"
            columns: ["storyline_id"]
            isOneToOne: false
            referencedRelation: "storylines"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      rag_questions: {
        Row: {
          answer: string | null
          citations: Json | null
          created_at: string
          id: string
          post_id: string | null
          question: string
          user_id: string | null
        }
        Insert: {
          answer?: string | null
          citations?: Json | null
          created_at?: string
          id?: string
          post_id?: string | null
          question: string
          user_id?: string | null
        }
        Update: {
          answer?: string | null
          citations?: Json | null
          created_at?: string
          id?: string
          post_id?: string | null
          question?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_questions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      sources: {
        Row: {
          category_id: string | null
          created_at: string
          enabled: boolean
          error_count: number
          id: string
          last_error: string | null
          last_ok_at: string | null
          name: string
          trust_score: number
          type: Database["public"]["Enums"]["source_type"]
          updated_at: string
          url: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          enabled?: boolean
          error_count?: number
          id?: string
          last_error?: string | null
          last_ok_at?: string | null
          name: string
          trust_score?: number
          type?: Database["public"]["Enums"]["source_type"]
          updated_at?: string
          url: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          enabled?: boolean
          error_count?: number
          id?: string
          last_error?: string | null
          last_ok_at?: string | null
          name?: string
          trust_score?: number
          type?: Database["public"]["Enums"]["source_type"]
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      storyline_events: {
        Row: {
          id: string
          occurred_at: string
          post_id: string
          storyline_id: string
        }
        Insert: {
          id?: string
          occurred_at?: string
          post_id: string
          storyline_id: string
        }
        Update: {
          id?: string
          occurred_at?: string
          post_id?: string
          storyline_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storyline_events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storyline_events_storyline_id_fkey"
            columns: ["storyline_id"]
            isOneToOne: false
            referencedRelation: "storylines"
            referencedColumns: ["id"]
          },
        ]
      }
      storylines: {
        Row: {
          created_at: string
          entity: string | null
          id: string
          last_event_at: string
          started_at: string
          summary: string | null
          title: string
        }
        Insert: {
          created_at?: string
          entity?: string | null
          id?: string
          last_event_at?: string
          started_at?: string
          summary?: string | null
          title: string
        }
        Update: {
          created_at?: string
          entity?: string | null
          id?: string
          last_event_at?: string
          started_at?: string
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      tool_calls: {
        Row: {
          args: Json | null
          created_at: string
          error: string | null
          id: string
          latency_ms: number | null
          result: Json | null
          run_id: string
          tool: string
        }
        Insert: {
          args?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          result?: Json | null
          run_id: string
          tool: string
        }
        Update: {
          args?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          result?: Json | null
          run_id?: string
          tool?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_calls_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          count: number
          day: string
          post_id: string
        }
        Insert: {
          count?: number
          day: string
          post_id: string
        }
        Update: {
          count?: number
          day?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_post_chunks: {
        Args: {
          filter_post_id?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          idx: number
          post_id: string
          similarity: number
        }[]
      }
      match_posts: {
        Args: {
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          id: string
          similarity: number
          title: string
        }[]
      }
    }
    Enums: {
      agent_kind:
        | "orchestrator"
        | "keyword"
        | "discovery"
        | "scraper"
        | "curator"
        | "editor"
        | "publisher"
      app_role: "admin" | "user"
      autonomy_mode: "auto_publish" | "draft_only" | "off"
      candidate_status:
        | "discovered"
        | "scraped"
        | "rejected"
        | "duplicate"
        | "published"
        | "approved"
      post_status: "draft" | "published" | "rejected" | "archived"
      run_status: "running" | "succeeded" | "failed" | "cancelled"
      source_type: "rss" | "web"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_kind: [
        "orchestrator",
        "keyword",
        "discovery",
        "scraper",
        "curator",
        "editor",
        "publisher",
      ],
      app_role: ["admin", "user"],
      autonomy_mode: ["auto_publish", "draft_only", "off"],
      candidate_status: [
        "discovered",
        "scraped",
        "rejected",
        "duplicate",
        "published",
        "approved",
      ],
      post_status: ["draft", "published", "rejected", "archived"],
      run_status: ["running", "succeeded", "failed", "cancelled"],
      source_type: ["rss", "web"],
    },
  },
} as const
