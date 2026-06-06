import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type UserRole = 'master' | 'leader' | 'member';
type UserStatus = 'pending' | 'active';
type AttendanceStatus = 'pending' | 'attending' | 'absent';
type NotificationScopeType = 'district' | 'service';
type NotificationType =
  | 'general'
  | 'schedule'
  | 'schedule_rsvp'
  | 'study'
  | 'devotional'
  | 'prayer'
  | 'reading_weekly'
  | 'service_notice';
type NotificationDigestMode = 'instant' | 'daily' | 'weekly';
type PushDeliveryStatus = 'pending' | 'sent' | 'failed' | 'expired' | 'skipped';

export interface Database {
  public: {
    Tables: {
      districts: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          description?: string | null;
          is_active?: boolean;
        };
      };
      users: {
        Row: {
          id: string;
          name: string;
          role: UserRole;
          status: UserStatus;
          district_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          role?: UserRole;
          status?: UserStatus;
          district_id?: string;
        };
        Update: {
          name?: string;
          role?: UserRole;
          status?: UserStatus;
          district_id?: string;
        };
      };
      bible_studies: {
        Row: {
          id: string;
          week_number: number;
          title: string;
          scripture: string;
          introduction: string;
          questions: Json;
          study_date: string;
          published: boolean;
          source_pdf_url: string | null;
          district_id: string;
          source_id: string | null;
          source_snapshot: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          week_number: number;
          title: string;
          scripture: string;
          introduction: string;
          questions: Json;
          study_date: string;
          published?: boolean;
          source_pdf_url?: string | null;
          district_id?: string;
          source_id?: string | null;
          source_snapshot?: Json;
        };
        Update: {
          week_number?: number;
          title?: string;
          scripture?: string;
          introduction?: string;
          questions?: Json;
          study_date?: string;
          published?: boolean;
          source_pdf_url?: string | null;
          district_id?: string;
          source_id?: string | null;
          source_snapshot?: Json;
        };
      };
      study_sources: {
        Row: {
          id: string;
          study_date: string;
          week_number: number;
          title: string;
          scripture: string;
          introduction: string;
          questions: Json;
          source_pdf_url: string | null;
          parse_mode: 'auto' | 'manual';
          parsed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          study_date: string;
          week_number: number;
          title: string;
          scripture?: string;
          introduction?: string;
          questions?: Json;
          source_pdf_url?: string | null;
          parse_mode?: 'auto' | 'manual';
          parsed_by?: string | null;
        };
        Update: {
          study_date?: string;
          week_number?: number;
          title?: string;
          scripture?: string;
          introduction?: string;
          questions?: Json;
          source_pdf_url?: string | null;
          parse_mode?: 'auto' | 'manual';
          parsed_by?: string | null;
        };
      };
      study_answers: {
        Row: {
          id: string;
          study_id: string;
          user_id: string;
          answers: Json;
          completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          study_id: string;
          user_id: string;
          answers: Json;
          completed?: boolean;
        };
        Update: {
          answers?: Json;
          completed?: boolean;
        };
      };
      prayer_requests: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          response: string | null;
          answered: boolean;
          shared_with_leader: boolean;
          shared_with_group: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          response?: string | null;
          answered?: boolean;
          shared_with_leader?: boolean;
          shared_with_group?: boolean;
        };
        Update: {
          content?: string;
          response?: string | null;
          answered?: boolean;
          shared_with_leader?: boolean;
          shared_with_group?: boolean;
        };
      };
      prayer_responses: {
        Row: {
          id: string;
          prayer_request_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          prayer_request_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          content?: string;
        };
      };
      prayer_intercessions: {
        Row: {
          id: string;
          prayer_request_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          prayer_request_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          prayer_request_id?: string;
          user_id?: string;
        };
      };
      bible_reading_logs: {
        Row: {
          id: string;
          user_id: string;
          log_date: string;
          chapters: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          log_date: string;
          chapters: number;
        };
        Update: {
          chapters?: number;
        };
      };
      bible_books: {
        Row: {
          id: number;
          korean_name: string;
          abbreviation: string | null;
          testament: 'old' | 'new';
          book_order: number;
          chapter_count: number;
          created_at: string;
        };
        Insert: {
          id: number;
          korean_name: string;
          abbreviation?: string | null;
          testament: 'old' | 'new';
          book_order: number;
          chapter_count: number;
        };
        Update: {
          korean_name?: string;
          abbreviation?: string | null;
          testament?: 'old' | 'new';
          book_order?: number;
          chapter_count?: number;
        };
      };
      bible_verses: {
        Row: {
          book_id: number;
          chapter: number;
          verse: number;
          text: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          book_id: number;
          chapter: number;
          verse: number;
          text: string;
        };
        Update: {
          text?: string;
        };
      };
      bible_bookmarks: {
        Row: {
          id: string;
          user_id: string;
          book_id: number;
          chapter: number;
          verse: number;
          note: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id: number;
          chapter: number;
          verse: number;
          note?: string;
        };
        Update: {
          note?: string;
        };
      };
      schedules: {
        Row: {
          id: string;
          title: string;
          schedule_date: string;
          schedule_time: string | null;
          location: string | null;
          memo: string | null;
          attachment: string | null;
          attendance_check: boolean;
          created_by: string;
          district_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          schedule_date: string;
          schedule_time?: string | null;
          location?: string | null;
          memo?: string | null;
          attachment?: string | null;
          attendance_check?: boolean;
          created_by: string;
          district_id?: string;
        };
        Update: {
          title?: string;
          schedule_date?: string;
          schedule_time?: string | null;
          location?: string | null;
          memo?: string | null;
          attachment?: string | null;
          attendance_check?: boolean;
          district_id?: string;
        };
      };
      attendances: {
        Row: {
          id: string;
          schedule_id: string;
          user_id: string;
          status: AttendanceStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          user_id: string;
          status?: AttendanceStatus;
        };
        Update: {
          status?: AttendanceStatus;
        };
      };
      daily_devotionals: {
        Row: {
          id: string;
          devotional_date: string;
          scripture: string;
          content: string;
          summary: string | null;
          application_question: string | null;
          audio_url: string | null;
          source_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          devotional_date: string;
          scripture: string;
          content: string;
          summary?: string | null;
          application_question?: string | null;
          audio_url?: string | null;
          source_url?: string | null;
        };
        Update: {
          devotional_date?: string;
          scripture?: string;
          content?: string;
          summary?: string | null;
          application_question?: string | null;
          audio_url?: string | null;
          source_url?: string | null;
        };
      };
      weekly_reports: {
        Row: {
          id: string;
          week_start: string;
          week_end: string;
          attendance_count: number | null;
          attendance_names: string[] | null;
          bible_chapters_total: number | null;
          study_completion_count: number | null;
          report_text: string | null;
          is_locked: boolean;
          district_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          week_start: string;
          week_end: string;
          attendance_count?: number | null;
          attendance_names?: string[] | null;
          bible_chapters_total?: number | null;
          study_completion_count?: number | null;
          report_text?: string | null;
          is_locked?: boolean;
          district_id?: string;
        };
        Update: {
          week_start?: string;
          week_end?: string;
          attendance_count?: number | null;
          attendance_names?: string[] | null;
          bible_chapters_total?: number | null;
          study_completion_count?: number | null;
          report_text?: string | null;
          is_locked?: boolean;
          district_id?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          title: string;
          body: string;
          created_by: string;
          district_id: string | null;
          notification_type: NotificationType;
          payload: Json;
          scope_type: NotificationScopeType;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body: string;
          created_by: string;
          district_id?: string | null;
          notification_type?: NotificationType;
          payload?: Json;
          scope_type?: NotificationScopeType;
          created_at?: string;
        };
        Update: {
          title?: string;
          body?: string;
          district_id?: string | null;
          notification_type?: NotificationType;
          payload?: Json;
          scope_type?: NotificationScopeType;
        };
      };
      notification_reads: {
        Row: {
          notification_id: string;
          user_id: string;
          read_at: string;
        };
        Insert: {
          notification_id: string;
          user_id: string;
          read_at?: string;
        };
        Update: {
          read_at?: string;
        };
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          district_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          platform: string;
          user_agent: string | null;
          app_version: string | null;
          is_active: boolean;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          district_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          platform?: string;
          user_agent?: string | null;
          app_version?: string | null;
          is_active?: boolean;
          last_seen_at?: string | null;
        };
        Update: {
          district_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          platform?: string;
          user_agent?: string | null;
          app_version?: string | null;
          is_active?: boolean;
          last_seen_at?: string | null;
        };
      };
      notification_preferences: {
        Row: {
          user_id: string;
          schedule_enabled: boolean;
          study_enabled: boolean;
          devotional_enabled: boolean;
          prayer_enabled: boolean;
          reading_weekly_enabled: boolean;
          service_notice_enabled: boolean;
          quiet_hours_start: string | null;
          quiet_hours_end: string | null;
          digest_mode: NotificationDigestMode;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          schedule_enabled?: boolean;
          study_enabled?: boolean;
          devotional_enabled?: boolean;
          prayer_enabled?: boolean;
          reading_weekly_enabled?: boolean;
          service_notice_enabled?: boolean;
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
          digest_mode?: NotificationDigestMode;
        };
        Update: {
          schedule_enabled?: boolean;
          study_enabled?: boolean;
          devotional_enabled?: boolean;
          prayer_enabled?: boolean;
          reading_weekly_enabled?: boolean;
          service_notice_enabled?: boolean;
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
          digest_mode?: NotificationDigestMode;
        };
      };
      push_deliveries: {
        Row: {
          id: string;
          notification_id: string;
          subscription_id: string;
          user_id: string;
          district_id: string | null;
          delivery_type: 'push';
          status: PushDeliveryStatus;
          error_message: string | null;
          response_code: number | null;
          attempt_count: number;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          notification_id: string;
          subscription_id: string;
          user_id: string;
          district_id?: string | null;
          delivery_type?: 'push';
          status?: PushDeliveryStatus;
          error_message?: string | null;
          response_code?: number | null;
          attempt_count?: number;
          sent_at?: string | null;
        };
        Update: {
          district_id?: string | null;
          delivery_type?: 'push';
          status?: PushDeliveryStatus;
          error_message?: string | null;
          response_code?: number | null;
          attempt_count?: number;
          sent_at?: string | null;
        };
      };
    };
  };
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: (_name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => fn(),
    persistSession: true,
    detectSessionInUrl: true,
  },
});
