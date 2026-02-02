import { create } from 'zustand';
import { Chat, Call } from '../lib/supabase';

interface AppState {
  currentChat: Chat | null;
  setCurrentChat: (chat: Chat | null) => void;
  
  activeCall: Call | null;
  setActiveCall: (call: Call | null) => void;
  
  incomingCall: Call | null;
  setIncomingCall: (call: Call | null) => void;
  
  theme: string;
  setTheme: (theme: string) => void;
  
  typingUsers: Record<string, string[]>;
  setTypingUser: (chatId: string, userId: string, isTyping: boolean) => void;
  
  unreadCounts: Record<string, number>;
  setUnreadCount: (chatId: string, count: number) => void;
  
  onlineUsers: Set<string>;
  setUserOnline: (userId: string, online: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  currentChat: null,
  setCurrentChat: (chat) => set({ currentChat: chat }),
  
  activeCall: null,
  setActiveCall: (call) => set({ activeCall: call }),
  
  incomingCall: null,
  setIncomingCall: (call) => set({ incomingCall: call }),
  
  theme: localStorage.getItem('theme') || 'dark',
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },
  
  typingUsers: {},
  setTypingUser: (chatId, userId, isTyping) => {
    set((state) => {
      const current = state.typingUsers[chatId] || [];
      const updated = isTyping
        ? [...current.filter(id => id !== userId), userId]
        : current.filter(id => id !== userId);
      
      return {
        typingUsers: {
          ...state.typingUsers,
          [chatId]: updated,
        },
      };
    });
  },
  
  unreadCounts: {},
  setUnreadCount: (chatId, count) => {
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [chatId]: count,
      },
    }));
  },
  
  onlineUsers: new Set(),
  setUserOnline: (userId, online) => {
    set((state) => {
      const newSet = new Set(state.onlineUsers);
      if (online) {
        newSet.add(userId);
      } else {
        newSet.delete(userId);
      }
      return { onlineUsers: newSet };
    });
  },
}));
