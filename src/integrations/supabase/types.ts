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
      agent_spend: {
        Row: {
          actor: string
          at: string
          id: number
          usd: number
          what: string
        }
        Insert: {
          actor: string
          at?: string
          id?: number
          usd: number
          what: string
        }
        Update: {
          actor?: string
          at?: string
          id?: number
          usd?: number
          what?: string
        }
        Relationships: []
      }
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
          provider: string | null
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
          provider?: string | null
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
          provider?: string | null
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
            referencedRelation: "library_snapshot_fields"
            referencedColumns: ["id"]
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
      art_works: {
        Row: {
          artist: string | null
          credit_line: string
          date_display: string
          first_seen: string
          height: number
          id: number
          kind: string
          last_seen: string
          licence: string
          link: string
          movement: string | null
          palette: Json
          removed_at: string | null
          removed_reason: string | null
          run_id: string | null
          source: string
          source_id: string
          thumb: string | null
          thumb_hash: string | null
          title: string
          tradition: string
          width: number
          year_end: number
          year_start: number
        }
        Insert: {
          artist?: string | null
          credit_line: string
          date_display: string
          first_seen?: string
          height: number
          id?: never
          kind: string
          last_seen?: string
          licence: string
          link: string
          movement?: string | null
          palette: Json
          removed_at?: string | null
          removed_reason?: string | null
          run_id?: string | null
          source: string
          source_id: string
          thumb?: string | null
          thumb_hash?: string | null
          title: string
          tradition: string
          width: number
          year_end: number
          year_start: number
        }
        Update: {
          artist?: string | null
          credit_line?: string
          date_display?: string
          first_seen?: string
          height?: number
          id?: never
          kind?: string
          last_seen?: string
          licence?: string
          link?: string
          movement?: string | null
          palette?: Json
          removed_at?: string | null
          removed_reason?: string | null
          run_id?: string | null
          source?: string
          source_id?: string
          thumb?: string | null
          thumb_hash?: string | null
          title?: string
          tradition?: string
          width?: number
          year_end?: number
          year_start?: number
        }
        Relationships: []
      }
      asset_grids: {
        Row: {
          computed_at: string
          grid: string
          method: string
          path: string
          spread: number
        }
        Insert: {
          computed_at?: string
          grid: string
          method: string
          path: string
          spread: number
        }
        Update: {
          computed_at?: string
          grid?: string
          method?: string
          path?: string
          spread?: number
        }
        Relationships: []
      }
      audience_weeks: {
        Row: {
          actor: string
          at: string
          id: number
          pageviews: number
          sources: Json
          test: boolean
          top: Json
          visitors: number
          week: string
        }
        Insert: {
          actor: string
          at?: string
          id?: never
          pageviews: number
          sources?: Json
          test?: boolean
          top?: Json
          visitors: number
          week: string
        }
        Update: {
          actor?: string
          at?: string
          id?: never
          pageviews?: number
          sources?: Json
          test?: boolean
          top?: Json
          visitors?: number
          week?: string
        }
        Relationships: []
      }
      brand_assets: {
        Row: {
          bytes: number
          captured_at: string
          created_at: string
          domain: string
          first_seen_at: string
          hash: string
          height: number
          id: number
          kind: string
          last_seen_at: string
          path: string
          run_id: string | null
          width: number
        }
        Insert: {
          bytes: number
          captured_at: string
          created_at?: string
          domain: string
          first_seen_at: string
          hash: string
          height: number
          id?: never
          kind: string
          last_seen_at: string
          path: string
          run_id?: string | null
          width: number
        }
        Update: {
          bytes?: number
          captured_at?: string
          created_at?: string
          domain?: string
          first_seen_at?: string
          hash?: string
          height?: number
          id?: never
          kind?: string
          last_seen_at?: string
          path?: string
          run_id?: string | null
          width?: number
        }
        Relationships: []
      }
      brand_candidate_statuses: {
        Row: {
          actor: string
          at: string
          candidate_id: number
          id: number
          reason: string | null
          status: string
        }
        Insert: {
          actor: string
          at?: string
          candidate_id: number
          id?: never
          reason?: string | null
          status: string
        }
        Update: {
          actor?: string
          at?: string
          candidate_id?: number
          id?: never
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_candidate_statuses_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "brand_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_candidates: {
        Row: {
          at: string
          call_id: number | null
          cites: string
          domain: string
          id: number
          log_id: number | null
          name: string
          sector: string
          test: boolean
          week: string
          why: string
        }
        Insert: {
          at?: string
          call_id?: number | null
          cites: string
          domain: string
          id?: never
          log_id?: number | null
          name: string
          sector: string
          test?: boolean
          week: string
          why: string
        }
        Update: {
          at?: string
          call_id?: number | null
          cites?: string
          domain?: string
          id?: never
          log_id?: number | null
          name?: string
          sector?: string
          test?: boolean
          week?: string
          why?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_candidates_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "desk_calls_weekly"
            referencedColumns: ["id"]
          },
        ]
      }
      build_queue: {
        Row: {
          at: string
          desk: string
          expects: string
          id: number
          ikey: string | null
          kind: string
          move: Json | null
          phase: string | null
          proposal_log_id: number | null
          source_kind: string
          source_ref: string | null
          test: boolean
          title: string
          why: string
        }
        Insert: {
          at?: string
          desk: string
          expects: string
          id?: never
          ikey?: string | null
          kind: string
          move?: Json | null
          phase?: string | null
          proposal_log_id?: number | null
          source_kind?: string
          source_ref?: string | null
          test?: boolean
          title: string
          why: string
        }
        Update: {
          at?: string
          desk?: string
          expects?: string
          id?: never
          ikey?: string | null
          kind?: string
          move?: Json | null
          phase?: string | null
          proposal_log_id?: number | null
          source_kind?: string
          source_ref?: string | null
          test?: boolean
          title?: string
          why?: string
        }
        Relationships: [
          {
            foreignKeyName: "build_queue_proposal_log_id_fkey"
            columns: ["proposal_log_id"]
            isOneToOne: false
            referencedRelation: "desk_log"
            referencedColumns: ["id"]
          },
        ]
      }
      build_queue_moves: {
        Row: {
          actor: string
          at: string
          detail: Json
          id: number
          item_id: number
          reason: string | null
          status: string
        }
        Insert: {
          actor: string
          at?: string
          detail?: Json
          id?: never
          item_id: number
          reason?: string | null
          status: string
        }
        Update: {
          actor?: string
          at?: string
          detail?: Json
          id?: never
          item_id?: number
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "build_queue_moves_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "build_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      census_counts: {
        Row: {
          base: number
          census_key: string
          count: number
          created_at: string
          day: string
          id: number
          members: Json
          story_id: string
        }
        Insert: {
          base: number
          census_key: string
          count: number
          created_at?: string
          day: string
          id?: never
          members?: Json
          story_id: string
        }
        Update: {
          base?: number
          census_key?: string
          count?: number
          created_at?: string
          day?: string
          id?: never
          members?: Json
          story_id?: string
        }
        Relationships: []
      }
      change_checks: {
        Row: {
          checked_at: string
          event_id: number
          fields: Json
          id: number
          pass_fields: string[]
          verdict: string
        }
        Insert: {
          checked_at?: string
          event_id: number
          fields?: Json
          id?: never
          pass_fields?: string[]
          verdict: string
        }
        Update: {
          checked_at?: string
          event_id?: number
          fields?: Json
          id?: never
          pass_fields?: string[]
          verdict?: string
        }
        Relationships: []
      }
      chart_cards: {
        Row: {
          created_at: string
          model: Json
          origin: string
          run_id: number
          trait: string
          week: string
        }
        Insert: {
          created_at?: string
          model: Json
          origin: string
          run_id: number
          trait: string
          week: string
        }
        Update: {
          created_at?: string
          model?: Json
          origin?: string
          run_id?: number
          trait?: string
          week?: string
        }
        Relationships: []
      }
      chart_choices: {
        Row: {
          at: string
          basis: string
          call_id: number | null
          figure: string
          form: string
          id: number
          reason: string | null
          shape: string
          study: string
        }
        Insert: {
          at?: string
          basis: string
          call_id?: number | null
          figure: string
          form: string
          id?: never
          reason?: string | null
          shape: string
          study: string
        }
        Update: {
          at?: string
          basis?: string
          call_id?: number | null
          figure?: string
          form?: string
          id?: never
          reason?: string | null
          shape?: string
          study?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_choices_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "desk_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      color_tickers: {
        Row: {
          data: Json
          key: string
          scope: string
          updated_at: string
        }
        Insert: {
          data: Json
          key: string
          scope: string
          updated_at?: string
        }
        Update: {
          data?: Json
          key?: string
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      crawl_requests: {
        Row: {
          attempts: number
          domain: string
          done_at: string | null
          last_error: string | null
          rendered_at: string | null
          requested_at: string
          signals: Json | null
          status: string
          url: string
        }
        Insert: {
          attempts?: number
          domain: string
          done_at?: string | null
          last_error?: string | null
          rendered_at?: string | null
          requested_at?: string
          signals?: Json | null
          status?: string
          url: string
        }
        Update: {
          attempts?: number
          domain?: string
          done_at?: string | null
          last_error?: string | null
          rendered_at?: string | null
          requested_at?: string
          signals?: Json | null
          status?: string
          url?: string
        }
        Relationships: []
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
          galleries: string[] | null
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
          galleries?: string[] | null
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
          galleries?: string[] | null
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
      crop_quality: {
        Row: {
          bytes_per_px: number | null
          computed_at: string
          edge_mean: number | null
          lead_ok: boolean
          luma_std: number | null
          method: string
          path: string
          reason: string | null
          top_share: number | null
        }
        Insert: {
          bytes_per_px?: number | null
          computed_at?: string
          edge_mean?: number | null
          lead_ok: boolean
          luma_std?: number | null
          method: string
          path: string
          reason?: string | null
          top_share?: number | null
        }
        Update: {
          bytes_per_px?: number | null
          computed_at?: string
          edge_mean?: number | null
          lead_ok?: boolean
          luma_std?: number | null
          method?: string
          path?: string
          reason?: string | null
          top_share?: number | null
        }
        Relationships: []
      }
      data_findings: {
        Row: {
          actor: string
          at: string
          expected: string | null
          finding_id: number | null
          fkey: string | null
          found: string | null
          id: number
          kind: string | null
          measure: string | null
          op: string
          reason: string | null
          receipt: Json
          subject: string | null
        }
        Insert: {
          actor: string
          at?: string
          expected?: string | null
          finding_id?: number | null
          fkey?: string | null
          found?: string | null
          id?: never
          kind?: string | null
          measure?: string | null
          op: string
          reason?: string | null
          receipt?: Json
          subject?: string | null
        }
        Update: {
          actor?: string
          at?: string
          expected?: string | null
          finding_id?: number | null
          fkey?: string | null
          found?: string | null
          id?: never
          kind?: string | null
          measure?: string | null
          op?: string
          reason?: string | null
          receipt?: Json
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_findings_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "data_findings"
            referencedColumns: ["id"]
          },
        ]
      }
      db_alerts: {
        Row: {
          at: string
          id: number
          key: string
          level: string
          line: string
          reading: Json
        }
        Insert: {
          at?: string
          id?: never
          key: string
          level: string
          line: string
          reading?: Json
        }
        Update: {
          at?: string
          id?: never
          key?: string
          level?: string
          line?: string
          reading?: Json
        }
        Relationships: []
      }
      db_load_samples: {
        Row: {
          at: string
          stats_reset: string | null
          wal_bytes: number
        }
        Insert: {
          at?: string
          stats_reset?: string | null
          wal_bytes: number
        }
        Update: {
          at?: string
          stats_reset?: string | null
          wal_bytes?: number
        }
        Relationships: []
      }
      db_safe_mode: {
        Row: {
          actor: string
          at: string
          id: number
          is_on: boolean
          reading: Json
          reason: string
        }
        Insert: {
          actor: string
          at?: string
          id?: never
          is_on: boolean
          reading?: Json
          reason: string
        }
        Update: {
          actor?: string
          at?: string
          id?: never
          is_on?: boolean
          reading?: Json
          reason?: string
        }
        Relationships: []
      }
      desk_calls: {
        Row: {
          answer: Json
          at: string
          cost: number
          desk: string
          error: string | null
          id: number
          model: string
          ok: boolean
          prompt_version: string | null
          purpose: string
          story_ids: string[]
          usage_id: number | null
        }
        Insert: {
          answer?: Json
          at?: string
          cost?: number
          desk: string
          error?: string | null
          id?: never
          model: string
          ok: boolean
          prompt_version?: string | null
          purpose: string
          story_ids?: string[]
          usage_id?: number | null
        }
        Update: {
          answer?: Json
          at?: string
          cost?: number
          desk?: string
          error?: string | null
          id?: never
          model?: string
          ok?: boolean
          prompt_version?: string | null
          purpose?: string
          story_ids?: string[]
          usage_id?: number | null
        }
        Relationships: []
      }
      desk_calls_weekly: {
        Row: {
          answer: Json
          at: string
          cost: number
          desk: string
          error: string | null
          id: number
          model: string
          ok: boolean
          prompt_version: string | null
          purpose: string
          usage_id: number | null
          week: string | null
        }
        Insert: {
          answer?: Json
          at?: string
          cost?: number
          desk: string
          error?: string | null
          id?: never
          model: string
          ok: boolean
          prompt_version?: string | null
          purpose: string
          usage_id?: number | null
          week?: string | null
        }
        Update: {
          answer?: Json
          at?: string
          cost?: number
          desk?: string
          error?: string | null
          id?: never
          model?: string
          ok?: boolean
          prompt_version?: string | null
          purpose?: string
          usage_id?: number | null
          week?: string | null
        }
        Relationships: []
      }
      desk_log: {
        Row: {
          action: string
          actor: string
          at: string
          decision: string
          detail: Json
          edit_id: number | null
          id: number
          level: string | null
          reason: string | null
          subject_id: string | null
          subject_kind: string | null
        }
        Insert: {
          action: string
          actor: string
          at?: string
          decision: string
          detail?: Json
          edit_id?: number | null
          id?: never
          level?: string | null
          reason?: string | null
          subject_id?: string | null
          subject_kind?: string | null
        }
        Update: {
          action?: string
          actor?: string
          at?: string
          decision?: string
          detail?: Json
          edit_id?: number | null
          id?: never
          level?: string | null
          reason?: string | null
          subject_id?: string | null
          subject_kind?: string | null
        }
        Relationships: []
      }
      desk_notes: {
        Row: {
          actor: string
          at: string
          id: number
          subject_id: string
          subject_kind: string
          text: string
        }
        Insert: {
          actor: string
          at?: string
          id?: never
          subject_id: string
          subject_kind: string
          text: string
        }
        Update: {
          actor?: string
          at?: string
          id?: never
          subject_id?: string
          subject_kind?: string
          text?: string
        }
        Relationships: []
      }
      desk_pass_ends: {
        Row: {
          at: string
          error: string | null
          id: number
          ms: number
          ok: boolean
          pass_id: number
          results: Json
          rows_written: number
        }
        Insert: {
          at?: string
          error?: string | null
          id?: never
          ms: number
          ok: boolean
          pass_id: number
          results: Json
          rows_written?: number
        }
        Update: {
          at?: string
          error?: string | null
          id?: never
          ms?: number
          ok?: boolean
          pass_id?: number
          results?: Json
          rows_written?: number
        }
        Relationships: [
          {
            foreignKeyName: "desk_pass_ends_pass_id_fkey"
            columns: ["pass_id"]
            isOneToOne: true
            referencedRelation: "desk_passes"
            referencedColumns: ["id"]
          },
        ]
      }
      desk_passes: {
        Row: {
          actor: string
          at: string
          check_name: string
          day: string
          id: number
          items: Json
          plan: Json | null
          slot: string
        }
        Insert: {
          actor?: string
          at?: string
          check_name: string
          day: string
          id?: never
          items: Json
          plan?: Json | null
          slot: string
        }
        Update: {
          actor?: string
          at?: string
          check_name?: string
          day?: string
          id?: never
          items?: Json
          plan?: Json | null
          slot?: string
        }
        Relationships: []
      }
      desk_switches: {
        Row: {
          actor: string
          at: string
          id: number
          is_on: boolean
          name: string
          reason: string
        }
        Insert: {
          actor: string
          at?: string
          id?: never
          is_on: boolean
          name: string
          reason: string
        }
        Update: {
          actor?: string
          at?: string
          id?: never
          is_on?: boolean
          name?: string
          reason?: string
        }
        Relationships: []
      }
      digest_texts: {
        Row: {
          argument: Json
          attempts: number
          changes: Json
          chart_caption: string | null
          checked_at: string | null
          cost: number
          created_at: string
          deck: string
          facts_hash: string
          failures: string[]
          headline: string
          id: number
          log: Json
          model: string
          passed: boolean
          use_text: string | null
          week: string
        }
        Insert: {
          argument?: Json
          attempts?: number
          changes?: Json
          chart_caption?: string | null
          checked_at?: string | null
          cost?: number
          created_at?: string
          deck: string
          facts_hash: string
          failures?: string[]
          headline: string
          id?: never
          log?: Json
          model: string
          passed?: boolean
          use_text?: string | null
          week: string
        }
        Update: {
          argument?: Json
          attempts?: number
          changes?: Json
          chart_caption?: string | null
          checked_at?: string | null
          cost?: number
          created_at?: string
          deck?: string
          facts_hash?: string
          failures?: string[]
          headline?: string
          id?: never
          log?: Json
          model?: string
          passed?: boolean
          use_text?: string | null
          week?: string
        }
        Relationships: []
      }
      discourse_counts: {
        Row: {
          design_posts: number
          fatigue: number
          n: number
          sampled_posts: number
          source: string
          term: string
          updated_at: string
          window_end: string
          window_start: string
        }
        Insert: {
          design_posts?: number
          fatigue?: number
          n?: number
          sampled_posts?: number
          source: string
          term: string
          updated_at?: string
          window_end: string
          window_start: string
        }
        Update: {
          design_posts?: number
          fatigue?: number
          n?: number
          sampled_posts?: number
          source?: string
          term?: string
          updated_at?: string
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      font_catalog: {
        Row: {
          category: string
          family: string
          key: string
          license_hint: string
          source: string
          updated_at: string
        }
        Insert: {
          category: string
          family: string
          key: string
          license_hint: string
          source: string
          updated_at?: string
        }
        Update: {
          category?: string
          family?: string
          key?: string
          license_hint?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      font_pairs: {
        Row: {
          data: Json
          key: string
          updated_at: string
        }
        Insert: {
          data: Json
          key: string
          updated_at?: string
        }
        Update: {
          data?: Json
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      font_usage: {
        Row: {
          data: Json
          key: string
          role: string
          scope: string
          updated_at: string
        }
        Insert: {
          data: Json
          key: string
          role: string
          scope: string
          updated_at?: string
        }
        Update: {
          data?: Json
          key?: string
          role?: string
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      forecast_backtests: {
        Row: {
          at: string
          calls: number
          days: number
          detail: Json
          id: number
          mean_miss: number | null
          right_calls: number
          run_id: number
          scored_run_id: number
        }
        Insert: {
          at?: string
          calls: number
          days: number
          detail?: Json
          id?: never
          mean_miss?: number | null
          right_calls: number
          run_id: number
          scored_run_id: number
        }
        Update: {
          at?: string
          calls?: number
          days?: number
          detail?: Json
          id?: never
          mean_miss?: number | null
          right_calls?: number
          run_id?: number
          scored_run_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "forecast_backtests_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_model_card"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "forecast_backtests_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_backtests_scored_run_id_fkey"
            columns: ["scored_run_id"]
            isOneToOne: true
            referencedRelation: "forecast_model_card"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "forecast_backtests_scored_run_id_fkey"
            columns: ["scored_run_id"]
            isOneToOne: true
            referencedRelation: "forecast_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_calls: {
        Row: {
          actual_n: number | null
          actual_share: number | null
          backfilled: boolean
          band_hi: number | null
          band_lo: number | null
          band_mid: number | null
          created_at: string
          data_through: string | null
          direction: string | null
          horizon_q: number | null
          id: number
          made_at: string
          momentum: number | null
          next_wave_score: number | null
          origin: string
          outcome: string | null
          outcome_reason: string | null
          resolved_at: string | null
          run_id: number
          scope: string
          selected_by: string[]
          share_at_call: number | null
          stage_at_call: string | null
          target_quarter: string | null
          trait: string
          week: string
        }
        Insert: {
          actual_n?: number | null
          actual_share?: number | null
          backfilled?: boolean
          band_hi?: number | null
          band_lo?: number | null
          band_mid?: number | null
          created_at?: string
          data_through?: string | null
          direction?: string | null
          horizon_q?: number | null
          id?: never
          made_at: string
          momentum?: number | null
          next_wave_score?: number | null
          origin: string
          outcome?: string | null
          outcome_reason?: string | null
          resolved_at?: string | null
          run_id: number
          scope: string
          selected_by: string[]
          share_at_call?: number | null
          stage_at_call?: string | null
          target_quarter?: string | null
          trait: string
          week: string
        }
        Update: {
          actual_n?: number | null
          actual_share?: number | null
          backfilled?: boolean
          band_hi?: number | null
          band_lo?: number | null
          band_mid?: number | null
          created_at?: string
          data_through?: string | null
          direction?: string | null
          horizon_q?: number | null
          id?: never
          made_at?: string
          momentum?: number | null
          next_wave_score?: number | null
          origin?: string
          outcome?: string | null
          outcome_reason?: string | null
          resolved_at?: string | null
          run_id?: number
          scope?: string
          selected_by?: string[]
          share_at_call?: number | null
          stage_at_call?: string | null
          target_quarter?: string | null
          trait?: string
          week?: string
        }
        Relationships: []
      }
      forecast_runs: {
        Row: {
          computed_at: string
          coverage: Json
          data_cutoff_quarter: string | null
          error: string | null
          id: number
          model_card: Json
          status: string
        }
        Insert: {
          computed_at?: string
          coverage?: Json
          data_cutoff_quarter?: string | null
          error?: string | null
          id?: number
          model_card?: Json
          status?: string
        }
        Update: {
          computed_at?: string
          coverage?: Json
          data_cutoff_quarter?: string | null
          error?: string | null
          id?: number
          model_card?: Json
          status?: string
        }
        Relationships: []
      }
      forecasts: {
        Row: {
          backtest: Json
          components: Json
          computed_at: string
          current_share: number | null
          dimension: string
          evidence: Json
          id: number
          model: string | null
          momentum: number | null
          next_wave_score: number | null
          proj_q1: number | null
          proj_q1_hi: number | null
          proj_q1_lo: number | null
          proj_q2: number | null
          proj_q2_hi: number | null
          proj_q2_lo: number | null
          proj_q4: number | null
          proj_q4_hi: number | null
          proj_q4_lo: number | null
          run_id: number
          scope: string
          stage: string | null
          status: string
          value: string
        }
        Insert: {
          backtest?: Json
          components?: Json
          computed_at?: string
          current_share?: number | null
          dimension: string
          evidence?: Json
          id?: number
          model?: string | null
          momentum?: number | null
          next_wave_score?: number | null
          proj_q1?: number | null
          proj_q1_hi?: number | null
          proj_q1_lo?: number | null
          proj_q2?: number | null
          proj_q2_hi?: number | null
          proj_q2_lo?: number | null
          proj_q4?: number | null
          proj_q4_hi?: number | null
          proj_q4_lo?: number | null
          run_id: number
          scope: string
          stage?: string | null
          status: string
          value: string
        }
        Update: {
          backtest?: Json
          components?: Json
          computed_at?: string
          current_share?: number | null
          dimension?: string
          evidence?: Json
          id?: number
          model?: string | null
          momentum?: number | null
          next_wave_score?: number | null
          proj_q1?: number | null
          proj_q1_hi?: number | null
          proj_q1_lo?: number | null
          proj_q2?: number | null
          proj_q2_hi?: number | null
          proj_q2_lo?: number | null
          proj_q4?: number | null
          proj_q4_hi?: number | null
          proj_q4_lo?: number | null
          run_id?: number
          scope?: string
          stage?: string | null
          status?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecasts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_model_card"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "forecasts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      gate_results: {
        Row: {
          actor: string
          after_run: string
          at: string
          before_run: string
          checks: Json
          commit_sha: string
          id: number
          item_id: number
          pass: boolean
          tests: Json
        }
        Insert: {
          actor: string
          after_run: string
          at?: string
          before_run: string
          checks: Json
          commit_sha: string
          id?: never
          item_id: number
          pass: boolean
          tests: Json
        }
        Update: {
          actor?: string
          after_run?: string
          at?: string
          before_run?: string
          checks?: Json
          commit_sha?: string
          id?: never
          item_id?: number
          pass?: boolean
          tests?: Json
        }
        Relationships: [
          {
            foreignKeyName: "gate_results_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "build_queue"
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
      headline_calls: {
        Row: {
          after_text: string | null
          before_text: string | null
          call: string
          created_at: string
          domain: string
          event_id: number
          id: number
          model: string | null
          reason: string
          source: string
        }
        Insert: {
          after_text?: string | null
          before_text?: string | null
          call: string
          created_at?: string
          domain: string
          event_id: number
          id?: never
          model?: string | null
          reason: string
          source: string
        }
        Update: {
          after_text?: string | null
          before_text?: string | null
          call?: string
          created_at?: string
          domain?: string
          event_id?: number
          id?: never
          model?: string | null
          reason?: string
          source?: string
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
      job_run_notes: {
        Row: {
          actor: string
          at: string
          id: number
          note: string
          run_id: number
          test: boolean
        }
        Insert: {
          actor: string
          at?: string
          id?: never
          note: string
          run_id: number
          test?: boolean
        }
        Update: {
          actor?: string
          at?: string
          id?: never
          note?: string
          run_id?: number
          test?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "job_run_notes_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "job_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          at: string
          detail: Json | null
          id: number
          items: Json | null
          job: string
          ms: number | null
          note: string | null
          ok: boolean | null
          phase: string
          slot: string | null
          start_id: number | null
        }
        Insert: {
          at?: string
          detail?: Json | null
          id?: never
          items?: Json | null
          job: string
          ms?: number | null
          note?: string | null
          ok?: boolean | null
          phase: string
          slot?: string | null
          start_id?: number | null
        }
        Update: {
          at?: string
          detail?: Json | null
          id?: never
          items?: Json | null
          job?: string
          ms?: number | null
          note?: string | null
          ok?: boolean | null
          phase?: string
          slot?: string | null
          start_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_runs_start_id_fkey"
            columns: ["start_id"]
            isOneToOne: false
            referencedRelation: "job_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_steps: {
        Row: {
          attempts: number
          detail: string | null
          finished_at: string | null
          job: string
          lease_until: string | null
          position: number
          queued_at: string
          run_key: string
          started_at: string | null
          status: string
          step: string
        }
        Insert: {
          attempts?: number
          detail?: string | null
          finished_at?: string | null
          job: string
          lease_until?: string | null
          position: number
          queued_at?: string
          run_key: string
          started_at?: string | null
          status?: string
          step: string
        }
        Update: {
          attempts?: number
          detail?: string | null
          finished_at?: string | null
          job?: string
          lease_until?: string | null
          position?: number
          queued_at?: string
          run_key?: string
          started_at?: string | null
          status?: string
          step?: string
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
          paused_at: string | null
          probed_at: string | null
          rate_limits: number
          reason: string | null
        }
        Insert: {
          lease_token?: string | null
          lease_until?: string | null
          name: string
          paused?: boolean
          paused_at?: string | null
          probed_at?: string | null
          rate_limits?: number
          reason?: string | null
        }
        Update: {
          lease_token?: string | null
          lease_until?: string | null
          name?: string
          paused?: boolean
          paused_at?: string | null
          probed_at?: string | null
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
            referencedRelation: "library_snapshot_fields"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "library_snapshot_fields"
            referencedColumns: ["id"]
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
      library_event_marks: {
        Row: {
          event_id: number
          field: string
          kind: string
          marked_at: string
          reason: string
        }
        Insert: {
          event_id: number
          field: string
          kind: string
          marked_at?: string
          reason: string
        }
        Update: {
          event_id?: number
          field?: string
          kind?: string
          marked_at?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_event_marks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "library_event_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_event_marks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "library_events"
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
            referencedRelation: "library_snapshot_fields"
            referencedColumns: ["id"]
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
            referencedRelation: "library_snapshot_fields"
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
            referencedRelation: "library_snapshot_fields"
            referencedColumns: ["id"]
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
          refresh_started_at: string | null
          refreshed_at: string | null
        }
        Insert: {
          dirty?: boolean
          id?: number
          refresh_started_at?: string | null
          refreshed_at?: string | null
        }
        Update: {
          dirty?: boolean
          id?: number
          refresh_started_at?: string | null
          refreshed_at?: string | null
        }
        Relationships: []
      }
      library_history_dirty_domains: {
        Row: {
          dirty_at: string
          domain: string
          mark: number
          tries: number
        }
        Insert: {
          dirty_at?: string
          domain: string
          mark?: number
          tries?: number
        }
        Update: {
          dirty_at?: string
          domain?: string
          mark?: number
          tries?: number
        }
        Relationships: []
      }
      library_history_runs: {
        Row: {
          detail: Json
          domain_ms: Json
          domains_done: number
          domains_left: number
          feeding: boolean | null
          finished_at: string
          id: number
          kind: string
          ms: number
          rows_written: number
          started_at: string
          stopped: string | null
          views: Json
        }
        Insert: {
          detail?: Json
          domain_ms?: Json
          domains_done?: number
          domains_left?: number
          feeding?: boolean | null
          finished_at?: string
          id?: never
          kind: string
          ms: number
          rows_written?: number
          started_at: string
          stopped?: string | null
          views?: Json
        }
        Update: {
          detail?: Json
          domain_ms?: Json
          domains_done?: number
          domains_left?: number
          feeding?: boolean | null
          finished_at?: string
          id?: never
          kind?: string
          ms?: number
          rows_written?: number
          started_at?: string
          stopped?: string | null
          views?: Json
        }
        Relationships: []
      }
      library_history_view_state: {
        Row: {
          attempt_at: string | null
          last_ms: number
          position: number
          refreshed_at: string | null
          view: string
        }
        Insert: {
          attempt_at?: string | null
          last_ms: number
          position: number
          refreshed_at?: string | null
          view: string
        }
        Update: {
          attempt_at?: string | null
          last_ms?: number
          position?: number
          refreshed_at?: string | null
          view?: string
        }
        Relationships: []
      }
      library_site_history_store: {
        Row: {
          accent: string | null
          ai_tags: Json | null
          body_family: string | null
          captured_at: string | null
          css_features: Json | null
          cta_radius_bucket: string | null
          domain: string
          frameworks: Json | null
          grid_max_cols: number | null
          h1_family: string | null
          h1_size_px: number | null
          h1_tracking: number | null
          hero_media: string | null
          now: boolean | null
          page_bg: string | null
          quarter: string
          sector: string | null
          snapshot_id: number | null
          source: string | null
          theme: string | null
          webfont: boolean | null
          whitespace_ratio: number | null
        }
        Insert: {
          accent?: string | null
          ai_tags?: Json | null
          body_family?: string | null
          captured_at?: string | null
          css_features?: Json | null
          cta_radius_bucket?: string | null
          domain: string
          frameworks?: Json | null
          grid_max_cols?: number | null
          h1_family?: string | null
          h1_size_px?: number | null
          h1_tracking?: number | null
          hero_media?: string | null
          now?: boolean | null
          page_bg?: string | null
          quarter: string
          sector?: string | null
          snapshot_id?: number | null
          source?: string | null
          theme?: string | null
          webfont?: boolean | null
          whitespace_ratio?: number | null
        }
        Update: {
          accent?: string | null
          ai_tags?: Json | null
          body_family?: string | null
          captured_at?: string | null
          css_features?: Json | null
          cta_radius_bucket?: string | null
          domain?: string
          frameworks?: Json | null
          grid_max_cols?: number | null
          h1_family?: string | null
          h1_size_px?: number | null
          h1_tracking?: number | null
          hero_media?: string | null
          now?: boolean | null
          page_bg?: string | null
          quarter?: string
          sector?: string | null
          snapshot_id?: number | null
          source?: string | null
          theme?: string | null
          webfont?: boolean | null
          whitespace_ratio?: number | null
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
          site_kind: string
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
          site_kind?: string
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
          site_kind?: string
        }
        Relationships: []
      }
      library_snapshot_check_store: {
        Row: {
          check_fields: Json
          snapshot_id: number
        }
        Insert: {
          check_fields: Json
          snapshot_id: number
        }
        Update: {
          check_fields?: Json
          snapshot_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_snapshot_check_store_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: true
            referencedRelation: "library_snapshot_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_snapshot_check_store_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: true
            referencedRelation: "library_snapshots"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "library_snapshot_fields"
            referencedColumns: ["id"]
          },
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
          received_at: string | null
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
          received_at?: string | null
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
          received_at?: string | null
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
          carried_from: string | null
          created_at: string
          domain: string
          model: string
          read_version: string | null
          signals_hash: string
          snapshot_id: number
          tags: Json
        }
        Insert: {
          carried_from?: string | null
          created_at?: string
          domain: string
          model: string
          read_version?: string | null
          signals_hash: string
          snapshot_id: number
          tags: Json
        }
        Update: {
          carried_from?: string | null
          created_at?: string
          domain?: string
          model?: string
          read_version?: string | null
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
            referencedRelation: "library_snapshot_fields"
            referencedColumns: ["id"]
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
      living_edition_status: {
        Row: {
          at: string
          edition: number
          id: number
          note: string | null
          status: string
        }
        Insert: {
          at?: string
          edition: number
          id?: never
          note?: string | null
          status: string
        }
        Update: {
          at?: string
          edition?: number
          id?: never
          note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "living_edition_status_edition_fkey"
            columns: ["edition"]
            isOneToOne: false
            referencedRelation: "living_editions"
            referencedColumns: ["number"]
          },
        ]
      }
      living_editions: {
        Row: {
          comparison: Json | null
          created_at: string
          dated: string
          number: number
          values: Json
        }
        Insert: {
          comparison?: Json | null
          created_at?: string
          dated: string
          number: number
          values: Json
        }
        Update: {
          comparison?: Json | null
          created_at?: string
          dated?: string
          number?: number
          values?: Json
        }
        Relationships: []
      }
      living_moves: {
        Row: {
          base: number | null
          count: number | null
          created_at: string
          edition: number
          id: number
          new_value: Json
          old_value: Json
          rule: string | null
          setting: string
          share: number | null
          signal: string | null
        }
        Insert: {
          base?: number | null
          count?: number | null
          created_at?: string
          edition: number
          id?: never
          new_value: Json
          old_value: Json
          rule?: string | null
          setting: string
          share?: number | null
          signal?: string | null
        }
        Update: {
          base?: number | null
          count?: number | null
          created_at?: string
          edition?: number
          id?: never
          new_value?: Json
          old_value?: Json
          rule?: string | null
          setting?: string
          share?: number | null
          signal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "living_moves_edition_fkey"
            columns: ["edition"]
            isOneToOne: false
            referencedRelation: "living_editions"
            referencedColumns: ["number"]
          },
        ]
      }
      living_readings: {
        Row: {
          edition: number
          id: number
          month: string
          note: string
          proposed_edition: number | null
          read_at: string
          ready: number
          run_id: string | null
          signals: Json
        }
        Insert: {
          edition: number
          id?: never
          month: string
          note: string
          proposed_edition?: number | null
          read_at?: string
          ready?: number
          run_id?: string | null
          signals: Json
        }
        Update: {
          edition?: number
          id?: never
          month?: string
          note?: string
          proposed_edition?: number | null
          read_at?: string
          ready?: number
          run_id?: string | null
          signals?: Json
        }
        Relationships: []
      }
      mcp_key_usage: {
        Row: {
          calls: number
          day: string
          key_id: string
          tool: string
        }
        Insert: {
          calls?: number
          day: string
          key_id: string
          tool: string
        }
        Update: {
          calls?: number
          day?: string
          key_id?: string
          tool?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_key_usage_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "mcp_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_keys: {
        Row: {
          created_at: string
          id: string
          key_sha256: string
          last_used_at: string | null
          name: string
          note: string | null
          prefix: string
          rate_per_min: number
          revoked_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key_sha256: string
          last_used_at?: string | null
          name: string
          note?: string | null
          prefix: string
          rate_per_min?: number
          revoked_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key_sha256?: string
          last_used_at?: string | null
          name?: string
          note?: string | null
          prefix?: string
          rate_per_min?: number
          revoked_at?: string | null
        }
        Relationships: []
      }
      outside_series: {
        Row: {
          captured_at: string
          key: string
          label: string
          metric: string
          period_end: string
          run_id: string
          source: string
          topic: string
          updated_at: string
          value: number
        }
        Insert: {
          captured_at: string
          key: string
          label: string
          metric: string
          period_end: string
          run_id: string
          source: string
          topic: string
          updated_at?: string
          value: number
        }
        Update: {
          captured_at?: string
          key?: string
          label?: string
          metric?: string
          period_end?: string
          run_id?: string
          source?: string
          topic?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      package_checks: {
        Row: {
          at: string
          checks: Json
          id: number
          issue: number | null
          pass: boolean
          test: boolean
          week: string
        }
        Insert: {
          at?: string
          checks: Json
          id?: never
          issue?: number | null
          pass: boolean
          test?: boolean
          week: string
        }
        Update: {
          at?: string
          checks?: Json
          id?: never
          issue?: number | null
          pass?: boolean
          test?: boolean
          week?: string
        }
        Relationships: []
      }
      page_reviews: {
        Row: {
          actor: string
          against: string | null
          at: string
          id: number
          kind: string
          measures: Json
          page: string
          path: string
          picture_bytes: number | null
          picture_height: number | null
          picture_path: string | null
          picture_width: number | null
          run: string
          width: number
        }
        Insert: {
          actor: string
          against?: string | null
          at?: string
          id?: never
          kind: string
          measures?: Json
          page: string
          path: string
          picture_bytes?: number | null
          picture_height?: number | null
          picture_path?: string | null
          picture_width?: number | null
          run: string
          width: number
        }
        Update: {
          actor?: string
          against?: string | null
          at?: string
          id?: never
          kind?: string
          measures?: Json
          page?: string
          path?: string
          picture_bytes?: number | null
          picture_height?: number | null
          picture_path?: string | null
          picture_width?: number | null
          run?: string
          width?: number
        }
        Relationships: []
      }
      palette_examples: {
        Row: {
          data: Json
          domain: string
          updated_at: string
        }
        Insert: {
          data: Json
          domain: string
          updated_at?: string
        }
        Update: {
          data?: Json
          domain?: string
          updated_at?: string
        }
        Relationships: []
      }
      picture_choices: {
        Row: {
          actor: string
          assets: string[]
          at: string
          call_id: number | null
          id: number
          kind: string
          per_picture: Json
          reason: string
          story_id: string
          verdict: string
        }
        Insert: {
          actor: string
          assets?: string[]
          at?: string
          call_id?: number | null
          id?: never
          kind: string
          per_picture?: Json
          reason: string
          story_id: string
          verdict: string
        }
        Update: {
          actor?: string
          assets?: string[]
          at?: string
          call_id?: number | null
          id?: never
          kind?: string
          per_picture?: Json
          reason?: string
          story_id?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "picture_choices_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "desk_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picture_choices_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_assignments: {
        Row: {
          actor: string
          at: string
          desk: string
          id: number
          pitch_id: number
          reason: string | null
          status: string
        }
        Insert: {
          actor: string
          at?: string
          desk: string
          id?: never
          pitch_id: number
          reason?: string | null
          status: string
        }
        Update: {
          actor?: string
          at?: string
          desk?: string
          id?: never
          pitch_id?: number
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pitch_assignments_pitch_id_fkey"
            columns: ["pitch_id"]
            isOneToOne: false
            referencedRelation: "pitches"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_verdicts: {
        Row: {
          created_at: string
          id: number
          pitch_id: number
          source: string
          status: string
          story_id: string | null
          story_number: number | null
          verdict: Json
        }
        Insert: {
          created_at?: string
          id?: never
          pitch_id: number
          source: string
          status: string
          story_id?: string | null
          story_number?: number | null
          verdict: Json
        }
        Update: {
          created_at?: string
          id?: never
          pitch_id?: number
          source?: string
          status?: string
          story_id?: string | null
          story_number?: number | null
          verdict?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pitch_verdicts_pitch_id_fkey"
            columns: ["pitch_id"]
            isOneToOne: false
            referencedRelation: "pitches"
            referencedColumns: ["id"]
          },
        ]
      }
      pitches: {
        Row: {
          created_at: string
          facts: Json
          id: number
          kind: string
          note: string
          pitched_by: string
          ref: string
        }
        Insert: {
          created_at?: string
          facts?: Json
          id?: never
          kind: string
          note: string
          pitched_by: string
          ref: string
        }
        Update: {
          created_at?: string
          facts?: Json
          id?: never
          kind?: string
          note?: string
          pitched_by?: string
          ref?: string
        }
        Relationships: []
      }
      proposal_statuses: {
        Row: {
          actor: string
          at: string
          id: number
          log_id: number
          reason: string | null
          status: string
        }
        Insert: {
          actor: string
          at?: string
          id?: never
          log_id: number
          reason?: string | null
          status: string
        }
        Update: {
          actor?: string
          at?: string
          id?: never
          log_id?: number
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_statuses_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "desk_log"
            referencedColumns: ["id"]
          },
        ]
      }
      read_records: {
        Row: {
          body: Json
          body_hash: string | null
          bytes: number
          computed_at: string
          key: string
          kind: string
          source: string
        }
        Insert: {
          body: Json
          body_hash?: string | null
          bytes?: number
          computed_at?: string
          key: string
          kind: string
          source: string
        }
        Update: {
          body?: Json
          body_hash?: string | null
          bytes?: number
          computed_at?: string
          key?: string
          kind?: string
          source?: string
        }
        Relationships: []
      }
      review_checklists: {
        Row: {
          at: string
          fingerprint: string
          id: number
          review_id: number
          story_id: string
        }
        Insert: {
          at?: string
          fingerprint: string
          id?: never
          review_id: number
          story_id: string
        }
        Update: {
          at?: string
          fingerprint?: string
          id?: never
          review_id?: number
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_checklists_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "story_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_sheets: {
        Row: {
          at: string
          hash: string
          id: number
          sheet: Json
          story_id: string
        }
        Insert: {
          at?: string
          hash: string
          id?: never
          sheet: Json
          story_id: string
        }
        Update: {
          at?: string
          hash?: string
          id?: never
          sheet?: Json
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_sheets_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      rewrite_requests: {
        Row: {
          actor: string
          at: string
          id: number
          reason: string
          story_id: string
        }
        Insert: {
          actor: string
          at?: string
          id?: never
          reason: string
          story_id: string
        }
        Update: {
          actor?: string
          at?: string
          id?: never
          reason?: string
          story_id?: string
        }
        Relationships: []
      }
      share_checks: {
        Row: {
          at: string
          checked: number
          failures: Json
          id: number
          rebuilt: number
        }
        Insert: {
          at?: string
          checked: number
          failures?: Json
          id?: never
          rebuilt?: number
        }
        Update: {
          at?: string
          checked?: number
          failures?: Json
          id?: never
          rebuilt?: number
        }
        Relationships: []
      }
      site_crops: {
        Row: {
          bytes: number
          captured_at: string
          created_at: string
          domain: string
          first_seen_at: string
          hash: string
          height: number
          id: number
          last_seen_at: string
          path: string
          run_id: string | null
          section: string
          viewport: string
          width: number
        }
        Insert: {
          bytes: number
          captured_at: string
          created_at?: string
          domain: string
          first_seen_at: string
          hash: string
          height: number
          id?: never
          last_seen_at: string
          path: string
          run_id?: string | null
          section: string
          viewport?: string
          width: number
        }
        Update: {
          bytes?: number
          captured_at?: string
          created_at?: string
          domain?: string
          first_seen_at?: string
          hash?: string
          height?: number
          id?: never
          last_seen_at?: string
          path?: string
          run_id?: string | null
          section?: string
          viewport?: string
          width?: number
        }
        Relationships: []
      }
      site_thumbs: {
        Row: {
          bytes: number
          captured_at: string
          created_at: string
          domain: string
          height: number
          id: number
          path: string
          removed_at: string | null
          source_run_id: string | null
          variants: Json
          viewport: string
          width: number
        }
        Insert: {
          bytes: number
          captured_at: string
          created_at?: string
          domain: string
          height: number
          id?: never
          path: string
          removed_at?: string | null
          source_run_id?: string | null
          variants?: Json
          viewport: string
          width: number
        }
        Update: {
          bytes?: number
          captured_at?: string
          created_at?: string
          domain?: string
          height?: number
          id?: never
          path?: string
          removed_at?: string | null
          source_run_id?: string | null
          variants?: Json
          viewport?: string
          width?: number
        }
        Relationships: []
      }
      social_draft_statuses: {
        Row: {
          actor: string
          at: string
          draft_id: number
          id: number
          reason: string | null
          status: string
        }
        Insert: {
          actor: string
          at?: string
          draft_id: number
          id?: never
          reason?: string | null
          status: string
        }
        Update: {
          actor?: string
          at?: string
          draft_id?: number
          id?: never
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_draft_statuses_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "social_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_drafts: {
        Row: {
          at: string
          body: string
          call_id: number | null
          check_id: number
          id: number
          link: string
          story_id: string | null
          target: string
          test: boolean
          week: string
        }
        Insert: {
          at?: string
          body: string
          call_id?: number | null
          check_id: number
          id?: never
          link: string
          story_id?: string | null
          target: string
          test?: boolean
          week: string
        }
        Update: {
          at?: string
          body?: string
          call_id?: number | null
          check_id?: number
          id?: never
          link?: string
          story_id?: string | null
          target?: string
          test?: boolean
          week?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_drafts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "desk_calls_weekly"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_drafts_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "package_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      source_cursors: {
        Row: {
          etag: string | null
          key: string
          last_modified: string | null
          state: Json | null
          updated_at: string
        }
        Insert: {
          etag?: string | null
          key: string
          last_modified?: string | null
          state?: Json | null
          updated_at?: string
        }
        Update: {
          etag?: string | null
          key?: string
          last_modified?: string | null
          state?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      source_notes: {
        Row: {
          actor: string
          at: string
          id: number
          link: string | null
          note: string
          read_on: string | null
          source: string
          status: string
        }
        Insert: {
          actor: string
          at?: string
          id?: never
          link?: string | null
          note: string
          read_on?: string | null
          source: string
          status: string
        }
        Update: {
          actor?: string
          at?: string
          id?: never
          link?: string | null
          note?: string
          read_on?: string | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      spend_caps: {
        Row: {
          actor: string
          at: string
          build_credits: number | null
          id: number
          model_usd: number | null
          reason: string
        }
        Insert: {
          actor: string
          at?: string
          build_credits?: number | null
          id?: never
          model_usd?: number | null
          reason: string
        }
        Update: {
          actor?: string
          at?: string
          build_credits?: number | null
          id?: never
          model_usd?: number | null
          reason?: string
        }
        Relationships: []
      }
      spend_entries: {
        Row: {
          actor: string
          at: string
          credits: number
          id: number
          kind: string
          queue_item: number | null
          what: string
        }
        Insert: {
          actor: string
          at?: string
          credits: number
          id?: never
          kind?: string
          queue_item?: number | null
          what: string
        }
        Update: {
          actor?: string
          at?: string
          credits?: number
          id?: never
          kind?: string
          queue_item?: number | null
          what?: string
        }
        Relationships: [
          {
            foreignKeyName: "spend_entries_queue_item_fkey"
            columns: ["queue_item"]
            isOneToOne: false
            referencedRelation: "build_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          basis: string | null
          components: Json
          created_at: string
          deck: string | null
          domains: string[]
          evidence: Json
          facts: Json
          happened_at: string
          headline: string
          id: string
          kicker: string
          reason: string
          score: number
          sector: string | null
          signal_keys: string[]
          source_ids: string[]
          status: string
          type: string
          why_at: string | null
          why_line: string | null
          why_model: string | null
          why_ran: string
        }
        Insert: {
          basis?: string | null
          components: Json
          created_at?: string
          deck?: string | null
          domains?: string[]
          evidence?: Json
          facts?: Json
          happened_at: string
          headline: string
          id: string
          kicker: string
          reason: string
          score: number
          sector?: string | null
          signal_keys?: string[]
          source_ids?: string[]
          status: string
          type: string
          why_at?: string | null
          why_line?: string | null
          why_model?: string | null
          why_ran: string
        }
        Update: {
          basis?: string | null
          components?: Json
          created_at?: string
          deck?: string | null
          domains?: string[]
          evidence?: Json
          facts?: Json
          happened_at?: string
          headline?: string
          id?: string
          kicker?: string
          reason?: string
          score?: number
          sector?: string | null
          signal_keys?: string[]
          source_ids?: string[]
          status?: string
          type?: string
          why_at?: string | null
          why_line?: string | null
          why_model?: string | null
          why_ran?: string
        }
        Relationships: []
      }
      story_edits: {
        Row: {
          action: string
          at: string
          id: number
          note: string | null
          payload: Json
          story_id: string
        }
        Insert: {
          action: string
          at?: string
          id?: never
          note?: string | null
          payload?: Json
          story_id: string
        }
        Update: {
          action?: string
          at?: string
          id?: never
          note?: string | null
          payload?: Json
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_edits_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_kept_crops: {
        Row: {
          created_at: string
          crop_id: number
          domain: string
          id: number
          path: string
          role: string
          story_id: string
        }
        Insert: {
          created_at?: string
          crop_id: number
          domain: string
          id?: never
          path: string
          role: string
          story_id: string
        }
        Update: {
          created_at?: string
          crop_id?: number
          domain?: string
          id?: never
          path?: string
          role?: string
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_kept_crops_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "site_crops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_kept_crops_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_lines: {
        Row: {
          story_id: string
          why_at: string
          why_line: string
          why_model: string
        }
        Insert: {
          story_id: string
          why_at?: string
          why_line: string
          why_model: string
        }
        Update: {
          story_id?: string
          why_at?: string
          why_line?: string
          why_model?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_lines_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: true
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_numbers: {
        Row: {
          assigned_at: string
          number: number
          story_id: string
        }
        Insert: {
          assigned_at?: string
          number: number
          story_id: string
        }
        Update: {
          assigned_at?: string
          number?: number
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_numbers_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: true
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_reviews: {
        Row: {
          at: string
          basis: string
          call_id: number | null
          checklist: Json
          desk: string
          facts_hash: string
          id: number
          placement: number | null
          problems: Json
          prompt_version: string | null
          reason: string | null
          second_reader: string | null
          story_id: string
          verdict: string
        }
        Insert: {
          at?: string
          basis?: string
          call_id?: number | null
          checklist?: Json
          desk: string
          facts_hash: string
          id?: never
          placement?: number | null
          problems?: Json
          prompt_version?: string | null
          reason?: string | null
          second_reader?: string | null
          story_id: string
          verdict: string
        }
        Update: {
          at?: string
          basis?: string
          call_id?: number | null
          checklist?: Json
          desk?: string
          facts_hash?: string
          id?: never
          placement?: number | null
          problems?: Json
          prompt_version?: string | null
          reason?: string | null
          second_reader?: string | null
          story_id?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_reviews_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "desk_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_reviews_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_states: {
        Row: {
          actor: string
          at: string
          id: number
          reason: string | null
          recorded_at: string
          ref: string
          state: string
          story_id: string
        }
        Insert: {
          actor: string
          at: string
          id?: never
          reason?: string | null
          recorded_at?: string
          ref: string
          state: string
          story_id: string
        }
        Update: {
          actor?: string
          at?: string
          id?: never
          reason?: string | null
          recorded_at?: string
          ref?: string
          state?: string
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_states_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_texts: {
        Row: {
          attempts: number
          body: string[]
          checked: boolean
          cost: number
          created_at: string
          deck: string
          failures: string[]
          headline: string
          how_we_know: string
          id: number
          model: string
          story_id: string
          version: number
        }
        Insert: {
          attempts?: number
          body?: string[]
          checked: boolean
          cost?: number
          created_at?: string
          deck: string
          failures?: string[]
          headline: string
          how_we_know: string
          id?: never
          model: string
          story_id: string
          version: number
        }
        Update: {
          attempts?: number
          body?: string[]
          checked?: boolean
          cost?: number
          created_at?: string
          deck?: string
          failures?: string[]
          headline?: string
          how_we_know?: string
          id?: never
          model?: string
          story_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "story_texts_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      study_texts: {
        Row: {
          attempts: number
          checked_at: string | null
          cost: number
          created_at: string
          deck: string
          facts_hash: string
          failures: string[]
          headline: string
          id: number
          log: Json
          model: string
          opening: string
          scenes: Json
          slug: string
          use_text: string | null
        }
        Insert: {
          attempts?: number
          checked_at?: string | null
          cost?: number
          created_at?: string
          deck: string
          facts_hash: string
          failures?: string[]
          headline: string
          id?: never
          log?: Json
          model: string
          opening: string
          scenes?: Json
          slug: string
          use_text?: string | null
        }
        Update: {
          attempts?: number
          checked_at?: string | null
          cost?: number
          created_at?: string
          deck?: string
          facts_hash?: string
          failures?: string[]
          headline?: string
          id?: never
          log?: Json
          model?: string
          opening?: string
          scenes?: Json
          slug?: string
          use_text?: string | null
        }
        Relationships: []
      }
      surface_crops: {
        Row: {
          bytes: number
          captured_at: string
          created_at: string
          domain: string
          first_seen_at: string
          hash: string
          height: number
          id: number
          last_seen_at: string
          path: string
          run_id: string | null
          section: string
          viewport: string
          width: number
        }
        Insert: {
          bytes: number
          captured_at: string
          created_at?: string
          domain: string
          first_seen_at: string
          hash: string
          height: number
          id?: never
          last_seen_at: string
          path: string
          run_id?: string | null
          section: string
          viewport?: string
          width: number
        }
        Update: {
          bytes?: number
          captured_at?: string
          created_at?: string
          domain?: string
          first_seen_at?: string
          hash?: string
          height?: number
          id?: never
          last_seen_at?: string
          path?: string
          run_id?: string | null
          section?: string
          viewport?: string
          width?: number
        }
        Relationships: []
      }
      thumb_optouts: {
        Row: {
          created_at: string
          domain: string
          note: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          note?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          note?: string | null
        }
        Relationships: []
      }
      tool_cache: {
        Row: {
          created_at: string
          expires_at: string
          hash: string
          namespace: string | null
          response: Json
          tags: string[]
        }
        Insert: {
          created_at?: string
          expires_at?: string
          hash: string
          namespace?: string | null
          response: Json
          tags?: string[]
        }
        Update: {
          created_at?: string
          expires_at?: string
          hash?: string
          namespace?: string | null
          response?: Json
          tags?: string[]
        }
        Relationships: []
      }
      trendsetters: {
        Row: {
          domain: string
          rank: number
          run_id: number
          score: number
          sector: string | null
          traits_led: Json
        }
        Insert: {
          domain: string
          rank: number
          run_id: number
          score: number
          sector?: string | null
          traits_led?: Json
        }
        Update: {
          domain?: string
          rank?: number
          run_id?: number
          score?: number
          sector?: string | null
          traits_led?: Json
        }
        Relationships: [
          {
            foreignKeyName: "trendsetters_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_model_card"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "trendsetters_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      vibe_clusters: {
        Row: {
          cluster: number
          name: string
          quarter: string
          run_id: number
          stats: Json
        }
        Insert: {
          cluster: number
          name: string
          quarter: string
          run_id: number
          stats: Json
        }
        Update: {
          cluster?: number
          name?: string
          quarter?: string
          run_id?: number
          stats?: Json
        }
        Relationships: []
      }
      vibe_maps: {
        Row: {
          computed_at: string
          model: Json
          quarter: string
          run_id: number
        }
        Insert: {
          computed_at?: string
          model: Json
          quarter: string
          run_id: number
        }
        Update: {
          computed_at?: string
          model?: Json
          quarter?: string
          run_id?: number
        }
        Relationships: []
      }
      vibe_points: {
        Row: {
          cluster: number
          current: boolean
          domain: string
          quarter: string
          run_id: number
          sector: string
          tags: string[]
          x: number
          y: number
        }
        Insert: {
          cluster: number
          current?: boolean
          domain: string
          quarter: string
          run_id: number
          sector: string
          tags?: string[]
          x: number
          y: number
        }
        Update: {
          cluster?: number
          current?: boolean
          domain?: string
          quarter?: string
          run_id?: number
          sector?: string
          tags?: string[]
          x?: number
          y?: number
        }
        Relationships: []
      }
      watchlists: {
        Row: {
          created_at: string
          edit_token_sha256: string
          feed_token: string
          id: string
          last_viewed_at: string | null
          name: string
          pending_sites: string[]
          sectors: string[]
          sites: string[]
          traits: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          edit_token_sha256: string
          feed_token: string
          id: string
          last_viewed_at?: string | null
          name: string
          pending_sites?: string[]
          sectors?: string[]
          sites?: string[]
          traits?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          edit_token_sha256?: string
          feed_token?: string
          id?: string
          last_viewed_at?: string | null
          name?: string
          pending_sites?: string[]
          sectors?: string[]
          sites?: string[]
          traits?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      weekly_briefs: {
        Row: {
          brief: Json
          created_at: string
          model: string
          run_id: number | null
          week: string
        }
        Insert: {
          brief: Json
          created_at?: string
          model: string
          run_id?: number | null
          week: string
        }
        Update: {
          brief?: Json
          created_at?: string
          model?: string
          run_id?: number | null
          week?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_briefs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_model_card"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "weekly_briefs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      wire_items: {
        Row: {
          excerpt: string | null
          fetched_at: string
          id: number
          link: string | null
          published_at: string
          ref: string | null
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
          link?: string | null
          published_at: string
          ref?: string | null
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
          link?: string | null
          published_at?: string
          ref?: string | null
          source?: string
          source_kind?: string
          tags?: string[]
          title?: string
          url?: string
        }
        Relationships: []
      }
      wire_pick_drops: {
        Row: {
          actor: string
          at: string
          id: number
          pick_id: number
          reason: string
        }
        Insert: {
          actor: string
          at?: string
          id?: never
          pick_id: number
          reason: string
        }
        Update: {
          actor?: string
          at?: string
          id?: never
          pick_id?: number
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "wire_pick_drops_pick_id_fkey"
            columns: ["pick_id"]
            isOneToOne: false
            referencedRelation: "wire_picks"
            referencedColumns: ["id"]
          },
        ]
      }
      wire_picks: {
        Row: {
          actor: string
          at: string
          call_id: number | null
          domain: string | null
          id: number
          item_id: number
          line: string
          subject: string
        }
        Insert: {
          actor: string
          at?: string
          call_id?: number | null
          domain?: string | null
          id?: never
          item_id: number
          line: string
          subject: string
        }
        Update: {
          actor?: string
          at?: string
          call_id?: number | null
          domain?: string | null
          id?: never
          item_id?: number
          line?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "wire_picks_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "desk_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wire_picks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "wire_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_marks: {
        Row: {
          done_at: string | null
          marked_at: string
          topic: string
        }
        Insert: {
          done_at?: string | null
          marked_at?: string
          topic: string
        }
        Update: {
          done_at?: string | null
          marked_at?: string
          topic?: string
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
      brand_pictures: {
        Row: {
          captured_at: string | null
          domain: string | null
          height: number | null
          kind: string | null
          path: string | null
          width: number | null
        }
        Relationships: []
      }
      change_checks_latest: {
        Row: {
          checked_at: string | null
          event_id: number | null
          fields: Json | null
          pass_fields: string[] | null
          verdict: string | null
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
          curated_share: number | null
          curation_lead_pts: number | null
          label: string | null
          mainstream_share: number | null
          prev_curation_lead_pts: number | null
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
          curated_share: number | null
          curation_lead_pts: number | null
          label: string | null
          mainstream_share: number | null
          prev_curation_lead_pts: number | null
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
          curated_share: number | null
          curation_lead_pts: number | null
          label: string | null
          mainstream_share: number | null
          prev_curation_lead_pts: number | null
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
      desk_history: {
        Row: {
          action: string | null
          actor: string | null
          at: string | null
          decision: string | null
          level: string | null
          reason: string | null
          ref: string | null
          source: string | null
          subject_id: string | null
          subject_kind: string | null
        }
        Relationships: []
      }
      forecast_latest: {
        Row: {
          backtest: Json | null
          components: Json | null
          computed_at: string | null
          current_share: number | null
          dimension: string | null
          evidence: Json | null
          id: number | null
          model: string | null
          momentum: number | null
          next_wave_score: number | null
          proj_q1: number | null
          proj_q1_hi: number | null
          proj_q1_lo: number | null
          proj_q2: number | null
          proj_q2_hi: number | null
          proj_q2_lo: number | null
          proj_q4: number | null
          proj_q4_hi: number | null
          proj_q4_lo: number | null
          run_id: number | null
          scope: string | null
          stage: string | null
          status: string | null
          value: string | null
        }
        Insert: {
          backtest?: Json | null
          components?: Json | null
          computed_at?: string | null
          current_share?: number | null
          dimension?: string | null
          evidence?: Json | null
          id?: number | null
          model?: string | null
          momentum?: number | null
          next_wave_score?: number | null
          proj_q1?: number | null
          proj_q1_hi?: number | null
          proj_q1_lo?: number | null
          proj_q2?: number | null
          proj_q2_hi?: number | null
          proj_q2_lo?: number | null
          proj_q4?: number | null
          proj_q4_hi?: number | null
          proj_q4_lo?: number | null
          run_id?: number | null
          scope?: string | null
          stage?: string | null
          status?: string | null
          value?: string | null
        }
        Update: {
          backtest?: Json | null
          components?: Json | null
          computed_at?: string | null
          current_share?: number | null
          dimension?: string | null
          evidence?: Json | null
          id?: number | null
          model?: string | null
          momentum?: number | null
          next_wave_score?: number | null
          proj_q1?: number | null
          proj_q1_hi?: number | null
          proj_q1_lo?: number | null
          proj_q2?: number | null
          proj_q2_hi?: number | null
          proj_q2_lo?: number | null
          proj_q4?: number | null
          proj_q4_hi?: number | null
          proj_q4_lo?: number | null
          run_id?: number | null
          scope?: string | null
          stage?: string | null
          status?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forecasts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_model_card"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "forecasts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_model_card: {
        Row: {
          computed_at: string | null
          coverage: Json | null
          data_cutoff_quarter: string | null
          model_card: Json | null
          run_id: number | null
        }
        Relationships: []
      }
      gfont_first_seen: {
        Row: {
          category: string | null
          family: string | null
          first_seen: string | null
        }
        Relationships: []
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
            referencedRelation: "library_snapshot_fields"
            referencedColumns: ["id"]
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
            referencedRelation: "library_snapshot_fields"
            referencedColumns: ["id"]
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
            referencedRelation: "library_snapshot_fields"
            referencedColumns: ["id"]
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
            referencedRelation: "library_snapshot_fields"
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
      library_history_fonts: {
        Row: {
          family: string | null
          rank: number | null
          role: string | null
          sites: number | null
          year: number | null
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
      library_history_share: {
        Row: {
          coverage: number | null
          denom: number | null
          dimension: string | null
          quarter: string | null
          sector: string | null
          share: number | null
          sites: number | null
          value: string | null
        }
        Relationships: []
      }
      library_history_share_live: {
        Row: {
          coverage: number | null
          denom: number | null
          dimension: string | null
          quarter: string | null
          sector: string | null
          share: number | null
          sites: number | null
          value: string | null
        }
        Relationships: []
      }
      library_history_share_mat: {
        Row: {
          coverage: number | null
          denom: number | null
          dimension: string | null
          quarter: string | null
          sector: string | null
          share: number | null
          sites: number | null
          value: string | null
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
      library_redesigns: {
        Row: {
          redesigns: number | null
          sector: string | null
          source: string | null
          year: number | null
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
      library_site_history: {
        Row: {
          accent: string | null
          ai_tags: Json | null
          body_family: string | null
          captured_at: string | null
          css_features: Json | null
          cta_radius_bucket: string | null
          domain: string | null
          frameworks: Json | null
          grid_max_cols: number | null
          h1_family: string | null
          h1_size_px: number | null
          h1_tracking: number | null
          hero_media: string | null
          now: boolean | null
          page_bg: string | null
          quarter: string | null
          sector: string | null
          snapshot_id: number | null
          source: string | null
          theme: string | null
          webfont: boolean | null
          whitespace_ratio: number | null
        }
        Relationships: []
      }
      library_site_history_mat: {
        Row: {
          accent: string | null
          ai_tags: Json | null
          body_family: string | null
          captured_at: string | null
          css_features: Json | null
          cta_radius_bucket: string | null
          domain: string | null
          frameworks: Json | null
          grid_max_cols: number | null
          h1_family: string | null
          h1_size_px: number | null
          h1_tracking: number | null
          hero_media: string | null
          now: boolean | null
          page_bg: string | null
          quarter: string | null
          sector: string | null
          snapshot_id: number | null
          source: string | null
          theme: string | null
          webfont: boolean | null
          whitespace_ratio: number | null
        }
        Relationships: []
      }
      library_site_history_rows: {
        Row: {
          accent: string | null
          ai_tags: Json | null
          body_family: string | null
          captured_at: string | null
          css_features: Json | null
          cta_radius_bucket: string | null
          domain: string | null
          frameworks: Json | null
          grid_max_cols: number | null
          h1_family: string | null
          h1_size_px: number | null
          h1_tracking: number | null
          hero_media: string | null
          now: boolean | null
          page_bg: string | null
          quarter: string | null
          sector: string | null
          snapshot_id: number | null
          source: string | null
          theme: string | null
          webfont: boolean | null
          whitespace_ratio: number | null
        }
        Insert: {
          accent?: string | null
          ai_tags?: Json | null
          body_family?: string | null
          captured_at?: string | null
          css_features?: Json | null
          cta_radius_bucket?: string | null
          domain?: string | null
          frameworks?: Json | null
          grid_max_cols?: number | null
          h1_family?: string | null
          h1_size_px?: number | null
          h1_tracking?: number | null
          hero_media?: string | null
          now?: boolean | null
          page_bg?: string | null
          quarter?: string | null
          sector?: string | null
          snapshot_id?: number | null
          source?: string | null
          theme?: string | null
          webfont?: boolean | null
          whitespace_ratio?: number | null
        }
        Update: {
          accent?: string | null
          ai_tags?: Json | null
          body_family?: string | null
          captured_at?: string | null
          css_features?: Json | null
          cta_radius_bucket?: string | null
          domain?: string | null
          frameworks?: Json | null
          grid_max_cols?: number | null
          h1_family?: string | null
          h1_size_px?: number | null
          h1_tracking?: number | null
          hero_media?: string | null
          now?: boolean | null
          page_bg?: string | null
          quarter?: string | null
          sector?: string | null
          snapshot_id?: number | null
          source?: string | null
          theme?: string | null
          webfont?: boolean | null
          whitespace_ratio?: number | null
        }
        Relationships: []
      }
      library_snapshot_fields: {
        Row: {
          captured_at: string | null
          check_fields: Json | null
          domain: string | null
          hero_carousel: Json | null
          id: number | null
          page_type: string | null
          source: string | null
          viewport: string | null
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
      outside_series_weekly: {
        Row: {
          captured_at: string | null
          key: string | null
          label: string | null
          metric: string | null
          period_end: string | null
          source: string | null
          topic: string | null
          value: number | null
        }
        Relationships: []
      }
      spend_ledger: {
        Row: {
          actor: string | null
          calls: number | null
          credits: number | null
          day: string | null
          kind: string | null
          usd: number | null
          what: string | null
        }
        Relationships: []
      }
      trendsetters_latest: {
        Row: {
          domain: string | null
          rank: number | null
          run_id: number | null
          score: number | null
          sector: string | null
          traits_led: Json | null
        }
        Insert: {
          domain?: string | null
          rank?: number | null
          run_id?: number | null
          score?: number | null
          sector?: string | null
          traits_led?: Json | null
        }
        Update: {
          domain?: string | null
          rank?: number | null
          run_id?: number | null
          score?: number | null
          sector?: string | null
          traits_led?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "trendsetters_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_model_card"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "trendsetters_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      ai_pause_facts: { Args: never; Returns: Json }
      ai_reserve:
        | {
            Args: {
              p_estimate: number
              p_kind: string
              p_model: string
              p_snapshot_id: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_estimate: number
              p_kind: string
              p_model: string
              p_scope: string
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
      change_checks_latest_for: {
        Args: { _ids: number[] }
        Returns: {
          checked_at: string
          event_id: number
          fields: Json
          pass_fields: string[]
          verdict: string
        }[]
      }
      crop_opted_out: { Args: { p_domain: string }; Returns: boolean }
      db_load_facts: { Args: never; Returns: Json }
      db_session_limits: { Args: never; Returns: Json }
      desk_switch_on: { Args: { p_name: string }; Returns: boolean }
      discourse_merge: {
        Args: { p_add: boolean; p_rows: Json }
        Returns: number
      }
      health_facts: { Args: never; Returns: Json }
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
      library_ai_probe_acquire: { Args: { p_token: string }; Returns: Json }
      library_ai_probe_settle: {
        Args: { p_ok: boolean; p_reason: string; p_token: string }
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
      library_archive_input: { Args: { p_domain: string }; Returns: Json }
      library_archive_replace: {
        Args: { p_domain: string; p_expected: Json; p_history: Json }
        Returns: boolean
      }
      library_archive_replace_changed: {
        Args: { p_domain: string; p_expected: Json; p_history: Json }
        Returns: Json
      }
      library_archive_state: { Args: never; Returns: Json }
      library_archive_store: { Args: { p_snapshot: Json }; Returns: number }
      library_half_year: { Args: { t: string }; Returns: string }
      library_history_facts: { Args: never; Returns: Json }
      library_history_family: {
        Args: { r: string; s: Json; source: string }
        Returns: string
      }
      library_history_mark: { Args: { p_domains: string[] }; Returns: number }
      library_history_refresh_begin: {
        Args: { p_min_age_seconds?: number }
        Returns: Json
      }
      library_history_refresh_end: { Args: { p_ok: boolean }; Returns: Json }
      library_history_refresh_view: { Args: { p_view: string }; Returns: Json }
      library_number: { Args: { j: Json }; Returns: number }
      library_quarter: { Args: { t: string }; Returns: string }
      library_replace_history: {
        Args: { p_history: Json; p_ids: number[] }
        Returns: Json
      }
      library_replay_input: { Args: never; Returns: Json }
      library_snapshot_check_fields: { Args: { s: Json }; Returns: Json }
      library_snapshot_check_fields_slim: { Args: { s: Json }; Returns: Json }
      library_snapshot_context: { Args: { p_snapshot: Json }; Returns: Json }
      library_state: { Args: never; Returns: Json }
      library_store_snapshot: {
        Args: { p_context: Json; p_events: Json; p_snapshot: Json }
        Returns: Json
      }
      library_sync: { Args: { p_sites: Json }; Returns: undefined }
      mcp_key_count: {
        Args: { p_key: string; p_tool: string }
        Returns: undefined
      }
      newsroom_call_facts: { Args: never; Returns: Json }
      newsroom_desk_facts: { Args: never; Returns: Json }
      normalize_currency: { Args: { c: string }; Returns: string }
      outside_series_store: {
        Args: { p_captured_at: string; p_points: Json; p_run_id: string }
        Returns: Json
      }
      records_sweep_facts: { Args: never; Returns: Json }
      refresh_crawl_aggregates: { Args: never; Returns: undefined }
      refresh_library_history: { Args: never; Returns: undefined }
      replace_taste_data: {
        Args: {
          p_catalog: Json
          p_colors: Json
          p_pairs: Json
          p_palettes: Json
          p_usage: Json
        }
        Returns: undefined
      }
      spend_facts: { Args: never; Returns: Json }
      spend_status: { Args: never; Returns: Json }
      spend_week_facts: { Args: never; Returns: Json }
      story_picture_choices: {
        Args: { p_ids: string[] }
        Returns: {
          actor: string
          assets: string[]
          at: string
          kind: string
          reason: string
          story_id: string
          verdict: string
        }[]
      }
      story_writer_facts: { Args: never; Returns: Json }
      wire_picks_public: {
        Args: { p_since: string }
        Returns: {
          at: string
          domain: string
          item_id: number
          line: string
          pick_id: number
          published_at: string
          source: string
          subject: string
          title: string
          url: string
        }[]
      }
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
