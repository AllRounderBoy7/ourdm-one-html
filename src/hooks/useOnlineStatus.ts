import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useOnlineStatus(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const setOnlineStatus = async (online: boolean) => {
      await supabase
        .from('profiles')
        .update({
          online: online,
          last_seen: new Date().toISOString(),
        })
        .eq('id', userId);
    };

    // Set online when component mounts
    setOnlineStatus(true);

    // Set offline when page is closed/hidden
    const handleVisibilityChange = () => {
      setOnlineStatus(!document.hidden);
    };

    const handleBeforeUnload = () => {
      setOnlineStatus(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      if (!document.hidden) {
        setOnlineStatus(true);
      }
    }, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(heartbeatInterval);
      setOnlineStatus(false);
    };
  }, [userId]);
}
