-- OurDM Supabase Database Schema
-- Run this in your Supabase SQL Editor to set up all tables

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  bio TEXT,
  verified BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  online BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Privacy settings
  last_seen_visibility TEXT DEFAULT 'everyone' CHECK (last_seen_visibility IN ('everyone', 'friends', 'nobody')),
  profile_photo_visibility TEXT DEFAULT 'everyone' CHECK (profile_photo_visibility IN ('everyone', 'friends', 'nobody')),
  bio_visibility TEXT DEFAULT 'everyone' CHECK (bio_visibility IN ('everyone', 'friends', 'nobody')),
  read_receipts BOOLEAN DEFAULT true,
  typing_indicators BOOLEAN DEFAULT true,
  online_status BOOLEAN DEFAULT true,
  
  -- Preferences
  theme TEXT DEFAULT 'dark',
  notification_sound TEXT DEFAULT 'default',
  chat_wallpaper TEXT,
  font_size TEXT DEFAULT 'medium',
  language TEXT DEFAULT 'english',
  
  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 20),
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]+$')
);

-- ============================================
-- FRIENDSHIPS TABLE (Friend System)
-- ============================================
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  nickname TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- ============================================
-- BLOCKED USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS blocked_users (
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
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
  name TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CHAT PARTICIPANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS chat_participants (
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
-- MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'photo', 'video', 'voice', 'file', 'location', 'contact', 'gif', 'poll', 'event', 'task')),
  content TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  duration INTEGER, -- for voice/video messages
  
  -- Message metadata
  reply_to UUID REFERENCES messages(id) ON DELETE SET NULL,
  forwarded_from UUID REFERENCES messages(id) ON DELETE SET NULL,
  edited BOOLEAN DEFAULT false,
  deleted BOOLEAN DEFAULT false,
  starred BOOLEAN DEFAULT false,
  pinned BOOLEAN DEFAULT false,
  
  -- Location data
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  
  -- Poll data (JSON)
  poll_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- MESSAGE REACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(message_id, user_id, emoji)
);

-- ============================================
-- MESSAGE RECEIPTS TABLE (Read/Delivery Status)
-- ============================================
CREATE TABLE IF NOT EXISTS message_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'read')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(message_id, user_id)
);

-- ============================================
-- STORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('photo', 'video', 'text')),
  content TEXT,
  media_url TEXT,
  background_gradient TEXT,
  duration INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

-- ============================================
-- STORY VIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS story_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(story_id, viewer_id)
);

-- ============================================
-- STORY COMMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS story_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CALLS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('audio', 'video')),
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'ongoing', 'ended', 'missed', 'rejected')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration INTEGER, -- in seconds
  
  -- WebRTC signaling data
  offer JSONB,
  answer JSONB,
  ice_candidates JSONB[]
);

-- ============================================
-- TYPING INDICATORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS typing_indicators (
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
CREATE INDEX IF NOT EXISTS idx_profiles_online ON profiles(online);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

CREATE INDEX IF NOT EXISTS idx_blocked_users_user_id ON blocked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_user_id ON blocked_users(blocked_user_id);

CREATE INDEX IF NOT EXISTS idx_chats_last_message_at ON chats(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_pinned ON chat_participants(pinned);
CREATE INDEX IF NOT EXISTS idx_chat_participants_archived ON chat_participants(archived);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_pinned ON messages(pinned);
CREATE INDEX IF NOT EXISTS idx_messages_starred ON messages(starred);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_receipts_message_id ON message_receipts(message_id);

CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);

CREATE INDEX IF NOT EXISTS idx_story_views_story_id ON story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_comments_story_id ON story_comments(story_id);

CREATE INDEX IF NOT EXISTS idx_calls_caller_id ON calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_receiver_id ON calls(receiver_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);

CREATE INDEX IF NOT EXISTS idx_typing_indicators_chat_id ON typing_indicators(chat_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Friendships policies
CREATE POLICY "Users can view their friendships" ON friendships FOR SELECT USING (
  auth.uid() = user_id OR auth.uid() = friend_id
);
CREATE POLICY "Users can create friendships" ON friendships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their friendships" ON friendships FOR UPDATE USING (
  auth.uid() = user_id OR auth.uid() = friend_id
);
CREATE POLICY "Users can delete their friendships" ON friendships FOR DELETE USING (
  auth.uid() = user_id OR auth.uid() = friend_id
);

-- Blocked users policies
CREATE POLICY "Users can view their blocks" ON blocked_users FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create blocks" ON blocked_users FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their blocks" ON blocked_users FOR DELETE USING (auth.uid() = user_id);

-- Chats policies
CREATE POLICY "Users can view their chats" ON chats FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM chat_participants 
    WHERE chat_participants.chat_id = chats.id 
    AND chat_participants.user_id = auth.uid()
  )
);
CREATE POLICY "Users can create chats" ON chats FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update their chats" ON chats FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM chat_participants 
    WHERE chat_participants.chat_id = chats.id 
    AND chat_participants.user_id = auth.uid()
  )
);

-- Chat participants policies
CREATE POLICY "Users can view chat participants" ON chat_participants FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM chat_participants cp
    WHERE cp.chat_id = chat_participants.chat_id 
    AND cp.user_id = auth.uid()
  )
);
CREATE POLICY "Users can insert chat participants" ON chat_participants FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_participants 
    WHERE chat_participants.chat_id = chat_participants.chat_id 
    AND chat_participants.user_id = auth.uid()
  )
);
CREATE POLICY "Users can update their participation" ON chat_participants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their participation" ON chat_participants FOR DELETE USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view messages in their chats" ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM chat_participants 
    WHERE chat_participants.chat_id = messages.chat_id 
    AND chat_participants.user_id = auth.uid()
  )
);
CREATE POLICY "Users can create messages in their chats" ON messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM chat_participants 
    WHERE chat_participants.chat_id = messages.chat_id 
    AND chat_participants.user_id = auth.uid()
  )
);
CREATE POLICY "Users can update their messages" ON messages FOR UPDATE USING (auth.uid() = sender_id);
CREATE POLICY "Users can delete their messages" ON messages FOR DELETE USING (auth.uid() = sender_id);

-- Message reactions policies
CREATE POLICY "Users can view reactions" ON message_reactions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN chat_participants cp ON cp.chat_id = m.chat_id
    WHERE m.id = message_reactions.message_id AND cp.user_id = auth.uid()
  )
);
CREATE POLICY "Users can create reactions" ON message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their reactions" ON message_reactions FOR DELETE USING (auth.uid() = user_id);

-- Message receipts policies
CREATE POLICY "Users can view receipts" ON message_receipts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN chat_participants cp ON cp.chat_id = m.chat_id
    WHERE m.id = message_receipts.message_id AND cp.user_id = auth.uid()
  )
);
CREATE POLICY "Users can create receipts" ON message_receipts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update receipts" ON message_receipts FOR UPDATE USING (auth.uid() = user_id);

-- Stories policies
CREATE POLICY "Users can view friends' stories" ON stories FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM friendships 
    WHERE (friendships.user_id = auth.uid() AND friendships.friend_id = stories.user_id)
    OR (friendships.friend_id = auth.uid() AND friendships.user_id = stories.user_id)
    AND friendships.status = 'accepted'
  )
);
CREATE POLICY "Users can create stories" ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their stories" ON stories FOR DELETE USING (auth.uid() = user_id);

-- Story views policies
CREATE POLICY "Users can view story views" ON story_views FOR SELECT USING (
  EXISTS (SELECT 1 FROM stories WHERE stories.id = story_views.story_id AND stories.user_id = auth.uid())
);
CREATE POLICY "Users can create story views" ON story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- Story comments policies
CREATE POLICY "Users can view story comments" ON story_comments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM stories 
    WHERE stories.id = story_comments.story_id 
    AND (stories.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM friendships 
      WHERE (friendships.user_id = auth.uid() AND friendships.friend_id = stories.user_id)
      OR (friendships.friend_id = auth.uid() AND friendships.user_id = stories.user_id)
      AND friendships.status = 'accepted'
    ))
  )
);
CREATE POLICY "Users can create story comments" ON story_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their comments" ON story_comments FOR DELETE USING (auth.uid() = user_id);

-- Calls policies
CREATE POLICY "Users can view their calls" ON calls FOR SELECT USING (
  auth.uid() = caller_id OR auth.uid() = receiver_id
);
CREATE POLICY "Users can create calls" ON calls FOR INSERT WITH CHECK (auth.uid() = caller_id);
CREATE POLICY "Users can update their calls" ON calls FOR UPDATE USING (
  auth.uid() = caller_id OR auth.uid() = receiver_id
);

-- Typing indicators policies
CREATE POLICY "Users can view typing indicators" ON typing_indicators FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM chat_participants 
    WHERE chat_participants.chat_id = typing_indicators.chat_id 
    AND chat_participants.user_id = auth.uid()
  )
);
CREATE POLICY "Users can create typing indicators" ON typing_indicators FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their typing indicators" ON typing_indicators FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
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

CREATE TRIGGER update_friendships_updated_at BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update chat's last_message_at
CREATE OR REPLACE FUNCTION update_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chats SET last_message_at = NEW.created_at WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_last_message_trigger AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_chat_last_message();

-- Function to delete expired stories (run this periodically)
CREATE OR REPLACE FUNCTION delete_expired_stories()
RETURNS void AS $$
BEGIN
  DELETE FROM stories WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to clean old typing indicators (run this periodically)
CREATE OR REPLACE FUNCTION clean_typing_indicators()
RETURNS void AS $$
BEGIN
  DELETE FROM typing_indicators WHERE created_at < NOW() - INTERVAL '10 seconds';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STORAGE BUCKETS (Run in Supabase Dashboard > Storage)
-- ============================================
-- You need to create these buckets manually in Supabase Dashboard:
-- 1. 'avatars' - for profile pictures
-- 2. 'chat-media' - for chat photos/videos
-- 3. 'stories' - for story media
-- 4. 'chat-files' - for file attachments
-- 5. 'wallpapers' - for custom wallpapers

-- Storage policies (apply after creating buckets):
-- For 'avatars':
--   - SELECT: public
--   - INSERT: authenticated users (own folder)
--   - UPDATE: authenticated users (own files)
--   - DELETE: authenticated users (own files)

-- For 'chat-media', 'stories', 'chat-files':
--   - SELECT: authenticated users
--   - INSERT: authenticated users
--   - UPDATE: authenticated users (own files)
--   - DELETE: authenticated users (own files)

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================
-- Enable realtime for tables (Run in Supabase Dashboard > Database > Replication)
-- Enable for these tables:
-- - profiles
-- - friendships
-- - chats
-- - chat_participants
-- - messages
-- - message_reactions
-- - message_receipts
-- - stories
-- - story_views
-- - calls
-- - typing_indicators
