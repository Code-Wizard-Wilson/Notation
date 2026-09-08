export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      notes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          emoji: string;
          content_json: Json;
          plain_text_content: string;
          is_pinned: boolean;
          is_archived: boolean;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          emoji?: string;
          content_json?: Json;
          plain_text_content?: string;
          is_pinned?: boolean;
          is_archived?: boolean;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          title?: string;
          emoji?: string;
          content_json?: Json;
          plain_text_content?: string;
          is_pinned?: boolean;
          is_archived?: boolean;
          is_deleted?: boolean;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          note_id: string;
          user_id: string;
          type: "image" | "file";
          filename: string;
          storage_path: string;
          mime_type: string;
          size: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          user_id: string;
          type: "image" | "file";
          filename: string;
          storage_path: string;
          mime_type: string;
          size: number;
          created_at?: string;
        };
        Update: {
          filename?: string;
          storage_path?: string;
        };
        Relationships: [];
      };
      note_links: {
        Row: {
          id: string;
          user_id: string;
          source_note_id: string;
          target_note_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_note_id: string;
          target_note_id: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
