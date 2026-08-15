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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          school_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: number
          school_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      availabilities: {
        Row: {
          created_at: string
          id: string
          school_id: string
          slot_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          school_id: string
          slot_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          school_id?: string
          slot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availabilities_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availabilities_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availabilities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availabilities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      calendar_days: {
        Row: {
          created_at: string
          date: string
          day_type_id: string | null
          id: string
          is_school_day: boolean
          manually_set: boolean
          note: string | null
          school_id: string
          source: Database["public"]["Enums"]["day_source"]
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          date: string
          day_type_id?: string | null
          id?: string
          is_school_day?: boolean
          manually_set?: boolean
          note?: string | null
          school_id: string
          source?: Database["public"]["Enums"]["day_source"]
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          day_type_id?: string | null
          id?: string
          is_school_day?: boolean
          manually_set?: boolean
          note?: string | null
          school_id?: string
          source?: Database["public"]["Enums"]["day_source"]
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_days_day_type_id_fkey"
            columns: ["day_type_id"]
            isOneToOne: false
            referencedRelation: "day_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_days_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_days_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "schedule_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      day_types: {
        Row: {
          code: string
          id: string
          school_id: string
        }
        Insert: {
          code: string
          id?: string
          school_id: string
        }
        Update: {
          code?: string
          id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      ics_import_batches: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          diff: Json
          id: string
          school_id: string
          source_id: string
          status: Database["public"]["Enums"]["import_status"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          diff: Json
          id?: string
          school_id: string
          source_id: string
          status?: Database["public"]["Enums"]["import_status"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          diff?: Json
          id?: string
          school_id?: string
          source_id?: string
          status?: Database["public"]["Enums"]["import_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ics_import_batches_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ics_import_batches_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ics_import_batches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ics_import_batches_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "ics_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ics_sources: {
        Row: {
          id: string
          is_active: boolean
          last_error: string | null
          last_status: string | null
          last_synced_at: string | null
          school_id: string
          summary_mapping: Json
          url: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_status?: string | null
          last_synced_at?: string | null
          school_id: string
          summary_mapping?: Json
          url: string
        }
        Update: {
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_status?: string | null
          last_synced_at?: string | null
          school_id?: string
          summary_mapping?: Json
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ics_sources_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_sent: {
        Row: {
          id: number
          kind: string
          round_id: string | null
          school_id: string
          sent_at: string
          user_id: string | null
        }
        Insert: {
          id?: number
          kind: string
          round_id?: string | null
          school_id: string
          sent_at?: string
          user_id?: string | null
        }
        Update: {
          id?: number
          kind?: string
          round_id?: string | null
          school_id?: string
          sent_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_sent_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sent_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "v_participation"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "notifications_sent_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sent_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sent_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      period_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          school_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          school_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          full_name: string
          grad_year: number | null
          id: string
          is_active: boolean
          last_seen_at: string | null
          roles: Database["public"]["Enums"]["app_role"][]
          school_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          full_name: string
          grad_year?: number | null
          id: string
          is_active?: boolean
          last_seen_at?: string | null
          roles?: Database["public"]["Enums"]["app_role"][]
          school_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          full_name?: string
          grad_year?: number | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          roles?: Database["public"]["Enums"]["app_role"][]
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          id: string
          is_active: boolean
          name: string
          note: string | null
          school_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          school_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_invites: {
        Row: {
          age_confirmed: boolean
          approved_by: string | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          needs_approval: boolean
          roles: Database["public"]["Enums"]["app_role"][]
          school_id: string
        }
        Insert: {
          age_confirmed?: boolean
          approved_by?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          needs_approval?: boolean
          roles?: Database["public"]["Enums"]["app_role"][]
          school_id: string
        }
        Update: {
          age_confirmed?: boolean
          approved_by?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          needs_approval?: boolean
          roles?: Database["public"]["Enums"]["app_role"][]
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_invites_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_invites_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "roster_invites_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_invites_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "roster_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "roster_invites_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      round_links: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["link_kind"]
          label: string | null
          round_id: string
          school_id: string
          url: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["link_kind"]
          label?: string | null
          round_id: string
          school_id: string
          url: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["link_kind"]
          label?: string | null
          round_id?: string
          school_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_links_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_links_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "round_links_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_links_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "v_participation"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "round_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      round_notes: {
        Row: {
          about_user: string
          id: string
          note: string
          result_id: string
          school_id: string
        }
        Insert: {
          about_user: string
          id?: string
          note: string
          result_id: string
          school_id: string
        }
        Update: {
          about_user?: string
          id?: string
          note?: string
          result_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_notes_about_user_fkey"
            columns: ["about_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_notes_about_user_fkey"
            columns: ["about_user"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "round_notes_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "round_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      round_participants: {
        Row: {
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["participant_role"]
          round_id: string
          school_id: string
          side: Database["public"]["Enums"]["debate_side"] | null
          team: number | null
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role: Database["public"]["Enums"]["participant_role"]
          round_id: string
          school_id: string
          side?: Database["public"]["Enums"]["debate_side"] | null
          team?: number | null
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["participant_role"]
          round_id?: string
          school_id?: string
          side?: Database["public"]["Enums"]["debate_side"] | null
          team?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_participants_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_participants_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "v_participation"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "round_participants_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      round_results: {
        Row: {
          id: string
          rfd: string
          round_id: string
          school_id: string
          submitted_at: string
          submitted_by: string
          supersedes: string | null
          team1_side: Database["public"]["Enums"]["debate_side"]
          winning_team: number
        }
        Insert: {
          id?: string
          rfd: string
          round_id: string
          school_id: string
          submitted_at?: string
          submitted_by: string
          supersedes?: string | null
          team1_side: Database["public"]["Enums"]["debate_side"]
          winning_team: number
        }
        Update: {
          id?: string
          rfd?: string
          round_id?: string
          school_id?: string
          submitted_at?: string
          submitted_by?: string
          supersedes?: string | null
          team1_side?: Database["public"]["Enums"]["debate_side"]
          winning_team?: number
        }
        Relationships: [
          {
            foreignKeyName: "round_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "v_participation"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "round_results_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_results_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_results_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "round_results_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "round_results"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          room_freetext: string | null
          room_id: string | null
          school_id: string
          slot_id: string
          status: Database["public"]["Enums"]["round_status"]
          topic: string | null
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          room_freetext?: string | null
          room_id?: string | null
          school_id: string
          slot_id: string
          status?: Database["public"]["Enums"]["round_status"]
          topic?: string | null
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          room_freetext?: string | null
          room_id?: string | null
          school_id?: string
          slot_id?: string
          status?: Database["public"]["Enums"]["round_status"]
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "rounds_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_variants: {
        Row: {
          id: string
          name: string
          school_id: string
          template_id: string
        }
        Insert: {
          id?: string
          name: string
          school_id: string
          template_id: string
        }
        Update: {
          id?: string
          name?: string
          school_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_variants_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_variants_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "period_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      school_requests: {
        Row: {
          admin_email: string
          admin_name: string
          created_at: string
          id: string
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_name: string
          status: string
          tabroom_url: string
        }
        Insert: {
          admin_email: string
          admin_name: string
          created_at?: string
          id?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_name: string
          status?: string
          tabroom_url: string
        }
        Update: {
          admin_email?: string
          admin_name?: string
          created_at?: string
          id?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_name?: string
          status?: string
          tabroom_url?: string
        }
        Relationships: []
      }
      school_terms: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          name: string
          school_id: string
          starts_on: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          name: string
          school_id: string
          starts_on: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          name?: string
          school_id?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_terms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          expected_rounds_per_term: number
          id: string
          name: string
          rotation_resets_weekly: boolean
          slug: string
          status: Database["public"]["Enums"]["school_status"]
          timezone: string
          weekly_credit_cap: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          expected_rounds_per_term?: number
          id?: string
          name: string
          rotation_resets_weekly?: boolean
          slug: string
          status?: Database["public"]["Enums"]["school_status"]
          timezone?: string
          weekly_credit_cap?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          expected_rounds_per_term?: number
          id?: string
          name?: string
          rotation_resets_weekly?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["school_status"]
          timezone?: string
          weekly_credit_cap?: number
        }
        Relationships: []
      }
      slots: {
        Row: {
          block_id: string
          calendar_day_id: string
          created_at: string
          ends_at: string
          id: string
          is_open: boolean
          label: string
          school_id: string
          starts_at: string
        }
        Insert: {
          block_id: string
          calendar_day_id: string
          created_at?: string
          ends_at: string
          id?: string
          is_open?: boolean
          label: string
          school_id: string
          starts_at: string
        }
        Update: {
          block_id?: string
          calendar_day_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          is_open?: boolean
          label?: string
          school_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slots_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "template_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slots_calendar_day_id_fkey"
            columns: ["calendar_day_id"]
            isOneToOne: false
            referencedRelation: "calendar_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      template_blocks: {
        Row: {
          end_time: string
          id: string
          is_bookable: boolean
          label: string
          school_id: string
          sort_order: number
          start_time: string
          template_id: string
        }
        Insert: {
          end_time: string
          id?: string
          is_bookable?: boolean
          label: string
          school_id: string
          sort_order: number
          start_time: string
          template_id: string
        }
        Update: {
          end_time?: string
          id?: string
          is_bookable?: boolean
          label?: string
          school_id?: string
          sort_order?: number
          start_time?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_blocks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_blocks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "period_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_leaderboard: {
        Row: {
          debate_rounds: number | null
          display_name: string | null
          judge_rounds: number | null
          on_track: boolean | null
          school_id: string | null
          term_id: string | null
          total_rounds: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      v_participation: {
        Row: {
          role: Database["public"]["Enums"]["participant_role"] | null
          round_id: string | null
          school_id: string | null
          term_id: string | null
          user_id: string | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "round_participants_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "judge" | "debater"
      day_source: "manual" | "feed"
      debate_side: "pro" | "con"
      import_status: "pending" | "approved" | "rejected" | "failed"
      link_kind: "video" | "speech_doc" | "flow" | "other"
      participant_role: "debater" | "judge"
      round_status:
        | "forming"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "expired"
      school_status: "pending" | "active" | "suspended"
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
      app_role: ["admin", "judge", "debater"],
      day_source: ["manual", "feed"],
      debate_side: ["pro", "con"],
      import_status: ["pending", "approved", "rejected", "failed"],
      link_kind: ["video", "speech_doc", "flow", "other"],
      participant_role: ["debater", "judge"],
      round_status: [
        "forming",
        "confirmed",
        "completed",
        "cancelled",
        "expired",
      ],
      school_status: ["pending", "active", "suspended"],
    },
  },
} as const
