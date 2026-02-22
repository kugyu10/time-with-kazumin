export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: "guest" | "member" | "admin"
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: "guest" | "member" | "admin"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: "guest" | "member" | "admin"
          created_at?: string
          updated_at?: string
        }
      }
      plans: {
        Row: {
          id: number
          name: string
          monthly_points: number
          max_points: number | null
          price_monthly: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          monthly_points: number
          max_points?: number | null
          price_monthly?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          monthly_points?: number
          max_points?: number | null
          price_monthly?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      member_plans: {
        Row: {
          id: number
          user_id: string
          plan_id: number
          current_points: number
          monthly_points: number
          status: "active" | "suspended" | "canceled"
          started_at: string
          ended_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          plan_id: number
          current_points?: number
          monthly_points: number
          status?: "active" | "suspended" | "canceled"
          started_at?: string
          ended_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          plan_id?: number
          current_points?: number
          monthly_points?: number
          status?: "active" | "suspended" | "canceled"
          started_at?: string
          ended_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      meeting_menus: {
        Row: {
          id: number
          name: string
          duration_minutes: number
          points_required: number
          zoom_account: "A" | "B"
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          duration_minutes: number
          points_required: number
          zoom_account: "A" | "B"
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          duration_minutes?: number
          points_required?: number
          zoom_account?: "A" | "B"
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      weekly_schedules: {
        Row: {
          id: number
          day_of_week: number
          is_holiday_pattern: boolean
          start_time: string
          end_time: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          day_of_week: number
          is_holiday_pattern?: boolean
          start_time: string
          end_time: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          day_of_week?: number
          is_holiday_pattern?: boolean
          start_time?: string
          end_time?: string
          created_at?: string
          updated_at?: string
        }
      }
      point_transactions: {
        Row: {
          id: number
          member_plan_id: number
          points: number
          transaction_type: "consume" | "refund" | "monthly_grant" | "manual_adjust"
          reference_id: number | null
          notes: string | null
          balance_after: number
          created_at: string
        }
        Insert: {
          id?: number
          member_plan_id: number
          points: number
          transaction_type: "consume" | "refund" | "monthly_grant" | "manual_adjust"
          reference_id?: number | null
          notes?: string | null
          balance_after: number
          created_at?: string
        }
        Update: {
          id?: number
          member_plan_id?: number
          points?: number
          transaction_type?: "consume" | "refund" | "monthly_grant" | "manual_adjust"
          reference_id?: number | null
          notes?: string | null
          balance_after?: number
          created_at?: string
        }
      }
      bookings: {
        Row: {
          id: number
          member_plan_id: number | null
          menu_id: number
          guest_email: string | null
          guest_name: string | null
          guest_token: string | null
          start_time: string
          end_time: string
          status: "confirmed" | "completed" | "canceled"
          zoom_meeting_id: string | null
          zoom_join_url: string | null
          google_event_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          member_plan_id?: number | null
          menu_id: number
          guest_email?: string | null
          guest_name?: string | null
          guest_token?: string | null
          start_time: string
          end_time: string
          status?: "confirmed" | "completed" | "canceled"
          zoom_meeting_id?: string | null
          zoom_join_url?: string | null
          google_event_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          member_plan_id?: number | null
          menu_id?: number
          guest_email?: string | null
          guest_name?: string | null
          guest_token?: string | null
          start_time?: string
          end_time?: string
          status?: "confirmed" | "completed" | "canceled"
          zoom_meeting_id?: string | null
          zoom_join_url?: string | null
          google_event_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      app_settings: {
        Row: {
          id: number
          key: string
          value: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          key: string
          value?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          key?: string
          value?: string | null
          updated_at?: string
        }
      }
      idempotency_keys: {
        Row: {
          id: number
          key: string
          request_hash: string
          response: Json
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: number
          key: string
          request_hash: string
          response: Json
          created_at?: string
          expires_at?: string
        }
        Update: {
          id?: number
          key?: string
          request_hash?: string
          response?: Json
          created_at?: string
          expires_at?: string
        }
      }
    }
    Functions: {
      consume_points: {
        Args: {
          p_member_plan_id: number
          p_points: number
          p_transaction_type: string
          p_reference_id: number | null
          p_notes: string | null
        }
        Returns: number
      }
      refund_points: {
        Args: {
          p_member_plan_id: number
          p_points: number
          p_reference_id: number | null
          p_notes: string | null
        }
        Returns: number
      }
      manual_adjust_points: {
        Args: {
          p_member_plan_id: number
          p_points: number
          p_notes: string | null
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
