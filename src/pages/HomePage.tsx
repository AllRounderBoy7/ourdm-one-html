import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Users, Phone, Search, MoreVertical } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Chat, Friendship, Profile } from '../lib/supabase';
import { useStore } from '../store/useStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function HomePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'chats' | 'friends' | 'requests'>('chats');
  const [chats, setChats] = useState<Chat[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [friendRequests, setFriendRequests] = useState<Friendship[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const theme = useStore((state) => state.theme);

  useEffect(() => {
    if (user) {
      loadData();
      subscribeToUpdates();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load chats
      const { data: chatParticipants } = await supabase
        .from('chat_participants')
        .select('chat_id, chats(*, chat_participants(profile:profiles(*)))')
        .eq('user_id', user.id);

      if (chatParticipants) {
        const chatsData = chatParticipants.map(cp => cp.chats).filter(Boolean) as any[];
        
        // Load last messages for each chat
        for (const chat of chatsData) {
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('*, sender:profiles(*)')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (lastMessage) {
            chat.last_message = lastMessage;
          }
        }
        
        setChats(chatsData);
      }

      // Load friends
      const { data: friendships } = await supabase
        .from('friendships')
        .select('*, friend_profile:profiles!friendships_friend_id_fkey(*)')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (friendships) {
        const friendProfiles = friendships.map(f => 
          f.user_id === user.id ? f.friend_profile : null
        ).filter(Boolean) as Profile[];
        setFriends(friendProfiles);
      }

      // Load friend requests
      const { data: requests } = await supabase
        .from('friendships')
        .select('*, friend_profile:profiles!friendships_user_id_fkey(*)')
        .eq('friend_id', user.id)
        .eq('status', 'pending');

      if (requests) {
        setFriendRequests(requests as Friendship[]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToUpdates = () => {
    if (!user) return;

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel('messages')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => loadData()
      )
      .subscribe();

    // Subscribe to friend requests
    const friendshipsChannel = supabase
      .channel('friendships')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'friendships' },
        () => loadData()
      )
      .subscribe();

    return () => {
      messagesChannel.unsubscribe();
      friendshipsChannel.unsubscribe();
    };
  };

  const searchUsers = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .neq('id', user?.id || '')
      .limit(20);

    setSearchResults(data || []);
  };

  const sendFriendRequest = async (friendId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .insert({
          user_id: user.id,
          friend_id: friendId,
          status: 'pending'
        });

      if (error) throw error;
      toast.success('Friend request sent!');
      setSearchResults([]);
      setSearchQuery('');
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Friend request already sent');
      } else {
        toast.error('Failed to send friend request');
      }
    }
  };

  const acceptFriendRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (error) throw error;
      toast.success('Friend request accepted!');
      loadData();
    } catch (error) {
      toast.error('Failed to accept friend request');
    }
  };

  const rejectFriendRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', requestId);

      if (error) throw error;
      toast.success('Friend request rejected');
      loadData();
    } catch (error) {
      toast.error('Failed to reject friend request');
    }
  };

  const createChat = async (friendId: string) => {
    if (!user) return;

    try {
      // Check if chat already exists
      const { data: existingChats } = await supabase
        .from('chat_participants')
        .select('chat_id, chats(is_group)')
        .eq('user_id', user.id);

      if (existingChats) {
        for (const ec of existingChats) {
          const { data: participants } = await supabase
            .from('chat_participants')
            .select('user_id')
            .eq('chat_id', ec.chat_id);

          const participantIds = participants?.map(p => p.user_id) || [];
          if (participantIds.length === 2 && participantIds.includes(friendId)) {
            navigate(`/chat/${ec.chat_id}`);
            return;
          }
        }
      }

      // Create new chat
      const { data: newChat, error } = await supabase
        .from('chats')
        .insert({
          is_group: false,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Add participants
      await supabase.from('chat_participants').insert([
        { chat_id: newChat.id, user_id: user.id },
        { chat_id: newChat.id, user_id: friendId }
      ]);

      navigate(`/chat/${newChat.id}`);
    } catch (error) {
      console.error('Error creating chat:', error);
      toast.error('Failed to create chat');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className={`flex flex-col h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} px-4 py-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              OurDM
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/calls')}
              className={`p-2 rounded-full ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
            >
              <Phone className={`h-5 w-5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className={`p-2 rounded-full ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
              >
                <MoreVertical className={`h-5 w-5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} />
              </button>
              {showMenu && (
                <div className={`absolute right-0 mt-2 w-48 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-lg border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} py-2 z-10`}>
                  <button
                    onClick={() => { navigate('/profile/' + user?.id); setShowMenu(false); }}
                    className={`w-full text-left px-4 py-2 ${theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                  >
                    Profile
                  </button>
                  <button
                    onClick={() => { navigate('/settings'); setShowMenu(false); }}
                    className={`w-full text-left px-4 py-2 ${theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                  >
                    Settings
                  </button>
                  <button
                    onClick={() => { navigate('/stories'); setShowMenu(false); }}
                    className={`w-full text-left px-4 py-2 ${theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                  >
                    Stories
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-red-500 hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchUsers(e.target.value);
              }}
              placeholder="Search users..."
              className={`w-full rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'} px-10 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500`}
            />
          </div>
          {searchResults.length > 0 && (
            <div className={`mt-2 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} max-h-60 overflow-y-auto`}>
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className={`flex items-center justify-between p-3 ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white font-semibold">
                      {result.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        @{result.username}
                      </p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {result.full_name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => sendFriendRequest(result.id)}
                    className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 transition-colors"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <button
          onClick={() => setActiveTab('chats')}
          className={`flex-1 py-3 font-medium transition-colors ${
            activeTab === 'chats'
              ? 'border-b-2 border-purple-500 text-purple-500'
              : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          Chats
        </button>
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-3 font-medium transition-colors ${
            activeTab === 'friends'
              ? 'border-b-2 border-purple-500 text-purple-500'
              : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          Friends
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 py-3 font-medium transition-colors relative ${
            activeTab === 'requests'
              ? 'border-b-2 border-purple-500 text-purple-500'
              : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          Requests
          {friendRequests.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">
              {friendRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500/20 border-t-purple-500"></div>
          </div>
        ) : (
          <>
            {activeTab === 'chats' && (
              <div>
                {chats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <MessageCircle className={`h-16 w-16 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'} mb-4`} />
                    <p className={`text-lg font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                      No chats yet
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                      Add friends and start chatting!
                    </p>
                  </div>
                ) : (
                  chats.map((chat) => {
                    const otherParticipant = chat.participants?.find(p => p.user_id !== user?.id)?.profile;
                    return (
                      <div
                        key={chat.id}
                        onClick={() => navigate(`/chat/${chat.id}`)}
                        className={`flex items-center gap-3 p-4 cursor-pointer ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'} border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}
                      >
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                          {otherParticipant?.username?.[0]?.toUpperCase() || 'C'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {chat.is_group ? chat.name : `@${otherParticipant?.username || 'Unknown'}`}
                          </p>
                          {chat.last_message && (
                            <p className={`text-sm truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                              {chat.last_message.deleted ? 'Message deleted' : chat.last_message.content || 'Media'}
                            </p>
                          )}
                        </div>
                        {chat.last_message && (
                          <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                            {format(new Date(chat.last_message.created_at), 'HH:mm')}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'friends' && (
              <div>
                {friends.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <Users className={`h-16 w-16 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'} mb-4`} />
                    <p className={`text-lg font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                      No friends yet
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                      Search for users to add friends
                    </p>
                  </div>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      onClick={() => createChat(friend.id)}
                      className={`flex items-center justify-between p-4 cursor-pointer ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'} border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white font-semibold">
                          {friend.username?.[0]?.toUpperCase() || 'F'}
                        </div>
                        <div>
                          <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            @{friend.username}
                          </p>
                          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            {friend.full_name}
                          </p>
                        </div>
                      </div>
                      <MessageCircle className={`h-5 w-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'requests' && (
              <div>
                {friendRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <Users className={`h-16 w-16 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'} mb-4`} />
                    <p className={`text-lg font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                      No pending requests
                    </p>
                  </div>
                ) : (
                  friendRequests.map((request) => (
                    <div
                      key={request.id}
                      className={`flex items-center justify-between p-4 border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white font-semibold">
                          {request.friend_profile?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            @{request.friend_profile?.username}
                          </p>
                          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            {request.friend_profile?.full_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptFriendRequest(request.id)}
                          className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => rejectFriendRequest(request.id)}
                          className={`rounded-lg px-4 py-2 text-sm font-medium ${theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition-colors`}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
