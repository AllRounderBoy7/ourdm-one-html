import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useTypingIndicator(chatId: string, userId: string) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sendTyping = (isTyping: boolean) => {
    if (!chatId || !userId) return;

    // Broadcast typing status
    supabase.channel(`typing:${chatId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, isTyping },
    });

    // Auto-stop typing after 3 seconds
    if (isTyping) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        sendTyping(false);
      }, 3000);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      sendTyping(false);
    };
  }, [chatId]);

  return { sendTyping };
}
