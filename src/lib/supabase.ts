import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          role: 'leader' | 'member';
          status: 'pending' | 'active';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          role?: 'leader' | 'member';
          status?: 'pending' | 'active';
        };
        Update: {
          name?: string;
          role?: 'leader' | 'member';
          status?: 'pending' | 'active';
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
        };
        Update: {
          week_number?: number;
          title?: string;
          scripture?: string;
          introduction?: string;
          questions?: Json;
          study_date?: string;
          published?: boolean;
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          response?: string | null;
          answered?: boolean;
        };
        Update: {
          content?: string;
          response?: string | null;
          answered?: boolean;
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
      schedules: {
        Row: {
          id: string;
          title: string;
          schedule_date: string;
          schedule_time: string | null;
          location: string | null;
          memo: string | null;
          attendance_check: boolean;
          created_by: string;
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
          attendance_check?: boolean;
          created_by: string;
        };
        Update: {
          title?: string;
          schedule_date?: string;
          schedule_time?: string | null;
          location?: string | null;
          memo?: string | null;
          attendance_check?: boolean;
        };
      };
      attendances: {
        Row: {
          id: string;
          schedule_id: string;
          user_id: string;
          status: 'pending' | 'attending' | 'absent';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          user_id: string;
          status?: 'pending' | 'attending' | 'absent';
        };
        Update: {
          status?: 'pending' | 'attending' | 'absent';
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
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: 'no-op',
    persistSession: true,
    detectSessionInUrl: true,
  },
});
