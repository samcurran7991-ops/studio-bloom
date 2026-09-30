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
      connection_secrets: {
        Row: {
          access_token: string | null
          expires_at: string | null
          page_tokens: Json
          provider: string
          refresh_token: string | null
          studio_id: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          expires_at?: string | null
          page_tokens?: Json
          provider: string
          refresh_token?: string | null
          studio_id: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          expires_at?: string | null
          page_tokens?: Json
          provider?: string
          refresh_token?: string | null
          studio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_secrets_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          account_name: string | null
          connected_at: string
          connected_by: string | null
          details: Json
          error: string | null
          external_ids: string[]
          last_event_at: string | null
          provider: string
          status: string
          studio_id: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          connected_at?: string
          connected_by?: string | null
          details?: Json
          error?: string | null
          external_ids?: string[]
          last_event_at?: string | null
          provider: string
          status?: string
          studio_id: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          connected_at?: string
          connected_by?: string | null
          details?: Json
          error?: string | null
          external_ids?: string[]
          last_event_at?: string | null
          provider?: string
          status?: string
          studio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      followups: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          next_at: string | null
          status: string
          step: number
          stop_reason: string | null
          studio_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          next_at?: string | null
          status?: string
          step?: number
          stop_reason?: string | null
          studio_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          next_at?: string | null
          status?: string
          step?: number
          stop_reason?: string | null
          studio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_events: {
        Row: {
          created_at: string
          id: number
          session_id: string
          source: string
          step: string
          studio_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          session_id: string
          source: string
          step: string
          studio_id: string
        }
        Update: {
          created_at?: string
          id?: never
          session_id?: string
          source?: string
          step?: string
          studio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_events_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          chat: Json | null
          created_at: string
          id: string
          lead_id: string
          studio_id: string
          text: string
          type: string
        }
        Insert: {
          chat?: Json | null
          created_at?: string
          id?: string
          lead_id: string
          studio_id: string
          text: string
          type: string
        }
        Update: {
          chat?: Json | null
          created_at?: string
          id?: string
          lead_id?: string
          studio_id?: string
          text?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          campaign: string | null
          created_at: string
          email: string | null
          has_unread: boolean
          id: string
          ig_user_id: string | null
          ig_username: string | null
          kind: string
          last_message_at: string | null
          message: string | null
          name: string
          phone: string | null
          phone_e164: string | null
          preferred_day: string | null
          preferred_time: string | null
          quiz: Json
          service: string | null
          source: string
          status: string
          studio_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          campaign?: string | null
          created_at?: string
          email?: string | null
          has_unread?: boolean
          id?: string
          ig_user_id?: string | null
          ig_username?: string | null
          kind: string
          last_message_at?: string | null
          message?: string | null
          name: string
          phone?: string | null
          phone_e164?: string | null
          preferred_day?: string | null
          preferred_time?: string | null
          quiz?: Json
          service?: string | null
          source?: string
          status?: string
          studio_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          campaign?: string | null
          created_at?: string
          email?: string | null
          has_unread?: boolean
          id?: string
          ig_user_id?: string | null
          ig_username?: string | null
          kind?: string
          last_message_at?: string | null
          message?: string | null
          name?: string
          phone?: string | null
          phone_e164?: string | null
          preferred_day?: string | null
          preferred_time?: string | null
          quiz?: Json
          service?: string | null
          source?: string
          status?: string
          studio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          channel: string
          created_at: string
          direction: string
          error: string | null
          id: string
          lead_id: string | null
          provider_id: string | null
          sent_by: string | null
          status: string
          studio_id: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          direction: string
          error?: string | null
          id?: string
          lead_id?: string | null
          provider_id?: string | null
          sent_by?: string | null
          status?: string
          studio_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          direction?: string
          error?: string | null
          id?: string
          lead_id?: string | null
          provider_id?: string | null
          sent_by?: string | null
          status?: string
          studio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string
          provider: string
          return_to: string
          state: string
          studio_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          provider: string
          return_to?: string
          state: string
          studio_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          provider?: string
          return_to?: string
          state?: string
          studio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      opt_outs: {
        Row: {
          created_at: string
          phone_e164: string
          studio_id: string
        }
        Insert: {
          created_at?: string
          phone_e164: string
          studio_id: string
        }
        Update: {
          created_at?: string
          phone_e164?: string
          studio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opt_outs_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          studio_id: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          studio_id: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          studio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_members: {
        Row: {
          role: string
          studio_id: string
          user_id: string
        }
        Insert: {
          role?: string
          studio_id: string
          user_id: string
        }
        Update: {
          role?: string
          studio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_members_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studios: {
        Row: {
          config: Json
          created_at: string
          id: string
          ingest_key: string
          messaging: Json
          slug: string
        }
        Insert: {
          config: Json
          created_at?: string
          id?: string
          ingest_key?: string
          messaging?: Json
          slug: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          ingest_key?: string
          messaging?: Json
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      disconnect_account: {
        Args: { p_provider: string; p_studio: string }
        Returns: undefined
      }
      funnel_counts: {
        Args: { p_since: string; p_studio: string }
        Returns: {
          n: number
          source: string
          step: string
        }[]
      }
      get_ingest_key: { Args: { p_studio: string }; Returns: string }
      get_public_studio: { Args: { p_slug: string }; Returns: Json }
      is_member: { Args: { p_studio: string }; Returns: boolean }
      submit_lead: { Args: { p_lead: Json; p_slug: string }; Returns: string }
      to_e164: { Args: { p: string }; Returns: string }
      track_step: {
        Args: {
          p_session: string
          p_slug: string
          p_source: string
          p_step: string
        }
        Returns: undefined
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
