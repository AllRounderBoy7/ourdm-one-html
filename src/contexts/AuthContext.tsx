// Is portion ko apne useEffect ke andar replace karein

useEffect(() => {
  const initializeAuth = async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        // Yahan wait karna zaroori hai refresh par loading screen hatne se pehle
        const profileData = await createOrFetchProfile(currentSession.user);
        setProfile(profileData);
      }
    } catch (error) {
      console.error("Initialization error:", error);
    } finally {
      // Loading tabhi false hogi jab profile check ho chuka hoga
      setLoading(false);
    }
  };

  initializeAuth();

  // Listen for auth changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
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
    
    // Auth change event ke baad bhi loading handle karein
    setLoading(false);
  });

  // ... rest of your code (handleBeforeUnload etc.)
