import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface SubscriptionConfig {
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  callback: (payload: any) => void;
}

export function useRealtimeSubscription(config: SubscriptionConfig | SubscriptionConfig[]) {
  useEffect(() => {
    const configs = Array.isArray(config) ? config : [config];
    const channels: RealtimeChannel[] = [];

    configs.forEach((cfg, index) => {
      const channel = supabase.channel(`realtime:${cfg.table}:${index}`);

      channel.on(
        'postgres_changes',
        {
          event: cfg.event,
          schema: 'public',
          table: cfg.table,
          ...(cfg.filter ? { filter: cfg.filter } : {}),
        },
        cfg.callback
      );

      channel.subscribe();
      channels.push(channel);
    });

    return () => {
      channels.forEach(channel => channel.unsubscribe());
    };
  }, []);
}
