import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, User, Shield, Bell, Palette, Database,
  HelpCircle, Info, LogOut, ChevronRight, Moon, Sun,
  Eye, EyeOff, Clock, Lock, Smartphone, Globe,
  Volume2, Vibrate, MessageCircle, Phone, Image,
  Wifi, Download, Trash2, Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

interface Settings {
  // Privacy
  last_seen: 'everyone' | 'friends' | 'nobody';
  profile_photo: 'everyone' | 'friends' | 'nobody';
  read_receipts: boolean;
  typing_indicators: boolean;
  online_status: boolean;
  // Notifications
  message_notifications: boolean;
  call_notifications: boolean;
  group_notifications: boolean;
  notification_sound: string;
  vibration: boolean;
  preview_messages: boolean;
  // Chat
  enter_to_send: boolean;
  media_quality: 'auto' | 'high' | 'medium' | 'low';
  auto_download_wifi: boolean;
  auto_download_mobile: boolean;
  // Appearance
  font_size: 'small' | 'medium' | 'large';
  bubble_style: 'rounded' | 'square' | 'ios';
}

const defaultSettings: Settings = {
  last_seen: 'everyone',
  profile_photo: 'everyone',
  read_receipts: true,
  typing_indicators: true,
  online_status: true,
  message_notifications: true,
  call_notifications: true,
  group_notifications: true,
  notification_sound: 'default',
  vibration: true,
  preview_messages: true,
  enter_to_send: true,
  media_quality: 'auto',
  auto_download_wifi: true,
  auto_download_mobile: false,
  font_size: 'medium',
  bubble_style: 'rounded',
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isDark, toggleTheme, theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setSettings({ ...defaultSettings, ...data.settings });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: Partial<Settings>) => {
    if (!user) return;
    
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    setSaving(true);

    try {
      await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          settings: updatedSettings,
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const SettingItem = ({ 
    icon: Icon, 
    label, 
    description,
    onClick,
    rightElement,
    danger
  }: {
    icon: any;
    label: string;
    description?: string;
    onClick?: () => void;
    rightElement?: React.ReactNode;
    danger?: boolean;
  }) => (
    <motion.button
      onClick={onClick}
      className={`w-full p-4 flex items-center gap-4 ${
        isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
      } transition-colors`}
      whileTap={{ scale: 0.98 }}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
        danger 
          ? 'bg-red-500/20' 
          : isDark ? 'bg-white/10' : 'bg-purple-100'
      }`}>
        <Icon className={`w-5 h-5 ${
          danger ? 'text-red-500' : 'text-purple-500'
        }`} />
      </div>
      <div className="flex-1 text-left">
        <p className={`font-medium ${
          danger 
            ? 'text-red-500' 
            : isDark ? 'text-white' : 'text-gray-900'
        }`}>
          {label}
        </p>
        {description && (
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {description}
          </p>
        )}
      </div>
      {rightElement || (
        <ChevronRight className={`w-5 h-5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
      )}
    </motion.button>
  );

  const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`w-12 h-7 rounded-full p-1 transition-colors ${
        enabled ? 'bg-purple-600' : isDark ? 'bg-gray-700' : 'bg-gray-300'
      }`}
    >
      <motion.div
        className="w-5 h-5 rounded-full bg-white shadow"
        animate={{ x: enabled ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <div className={`px-4 py-3 ${isDark ? 'bg-black/30' : 'bg-gray-100'}`}>
      <h3 className={`text-sm font-medium uppercase tracking-wider ${
        isDark ? 'text-gray-400' : 'text-gray-500'
      }`}>
        {title}
      </h3>
    </div>
  );

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-40 ${isDark ? 'bg-gray-950/80' : 'bg-white/80'} 
                      backdrop-blur-lg border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <div className="px-4 py-3 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className={`w-6 h-6 ${isDark ? 'text-white' : 'text-gray-900'}`} />
          </button>
          <h1 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Settings
          </h1>
          {saving && (
            <div className="ml-auto">
              <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Settings content */}
      <div className="pb-24">
        {/* Account */}
        <SectionHeader title="Account" />
        <div className={`${isDark ? 'bg-gray-900' : 'bg-white'}`}>
          <SettingItem
            icon={User}
            label="Profile"
            description="Edit your profile information"
            onClick={() => navigate('/profile')}
          />
        </div>

        {/* Appearance */}
        <SectionHeader title="Appearance" />
        <div className={`${isDark ? 'bg-gray-900' : 'bg-white'}`}>
          <SettingItem
            icon={isDark ? Moon : Sun}
            label="Dark Mode"
            description={isDark ? 'Currently on' : 'Currently off'}
            rightElement={<Toggle enabled={isDark} onChange={toggleTheme} />}
          />
          
          <div className="px-4 py-4 border-t border-white/5">
            <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Theme Color
            </p>
            <div className="flex gap-3">
              {[
                { id: 'dark', color: 'from-gray-800 to-gray-900', label: 'Dark' },
                { id: 'light', color: 'from-gray-100 to-white', label: 'Light' },
                { id: 'purple', color: 'from-purple-600 to-violet-600', label: 'Purple' },
                { id: 'ocean', color: 'from-blue-600 to-cyan-600', label: 'Ocean' },
                { id: 'sunset', color: 'from-orange-500 to-pink-500', label: 'Sunset' },
                { id: 'forest', color: 'from-green-600 to-emerald-600', label: 'Forest' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id as any)}
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} 
                            flex items-center justify-center
                            ${theme === t.id ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-900' : ''}`}
                >
                  {theme === t.id && <Check className="w-5 h-5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <SettingItem
            icon={Palette}
            label="Font Size"
            description={settings.font_size.charAt(0).toUpperCase() + settings.font_size.slice(1)}
            onClick={() => {
              const sizes: ('small' | 'medium' | 'large')[] = ['small', 'medium', 'large'];
              const currentIndex = sizes.indexOf(settings.font_size);
              const nextIndex = (currentIndex + 1) % sizes.length;
              saveSettings({ font_size: sizes[nextIndex] });
            }}
          />
        </div>

        {/* Privacy */}
        <SectionHeader title="Privacy" />
        <div className={`${isDark ? 'bg-gray-900' : 'bg-white'}`}>
          <SettingItem
            icon={Clock}
            label="Last Seen"
            description={settings.last_seen.charAt(0).toUpperCase() + settings.last_seen.slice(1)}
            onClick={() => {
              const options: ('everyone' | 'friends' | 'nobody')[] = ['everyone', 'friends', 'nobody'];
              const currentIndex = options.indexOf(settings.last_seen);
              const nextIndex = (currentIndex + 1) % options.length;
              saveSettings({ last_seen: options[nextIndex] });
            }}
          />
          <SettingItem
            icon={Image}
            label="Profile Photo"
            description={settings.profile_photo.charAt(0).toUpperCase() + settings.profile_photo.slice(1)}
            onClick={() => {
              const options: ('everyone' | 'friends' | 'nobody')[] = ['everyone', 'friends', 'nobody'];
              const currentIndex = options.indexOf(settings.profile_photo);
              const nextIndex = (currentIndex + 1) % options.length;
              saveSettings({ profile_photo: options[nextIndex] });
            }}
          />
          <SettingItem
            icon={Eye}
            label="Read Receipts"
            description="Show when you've read messages"
            rightElement={
              <Toggle 
                enabled={settings.read_receipts} 
                onChange={(v) => saveSettings({ read_receipts: v })} 
              />
            }
          />
          <SettingItem
            icon={MessageCircle}
            label="Typing Indicators"
            description="Show when you're typing"
            rightElement={
              <Toggle 
                enabled={settings.typing_indicators} 
                onChange={(v) => saveSettings({ typing_indicators: v })} 
              />
            }
          />
          <SettingItem
            icon={Globe}
            label="Online Status"
            description="Show when you're online"
            rightElement={
              <Toggle 
                enabled={settings.online_status} 
                onChange={(v) => saveSettings({ online_status: v })} 
              />
            }
          />
          <SettingItem
            icon={Lock}
            label="Blocked Users"
            description="Manage blocked contacts"
            onClick={() => {}}
          />
        </div>

        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <div className={`${isDark ? 'bg-gray-900' : 'bg-white'}`}>
          <SettingItem
            icon={Bell}
            label="Message Notifications"
            rightElement={
              <Toggle 
                enabled={settings.message_notifications} 
                onChange={(v) => saveSettings({ message_notifications: v })} 
              />
            }
          />
          <SettingItem
            icon={Phone}
            label="Call Notifications"
            rightElement={
              <Toggle 
                enabled={settings.call_notifications} 
                onChange={(v) => saveSettings({ call_notifications: v })} 
              />
            }
          />
          <SettingItem
            icon={Volume2}
            label="Notification Sound"
            description={settings.notification_sound}
            onClick={() => {}}
          />
          <SettingItem
            icon={Vibrate}
            label="Vibration"
            rightElement={
              <Toggle 
                enabled={settings.vibration} 
                onChange={(v) => saveSettings({ vibration: v })} 
              />
            }
          />
          <SettingItem
            icon={EyeOff}
            label="Show Preview"
            description="Show message content in notifications"
            rightElement={
              <Toggle 
                enabled={settings.preview_messages} 
                onChange={(v) => saveSettings({ preview_messages: v })} 
              />
            }
          />
        </div>

        {/* Data & Storage */}
        <SectionHeader title="Data & Storage" />
        <div className={`${isDark ? 'bg-gray-900' : 'bg-white'}`}>
          <SettingItem
            icon={Database}
            label="Storage Usage"
            description="Manage your storage"
            onClick={() => {}}
          />
          <SettingItem
            icon={Wifi}
            label="Auto-Download on WiFi"
            rightElement={
              <Toggle 
                enabled={settings.auto_download_wifi} 
                onChange={(v) => saveSettings({ auto_download_wifi: v })} 
              />
            }
          />
          <SettingItem
            icon={Smartphone}
            label="Auto-Download on Mobile"
            rightElement={
              <Toggle 
                enabled={settings.auto_download_mobile} 
                onChange={(v) => saveSettings({ auto_download_mobile: v })} 
              />
            }
          />
          <SettingItem
            icon={Download}
            label="Media Quality"
            description={settings.media_quality.charAt(0).toUpperCase() + settings.media_quality.slice(1)}
            onClick={() => {
              const options: ('auto' | 'high' | 'medium' | 'low')[] = ['auto', 'high', 'medium', 'low'];
              const currentIndex = options.indexOf(settings.media_quality);
              const nextIndex = (currentIndex + 1) % options.length;
              saveSettings({ media_quality: options[nextIndex] });
            }}
          />
          <SettingItem
            icon={Trash2}
            label="Clear Cache"
            description="Free up storage space"
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
          />
        </div>

        {/* Help & About */}
        <SectionHeader title="Help & About" />
        <div className={`${isDark ? 'bg-gray-900' : 'bg-white'}`}>
          <SettingItem
            icon={HelpCircle}
            label="Help Center"
            onClick={() => {}}
          />
          <SettingItem
            icon={Info}
            label="About OurDM"
            description="Version 1.0.0"
            onClick={() => {}}
          />
        </div>

        {/* Logout */}
        <div className={`mt-4 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
          <SettingItem
            icon={LogOut}
            label="Logout"
            description="Sign out of your account"
            onClick={handleLogout}
            danger
          />
        </div>

        {/* App info */}
        <div className="text-center py-8">
          <p className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            OurDM v1.0.0
          </p>
          <p className={`text-xs ${isDark ? 'text-gray-700' : 'text-gray-300'}`}>
            Made with 💜
          </p>
        </div>
      </div>
    </div>
  );
}
