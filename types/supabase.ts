export type Json =
  | string
  | number
  | boolean
  | null
  | {
      [key: string]: Json | undefined;
    }
  | Json[];

export type Database = {
  public: {
    Tables: {
      books: {
        Row: {
          author: string | null;
          cover_url: string | null;
          created_at: string;
          description: string | null;
          id: string;
          import_error: string | null;
          import_status: "processing" | "ready" | "failed";
          language: string | null;
          rag_error: string | null;
          rag_status: "pending" | "processing" | "ready" | "partial" | "failed";
          source_file_name: string;
          source_file_type: string;
          source_storage_path: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          author?: string | null;
          cover_url?: string | null;
          created_at?: string;
          description?: string | null;
          id: string;
          import_error?: string | null;
          import_status?: "processing" | "ready" | "failed";
          language?: string | null;
          rag_error?: string | null;
          rag_status?: "pending" | "processing" | "ready" | "partial" | "failed";
          source_file_name: string;
          source_file_type: string;
          source_storage_path: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          author?: string | null;
          cover_url?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          import_error?: string | null;
          import_status?: "processing" | "ready" | "failed";
          language?: string | null;
          rag_error?: string | null;
          rag_status?: "pending" | "processing" | "ready" | "partial" | "failed";
          source_file_name?: string;
          source_file_type?: string;
          source_storage_path?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      book_chunks: {
        Row: {
          book_id: string;
          chapter_id: string;
          chunk_index: number;
          content: string;
          created_at: string;
          embedding: number[] | null;
          embedding_error: string | null;
          embedding_model: string | null;
          embedding_status: "pending" | "ready" | "failed";
          end_paragraph_id: string;
          end_paragraph_order: number;
          id: string;
          paragraph_count: number;
          start_paragraph_id: string;
          start_paragraph_order: number;
          updated_at: string;
        };
        Insert: {
          book_id: string;
          chapter_id: string;
          chunk_index: number;
          content: string;
          created_at?: string;
          embedding?: number[] | null;
          embedding_error?: string | null;
          embedding_model?: string | null;
          embedding_status?: "pending" | "ready" | "failed";
          end_paragraph_id: string;
          end_paragraph_order: number;
          id?: string;
          paragraph_count: number;
          start_paragraph_id: string;
          start_paragraph_order: number;
          updated_at?: string;
        };
        Update: {
          book_id?: string;
          chapter_id?: string;
          chunk_index?: number;
          content?: string;
          created_at?: string;
          embedding?: number[] | null;
          embedding_error?: string | null;
          embedding_model?: string | null;
          embedding_status?: "pending" | "ready" | "failed";
          end_paragraph_id?: string;
          end_paragraph_order?: number;
          id?: string;
          paragraph_count?: number;
          start_paragraph_id?: string;
          start_paragraph_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      chapters: {
        Row: {
          book_id: string;
          created_at: string;
          id: string;
          order_index: number;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          book_id: string;
          created_at?: string;
          id?: string;
          order_index: number;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          book_id?: string;
          created_at?: string;
          id?: string;
          order_index?: number;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      paragraphs: {
        Row: {
          book_id: string;
          chapter_id: string;
          content: string;
          created_at: string;
          id: string;
          order_index: number;
          updated_at: string;
        };
        Insert: {
          book_id: string;
          chapter_id: string;
          content: string;
          created_at?: string;
          id?: string;
          order_index: number;
          updated_at?: string;
        };
        Update: {
          book_id?: string;
          chapter_id?: string;
          content?: string;
          created_at?: string;
          id?: string;
          order_index?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      smart_mark_jobs: {
        Row: {
          book_id: string;
          chapter_id: string | null;
          created_at: string;
          error_message: string | null;
          finished_at: string | null;
          id: string;
          inserted_marks: number;
          processed_paragraphs: number;
          started_at: string | null;
          status: "pending" | "processing" | "ready" | "failed";
          total_paragraphs: number;
        };
        Insert: {
          book_id: string;
          chapter_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          inserted_marks?: number;
          processed_paragraphs?: number;
          started_at?: string | null;
          status?: "pending" | "processing" | "ready" | "failed";
          total_paragraphs?: number;
        };
        Update: {
          book_id?: string;
          chapter_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          inserted_marks?: number;
          processed_paragraphs?: number;
          started_at?: string | null;
          status?: "pending" | "processing" | "ready" | "failed";
          total_paragraphs?: number;
        };
        Relationships: [];
      };
      smart_marks: {
        Row: {
          book_id: string;
          chapter_id: string;
          confidence: number;
          created_at: string;
          end_offset: number;
          explanation: string | null;
          id: string;
          mark_type:
            | "difficult-term"
            | "background"
            | "person"
            | "place"
            | "historical-context"
            | "literary-allusion"
            | "abstract-concept"
            | "author-keyword";
          paragraph_id: string;
          source: string;
          start_offset: number;
          target_text: string;
          updated_at: string;
        };
        Insert: {
          book_id: string;
          chapter_id: string;
          confidence?: number;
          created_at?: string;
          end_offset: number;
          explanation?: string | null;
          id?: string;
          mark_type:
            | "difficult-term"
            | "background"
            | "person"
            | "place"
            | "historical-context"
            | "literary-allusion"
            | "abstract-concept"
            | "author-keyword";
          paragraph_id: string;
          source?: string;
          start_offset: number;
          target_text: string;
          updated_at?: string;
        };
        Update: {
          book_id?: string;
          chapter_id?: string;
          confidence?: number;
          created_at?: string;
          end_offset?: number;
          explanation?: string | null;
          id?: string;
          mark_type?:
            | "difficult-term"
            | "background"
            | "person"
            | "place"
            | "historical-context"
            | "literary-allusion"
            | "abstract-concept"
            | "author-keyword";
          paragraph_id?: string;
          source?: string;
          start_offset?: number;
          target_text?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reflection_cards: {
        Row: {
          book_id: string;
          chapter_id: string;
          content: string;
          created_at: string;
          display_name_snapshot: string | null;
          id: string;
          moderation_status: string;
          paragraph_excerpt: string;
          paragraph_id: string;
          report_count: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          book_id: string;
          chapter_id: string;
          content: string;
          created_at?: string;
          display_name_snapshot?: string | null;
          id?: string;
          moderation_status?: string;
          paragraph_excerpt: string;
          paragraph_id: string;
          report_count?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          book_id?: string;
          chapter_id?: string;
          content?: string;
          created_at?: string;
          display_name_snapshot?: string | null;
          id?: string;
          moderation_status?: string;
          paragraph_excerpt?: string;
          paragraph_id?: string;
          report_count?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      reflection_card_likes: {
        Row: {
          card_id: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          card_id: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          card_id?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      feedback_reports: {
        Row: {
          content: string | null;
          created_at: string;
          feedback_type: string;
          id: string;
          metadata: Json;
          status: string;
          target_id: string | null;
          target_type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content?: string | null;
          created_at?: string;
          feedback_type: string;
          id?: string;
          metadata?: Json;
          status?: string;
          target_id?: string | null;
          target_type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: string | null;
          created_at?: string;
          feedback_type?: string;
          id?: string;
          metadata?: Json;
          status?: string;
          target_id?: string | null;
          target_type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      personal_notes: {
        Row: {
          ai_content: string | null;
          book_id: string;
          chapter_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          note_content: string | null;
          paragraph_excerpt: string;
          paragraph_id: string;
          source_text: string | null;
          source_type: "ai_answer" | "smart_mark_explanation" | "selected_text" | "reflection" | "dialogue_summary";
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ai_content?: string | null;
          book_id: string;
          chapter_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          note_content?: string | null;
          paragraph_excerpt: string;
          paragraph_id: string;
          source_text?: string | null;
          source_type: "ai_answer" | "smart_mark_explanation" | "selected_text" | "reflection" | "dialogue_summary";
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ai_content?: string | null;
          book_id?: string;
          chapter_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          note_content?: string | null;
          paragraph_excerpt?: string;
          paragraph_id?: string;
          source_text?: string | null;
          source_type?: "ai_answer" | "smart_mark_explanation" | "selected_text" | "reflection" | "dialogue_summary";
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      reading_behavior_events: {
        Row: {
          book_id: string;
          chapter_id: string | null;
          chapter_order: number | null;
          created_at: string;
          event_metadata: Json;
          event_type:
            | "reader_opened"
            | "chapter_viewed"
            | "progress_saved"
            | "page_reopened_without_progress"
            | "selection_ai_question"
            | "reminder_dismissed";
          id: string;
          occurred_at: string;
          paragraph_id: string | null;
          paragraph_order: number | null;
          user_id: string;
        };
        Insert: {
          book_id: string;
          chapter_id?: string | null;
          chapter_order?: number | null;
          created_at?: string;
          event_metadata?: Json;
          event_type:
            | "reader_opened"
            | "chapter_viewed"
            | "progress_saved"
            | "page_reopened_without_progress"
            | "selection_ai_question"
            | "reminder_dismissed";
          id?: string;
          occurred_at?: string;
          paragraph_id?: string | null;
          paragraph_order?: number | null;
          user_id: string;
        };
        Update: {
          book_id?: string;
          chapter_id?: string | null;
          chapter_order?: number | null;
          created_at?: string;
          event_metadata?: Json;
          event_type?:
            | "reader_opened"
            | "chapter_viewed"
            | "progress_saved"
            | "page_reopened_without_progress"
            | "selection_ai_question"
            | "reminder_dismissed";
          id?: string;
          occurred_at?: string;
          paragraph_id?: string | null;
          paragraph_order?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      reading_slump_rule_configs: {
        Row: {
          created_at: string;
          enabled_rules: Json;
          id: string;
          is_active: boolean;
          thresholds: Json;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          enabled_rules?: Json;
          id?: string;
          is_active?: boolean;
          thresholds?: Json;
          updated_at?: string;
          version: number;
        };
        Update: {
          created_at?: string;
          enabled_rules?: Json;
          id?: string;
          is_active?: boolean;
          thresholds?: Json;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      reading_slump_states: {
        Row: {
          book_id: string;
          created_at: string;
          evaluated_at: string;
          id: string;
          last_dismissed_at: string | null;
          reminder_suppressed_until: string | null;
          rule_version: number;
          signal_count: number;
          status: "steady" | "at_risk" | "slump";
          triggered_signals: string[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          book_id: string;
          created_at?: string;
          evaluated_at?: string;
          id?: string;
          last_dismissed_at?: string | null;
          reminder_suppressed_until?: string | null;
          rule_version: number;
          signal_count?: number;
          status?: "steady" | "at_risk" | "slump";
          triggered_signals?: string[];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          book_id?: string;
          created_at?: string;
          evaluated_at?: string;
          id?: string;
          last_dismissed_at?: string | null;
          reminder_suppressed_until?: string | null;
          rule_version?: number;
          signal_count?: number;
          status?: "steady" | "at_risk" | "slump";
          triggered_signals?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      academic_recommendation_cache: {
        Row: {
          book_id: string;
          cache_key: string;
          chapter_id: string | null;
          chapter_order: number | null;
          created_at: string;
          id: string;
          paragraph_id: string | null;
          paragraph_order: number | null;
          recommendations: Json;
          retrieved_at: string;
          source_count: number;
          themes: string[];
          trigger_reasons: string[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          book_id: string;
          cache_key: string;
          chapter_id?: string | null;
          chapter_order?: number | null;
          created_at?: string;
          id?: string;
          paragraph_id?: string | null;
          paragraph_order?: number | null;
          recommendations?: Json;
          retrieved_at?: string;
          source_count?: number;
          themes?: string[];
          trigger_reasons?: string[];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          book_id?: string;
          cache_key?: string;
          chapter_id?: string | null;
          chapter_order?: number | null;
          created_at?: string;
          id?: string;
          paragraph_id?: string | null;
          paragraph_order?: number | null;
          recommendations?: Json;
          retrieved_at?: string;
          source_count?: number;
          themes?: string[];
          trigger_reasons?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_memory_settings: {
        Row: {
          created_at: string;
          id: string;
          memory_enabled: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          memory_enabled?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          memory_enabled?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_memories: {
        Row: {
          content: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_enabled: boolean;
          memory_key: string;
          memory_type:
            | "explanation_style"
            | "interpretive_interest"
            | "recurring_question"
            | "answer_length"
            | "reading_assistance";
          reinforcement_count: number;
          source: "selection_ai" | "chapter_end_ai" | "reader_behavior" | "manual";
          source_context: Json;
          status: "active" | "deleted" | "rejected";
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_enabled?: boolean;
          memory_key: string;
          memory_type:
            | "explanation_style"
            | "interpretive_interest"
            | "recurring_question"
            | "answer_length"
            | "reading_assistance";
          reinforcement_count?: number;
          source: "selection_ai" | "chapter_end_ai" | "reader_behavior" | "manual";
          source_context?: Json;
          status?: "active" | "deleted" | "rejected";
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_enabled?: boolean;
          memory_key?: string;
          memory_type?:
            | "explanation_style"
            | "interpretive_interest"
            | "recurring_question"
            | "answer_length"
            | "reading_assistance";
          reinforcement_count?: number;
          source?: "selection_ai" | "chapter_end_ai" | "reader_behavior" | "manual";
          source_context?: Json;
          status?: "active" | "deleted" | "rejected";
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_bookshelves: {
        Row: {
          book_id: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          book_id: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          book_id?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_book_chunks: {
        Args: {
          match_count?: number;
          query_embedding_text: string;
          target_book_id: string;
          target_chapter_id?: string | null;
          target_paragraph_id?: string | null;
        };
        Returns: {
          book_id: string;
          chapter_id: string;
          chapter_title: string | null;
          chunk_id: string;
          content: string;
          end_paragraph_id: string;
          end_paragraph_order: number;
          similarity: number;
          start_paragraph_id: string;
          start_paragraph_order: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
