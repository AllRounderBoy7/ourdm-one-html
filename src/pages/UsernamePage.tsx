import { useState } from 'react';
import { AtSign, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function UsernamePage() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const validateUsername = (value: string): boolean => {
    const regex = /^[a-zA-Z0-9_]{3,20}$/;
    return regex.test(value);
  };

  const checkUsername = async (value: string) => {
    if (!validateUsername(value)) {
      setAvailable(false);
      return;
    }

    setChecking(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', value.toLowerCase())
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking username:', error);
        setAvailable(false);
      } else {
        setAvailable(!data);
      }
    } catch (error) {
      console.error('Error:', error);
      setAvailable(false);
    } finally {
      setChecking(false);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setUsername(value);
    setAvailable(null);

    if (value.length >= 3) {
      checkUsername(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!available) {
      toast.error('Please choose an available username');
      return;
    }

    try {
      setLoading(true);
      await updateProfile({
        username: username.toLowerCase(),
        full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || username,
      });
      navigate('/');
    } catch (error) {
      console.error('Error setting username:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-violet-900 to-purple-800 p-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 p-8 shadow-2xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
              <AtSign className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Choose Your Username</h1>
            <p className="text-purple-200 text-sm">
              This will be your unique identifier on OurDM
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                Username
              </label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-300" />
                <input
                  type="text"
                  value={username}
                  onChange={handleUsernameChange}
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-10 py-3 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-white/50"
                  placeholder="yourusername"
                  maxLength={20}
                  required
                />
                {checking && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                  </div>
                )}
                {!checking && available === true && (
                  <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-400" />
                )}
                {!checking && available === false && username.length > 0 && (
                  <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-red-400" />
                )}
              </div>
              <div className="mt-2 space-y-1 text-xs text-purple-200">
                <p>• 3-20 characters</p>
                <p>• Letters, numbers, and underscores only</p>
                <p>• No spaces or special characters</p>
              </div>
              {!checking && available === false && username.length > 0 && (
                <p className="mt-2 text-sm text-red-400">
                  {validateUsername(username)
                    ? 'Username is already taken'
                    : 'Username does not meet requirements'}
                </p>
              )}
              {available === true && (
                <p className="mt-2 text-sm text-green-400">
                  Username is available!
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!available || loading}
              className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Profile...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
