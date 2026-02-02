import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Camera, Edit2, QrCode, Settings, Share2,
  MessageCircle, Phone, Users, Star, Image, Heart,
  LogOut, Shield, Bell, Moon, ChevronRight, Check, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

interface Stats {
  friends: number;
  messages: number;
  calls: number;
  stories: number;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, updateProfile, signOut } = useAuth();
  const { isDark } = useTheme();
  const [stats, setStats] = useState<Stats>({ friends: 0, messages: 0, calls: 0, stories: 0 });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    username: '',
    bio: '',
  });
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setEditForm({
        full_name: profile.full_name || '',
        username: profile.username || '',
        bio: profile.bio || '',
      });
      fetchStats();
    }
  }, [profile]);

  const fetchStats = async () => {
    if (!user) return;

    // Friends count
    const { count: friendsCount } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted');

    // Messages count
    const { count: messagesCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', user.id);

    // Calls count
    const { count: callsCount } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`);

    // Stories count
    const { count: storiesCount } = await supabase
      .from('stories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    setStats({
      friends: friendsCount || 0,
      messages: messagesCount || 0,
      calls: callsCount || 0,
      stories: storiesCount || 0,
    });
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setAvatarUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        // Update profile
        await updateProfile({ avatar_url: publicUrl });
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile({
        full_name: editForm.full_name,
        username: editForm.username,
        bio: editForm.bio,
      });
      setShowEditModal(false);
    } catch (error) {
      console.error('Save profile error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const generateQRData = () => {
    return JSON.stringify({
      type: 'ourdm_profile',
      username: profile?.username,
      id: user?.id,
    });
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-40 ${isDark ? 'bg-gray-950/80' : 'bg-white/80'} 
                      backdrop-blur-lg border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <div className="px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className={`w-6 h-6 ${isDark ? 'text-white' : 'text-gray-900'}`} />
          </button>
          <h1 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Profile
          </h1>
          <button onClick={() => navigate('/settings')} className="p-2 -mr-2">
            <Settings className={`w-6 h-6 ${isDark ? 'text-white' : 'text-gray-900'}`} />
          </button>
        </div>
      </div>

      {/* Profile header */}
      <div className="relative">
        {/* Cover gradient */}
        <div className="h-32 bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600" />

        {/* Avatar */}
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-16">
          <div className="relative">
            <div className={`w-32 h-32 rounded-full border-4 ${isDark ? 'border-gray-950' : 'border-white'} 
                          overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500`}>
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-white text-4xl font-bold">
                    {profile?.full_name?.charAt(0) || '?'}
                  </span>
                </div>
              )}

              {avatarUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-1 right-1 p-2 rounded-full bg-purple-600 
                       shadow-lg hover:bg-purple-700 transition-colors"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="mt-20 px-4 text-center">
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {profile?.full_name || 'Unknown'}
        </h2>
        <p className="text-purple-500 font-medium">@{profile?.username || 'username'}</p>
        
        {profile?.bio && (
          <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {profile.bio}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex justify-center gap-3 mt-4">
          <motion.button
            onClick={() => setShowEditModal(true)}
            className="px-6 py-2 bg-purple-600 rounded-full text-white font-medium 
                     flex items-center gap-2"
            whileTap={{ scale: 0.95 }}
          >
            <Edit2 className="w-4 h-4" />
            Edit Profile
          </motion.button>

          <motion.button
            onClick={() => setShowQRModal(true)}
            className={`px-4 py-2 rounded-full flex items-center gap-2 
                      ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'}`}
            whileTap={{ scale: 0.95 }}
          >
            <QrCode className="w-4 h-4" />
          </motion.button>

          <motion.button
            className={`px-4 py-2 rounded-full flex items-center gap-2 
                      ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'}`}
            whileTap={{ scale: 0.95 }}
          >
            <Share2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 px-4 mt-6">
        {[
          { icon: Users, label: 'Friends', value: stats.friends, color: 'from-blue-500 to-cyan-500' },
          { icon: MessageCircle, label: 'Messages', value: stats.messages, color: 'from-purple-500 to-pink-500' },
          { icon: Phone, label: 'Calls', value: stats.calls, color: 'from-green-500 to-emerald-500' },
          { icon: Image, label: 'Stories', value: stats.stories, color: 'from-orange-500 to-red-500' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            className={`p-4 rounded-2xl ${isDark ? 'bg-white/5' : 'bg-white'} 
                      shadow-sm text-center`}
            whileTap={{ scale: 0.95 }}
          >
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${stat.color} 
                          flex items-center justify-center mx-auto mb-2`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
            <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {stat.value}
            </p>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {stat.label}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Quick settings */}
      <div className="px-4 mt-6 space-y-2">
        <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Quick Settings
        </h3>

        {[
          { icon: Bell, label: 'Notifications', onClick: () => navigate('/settings') },
          { icon: Shield, label: 'Privacy', onClick: () => navigate('/settings') },
          { icon: Moon, label: 'Dark Mode', onClick: () => navigate('/settings') },
          { icon: Star, label: 'Starred Messages', onClick: () => {} },
          { icon: Heart, label: 'Saved', onClick: () => {} },
        ].map((item) => (
          <motion.button
            key={item.label}
            onClick={item.onClick}
            className={`w-full p-4 rounded-2xl flex items-center gap-4 
                      ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-white hover:bg-gray-50'}
                      transition-colors`}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
              <item.icon className="w-5 h-5 text-purple-500" />
            </div>
            <span className={`flex-1 text-left font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {item.label}
            </span>
            <ChevronRight className={`w-5 h-5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
          </motion.button>
        ))}

        {/* Logout */}
        <motion.button
          onClick={handleLogout}
          className="w-full p-4 rounded-2xl flex items-center gap-4 bg-red-500/10 
                   hover:bg-red-500/20 transition-colors mt-4"
          whileTap={{ scale: 0.98 }}
        >
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-red-500" />
          </div>
          <span className="flex-1 text-left font-medium text-red-500">
            Logout
          </span>
        </motion.button>
      </div>

      {/* Bottom padding for nav */}
      <div className="h-24" />

      {/* Edit Profile Modal */}
      {showEditModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/50 flex items-end"
          onClick={() => setShowEditModal(false)}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            className={`w-full rounded-t-3xl ${isDark ? 'bg-gray-900' : 'bg-white'} p-6`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setShowEditModal(false)}>
                <X className={`w-6 h-6 ${isDark ? 'text-white' : 'text-gray-900'}`} />
              </button>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Edit Profile
              </h3>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="text-purple-500 font-medium"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                ) : (
                  <Check className="w-6 h-6" />
                )}
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className={`w-full mt-1 px-4 py-3 rounded-xl ${isDark 
                    ? 'bg-white/10 text-white placeholder-gray-500' 
                    : 'bg-gray-100 text-gray-900 placeholder-gray-400'
                  } outline-none focus:ring-2 focus:ring-purple-500`}
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Username
                </label>
                <div className="relative mt-1">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${
                    isDark ? 'text-gray-500' : 'text-gray-400'
                  }`}>@</span>
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value.toLowerCase() })}
                    className={`w-full pl-8 pr-4 py-3 rounded-xl ${isDark 
                      ? 'bg-white/10 text-white placeholder-gray-500' 
                      : 'bg-gray-100 text-gray-900 placeholder-gray-400'
                    } outline-none focus:ring-2 focus:ring-purple-500`}
                    placeholder="username"
                  />
                </div>
              </div>

              <div>
                <label className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Bio
                </label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  rows={3}
                  className={`w-full mt-1 px-4 py-3 rounded-xl resize-none ${isDark 
                    ? 'bg-white/10 text-white placeholder-gray-500' 
                    : 'bg-gray-100 text-gray-900 placeholder-gray-400'
                  } outline-none focus:ring-2 focus:ring-purple-500`}
                  placeholder="Tell us about yourself..."
                  maxLength={150}
                />
                <p className={`text-right text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {editForm.bio.length}/150
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
          onClick={() => setShowQRModal(false)}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`${isDark ? 'bg-gray-900' : 'bg-white'} rounded-3xl p-6 max-w-sm w-full`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Your QR Code
              </h3>
              <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Scan to add you on OurDM
              </p>

              {/* QR Code placeholder - in real app, use qrcode library */}
              <div className="w-48 h-48 mx-auto bg-white rounded-2xl p-4 flex items-center justify-center">
                <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 
                              rounded-xl flex items-center justify-center">
                  <QrCode className="w-24 h-24 text-white" />
                </div>
              </div>

              <p className={`mt-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                @{profile?.username}
              </p>

              <button
                onClick={() => setShowQRModal(false)}
                className="mt-6 px-6 py-3 bg-purple-600 rounded-full text-white font-medium w-full"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
