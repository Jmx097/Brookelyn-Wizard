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
      articles: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          processed: boolean
          processing_error: string | null
          published_at: string | null
          raw_content: string | null
          snippet: string | null
          source: Database["public"]["Enums"]["article_source"]
          title: string | null
          trigger_type: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          processed?: boolean
          processing_error?: string | null
          published_at?: string | null
          raw_content?: string | null
          snippet?: string | null
          source: Database["public"]["Enums"]["article_source"]
          title?: string | null
          trigger_type?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          processed?: boolean
          processing_error?: string | null
          published_at?: string | null
          raw_content?: string | null
          snippet?: string | null
          source?: Database["public"]["Enums"]["article_source"]
          title?: string | null
          trigger_type?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_status: {
        Row: {
          contact_name: string
          created_at: string
          id: string
          lead_id: string
          status: Database["public"]["Enums"]["contact_progress_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_name: string
          created_at?: string
          id?: string
          lead_id: string
          status?: Database["public"]["Enums"]["contact_progress_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_name?: string
          created_at?: string
          id?: string
          lead_id?: string
          status?: Database["public"]["Enums"]["contact_progress_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      enrichment_cache: {
        Row: {
          created_at: string
          domain: string
          execs: Json
          id: string
          job_results: Json
          scored: Json | null
          site_markdown: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          execs?: Json
          id?: string
          job_results?: Json
          scored?: Json | null
          site_markdown?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          execs?: Json
          id?: string
          job_results?: Json
          scored?: Json | null
          site_markdown?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gmail_forwarding_confirmations: {
        Row: {
          code: string | null
          created_at: string
          from_address: string | null
          id: string
          raw_body: string | null
          subject: string | null
          user_id: string
          verify_url: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          from_address?: string | null
          id?: string
          raw_body?: string | null
          subject?: string | null
          user_id: string
          verify_url?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          from_address?: string | null
          id?: string
          raw_body?: string | null
          subject?: string | null
          user_id?: string
          verify_url?: string | null
        }
        Relationships: []
      }
      icp_config: {
        Row: {
          auto_enrich_contacts_min_score: number
          company_size_max: number | null
          company_size_min: number | null
          countries_max: number | null
          countries_min: number | null
          created_at: string
          funding_stages: string[]
          id: string
          industries: string[]
          outreach_voice: string
          regions: string[]
          revenue_max_usd: number | null
          revenue_min_usd: number | null
          scoring_prompt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_enrich_contacts_min_score?: number
          company_size_max?: number | null
          company_size_min?: number | null
          countries_max?: number | null
          countries_min?: number | null
          created_at?: string
          funding_stages?: string[]
          id?: string
          industries?: string[]
          outreach_voice?: string
          regions?: string[]
          revenue_max_usd?: number | null
          revenue_min_usd?: number | null
          scoring_prompt?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_enrich_contacts_min_score?: number
          company_size_max?: number | null
          company_size_min?: number | null
          countries_max?: number | null
          countries_min?: number | null
          created_at?: string
          funding_stages?: string[]
          id?: string
          industries?: string[]
          outreach_voice?: string
          regions?: string[]
          revenue_max_usd?: number | null
          revenue_min_usd?: number | null
          scoring_prompt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_postings: {
        Row: {
          board: string | null
          country: string | null
          created_at: string
          id: string
          is_out_of_hq: boolean | null
          lead_id: string
          location: string | null
          posted_at: string | null
          seniority: string | null
          title: string
          url: string
          user_id: string
        }
        Insert: {
          board?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_out_of_hq?: boolean | null
          lead_id: string
          location?: string | null
          posted_at?: string | null
          seniority?: string | null
          title: string
          url: string
          user_id: string
        }
        Update: {
          board?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_out_of_hq?: boolean | null
          lead_id?: string
          location?: string | null
          posted_at?: string | null
          seniority?: string | null
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_contacts: {
        Row: {
          created_at: string
          full_name: string
          id: string
          lead_id: string
          linkedin_url: string | null
          location: string | null
          relevance_score: number
          seniority: string | null
          source: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          lead_id: string
          linkedin_url?: string | null
          location?: string | null
          relevance_score?: number
          seniority?: string | null
          source?: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          lead_id?: string
          linkedin_url?: string | null
          location?: string | null
          relevance_score?: number
          seniority?: string | null
          source?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          ceo_linkedin: string | null
          ceo_name: string | null
          cfo_linkedin: string | null
          cfo_name: string | null
          chro_linkedin: string | null
          chro_name: string | null
          company_name: string
          company_size: string | null
          contacts_enriched_at: string | null
          controller_linkedin: string | null
          controller_name: string | null
          coo_linkedin: string | null
          coo_name: string | null
          created_at: string
          domain: string | null
          expansion_signals: string[]
          finance_leader_1_linkedin: string | null
          finance_leader_1_name: string | null
          finance_leader_2_linkedin: string | null
          finance_leader_2_name: string | null
          fit_reasoning: string | null
          fit_score: number
          funding_amount: string | null
          funding_stage: string | null
          general_counsel_linkedin: string | null
          general_counsel_name: string | null
          hq: string | null
          id: string
          industry: string | null
          status: Database["public"]["Enums"]["lead_status"]
          tier_override: string | null
          trigger_summary: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          ceo_linkedin?: string | null
          ceo_name?: string | null
          cfo_linkedin?: string | null
          cfo_name?: string | null
          chro_linkedin?: string | null
          chro_name?: string | null
          company_name: string
          company_size?: string | null
          contacts_enriched_at?: string | null
          controller_linkedin?: string | null
          controller_name?: string | null
          coo_linkedin?: string | null
          coo_name?: string | null
          created_at?: string
          domain?: string | null
          expansion_signals?: string[]
          finance_leader_1_linkedin?: string | null
          finance_leader_1_name?: string | null
          finance_leader_2_linkedin?: string | null
          finance_leader_2_name?: string | null
          fit_reasoning?: string | null
          fit_score?: number
          funding_amount?: string | null
          funding_stage?: string | null
          general_counsel_linkedin?: string | null
          general_counsel_name?: string | null
          hq?: string | null
          id?: string
          industry?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tier_override?: string | null
          trigger_summary?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          ceo_linkedin?: string | null
          ceo_name?: string | null
          cfo_linkedin?: string | null
          cfo_name?: string | null
          chro_linkedin?: string | null
          chro_name?: string | null
          company_name?: string
          company_size?: string | null
          contacts_enriched_at?: string | null
          controller_linkedin?: string | null
          controller_name?: string | null
          coo_linkedin?: string | null
          coo_name?: string | null
          created_at?: string
          domain?: string | null
          expansion_signals?: string[]
          finance_leader_1_linkedin?: string | null
          finance_leader_1_name?: string | null
          finance_leader_2_linkedin?: string | null
          finance_leader_2_name?: string | null
          fit_reasoning?: string | null
          fit_score?: number
          funding_amount?: string | null
          funding_stage?: string | null
          general_counsel_linkedin?: string | null
          general_counsel_name?: string | null
          hq?: string | null
          id?: string
          industry?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tier_override?: string | null
          trigger_summary?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      linkedin_outreach: {
        Row: {
          approach: number
          company_name: string
          contact_name: string
          contact_role: string | null
          created_at: string
          id: string
          last_status_change_at: string
          lead_id: string
          meeting_at: string | null
          message_text: string | null
          notes: string | null
          replied_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["linkedin_outreach_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approach: number
          company_name: string
          contact_name: string
          contact_role?: string | null
          created_at?: string
          id?: string
          last_status_change_at?: string
          lead_id: string
          meeting_at?: string | null
          message_text?: string | null
          notes?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["linkedin_outreach_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approach?: number
          company_name?: string
          contact_name?: string
          contact_role?: string | null
          created_at?: string
          id?: string
          last_status_change_at?: string
          lead_id?: string
          meeting_at?: string | null
          message_text?: string | null
          notes?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["linkedin_outreach_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          body: string
          created_at: string
          id: string
          lead_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          lead_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          lead_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_drafts: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["outreach_channel"]
          created_at: string
          edited_body: string | null
          id: string
          lead_id: string
          sent_at: string | null
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          channel?: Database["public"]["Enums"]["outreach_channel"]
          created_at?: string
          edited_body?: string | null
          id?: string
          lead_id: string
          sent_at?: string | null
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["outreach_channel"]
          created_at?: string
          edited_body?: string | null
          id?: string
          lead_id?: string
          sent_at?: string | null
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_drafts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          created_at: string
          filters: Json
          id: string
          is_pinned: boolean
          name: string
          sort: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          is_pinned?: boolean
          name: string
          sort?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          is_pinned?: boolean
          name?: string
          sort?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      search_queries: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          last_run_at: string | null
          query: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          query: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          query?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      article_source: "alert_email" | "web_search" | "manual"
      contact_progress_status:
        | "not_responded"
        | "engaged"
        | "meeting"
        | "no_show"
        | "opportunity"
      lead_status: "new" | "pursuing" | "contacted" | "passed"
      linkedin_outreach_status:
        | "queued"
        | "sent"
        | "replied"
        | "meeting"
        | "no_response"
        | "passed"
      outreach_channel: "email" | "linkedin"
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
      article_source: ["alert_email", "web_search", "manual"],
      contact_progress_status: [
        "not_responded",
        "engaged",
        "meeting",
        "no_show",
        "opportunity",
      ],
      lead_status: ["new", "pursuing", "contacted", "passed"],
      linkedin_outreach_status: [
        "queued",
        "sent",
        "replied",
        "meeting",
        "no_response",
        "passed",
      ],
      outreach_channel: ["email", "linkedin"],
    },
  },
} as const
