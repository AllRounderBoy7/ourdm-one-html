import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';

interface Call {
  id: string;
  caller_id: string;
  receiver_id: string;
  type: 'audio' | 'video';
  status: 'completed' | 'missed' | 'rejected' | 'ongoing';
  duration: number | null;
  created_at: string;
  ended_at: string | null;
  caller: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
  };
  receiver: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export default function CallsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useStore((state) => state.theme);
  const [calls, setCalls] = useState<Call[]>([]);
  const [filter, setFilter] = useState<'all' | 'missed' | 'incoming' | 'outgoing'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCalls();
  }, [user]);

  const loadCalls = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('calls')
        .select(`
          *,
          caller:profiles!calls_caller_id_fkey(*),
          receiver:profiles!calls_receiver_id_fkey(*)
        `)
        .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setCalls(data || []);
    } catch (error) {
      console.error('Error loading calls:', error);
      toast.error('Failed to load calls');
    } finally {
      setLoading(false);
    }
  };

  const startCall = async (otherUserId: string, type: 'audio' | 'video') => {
    if (!user) return;

    try {
      const { data: call, error } = await supabase
        .from('calls')
        .insert({
          caller_id: user.id,
          receiver_id: otherUserId,
          type,
          status: 'ongoing'
        })
        .select()
        .single();

      if (error) throw error;

      // Navigate to call page
      if (type === 'video') {
        navigate(`/video-call/${call.id}`);
      } else {
        navigate(`/audio-call/${call.id}`);
      }

      toast.success('Starting call...');
    } catch (error) {
      console.error('Error starting call:', error);
      toast.error('Failed to start call');
    }
  };

  const getFilteredCalls = () => {
    if (!user) return [];

    switch (filter) {
      case 'missed':
        return calls.filter(c => c.status === 'missed' && c.receiver_id === user.id);
      case 'incoming':
        return calls.filter(c => c.receiver_id === user.id);
      case 'outgoing':
        return calls.filter(c => c.caller_id === user.id);
      default:
        return calls;
    }
  };

  const getCallIcon = (call: Call) => {
    if (call.status === 'missed' && call.receiver_id === user?.id) {
      return <PhoneMissed className="w-5 h-5 text-red-500" />;
    } else if (call.caller_id === user?.id) {
      return <PhoneOutgoing className="w-5 h-5 text-green-500" />;
    } else {
      return <PhoneIncoming className="w-5 h-5 text-blue-500" />;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredCalls = getFilteredCalls();

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} px-4 py-4`}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className={`p-2 rounded-full ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
          >
            <ArrowLeft className={`w-6 h-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
          </button>
          <div>
            <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Calls
            </h1>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              {filteredCalls.length} calls
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} px-4`}>
        <div className="flex gap-6 overflow-x-auto">
          {['all', 'missed', 'incoming', 'outgoing'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`py-3 px-2 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                filter === f
                  ? 'border-purple-500 text-purple-500'
                  : `border-transparent ${theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-900'}`
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Calls List */}
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500/20 border-t-purple-500" />
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="text-center py-12">
            <Phone className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
            <p className={`text-lg font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              No calls yet
            </p>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'} mt-2`}>
              Start calling your friends!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCalls.map((call, index) => {
              const otherUser = call.caller_id === user?.id ? call.receiver : call.caller;
              
              return (
                <motion.div
                  key={call.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'} rounded-xl p-4 transition-all cursor-pointer`}
                  onClick={() => {
                    // Can re-call
                    if (call.status !== 'ongoing') {
                      startCall(otherUser.id, call.type);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white font-bold">
                        {otherUser.username?.[0]?.toUpperCase() || 'U'}
                      </div>

                      {/* Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {otherUser.full_name}
                          </p>
                          {call.type === 'video' && (
                            <Video className="w-4 h-4 text-purple-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {getCallIcon(call)}
                          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            {format(new Date(call.created_at), 'MMM d, h:mm a')}
                          </p>
                          {call.duration && call.status === 'completed' && (
                            <>
                              <span className={theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}>•</span>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <p className="text-sm">{formatDuration(call.duration)}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Call buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startCall(otherUser.id, 'audio');
                        }}
                        className="p-2.5 rounded-full bg-green-500 hover:bg-green-600 transition-colors"
                      >
                        <Phone className="w-5 h-5 text-white" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startCall(otherUser.id, 'video');
                        }}
                        className="p-2.5 rounded-full bg-purple-500 hover:bg-purple-600 transition-colors"
                      >
                        <Video className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
