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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      crawl_runs: {
        Row: {
          finished_at: string | null
          id: string
          seeds_meta: Json | null
          started_at: string
          stats: Json | null
          status: string
          target_per_index: number | null
        }
        Insert: {
          finished_at?: string | null
          id: string
          seeds_meta?: Json | null
          started_at: string
          stats?: Json | null
          status?: string
          target_per_index?: number | null
        }
        Update: {
          finished_at?: string | null
          id?: string
          seeds_meta?: Json | null
          started_at?: string
          stats?: Json | null
          status?: string
          target_per_index?: number | null
        }
        Relationships: []
      }
      crawl_secrets: {
        Row: {
          id: number
          secret_sha256: string
        }
        Insert: {
          id?: number
          secret_sha256: string
        }
        Update: {
          id?: number
          secret_sha256?: string
        }
        Relationships: []
      }
      crawl_sites: {
        Row: {
          color: Json | null
          composition: Json | null
          crawled_at: string
          domain: string
          error: string | null
          final_url: string | null
          index_name: string
          lang: string | null
          layout: Json | null
          lexicon: Json | null
          ok: boolean
          run_id: string
          tech: Json | null
          title: string | null
          type: Json | null
        }
        Insert: {
          color?: Json | null
          composition?: Json | null
          crawled_at: string
          domain: string
          error?: string | null
          final_url?: string | null
          index_name: string
          lang?: string | null
          layout?: Json | null
          lexicon?: Json | null
          ok: boolean
          run_id: string
          tech?: Json | null
          title?: string | null
          type?: Json | null
        }
        Update: {
          color?: Json | null
          composition?: Json | null
          crawled_at?: string
          domain?: string
          error?: string | null
          final_url?: string | null
          index_name?: string
          lang?: string | null
          layout?: Json | null
          lexicon?: Json | null
          ok?: boolean
          run_id?: string
          tech?: Json | null
          title?: string | null
          type?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      gfont_snapshots: {
        Row: {
          captured_on: string
          category: string
          family: string
          is_variable: boolean
          popularity_rank: number
          trending_rank: number
        }
        Insert: {
          captured_on: string
          category: string
          family: string
          is_variable?: boolean
          popularity_rank: number
          trending_rank: number
        }
        Update: {
          captured_on?: string
          category?: string
          family?: string
          is_variable?: boolean
          popularity_rank?: number
          trending_rank?: number
        }
        Relationships: []
      }
      ingest_runs: {
        Row: {
          detail: Json | null
          finished_at: string | null
          id: number
          job: string
          ok: boolean
          rows_written: number
          started_at: string
        }
        Insert: {
          detail?: Json | null
          finished_at?: string | null
          id?: never
          job: string
          ok: boolean
          rows_written?: number
          started_at: string
        }
        Update: {
          detail?: Json | null
          finished_at?: string | null
          id?: never
          job?: string
          ok?: boolean
          rows_written?: number
          started_at?: string
        }
        Relationships: []
      }
      wire_items: {
        Row: {
          excerpt: string | null
          fetched_at: string
          id: number
          published_at: string
          source: string
          source_kind: string
          tags: string[]
          title: string
          url: string
        }
        Insert: {
          excerpt?: string | null
          fetched_at?: string
          id?: never
          published_at: string
          source: string
          source_kind: string
          tags?: string[]
          title: string
          url: string
        }
        Update: {
          excerpt?: string | null
          fetched_at?: string
          id?: never
          published_at?: string
          source?: string
          source_kind?: string
          tags?: string[]
          title?: string
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      crawl_color_stats: {
        Row: {
          accent_top: Json | null
          avg_whitespace: number | null
          dark_share: number | null
          index_name: string | null
          median_body_contrast: number | null
          run_id: string | null
          scope: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_color_stats_live: {
        Row: {
          accent_top: Json | null
          avg_whitespace: number | null
          dark_share: number | null
          index_name: string | null
          median_body_contrast: number | null
          run_id: string | null
          scope: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_color_stats_mat: {
        Row: {
          accent_top: Json | null
          avg_whitespace: number | null
          dark_share: number | null
          index_name: string | null
          median_body_contrast: number | null
          run_id: string | null
          scope: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_cta_phrases: {
        Row: {
          index_name: string | null
          phrase: string | null
          run_id: string | null
          scope: string | null
          share: number | null
          sites: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_cta_phrases_live: {
        Row: {
          index_name: string | null
          phrase: string | null
          run_id: string | null
          scope: string | null
          share: number | null
          sites: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_cta_phrases_mat: {
        Row: {
          index_name: string | null
          phrase: string | null
          run_id: string | null
          scope: string | null
          share: number | null
          sites: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_font_share: {
        Row: {
          family: string | null
          index_name: string | null
          role: string | null
          run_id: string | null
          scope: string | null
          share: number | null
          sites: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_font_share_live: {
        Row: {
          family: string | null
          index_name: string | null
          role: string | null
          run_id: string | null
          scope: string | null
          share: number | null
          sites: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_font_share_mat: {
        Row: {
          family: string | null
          index_name: string | null
          role: string | null
          run_id: string | null
          scope: string | null
          share: number | null
          sites: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_h1_words: {
        Row: {
          index_name: string | null
          run_id: string | null
          scope: string | null
          sites: number | null
          word: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_h1_words_live: {
        Row: {
          index_name: string | null
          run_id: string | null
          scope: string | null
          sites: number | null
          word: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_h1_words_mat: {
        Row: {
          index_name: string | null
          run_id: string | null
          scope: string | null
          sites: number | null
          word: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_latest: {
        Row: {
          id: string | null
          prev_id: string | null
        }
        Relationships: []
      }
      crawl_layout_share: {
        Row: {
          dimension: string | null
          index_name: string | null
          run_id: string | null
          scope: string | null
          share: number | null
          sites: number | null
          value: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_layout_share_live: {
        Row: {
          dimension: string | null
          index_name: string | null
          run_id: string | null
          scope: string | null
          share: number | null
          sites: number | null
          value: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_layout_share_mat: {
        Row: {
          dimension: string | null
          index_name: string | null
          run_id: string | null
          scope: string | null
          share: number | null
          sites: number | null
          value: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_spread: {
        Row: {
          label: string | null
          mainstream_share: number | null
          prev_spread_pts: number | null
          scope: string | null
          signal: string | null
          spread_pts: number | null
          vanguard_share: number | null
        }
        Relationships: []
      }
      crawl_spread_live: {
        Row: {
          label: string | null
          mainstream_share: number | null
          prev_spread_pts: number | null
          scope: string | null
          signal: string | null
          spread_pts: number | null
          vanguard_share: number | null
        }
        Relationships: []
      }
      crawl_spread_mat: {
        Row: {
          label: string | null
          mainstream_share: number | null
          prev_spread_pts: number | null
          scope: string | null
          signal: string | null
          spread_pts: number | null
          vanguard_share: number | null
        }
        Relationships: []
      }
      crawl_tech_share: {
        Row: {
          index_name: string | null
          run_id: string | null
          scope: string | null
          share: number | null
          sites: number | null
          tech: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_tech_share_live: {
        Row: {
          index_name: string | null
          run_id: string | null
          scope: string | null
          share: number | null
          sites: number | null
          tech: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_tech_share_mat: {
        Row: {
          index_name: string | null
          run_id: string | null
          scope: string | null
          share: number | null
          sites: number | null
          tech: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_sites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      refresh_crawl_aggregates: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
