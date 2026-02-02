import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Phone, Video, MoreVertical, Send, Paperclip,
  Image, Mic, Smile, X, Check, CheckCheck, Reply,
  Trash2, Copy, Star, Download, Camera, MapPin, File
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location';
  media_url?: string;
  reply_to?: string;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  read_by: string[];
  reactions: { user_id: string; emoji: string }[];
  sender?: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
  };
}

interface ChatInfo {
  id: string;
  name: string;
  is_group: boolean;
  avatar_url?: string;
  participants: {
    user_id: string;
    profile: {
      id: string;
      username: string;
      full_name: string;
      avatar_url: string;
      is_online: boolean;
      last_seen: string;
    };
  }[];
}

const EMOJI_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍', '👎', '🎉', '🔥', '👏', '🙏', '😍', '🤔', '😊', '👌', '💯', '✨', '🙌', '💪', '😎'];

export default function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load chat info
  useEffect(() => {
    if (!chatId || !user) return;

    const loadChatInfo = async () => {
      try {
        const { data: chat, error } = await supabase
          .from('chats')
          .select(`
            id,
            name,
            is_group,
            avatar_url,
            chat_participants (
              user_id,
              profile:profiles (
                id,
                username,
                full_name,
                avatar_url,
                is_online,
                last_seen
              )
            )
          `)
          .eq('id', chatId)
          .single();

        if (error) throw error;
        
        // Transform the data
        const chatData: ChatInfo = {
          id: chat.id,
          name: chat.name,
          is_group: chat.is_group,
          avatar_url: chat.avatar_url,
          participants: chat.chat_participants.map((p: any) => ({
            user_id: p.user_id,
            profile: p.profile
          }))
        };
        
        setChatInfo(chatData);
      } catch (error) {
        console.error('Error loading chat:', error);
        toast.error('Chat load nahi ho paya');
      }
    };

    loadChatInfo();
  }, [chatId, user]);

  // Load messages
  useEffect(() => {
    if (!chatId || !user) return;

    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select(`
            *,
            sender:profiles!sender_id (
              id,
              username,
              full_name,
              avatar_url
            )
          `)
          .eq('chat_id', chatId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
        
        // Mark messages as read
        await markMessagesAsRead();
      } catch (error) {
        console.error('Error loading messages:', error);
        toast.error('Messages load nahi hue');
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [chatId, user]);

  // Real-time message subscription
  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`messages:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        async (payload) => {
          // Fetch sender info
          const { data: sender } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .eq('id', payload.new.sender_id)
            .single();

          const newMsg: Message = {
            ...payload.new as Message,
            sender: sender || undefined
          };
          
          setMessages(prev => [...prev, newMsg]);
          scrollToBottom();
          
          // Mark as read if not from me
          if (payload.new.sender_id !== user?.id) {
            markMessagesAsRead();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        (payload) => {
          setMessages(prev => prev.map(msg => 
            msg.id === payload.new.id ? { ...msg, ...payload.new } : msg
          ));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        (payload) => {
          setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, user, scrollToBottom]);

  // Typing indicator subscription
  useEffect(() => {
    if (!chatId || !user) return;

    const channel = supabase
      .channel(`typing:${chatId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.user_id !== user.id) {
          setOtherUserTyping(true);
          setTimeout(() => setOtherUserTyping(false), 3000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, user]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Mark messages as read
  const markMessagesAsRead = async () => {
    if (!chatId || !user) return;
    
    try {
      await supabase.rpc('mark_messages_read', {
        p_chat_id: chatId,
        p_user_id: user.id
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Send typing indicator
  const sendTypingIndicator = useCallback(() => {
    if (!chatId || !user) return;

    supabase.channel(`typing:${chatId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: user.id }
    });
  }, [chatId, user]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      sendTypingIndicator();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 2000);
  };

  // Send message
  const sendMessage = async (
    content: string,
    type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' = 'text',
    mediaUrl?: string
  ) => {
    if (!chatId || !user || (!content.trim() && !mediaUrl)) return;

    setIsSending(true);
    try {
      const messageData = {
        chat_id: chatId,
        sender_id: user.id,
        content: content.trim(),
        message_type: type,
        media_url: mediaUrl || null,
        reply_to: replyingTo?.id || null,
        is_edited: false,
        is_deleted: false,
        read_by: [user.id],
        reactions: []
      };

      const { error } = await supabase
        .from('messages')
        .insert(messageData);

      if (error) throw error;

      setNewMessage('');
      setReplyingTo(null);
      
      // Update chat's last message
      await supabase
        .from('chats')
        .update({ 
          last_message: content.trim(),
          last_message_at: new Date().toISOString()
        })
        .eq('id', chatId);

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Message nahi gaya');
    } finally {
      setIsSending(false);
    }
  };

  // Handle send button click
  const handleSend = () => {
    if (newMessage.trim()) {
      sendMessage(newMessage, 'text');
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Upload media
  const uploadMedia = async (file: File, type: 'image' | 'video' | 'audio' | 'file') => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
      const bucket = type === 'audio' ? 'chat-media' : 'chat-media';

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      await sendMessage(file.name, type, publicUrl);
      toast.success('File sent!');
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Upload failed');
    }
  };

  // Handle image select
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      uploadMedia(file, type);
    }
    setShowAttachMenu(false);
  };

  // Handle file select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMedia(file, 'file');
    }
    setShowAttachMenu(false);
  };

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Create file from blob and upload
        const file = new window.File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        await uploadMedia(file, 'audio');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Start timer
      const startTime = Date.now();
      const interval = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      
      mediaRecorder.addEventListener('stop', () => clearInterval(interval));
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Microphone access denied');
    }
  };

  // Stop voice recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  // Cancel recording
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      audioChunksRef.current = [];
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  // Send location
  const sendLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const locationUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
          await sendMessage(`📍 Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, 'location', locationUrl);
          setShowAttachMenu(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Location access denied');
        }
      );
    }
  };

  // Add reaction
  const addReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    
    try {
      const message = messages.find(m => m.id === messageId);
      if (!message) return;

      const existingReactions = message.reactions || [];
      const myReactionIndex = existingReactions.findIndex(r => r.user_id === user.id);
      
      let newReactions;
      if (myReactionIndex >= 0) {
        if (existingReactions[myReactionIndex].emoji === emoji) {
          // Remove reaction
          newReactions = existingReactions.filter((_, i) => i !== myReactionIndex);
        } else {
          // Change reaction
          newReactions = [...existingReactions];
          newReactions[myReactionIndex] = { user_id: user.id, emoji };
        }
      } else {
        // Add reaction
        newReactions = [...existingReactions, { user_id: user.id, emoji }];
      }

      await supabase
        .from('messages')
        .update({ reactions: newReactions })
        .eq('id', messageId);

      setSelectedMessage(null);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  // Delete message
  const deleteMessage = async (messageId: string, forEveryone: boolean = false) => {
    try {
      if (forEveryone) {
        await supabase
          .from('messages')
          .update({ is_deleted: true, content: 'This message was deleted' })
          .eq('id', messageId);
      } else {
        // Just hide for me (would need a separate table for this)
        await supabase
          .from('messages')
          .delete()
          .eq('id', messageId);
      }
      toast.success('Message deleted');
      setSelectedMessage(null);
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Could not delete message');
    }
  };

  // Copy message
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied!');
    setSelectedMessage(null);
  };

  // Format time
  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Format recording time
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get other user (for 1-on-1 chat)
  const otherUser = chatInfo?.participants.find(p => p.user_id !== user?.id)?.profile;
  const chatName = chatInfo?.is_group ? chatInfo.name : otherUser?.full_name || otherUser?.username;
  const chatAvatar = chatInfo?.is_group ? chatInfo.avatar_url : otherUser?.avatar_url;
  const isOnline = !chatInfo?.is_group && otherUser?.is_online;

  if (isLoading) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800/90 backdrop-blur-lg px-4 py-3 flex items-center gap-3 border-b border-gray-700/50">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        
        <div className="relative">
          {chatAvatar ? (
            <img src={chatAvatar} alt={chatName} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
              {chatName?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          {isOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-semibold truncate">{chatName}</h2>
          <p className="text-xs text-gray-400">
            {otherUserTyping ? (
              <span className="text-purple-400">typing...</span>
            ) : isOnline ? (
              <span className="text-green-400">Online</span>
            ) : (
              'Tap for info'
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={() => navigate(`/call/${chatId}?type=audio`)}
            className="p-2 hover:bg-gray-700 rounded-full transition-colors"
          >
            <Phone className="w-5 h-5 text-white" />
          </button>
          <button 
            onClick={() => navigate(`/call/${chatId}?type=video`)}
            className="p-2 hover:bg-gray-700 rounded-full transition-colors"
          >
            <Video className="w-5 h-5 text-white" />
          </button>
          <button className="p-2 hover:bg-gray-700 rounded-full transition-colors">
            <MoreVertical className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mb-4">
              <Send className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isMe = message.sender_id === user?.id;
            const showAvatar = !isMe && (index === 0 || messages[index - 1]?.sender_id !== message.sender_id);
            
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}
              >
                {!isMe && showAvatar && (
                  <img
                    src={message.sender?.avatar_url || `https://ui-avatars.com/api/?name=${message.sender?.username}`}
                    alt=""
                    className="w-8 h-8 rounded-full mr-2 self-end"
                  />
                )}
                {!isMe && !showAvatar && <div className="w-8 mr-2" />}
                
                <div
                  className={`max-w-[75%] relative ${isMe ? 'order-1' : 'order-2'}`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setSelectedMessage(message);
                  }}
                  onClick={() => setSelectedMessage(selectedMessage?.id === message.id ? null : message)}
                >
                  {/* Reply indicator */}
                  {message.reply_to && (
                    <div className={`text-xs px-3 py-1 rounded-t-lg ${isMe ? 'bg-purple-700/50' : 'bg-gray-700/50'} border-l-2 border-purple-500`}>
                      <span className="text-purple-400">↩ Reply</span>
                    </div>
                  )}
                  
                  {/* Message bubble */}
                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      isMe
                        ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-br-md'
                        : 'bg-gray-800 text-white rounded-bl-md'
                    }`}
                  >
                    {message.message_type === 'image' && message.media_url && (
                      <img 
                        src={message.media_url} 
                        alt="Image" 
                        className="rounded-lg max-w-full mb-2 cursor-pointer"
                        onClick={() => window.open(message.media_url, '_blank')}
                      />
                    )}
                    
                    {message.message_type === 'video' && message.media_url && (
                      <video 
                        src={message.media_url} 
                        controls 
                        className="rounded-lg max-w-full mb-2"
                      />
                    )}
                    
                    {message.message_type === 'audio' && message.media_url && (
                      <audio src={message.media_url} controls className="max-w-full" />
                    )}
                    
                    {message.message_type === 'file' && message.media_url && (
                      <a 
                        href={message.media_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-purple-300 hover:underline"
                      >
                        <File className="w-5 h-5" />
                        {message.content}
                      </a>
                    )}
                    
                    {message.message_type === 'location' && message.media_url && (
                      <a 
                        href={message.media_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-purple-300 hover:underline"
                      >
                        <MapPin className="w-5 h-5" />
                        {message.content}
                      </a>
                    )}
                    
                    {(message.message_type === 'text' || !message.media_url) && (
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    )}
                    
                    <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[10px] opacity-70">{formatTime(message.created_at)}</span>
                      {message.is_edited && <span className="text-[10px] opacity-50">edited</span>}
                      {isMe && (
                        <span className="ml-1">
                          {message.read_by?.length > 1 ? (
                            <CheckCheck className="w-3 h-3 text-blue-400" />
                          ) : (
                            <Check className="w-3 h-3 opacity-70" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Reactions */}
                  {message.reactions && message.reactions.length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {message.reactions.map((reaction, i) => (
                        <span key={i} className="text-sm bg-gray-800 rounded-full px-2 py-0.5">
                          {reaction.emoji}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply indicator */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-gray-800 border-t border-gray-700 px-4 py-2 flex items-center gap-3"
          >
            <div className="w-1 h-10 bg-purple-500 rounded-full" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-purple-400">Replying to {replyingTo.sender?.full_name}</p>
              <p className="text-sm text-gray-300 truncate">{replyingTo.content}</p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-gray-700 rounded-full">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="bg-gray-800/90 backdrop-blur-lg px-3 py-3 border-t border-gray-700/50">
        {isRecording ? (
          <div className="flex items-center gap-3">
            <button onClick={cancelRecording} className="p-2 bg-red-500/20 rounded-full">
              <X className="w-5 h-5 text-red-500" />
            </button>
            <div className="flex-1 flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-white font-mono">{formatRecordingTime(recordingTime)}</span>
              <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 animate-pulse" style={{ width: '100%' }} />
              </div>
            </div>
            <button onClick={stopRecording} className="p-3 bg-purple-600 rounded-full">
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            >
              <Smile className="w-5 h-5 text-gray-400" />
            </button>
            
            <button
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            >
              <Paperclip className="w-5 h-5 text-gray-400" />
            </button>
            
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            
            {newMessage.trim() ? (
              <button
                onClick={handleSend}
                disabled={isSending}
                className="p-3 bg-purple-600 rounded-full hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            ) : (
              <button
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={cancelRecording}
                className="p-3 bg-purple-600 rounded-full hover:bg-purple-700 transition-colors"
              >
                <Mic className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Emoji picker */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="bg-gray-800 border-t border-gray-700 overflow-hidden"
          >
            <div className="p-4 grid grid-cols-8 gap-2 max-h-48 overflow-y-auto">
              {['😀', '😂', '😍', '🥰', '😊', '😎', '🤔', '😴', '😭', '😡', '🥺', '😱', '🤗', '🤣', '😇', '🙄', '👍', '👎', '❤️', '💔', '🔥', '✨', '🎉', '💯', '👏', '🙏', '💪', '👌', '✌️', '🤝', '👋', '🎁'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    setNewMessage(prev => prev + emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="text-2xl p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attach menu */}
      <AnimatePresence>
        {showAttachMenu && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-20 left-4 right-4 bg-gray-800 rounded-2xl p-4 shadow-xl border border-gray-700"
          >
            <div className="grid grid-cols-4 gap-4">
              <button
                onClick={() => imageInputRef.current?.click()}
                className="flex flex-col items-center gap-2 p-3 hover:bg-gray-700 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center">
                  <Image className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-gray-400">Photo</span>
              </button>
              
              <button
                onClick={() => imageInputRef.current?.click()}
                className="flex flex-col items-center gap-2 p-3 hover:bg-gray-700 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-pink-600 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-gray-400">Camera</span>
              </button>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 p-3 hover:bg-gray-700 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                  <File className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-gray-400">File</span>
              </button>
              
              <button
                onClick={sendLocation}
                className="flex flex-col items-center gap-2 p-3 hover:bg-gray-700 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-gray-400">Location</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message options modal */}
      <AnimatePresence>
        {selectedMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={() => setSelectedMessage(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800 w-full max-w-md rounded-t-3xl p-4"
            >
              {/* Emoji reactions */}
              <div className="flex justify-center gap-2 mb-4 overflow-x-auto pb-2">
                {EMOJI_REACTIONS.slice(0, 8).map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => addReaction(selectedMessage.id, emoji)}
                    className="text-2xl p-2 hover:bg-gray-700 rounded-full transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setReplyingTo(selectedMessage);
                    setSelectedMessage(null);
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-700 rounded-xl transition-colors"
                >
                  <Reply className="w-5 h-5 text-gray-400" />
                  <span className="text-white">Reply</span>
                </button>
                
                <button
                  onClick={() => copyMessage(selectedMessage.content)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-700 rounded-xl transition-colors"
                >
                  <Copy className="w-5 h-5 text-gray-400" />
                  <span className="text-white">Copy</span>
                </button>
                
                <button
                  onClick={() => {
                    toast.success('Message starred!');
                    setSelectedMessage(null);
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-700 rounded-xl transition-colors"
                >
                  <Star className="w-5 h-5 text-gray-400" />
                  <span className="text-white">Star</span>
                </button>
                
                {selectedMessage.media_url && (
                  <a
                    href={selectedMessage.media_url}
                    download
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    <Download className="w-5 h-5 text-gray-400" />
                    <span className="text-white">Download</span>
                  </a>
                )}
                
                {selectedMessage.sender_id === user?.id && (
                  <button
                    onClick={() => deleteMessage(selectedMessage.id, true)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-red-900/30 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-5 h-5 text-red-500" />
                    <span className="text-red-500">Delete for everyone</span>
                  </button>
                )}
                
                <button
                  onClick={() => deleteMessage(selectedMessage.id, false)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-red-900/30 rounded-xl transition-colors"
                >
                  <Trash2 className="w-5 h-5 text-red-400" />
                  <span className="text-red-400">Delete for me</span>
                </button>
              </div>
              
              <button
                onClick={() => setSelectedMessage(null)}
                className="w-full mt-4 p-3 bg-gray-700 rounded-xl text-white font-medium"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageSelect}
        accept="image/*,video/*"
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="*/*"
        className="hidden"
      />
    </div>
  );
}
