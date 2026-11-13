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
      ai_budget: {
        Row: {
          active: boolean
          cap_usd: number
          ends_at: string | null
          scope: string
        }
        Insert: {
          active?: boolean
          cap_usd: number
          ends_at?: string | null
          scope: string
        }
        Update: {
          active?: boolean
          cap_usd?: number
          ends_at?: string | null
          scope?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          created_at: string
          error: string | null
          est_cost_usd: number
          id: number
          input_tokens: number | null
          kind: string
          model: string
          ok: boolean
          output_tokens: number | null
          scope: string
          snapshot_id: number | null
          state: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          est_cost_usd: number
          id?: number
          input_tokens?: number | null
          kind: string
          model: string
          ok?: boolean
          output_tokens?: number | null
          scope: string
          snapshot_id?: number | null
          state?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          est_cost_usd?: number
          id?: number
          input_tokens?: number | null
          kind?: string
          model?: string
          ok?: boolean
          output_tokens?: number | null
          scope?: string
          snapshot_id?: number | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_scope_fkey"
            columns: ["scope"]
            isOneToOne: false
            referencedRelation: "ai_budget"
            referencedColumns: ["scope"]
          },
          {
            foreignKeyName: "ai_usage_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "library_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
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
      library_ai_baselines: {
        Row: {
          captured_at: string
          confirmed_at: string
          domain: string
          kind: string
          last_snapshot_id: number | null
          page_type: string
          pending: Json
          signals: Json
          snapshot_id: number | null
          viewport: string
        }
        Insert: {
          captured_at: string
          confirmed_at: string
          domain: string
          kind: string
          last_snapshot_id?: number | null
          page_type: string
          pending?: Json
          signals: Json
          snapshot_id?: number | null
          viewport: string
        }
        Update: {
          captured_at?: string
          confirmed_at?: string
          domain?: string
          kind?: string
          last_snapshot_id?: number | null
          page_type?: string
          pending?: Json
          signals?: Json
          snapshot_id?: number | null
          viewport?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_ai_baselines_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_latest"
            referencedColumns: ["domain"]
          },
          {
            foreignKeyName: "library_ai_baselines_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_sites"
            referencedColumns: ["domain"]
          },
        ]
      }
      library_ai_control: {
        Row: {
          lease_token: string | null
          lease_until: string | null
          name: string
          paused: boolean
          rate_limits: number
          reason: string | null
        }
        Insert: {
          lease_token?: string | null
          lease_until?: string | null
          name: string
          paused?: boolean
          rate_limits?: number
          reason?: string | null
        }
        Update: {
          lease_token?: string | null
          lease_until?: string | null
          name?: string
          paused?: boolean
          rate_limits?: number
          reason?: string | null
        }
        Relationships: []
      }
      library_ai_jobs: {
        Row: {
          attempts: number
          claimed_at: string | null
          created_at: string
          done_at: string | null
          error: string | null
          id: number
          kind: string
          lease_token: string | null
          snapshot_id: number
          status: string
          validation_error: string | null
          validation_failures: number
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          done_at?: string | null
          error?: string | null
          id?: number
          kind: string
          lease_token?: string | null
          snapshot_id: number
          status?: string
          validation_error?: string | null
          validation_failures?: number
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          done_at?: string | null
          error?: string | null
          id?: number
          kind?: string
          lease_token?: string | null
          snapshot_id?: number
          status?: string
          validation_error?: string | null
          validation_failures?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_ai_jobs_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: true
            referencedRelation: "library_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      library_baselines: {
        Row: {
          confirmed_at: string
          domain: string
          page_type: string
          pending: Json
          signals: Json
          snapshot_id: number | null
          source: string
          viewport: string
        }
        Insert: {
          confirmed_at: string
          domain: string
          page_type: string
          pending?: Json
          signals: Json
          snapshot_id?: number | null
          source: string
          viewport: string
        }
        Update: {
          confirmed_at?: string
          domain?: string
          page_type?: string
          pending?: Json
          signals?: Json
          snapshot_id?: number | null
          source?: string
          viewport?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_baselines_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_latest"
            referencedColumns: ["domain"]
          },
          {
            foreignKeyName: "library_baselines_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_sites"
            referencedColumns: ["domain"]
          },
          {
            foreignKeyName: "library_baselines_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "library_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      library_events: {
        Row: {
          after: Json | null
          before: Json | null
          detected_at: string | null
          domain: string
          effective_at: string | null
          id: number
          page_type: string
          prev_snapshot_id: number | null
          severity: number
          snapshot_id: number | null
          source: string
          summary: string | null
          type: string
          viewport: string
        }
        Insert: {
          after?: Json | null
          before?: Json | null
          detected_at?: string | null
          domain: string
          effective_at?: string | null
          id?: number
          page_type: string
          prev_snapshot_id?: number | null
          severity: number
          snapshot_id?: number | null
          source?: string
          summary?: string | null
          type: string
          viewport: string
        }
        Update: {
          after?: Json | null
          before?: Json | null
          detected_at?: string | null
          domain?: string
          effective_at?: string | null
          id?: number
          page_type?: string
          prev_snapshot_id?: number | null
          severity?: number
          snapshot_id?: number | null
          source?: string
          summary?: string | null
          type?: string
          viewport?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_events_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_latest"
            referencedColumns: ["domain"]
          },
          {
            foreignKeyName: "library_events_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_sites"
            referencedColumns: ["domain"]
          },
          {
            foreignKeyName: "library_events_prev_snapshot_id_fkey"
            columns: ["prev_snapshot_id"]
            isOneToOne: false
            referencedRelation: "library_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_events_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "library_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      library_extractions: {
        Row: {
          created_at: string
          data: Json
          domain: string
          kind: string
          model: string
          snapshot_id: number
        }
        Insert: {
          created_at?: string
          data: Json
          domain: string
          kind: string
          model: string
          snapshot_id: number
        }
        Update: {
          created_at?: string
          data?: Json
          domain?: string
          kind?: string
          model?: string
          snapshot_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_extractions_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_latest"
            referencedColumns: ["domain"]
          },
          {
            foreignKeyName: "library_extractions_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_sites"
            referencedColumns: ["domain"]
          },
          {
            foreignKeyName: "library_extractions_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: true
            referencedRelation: "library_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      library_history_control: {
        Row: {
          dirty: boolean
          id: number
        }
        Insert: {
          dirty?: boolean
          id?: number
        }
        Update: {
          dirty?: boolean
          id?: number
        }
        Relationships: []
      }
      library_sites: {
        Row: {
          active: boolean | null
          added_at: string | null
          domain: string
          last_change_at: string | null
          last_snapshot_at: string | null
          name: string | null
          pages: Json | null
          sector: string
        }
        Insert: {
          active?: boolean | null
          added_at?: string | null
          domain: string
          last_change_at?: string | null
          last_snapshot_at?: string | null
          name?: string | null
          pages?: Json | null
          sector: string
        }
        Update: {
          active?: boolean | null
          added_at?: string | null
          domain?: string
          last_change_at?: string | null
          last_snapshot_at?: string | null
          name?: string | null
          pages?: Json | null
          sector?: string
        }
        Relationships: []
      }
      library_snapshot_text: {
        Row: {
          raw_text: string
          snapshot_id: number
        }
        Insert: {
          raw_text: string
          snapshot_id: number
        }
        Update: {
          raw_text?: string
          snapshot_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_snapshot_text_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: true
            referencedRelation: "library_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      library_snapshots: {
        Row: {
          captured_at: string
          content_hash: string | null
          domain: string
          html_hash: string | null
          id: number
          page_type: string
          run_id: string | null
          signals: Json
          signals_hash: string | null
          source: string
          url: string | null
          viewport: string
        }
        Insert: {
          captured_at: string
          content_hash?: string | null
          domain: string
          html_hash?: string | null
          id?: number
          page_type: string
          run_id?: string | null
          signals: Json
          signals_hash?: string | null
          source?: string
          url?: string | null
          viewport: string
        }
        Update: {
          captured_at?: string
          content_hash?: string | null
          domain?: string
          html_hash?: string | null
          id?: number
          page_type?: string
          run_id?: string | null
          signals?: Json
          signals_hash?: string | null
          source?: string
          url?: string | null
          viewport?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_snapshots_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_latest"
            referencedColumns: ["domain"]
          },
          {
            foreignKeyName: "library_snapshots_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_sites"
            referencedColumns: ["domain"]
          },
        ]
      }
      library_tags: {
        Row: {
          created_at: string
          domain: string
          model: string
          signals_hash: string
          snapshot_id: number
          tags: Json
        }
        Insert: {
          created_at?: string
          domain: string
          model: string
          signals_hash: string
          snapshot_id: number
          tags: Json
        }
        Update: {
          created_at?: string
          domain?: string
          model?: string
          signals_hash?: string
          snapshot_id?: number
          tags?: Json
        }
        Relationships: [
          {
            foreignKeyName: "library_tags_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_latest"
            referencedColumns: ["domain"]
          },
          {
            foreignKeyName: "library_tags_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_sites"
            referencedColumns: ["domain"]
          },
          {
            foreignKeyName: "library_tags_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: true
            referencedRelation: "library_snapshots"
            referencedColumns: ["id"]
          },
        ]
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
      ai_spend_summary: {
        Row: {
          backfill_cap_usd: number | null
          backfill_usd: number | null
          changelog_calls: number | null
          month_to_date_usd: number | null
          monthly_cap_usd: number | null
          pricing_calls: number | null
          product_calls: number | null
          vision_calls: number | null
        }
        Relationships: []
      }
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
      library_ai_extraction_history: {
        Row: {
          captured_at: string | null
          created_at: string | null
          data: Json | null
          domain: string | null
          kind: string | null
          model: string | null
          sector: string | null
          snapshot_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_extractions_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_latest"
            referencedColumns: ["domain"]
          },
          {
            foreignKeyName: "library_extractions_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_sites"
            referencedColumns: ["domain"]
          },
          {
            foreignKeyName: "library_extractions_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: true
            referencedRelation: "library_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      library_ai_status: {
        Row: {
          name: string | null
          paused: boolean | null
          reason: string | null
        }
        Insert: {
          name?: string | null
          paused?: boolean | null
          reason?: string | null
        }
        Update: {
          name?: string | null
          paused?: boolean | null
          reason?: string | null
        }
        Relationships: []
      }
      library_ai_tag_history: {
        Row: {
          captured_at: string | null
          created_at: string | null
          domain: string | null
          model: string | null
          sector: string | null
          snapshot_id: number | null
          tags: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "library_tags_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_latest"
            referencedColumns: ["domain"]
          },
          {
            foreignKeyName: "library_tags_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_sites"
            referencedColumns: ["domain"]
          },
          {
            foreignKeyName: "library_tags_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: true
            referencedRelation: "library_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      library_changelog_stats: {
        Row: {
          median_ai_share: number | null
          median_entries_last_30d: number | null
          sector: string | null
          shipped_last_30d_share: number | null
          sites_extracted: number | null
        }
        Relationships: []
      }
      library_css_history: {
        Row: {
          bucket: string | null
          coverage: number | null
          feature: string | null
          low_coverage: boolean | null
          sector: string | null
          share: number | null
          sites: number | null
        }
        Relationships: []
      }
      library_css_series: {
        Row: {
          bucket: string | null
          coverage: number | null
          feature: string | null
          low_coverage: boolean | null
          sector: string | null
          share: number | null
          sites: number | null
        }
        Relationships: []
      }
      library_css_series_mat: {
        Row: {
          bucket: string | null
          coverage: number | null
          feature: string | null
          low_coverage: boolean | null
          sector: string | null
          share: number | null
          sites: number | null
        }
        Relationships: []
      }
      library_event_feed: {
        Row: {
          after: Json | null
          before: Json | null
          detected_at: string | null
          domain: string | null
          effective_at: string | null
          id: number | null
          page_type: string | null
          prev_snapshot_id: number | null
          sector: string | null
          severity: number | null
          snapshot_id: number | null
          source: string | null
          summary: string | null
          type: string | null
          viewport: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_events_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_latest"
            referencedColumns: ["domain"]
          },
          {
            foreignKeyName: "library_events_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_sites"
            referencedColumns: ["domain"]
          },
          {
            foreignKeyName: "library_events_prev_snapshot_id_fkey"
            columns: ["prev_snapshot_id"]
            isOneToOne: false
            referencedRelation: "library_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_events_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "library_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      library_feature_themes: {
        Row: {
          change_28d: number | null
          delta_28d_pts: number | null
          sector: string | null
          share: number | null
          sites: number | null
          sites_28d: number | null
          sites_extracted: number | null
          theme: string | null
        }
        Relationships: []
      }
      library_font_history: {
        Row: {
          bucket: string | null
          coverage: number | null
          family: string | null
          low_coverage: boolean | null
          role: string | null
          share: number | null
          sites: number | null
        }
        Relationships: []
      }
      library_font_series: {
        Row: {
          bucket: string | null
          coverage: number | null
          family: string | null
          low_coverage: boolean | null
          role: string | null
          share: number | null
          sites: number | null
        }
        Relationships: []
      }
      library_font_series_mat: {
        Row: {
          bucket: string | null
          coverage: number | null
          family: string | null
          low_coverage: boolean | null
          role: string | null
          share: number | null
          sites: number | null
        }
        Relationships: []
      }
      library_history_coverage: {
        Row: {
          bucket: string | null
          coverage: number | null
          sector: string | null
          sites: number | null
        }
        Relationships: []
      }
      library_history_samples: {
        Row: {
          bucket: string | null
          captured_at: string | null
          domain: string | null
          id: number | null
          sector: string | null
          signals: Json | null
          source: string | null
        }
        Relationships: []
      }
      library_latest: {
        Row: {
          accent: string | null
          body_family: string | null
          domain: string | null
          events_30d: number | null
          h1_family: string | null
          hero_media: string | null
          last_change_at: string | null
          last_snapshot_at: string | null
          sector: string | null
          theme: string | null
          whitespace_ratio: number | null
        }
        Relationships: []
      }
      library_pending: {
        Row: {
          domain: string | null
          field: string | null
          first_seen_at: string | null
          from: Json | null
          page_type: string | null
          to: Json | null
          viewport: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_baselines_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_latest"
            referencedColumns: ["domain"]
          },
          {
            foreignKeyName: "library_baselines_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "library_sites"
            referencedColumns: ["domain"]
          },
        ]
      }
      library_pricing_stats: {
        Row: {
          ai_addon_share: number | null
          credit_metering_share: number | null
          enterprise_contact_share: number | null
          free_tier_share: number | null
          median_cheapest_paid_monthly: number | null
          sector: string | null
          sites_extracted: number | null
          trial_share: number | null
          usage_based_share: number | null
          usd_sites: number | null
        }
        Relationships: []
      }
      library_sector_stats: {
        Row: {
          dark_theme_share: number | null
          events_30d: number | null
          median_whitespace_ratio: number | null
          sector: string | null
          serif_headline_share: number | null
          sites: number | null
          sites_snapshotted: number | null
        }
        Relationships: []
      }
      library_signal_history: {
        Row: {
          bucket: string | null
          coverage: number | null
          dark_theme_share: number | null
          framer_share: number | null
          low_coverage: boolean | null
          median_h1_px: number | null
          median_whitespace: number | null
          next_share: number | null
          pill_cta_share: number | null
          sector: string | null
          serif_h1_share: number | null
          sites: number | null
          system_ui_body_share: number | null
          tailwind_share: number | null
          tight_tracking_share: number | null
          video_hero_share: number | null
          webflow_share: number | null
          webfont_share: number | null
          webgl_hero_share: number | null
        }
        Relationships: []
      }
      library_signal_series: {
        Row: {
          bucket: string | null
          coverage: number | null
          dark_theme_share: number | null
          framer_share: number | null
          low_coverage: boolean | null
          median_h1_px: number | null
          median_whitespace: number | null
          next_share: number | null
          pill_cta_share: number | null
          sector: string | null
          serif_h1_share: number | null
          sites: number | null
          system_ui_body_share: number | null
          tailwind_share: number | null
          tight_tracking_share: number | null
          video_hero_share: number | null
          webflow_share: number | null
          webfont_share: number | null
          webgl_hero_share: number | null
        }
        Relationships: []
      }
      library_signal_series_mat: {
        Row: {
          bucket: string | null
          coverage: number | null
          dark_theme_share: number | null
          framer_share: number | null
          low_coverage: boolean | null
          median_h1_px: number | null
          median_whitespace: number | null
          next_share: number | null
          pill_cta_share: number | null
          sector: string | null
          serif_h1_share: number | null
          sites: number | null
          system_ui_body_share: number | null
          tailwind_share: number | null
          tight_tracking_share: number | null
          video_hero_share: number | null
          webflow_share: number | null
          webfont_share: number | null
          webgl_hero_share: number | null
        }
        Relationships: []
      }
      library_tag_history: {
        Row: {
          bucket: string | null
          coverage: number | null
          dimension: string | null
          low_coverage: boolean | null
          sector: string | null
          share: number | null
          tagged_sites: number | null
          value: string | null
        }
        Relationships: []
      }
      library_tag_series: {
        Row: {
          bucket: string | null
          coverage: number | null
          dimension: string | null
          low_coverage: boolean | null
          sector: string | null
          share: number | null
          tagged_sites: number | null
          value: string | null
        }
        Relationships: []
      }
      library_tag_series_mat: {
        Row: {
          bucket: string | null
          coverage: number | null
          dimension: string | null
          low_coverage: boolean | null
          sector: string | null
          share: number | null
          tagged_sites: number | null
          value: string | null
        }
        Relationships: []
      }
      library_tag_share: {
        Row: {
          delta_28d_pts: number | null
          dimension: string | null
          sector: string | null
          share: number | null
          share_28d: number | null
          sites: number | null
          tagged_sites: number | null
          value: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      ai_reserve: {
        Args: {
          p_estimate: number
          p_kind: string
          p_model: string
          p_snapshot_id: number
        }
        Returns: Json
      }
      ai_settle: {
        Args: {
          p_cost: number
          p_error?: string
          p_id: number
          p_input: number
          p_ok: boolean
          p_output: number
          p_state?: string
        }
        Returns: undefined
      }
      library_ai_claim: { Args: { p_token: string }; Returns: Json }
      library_ai_complete: {
        Args: {
          p_data: Json
          p_domain: string
          p_job: number
          p_kind: string
          p_model: string
          p_snapshot: number
          p_token: string
        }
        Returns: boolean
      }
      library_ai_release: { Args: { p_token: string }; Returns: undefined }
      library_ai_store: {
        Args: {
          p_data: Json
          p_expected: Json
          p_kind: string
          p_model: string
          p_snapshot: number
          p_state: Json
        }
        Returns: boolean
      }
      library_ai_worker_acquire: { Args: { p_token: string }; Returns: Json }
      library_ai_worker_next: { Args: { p_token: string }; Returns: Json }
      library_ai_worker_retry: {
        Args: { p_code: string; p_job: number; p_token: string }
        Returns: boolean
      }
      library_half_year: { Args: { t: string }; Returns: string }
      library_number: { Args: { j: Json }; Returns: number }
      library_replace_history: {
        Args: { p_history: Json; p_ids: number[] }
        Returns: Json
      }
      library_replay_input: { Args: never; Returns: Json }
      library_snapshot_context: { Args: { p_snapshot: Json }; Returns: Json }
      library_state: { Args: never; Returns: Json }
      library_store_snapshot: {
        Args: { p_context: Json; p_events: Json; p_snapshot: Json }
        Returns: Json
      }
      library_sync: { Args: { p_sites: Json }; Returns: undefined }
      normalize_currency: { Args: { c: string }; Returns: string }
      refresh_crawl_aggregates: { Args: never; Returns: undefined }
      refresh_library_history: { Args: never; Returns: undefined }
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
