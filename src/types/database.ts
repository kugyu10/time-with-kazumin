export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: number
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          id?: number
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          id?: number
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          created_at: string | null
          end_time: string
          google_event_id: string | null
          guest_email: string | null
          guest_name: string | null
          guest_token: string | null
          id: number
          member_plan_id: number | null
          menu_id: number
          reminder_sent_at: string | null
          start_time: string
          status: string
          thank_you_sent_at: string | null
          updated_at: string | null
          zoom_join_url: string | null
          zoom_meeting_id: string | null
        }
        Insert: {
          created_at?: string | null
          end_time: string
          google_event_id?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_token?: string | null
          id?: number
          member_plan_id?: number | null
          menu_id: number
          reminder_sent_at?: string | null
          start_time: string
          status?: string
          thank_you_sent_at?: string | null
          updated_at?: string | null
          zoom_join_url?: string | null
          zoom_meeting_id?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: string
          google_event_id?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_token?: string | null
          id?: number
          member_plan_id?: number | null
          menu_id?: number
          reminder_sent_at?: string | null
          start_time?: string
          status?: string
          thank_you_sent_at?: string | null
          updated_at?: string | null
          zoom_join_url?: string | null
          zoom_meeting_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_member_plan_id_fkey"
            columns: ["member_plan_id"]
            isOneToOne: false
            referencedRelation: "member_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "meeting_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string | null
          expires_at: string
          id: number
          key: string
          request_hash: string
          response: Json
        }
        Insert: {
          created_at?: string | null
          expires_at?: string
          id?: number
          key: string
          request_hash: string
          response: Json
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: number
          key?: string
          request_hash?: string
          response?: Json
        }
        Relationships: []
      }
      meeting_menus: {
        Row: {
          allowed_plan_types: number[] | null
          created_at: string | null
          description: string | null
          duration_minutes: number
          id: number
          is_active: boolean | null
          name: string
          points_required: number
          send_thank_you_email: boolean | null
          updated_at: string | null
          zoom_account: string
        }
        Insert: {
          allowed_plan_types?: number[] | null
          created_at?: string | null
          description?: string | null
          duration_minutes: number
          id?: number
          is_active?: boolean | null
          name: string
          points_required: number
          send_thank_you_email?: boolean | null
          updated_at?: string | null
          zoom_account: string
        }
        Update: {
          allowed_plan_types?: number[] | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          id?: number
          is_active?: boolean | null
          name?: string
          points_required?: number
          send_thank_you_email?: boolean | null
          updated_at?: string | null
          zoom_account?: string
        }
        Relationships: []
      }
      member_plans: {
        Row: {
          created_at: string | null
          current_points: number
          ended_at: string | null
          id: number
          monthly_points: number
          plan_id: number
          started_at: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_points?: number
          ended_at?: string | null
          id?: number
          monthly_points: number
          plan_id: number
          started_at?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_points?: number
          ended_at?: string | null
          id?: number
          monthly_points?: number
          plan_id?: number
          started_at?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_tokens: {
        Row: {
          access_token_encrypted: string
          created_at: string
          expiry_date: string | null
          id: number
          provider: string
          refresh_token_encrypted: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted: string
          created_at?: string
          expiry_date?: string | null
          id?: number
          provider: string
          refresh_token_encrypted?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string
          expiry_date?: string | null
          id?: number
          provider?: string
          refresh_token_encrypted?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string | null
          id: number
          is_active: boolean | null
          max_points: number | null
          monthly_points: number
          name: string
          price_monthly: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          max_points?: number | null
          monthly_points: number
          name: string
          price_monthly?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          max_points?: number | null
          monthly_points?: number
          name?: string
          price_monthly?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          balance_after: number
          created_at: string | null
          id: number
          member_plan_id: number
          notes: string | null
          points: number
          reference_id: number | null
          transaction_type: string
        }
        Insert: {
          balance_after: number
          created_at?: string | null
          id?: number
          member_plan_id: number
          notes?: string | null
          points: number
          reference_id?: number | null
          transaction_type: string
        }
        Update: {
          balance_after?: number
          created_at?: string | null
          id?: number
          member_plan_id?: number
          notes?: string | null
          points?: number
          reference_id?: number | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_member_plan_id_fkey"
            columns: ["member_plan_id"]
            isOneToOne: false
            referencedRelation: "member_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      task_execution_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          details: Json | null
          error_details: string[] | null
          failed_count: number | null
          id: number
          reference_id: number | null
          reference_type: string | null
          started_at: string
          status: string
          success_count: number | null
          task_name: string
          total_count: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          details?: Json | null
          error_details?: string[] | null
          failed_count?: number | null
          id?: number
          reference_id?: number | null
          reference_type?: string | null
          started_at?: string
          status: string
          success_count?: number | null
          task_name: string
          total_count?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          details?: Json | null
          error_details?: string[] | null
          failed_count?: number | null
          id?: number
          reference_id?: number | null
          reference_type?: string | null
          started_at?: string
          status?: string
          success_count?: number | null
          task_name?: string
          total_count?: number | null
        }
        Relationships: []
      }
      weekly_schedules: {
        Row: {
          break_end_time: string | null
          break_start_time: string | null
          created_at: string | null
          day_of_week: number
          end_time: string
          id: number
          is_holiday_pattern: boolean
          start_time: string
          updated_at: string | null
        }
        Insert: {
          break_end_time?: string | null
          break_start_time?: string | null
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: number
          is_holiday_pattern?: boolean
          start_time: string
          updated_at?: string | null
        }
        Update: {
          break_end_time?: string | null
          break_start_time?: string | null
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: number
          is_holiday_pattern?: boolean
          start_time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_points: {
        Args: {
          p_member_plan_id: number
          p_notes?: string
          p_points: number
          p_reference_id?: number
          p_transaction_type?: string
        }
        Returns: number
      }
      decrypt_token: {
        Args: { encrypted_token: string; encryption_key: string }
        Returns: string
      }
      delete_oauth_token: { Args: { p_provider: string }; Returns: undefined }
      encrypt_token: {
        Args: { encryption_key: string; token: string }
        Returns: string
      }
      get_oauth_token: {
        Args: { p_encryption_key: string; p_provider: string }
        Returns: {
          access_token: string
          expiry_date: string
          refresh_token: string
        }[]
      }
      grant_monthly_points: {
        Args: never
        Returns: {
          granted_points: number
          member_plan_id: number
          new_balance: number
        }[]
      }
      manual_adjust_points: {
        Args: { p_member_plan_id: number; p_notes?: string; p_points: number }
        Returns: number
      }
      refund_points: {
        Args: {
          p_member_plan_id: number
          p_notes?: string
          p_points: number
          p_reference_id?: number
          p_transaction_type?: string
        }
        Returns: number
      }
      upsert_oauth_token: {
        Args: {
          p_access_token: string
          p_encryption_key?: string
          p_expiry_date?: string
          p_provider: string
          p_refresh_token?: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

