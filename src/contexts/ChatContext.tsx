import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'gif' | 'location';
  media_url?: string;
  reply_to?: string;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  read_by: string[];
  reactions: Array<{ user_id: string; emoji: string }>;
  sender?: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
  };
}

export interface Chat {
  id: string;
  name?: string;
  is_group: boolean;
  created_by: string;
  created_at: string;
  last_message?: Message;
  participants: Array<{
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
    is_online: boolean;
  }>;
  unread_count: number;
  is_muted: boolean;
  is_pinned: boolean;
  is_archived: boolean;
}

interface ChatContextType {
  // State
  chats: Chat[];
  currentChat: Chat | null;
  messages: Message[];
  loading: boolean;
  sending: boolean;
  
  // Actions
  fetchChats: () => Promise<void>;
  fetchMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, content: string, type?: string, mediaUrl?: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string, forEveryone?: boolean) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string) => Promise<void>;
  markAsRead: (chatId: string) => Promise<void>;
  createChat: (participantIds: string[], isGroup?: boolean, name?: string) => Promise<string | null>;
  setTyping: (chatId: string, isTyping: boolean) => void;
  pinChat: (chatId: string, isPinned: boolean) => Promise<void>;
  muteChat: (chatId: string, isMuted: boolean) => Promise<void>;
  archiveChat: (chatId: string, isArchived: boolean) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Fetch all chats
  const fetchChats = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get chats where user is participant
      const { data: participations } = await supabase
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', user.id);

      if (!participations?.length) {
        setChats([]);
        setLoading(false);
        return;
      }

      const chatIds = participations.map(p => p.chat_id);

      const { data: chatsData } = await supabase
        .from('chats')
        .select('*')
        .in('id', chatIds)
        .order('updated_at', { ascending: false });

      if (chatsData) {
        // Fetch participants for each chat
        const chatsWithParticipants = await Promise.all(
          chatsData.map(async (chat) => {
            const { data: participants } = await supabase
              .from('chat_participants')
              .select(`
                user_id,
                profiles:user_id(id, username, full_name, avatar_url, is_online)
              `)
              .eq('chat_id', chat.id);

            const { data: lastMessage } = await supabase
              .from('messages')
              .select('*')
              .eq('chat_id', chat.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            // Count unread messages
            const { count: unreadCount } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('chat_id', chat.id)
              .not('read_by', 'cs', `{${user.id}}`);

            return {
              ...chat,
              participants: participants?.map((p: any) => p.profiles).filter(Boolean) || [],
              last_message: lastMessage || undefined,
              unread_count: unreadCount || 0,
            };
          })
        );

        setChats(chatsWithParticipants);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch messages for a chat
  const fetchMessages = useCallback(async (chatId: string) => {
    if (!user) return;
    setLoading(true);

    try {
      const { data } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!sender_id(id, username, full_name, avatar_url)
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (data) {
        setMessages(data);
      }

      // Mark messages as read
      await markAsRead(chatId);

      // Find and set current chat
      const chat = chats.find(c => c.id === chatId);
      if (chat) {
        setCurrentChat(chat);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [user, chats]);

  // Send a message
  const sendMessage = async (
    chatId: string,
    content: string,
    type: string = 'text',
    mediaUrl?: string
  ) => {
    if (!user) return;
    setSending(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          content,
          message_type: type,
          media_url: mediaUrl,
          read_by: [user.id],
        })
        .select(`
          *,
          sender:profiles!sender_id(id, username, full_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      if (data) {
        setMessages(prev => [...prev, data]);
        
        // Update chat's last message
        await supabase
          .from('chats')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', chatId);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  // Edit message
  const editMessage = async (messageId: string, content: string) => {
    if (!user) return;

    try {
      const message = messages.find(m => m.id === messageId);
      if (!message) return;

      // Check if message is within 15 minutes
      const messageTime = new Date(message.created_at).getTime();
      const now = Date.now();
      const fifteenMinutes = 15 * 60 * 1000;

      if (now - messageTime > fifteenMinutes) {
        console.error('Cannot edit messages older than 15 minutes');
        return;
      }

      if (message.sender_id !== user.id) {
        console.error('Cannot edit others messages');
        return;
      }

      await supabase
        .from('messages')
        .update({ content, is_edited: true })
        .eq('id', messageId);

      setMessages(prev =>
        prev.map(m =>
          m.id === messageId ? { ...m, content, is_edited: true } : m
        )
      );
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  // Delete message
  const deleteMessage = async (messageId: string, forEveryone: boolean = false) => {
    if (!user) return;

    try {
      const message = messages.find(m => m.id === messageId);
      if (!message) return;

      if (forEveryone) {
        if (message.sender_id !== user.id) {
          console.error('Cannot delete others messages for everyone');
          return;
        }
        
        await supabase
          .from('messages')
          .update({ is_deleted: true, content: 'This message was deleted' })
          .eq('id', messageId);

        setMessages(prev =>
          prev.map(m =>
            m.id === messageId ? { ...m, is_deleted: true, content: 'This message was deleted' } : m
          )
        );
      } else {
        // Delete for me only - just remove from local state
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  // Add reaction to message
  const addReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    try {
      const { data: message } = await supabase
        .from('messages')
        .select('reactions')
        .eq('id', messageId)
        .single();

      if (message) {
        const reactions = message.reactions || [];
        const existingIndex = reactions.findIndex((r: any) => r.user_id === user.id);
        
        if (existingIndex >= 0) {
          reactions[existingIndex] = { user_id: user.id, emoji };
        } else {
          reactions.push({ user_id: user.id, emoji });
        }

        await supabase
          .from('messages')
          .update({ reactions })
          .eq('id', messageId);

        setMessages(prev =>
          prev.map(m =>
            m.id === messageId ? { ...m, reactions } : m
          )
        );
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  // Remove reaction
  const removeReaction = async (messageId: string) => {
    if (!user) return;

    try {
      const { data: message } = await supabase
        .from('messages')
        .select('reactions')
        .eq('id', messageId)
        .single();

      if (message) {
        const reactions = (message.reactions || []).filter(
          (r: any) => r.user_id !== user.id
        );

        await supabase
          .from('messages')
          .update({ reactions })
          .eq('id', messageId);

        setMessages(prev =>
          prev.map(m =>
            m.id === messageId ? { ...m, reactions } : m
          )
        );
      }
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  };

  // Mark messages as read
  const markAsRead = async (chatId: string) => {
    if (!user) return;

    try {
      const unreadMessages = messages.filter(
        m => m.chat_id === chatId && !m.read_by.includes(user.id)
      );

      for (const msg of unreadMessages) {
        await supabase
          .from('messages')
          .update({ read_by: [...msg.read_by, user.id] })
          .eq('id', msg.id);
      }

      setMessages(prev =>
        prev.map(m =>
          m.chat_id === chatId && !m.read_by.includes(user.id)
            ? { ...m, read_by: [...m.read_by, user.id] }
            : m
        )
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  // Create new chat
  const createChat = async (
    participantIds: string[],
    isGroup: boolean = false,
    name?: string
  ): Promise<string | null> => {
    if (!user) return null;

    try {
      // Check if 1-on-1 chat already exists
      if (!isGroup && participantIds.length === 1) {
        const existingChat = chats.find(c => {
          if (c.is_group) return false;
          const participantUserIds = c.participants.map(p => p.id);
          return participantUserIds.includes(participantIds[0]) && 
                 participantUserIds.includes(user.id) &&
                 c.participants.length === 2;
        });

        if (existingChat) return existingChat.id;
      }

      // Create new chat
      const { data: chat, error } = await supabase
        .from('chats')
        .insert({
          name: name || null,
          is_group: isGroup,
          created_by: user.id,
        })
        .select()
        .single();

      if (error || !chat) throw error;

      // Add all participants
      const allParticipants = [user.id, ...participantIds];
      await supabase.from('chat_participants').insert(
        allParticipants.map(userId => ({
          chat_id: chat.id,
          user_id: userId,
        }))
      );

      await fetchChats();
      return chat.id;
    } catch (error) {
      console.error('Error creating chat:', error);
      return null;
    }
  };

  // Set typing indicator
  const setTyping = (chatId: string, isTyping: boolean) => {
    if (!user) return;

    supabase.channel(`typing:${chatId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: user.id,
        is_typing: isTyping,
      },
    });
  };

  // Pin/unpin chat
  const pinChat = async (chatId: string, isPinned: boolean) => {
    try {
      await supabase
        .from('chat_participants')
        .update({ is_pinned: isPinned })
        .eq('chat_id', chatId)
        .eq('user_id', user?.id);

      setChats(prev =>
        prev.map(c => (c.id === chatId ? { ...c, is_pinned: isPinned } : c))
      );
    } catch (error) {
      console.error('Error pinning chat:', error);
    }
  };

  // Mute/unmute chat
  const muteChat = async (chatId: string, isMuted: boolean) => {
    try {
      await supabase
        .from('chat_participants')
        .update({ is_muted: isMuted })
        .eq('chat_id', chatId)
        .eq('user_id', user?.id);

      setChats(prev =>
        prev.map(c => (c.id === chatId ? { ...c, is_muted: isMuted } : c))
      );
    } catch (error) {
      console.error('Error muting chat:', error);
    }
  };

  // Archive/unarchive chat
  const archiveChat = async (chatId: string, isArchived: boolean) => {
    try {
      await supabase
        .from('chat_participants')
        .update({ is_archived: isArchived })
        .eq('chat_id', chatId)
        .eq('user_id', user?.id);

      setChats(prev =>
        prev.map(c => (c.id === chatId ? { ...c, is_archived: isArchived } : c))
      );
    } catch (error) {
      console.error('Error archiving chat:', error);
    }
  };

  // Delete chat
  const deleteChat = async (chatId: string) => {
    try {
      await supabase
        .from('chat_participants')
        .delete()
        .eq('chat_id', chatId)
        .eq('user_id', user?.id);

      setChats(prev => prev.filter(c => c.id !== chatId));
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  // Subscribe to real-time messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // Fetch sender info
          const { data: sender } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .eq('id', newMessage.sender_id)
            .single();

          const messageWithSender = { ...newMessage, sender };

          setMessages(prev => {
            if (prev.find(m => m.id === newMessage.id)) return prev;
            return [...prev, messageWithSender];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Fetch chats on mount
  useEffect(() => {
    if (user) {
      fetchChats();
    }
  }, [user, fetchChats]);

  return (
    <ChatContext.Provider
      value={{
        chats,
        currentChat,
        messages,
        loading,
        sending,
        fetchChats,
        fetchMessages,
        sendMessage,
        editMessage,
        deleteMessage,
        addReaction,
        removeReaction,
        markAsRead,
        createChat,
        setTyping,
        pinChat,
        muteChat,
        archiveChat,
        deleteChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
