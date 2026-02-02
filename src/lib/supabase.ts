import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nyevygppwrhadxegqqvl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZXZ5Z3Bwd3JoYWR4ZWdxcXZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTY5MTcsImV4cCI6MjA4NTE5MjkxN30.-YBncgAj_2qOLJDaWI11NPpGAr2bwvEmo8bgB0WgKaQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Database types
export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  verified: boolean;
  created_at: string;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  friend_profile?: Profile;
}

export interface Chat {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string;
  created_at: string;
  participants?: ChatParticipant[];
  last_message?: Message;
}

export interface ChatParticipant {
  id: string;
  chat_id: string;
  user_id: string;
  joined_at: string;
  profile?: Profile;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location';
  media_url: string | null;
  reply_to: string | null;
  edited: boolean;
  deleted: boolean;
  created_at: string;
  updated_at: string;
  sender?: Profile;
  reactions?: MessageReaction[];
  reads?: MessageRead[];
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface MessageRead {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
}

export interface Story {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  story_type: 'image' | 'video' | 'text';
  background_color: string | null;
  expires_at: string;
  created_at: string;
  user?: Profile;
  views?: StoryView[];
}

export interface StoryView {
  id: string;
  story_id: string;
  viewer_id: string;
  viewed_at: string;
  viewer?: Profile;
}

export interface Call {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: 'audio' | 'video';
  status: 'initiated' | 'ringing' | 'answered' | 'ended' | 'missed' | 'rejected';
  started_at: string;
  ended_at: string | null;
  duration: number | null;
  caller?: Profile;
  receiver?: Profile;
}

export interface UserSettings {
  user_id: string;
  theme: string;
  last_seen_privacy: 'everyone' | 'friends' | 'nobody';
  profile_photo_privacy: 'everyone' | 'friends' | 'nobody';
  read_receipts: boolean;
  typing_indicators: boolean;
  online_status: boolean;
  notifications_enabled: boolean;
  notification_sound: string;
  created_at: string;
}

export interface ChatSettings {
  id: string;
  chat_id: string;
  user_id: string;
  is_pinned: boolean;
  is_muted: boolean;
  is_archived: boolean;
  is_hidden: boolean;
  wallpaper_url: string | null;
  theme: string | null;
}
