import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Create or fetch profile for a user
  const createOrFetchProfile = async (authUser: User): Promise<Profile | null> => {
    try {
      // First try to fetch existing profile
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (existingProfile) {
        // Update online status
        await supabase
          .from('profiles')
          .update({ is_online: true, last_seen: new Date().toISOString() })
          .eq('id', authUser.id);
        return existingProfile as Profile;
      }

      // If profile doesn't exist (PGRST116 = not found), create one
      if (fetchError?.code === 'PGRST116') {
        const email = authUser.email || '';
        const baseName = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        const randomSuffix = Math.floor(Math.random() * 9999);
        const username = `${baseName}${randomSuffix}`.slice(0, 20);
        
        const newProfile = {
          id: authUser.id,
          username: username,
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || email.split('@')[0],
          avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
          bio: '',
          is_online: true,
          last_seen: new Date().toISOString(),
        };

        const { data: createdProfile, error: createError } = await supabase
          .from('profiles')
          .insert(newProfile)
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          // Race condition - try fetch again
          const { data: retryProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();
          return retryProfile as Profile | null;
        }

        toast.success('Welcome to OurDM! 🎉');
        return createdProfile as Profile;
      }

      console.error('Error fetching profile:', fetchError);
      return null;
    } catch (err) {
      console.error('Profile error:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await createOrFetchProfile(user);
      setProfile(profileData);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        const profileData = await createOrFetchProfile(currentSession.user);
        setProfile(profileData);
      }
      
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('Auth event:', event);
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        const profileData = await createOrFetchProfile(currentSession.user);
        setProfile(profileData);
        
        if (event === 'SIGNED_IN') {
          toast.success('Signed in successfully! 🎉');
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    // Set offline status on page unload
    const handleBeforeUnload = async () => {
      if (user) {
        await supabase
          .from('profiles')
          .update({ is_online: false, last_seen: new Date().toISOString() })
          .eq('id', user.id);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        toast.error('Google sign in failed: ' + error.message);
        throw error;
      }
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Wrong email or password');
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Please verify your email first');
        } else {
          toast.error(error.message);
        }
        throw error;
      }

      if (data.user) {
        const profileData = await createOrFetchProfile(data.user);
        setProfile(profileData);
      }
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}`,
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('This email is already registered. Try signing in.');
        } else {
          toast.error(error.message);
        }
        throw error;
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        toast.success('Check your email for verification link! 📧');
      } else if (data.user && data.session) {
        // Auto-confirmed (if email confirmation disabled in Supabase)
        const profileData = await createOrFetchProfile(data.user);
        setProfile(profileData);
        toast.success('Account created successfully! 🎉');
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    // Set offline before signing out
    if (user) {
      await supabase
        .from('profiles')
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('id', user.id);
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      toast.error(error.message);
      throw error;
    }

    setUser(null);
    setProfile(null);
    setSession(null);
    toast.success('Signed out successfully!');
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) throw new Error('No user logged in');

    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id);

    if (error) {
      toast.error(error.message);
      throw error;
    }

    await refreshProfile();
    toast.success('Profile updated! ✨');
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    updateProfile,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
