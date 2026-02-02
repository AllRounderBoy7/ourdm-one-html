-- ============================================
-- OurDM Complete Database Schema
-- Run this ENTIRE file in Supabase SQL Editor
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- DROP EXISTING TABLES (if re-running)
-- ============================================
DROP TABLE IF EXISTS typing_indicators CASCADE;
DROP TABLE IF EXISTS story_comments CASCADE;
DROP TABLE IF EXISTS story_views CASCADE;
DROP TABLE IF EXISTS stories CASCADE;
DROP TABLE IF EXISTS message_reads CASCADE;
DROP TABLE IF EXISTS message_reactions CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chat_participants CASCADE;
DROP TABLE IF EXISTS chat_settings CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS calls CASCADE;
DROP TABLE IF EXISTS blocked_users CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  verified BOOLEAN DEFAULT false,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 20),
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]+$')
);

-- ============================================
-- USER SETTINGS TABLE
-- ============================================
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'dark',
  last_seen_visibility TEXT DEFAULT 'everyone' CHECK (last_seen_visibility IN ('everyone', 'friends', 'nobody')),
  profile_photo_visibility TEXT DEFAULT 'everyone' CHECK (profile_photo_visibility IN ('everyone', 'friends', 'nobody')),
  read_receipts BOOLEAN DEFAULT true,
  typing_indicators BOOLEAN DEFAULT true,
  online_status BOOLEAN DEFAULT true,
  message_notifications BOOLEAN DEFAULT true,
  notification_sound TEXT DEFAULT 'default',
  vibration BOOLEAN DEFAULT true,
  group_notifications BOOLEAN DEFAULT true,
  notification_preview TEXT DEFAULT 'full' CHECK (notification_preview IN ('full', 'name', 'hidden')),
  call_ringtone TEXT DEFAULT 'default',
  auto_download_photos TEXT DEFAULT 'wifi' CHECK (auto_download_photos IN ('wifi', 'always', 'never')),
  auto_download_videos TEXT DEFAULT 'wifi' CHECK (auto_download_videos IN ('wifi', 'always', 'never')),
  low_data_mode BOOLEAN DEFAULT false,
  media_quality TEXT DEFAULT 'auto' CHECK (media_quality IN ('auto', 'high', 'medium', 'low')),
  font_size TEXT DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large', 'extra_large')),
  enter_to_send BOOLEAN DEFAULT true,
  time_format TEXT DEFAULT '12' CHECK (time_format IN ('12', '24')),
  language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- FRIENDSHIPS TABLE
-- ============================================
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  nickname TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- ============================================
-- BLOCKED USERS TABLE
-- ============================================
CREATE TABLE blocked_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, blocked_user_id),
  CHECK (user_id != blocked_user_id)
);

-- ============================================
-- CHATS TABLE
-- ============================================
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  is_group BOOLEAN DEFAULT false,
  avatar_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CHAT PARTICIPANTS TABLE
-- ============================================
CREATE TABLE chat_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Per-chat settings
  pinned BOOLEAN DEFAULT false,
  muted BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  hidden BOOLEAN DEFAULT false,
  wallpaper TEXT,
  theme TEXT,
  nickname TEXT,
  
  UNIQUE(chat_id, user_id)
);

-- ============================================
-- CHAT SETTINGS TABLE
-- ============================================
CREATE TABLE chat_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_pinned BOOLEAN DEFAULT false,
  is_muted BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_hidden BOOLEAN DEFAULT false,
  wallpaper_url TEXT,
  theme TEXT,
  
  UNIQUE(chat_id, user_id)
);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'file', 'location', 'contact', 'gif')),
  media_url TEXT,
  thumbnail_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  duration INTEGER,
  reply_to UUID REFERENCES messages(id) ON DELETE SET NULL,
  forwarded_from UUID REFERENCES messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  read_by UUID[] DEFAULT ARRAY[]::UUID[],
  reactions JSONB DEFAULT '[]'::JSONB,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- MESSAGE REACTIONS TABLE
-- ============================================
CREATE TABLE message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(message_id, user_id, emoji)
);

-- ============================================
-- MESSAGE READS TABLE
-- ============================================
CREATE TABLE message_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(message_id, user_id)
);

-- ============================================
-- STORIES TABLE
-- ============================================
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('image', 'video', 'text')),
  content_url TEXT,
  text_content TEXT,
  background_color TEXT,
  duration INTEGER DEFAULT 5,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

-- ============================================
-- STORY VIEWS TABLE
-- ============================================
CREATE TABLE story_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(story_id, user_id)
);

-- ============================================
-- STORY COMMENTS TABLE
-- ============================================
CREATE TABLE story_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CALLS TABLE
-- ============================================
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
  caller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  callee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'answered', 'ongoing', 'ended', 'missed', 'rejected')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration INTEGER,
  offer JSONB,
  answer JSONB,
  ice_candidates JSONB[]
);

-- ============================================
-- TYPING INDICATORS TABLE
-- ============================================
CREATE TABLE typing_indicators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(chat_id, user_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_is_online ON profiles(is_online);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

CREATE INDEX IF NOT EXISTS idx_blocked_users_user_id ON blocked_users(user_id);

CREATE INDEX IF NOT EXISTS idx_chats_last_message_at ON chats(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);

CREATE INDEX IF NOT EXISTS idx_calls_caller_id ON calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_receiver_id ON calls(receiver_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User settings policies
CREATE POLICY "Users can view own settings" ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Friendships policies
CREATE POLICY "Users can view their friendships" ON friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can create friendships" ON friendships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their friendships" ON friendships FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can delete their friendships" ON friendships FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Blocked users policies
CREATE POLICY "Users can view their blocks" ON blocked_users FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create blocks" ON blocked_users FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their blocks" ON blocked_users FOR DELETE USING (auth.uid() = user_id);

-- Chats policies
CREATE POLICY "Users can view their chats" ON chats FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_participants WHERE chat_participants.chat_id = chats.id AND chat_participants.user_id = auth.uid())
);
CREATE POLICY "Users can create chats" ON chats FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update their chats" ON chats FOR UPDATE USING (
  EXISTS (SELECT 1 FROM chat_participants WHERE chat_participants.chat_id = chats.id AND chat_participants.user_id = auth.uid())
);

-- Chat participants policies
CREATE POLICY "Users can view chat participants" ON chat_participants FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_participants cp WHERE cp.chat_id = chat_participants.chat_id AND cp.user_id = auth.uid())
);
CREATE POLICY "Users can insert chat participants" ON chat_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their participation" ON chat_participants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their participation" ON chat_participants FOR DELETE USING (auth.uid() = user_id);

-- Chat settings policies
CREATE POLICY "Users can view their chat settings" ON chat_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their chat settings" ON chat_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their chat settings" ON chat_settings FOR UPDATE USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view messages in their chats" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_participants WHERE chat_participants.chat_id = messages.chat_id AND chat_participants.user_id = auth.uid())
);
CREATE POLICY "Users can send messages to their chats" ON messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (SELECT 1 FROM chat_participants WHERE chat_participants.chat_id = messages.chat_id AND chat_participants.user_id = auth.uid())
);
CREATE POLICY "Users can update their messages" ON messages FOR UPDATE USING (auth.uid() = sender_id);
CREATE POLICY "Users can delete their messages" ON messages FOR DELETE USING (auth.uid() = sender_id);

-- Message reactions policies
CREATE POLICY "Users can view reactions" ON message_reactions FOR SELECT USING (true);
CREATE POLICY "Users can add reactions" ON message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their reactions" ON message_reactions FOR DELETE USING (auth.uid() = user_id);

-- Message reads policies
CREATE POLICY "Users can view reads" ON message_reads FOR SELECT USING (true);
CREATE POLICY "Users can mark as read" ON message_reads FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Stories policies
CREATE POLICY "Users can view friends stories" ON stories FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM friendships 
    WHERE ((friendships.user_id = auth.uid() AND friendships.friend_id = stories.user_id)
    OR (friendships.friend_id = auth.uid() AND friendships.user_id = stories.user_id))
    AND friendships.status = 'accepted'
  )
);
CREATE POLICY "Users can create stories" ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their stories" ON stories FOR DELETE USING (auth.uid() = user_id);

-- Story views policies
CREATE POLICY "Story owners can view views" ON story_views FOR SELECT USING (
  EXISTS (SELECT 1 FROM stories WHERE stories.id = story_views.story_id AND stories.user_id = auth.uid())
  OR auth.uid() = user_id
);
CREATE POLICY "Users can create story views" ON story_views FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Story comments policies
CREATE POLICY "Users can view story comments" ON story_comments FOR SELECT USING (true);
CREATE POLICY "Users can add comments" ON story_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their comments" ON story_comments FOR DELETE USING (auth.uid() = user_id);

-- Calls policies
CREATE POLICY "Users can view their calls" ON calls FOR SELECT USING (
  auth.uid() = caller_id OR auth.uid() = receiver_id OR auth.uid() = callee_id
);
CREATE POLICY "Users can create calls" ON calls FOR INSERT WITH CHECK (auth.uid() = caller_id);
CREATE POLICY "Users can update their calls" ON calls FOR UPDATE USING (
  auth.uid() = caller_id OR auth.uid() = receiver_id OR auth.uid() = callee_id
);

-- Typing indicators policies
CREATE POLICY "Users can view typing indicators" ON typing_indicators FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_participants WHERE chat_participants.chat_id = typing_indicators.chat_id AND chat_participants.user_id = auth.uid())
);
CREATE POLICY "Users can set typing" ON typing_indicators FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can clear typing" ON typing_indicators FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_friendships_updated_at BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment story views
CREATE OR REPLACE FUNCTION increment_story_views(story_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE stories SET view_count = view_count + 1 WHERE id = story_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_read(p_chat_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE messages 
  SET read_by = array_append(read_by, p_user_id)
  WHERE chat_id = p_chat_id 
    AND sender_id != p_user_id
    AND NOT (p_user_id = ANY(read_by));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete expired stories (run this periodically)
CREATE OR REPLACE FUNCTION delete_expired_stories()
RETURNS void AS $$
BEGIN
  DELETE FROM stories WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- REALTIME CONFIGURATION
-- ============================================
-- Enable realtime for these tables in Supabase Dashboard:
-- profiles, friendships, chats, chat_participants, messages,
-- message_reactions, stories, story_views, calls, typing_indicators

-- ============================================
-- STORAGE BUCKETS
-- ============================================
-- Create these buckets in Supabase Storage Dashboard:
-- 1. avatars (public, 5MB limit)
-- 2. chat-media (public, 100MB limit)
-- 3. stories (public, 50MB limit)
-- 4. chat-files (public, 100MB limit)
-- 5. wallpapers (public, 10MB limit)

-- ============================================
-- DONE! 🎉
-- ============================================
