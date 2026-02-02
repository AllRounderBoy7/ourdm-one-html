# 🔐 Supabase Authentication Setup Guide

## ⚠️ IMPORTANT: Google OAuth Configuration

For Google Sign-In to work, you MUST configure it in both Google Cloud Console AND Supabase Dashboard.

---

## Step 1: Google Cloud Console Setup

### 1.1 Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client IDs**
5. Select **Web application**
6. Set a name: "OurDM Auth"

### 1.2 Configure Authorized URLs

**Authorized JavaScript origins:**
```
https://nyevygppwrhadxegqqvl.supabase.co
```

**Authorized redirect URIs:**
```
https://nyevygppwrhadxegqqvl.supabase.co/auth/v1/callback
```

7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

---

## Step 2: Supabase Dashboard Setup

### 2.1 Enable Google Provider

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project: `nyevygppwrhadxegqqvl`
3. Go to **Authentication** → **Providers**
4. Find **Google** and toggle it **ON**
5. Paste your **Client ID** and **Client Secret** from Google
6. Click **Save**

### 2.2 Configure Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**: 
   - For development: `http://localhost:5173`
   - For production: `https://your-deployed-app.com`
3. Add **Redirect URLs**:
   ```
   http://localhost:5173
   http://localhost:5173/
   https://your-deployed-app.com
   https://your-deployed-app.com/
   ```
4. Click **Save**

---

## Step 3: Email Authentication Setup

### 3.1 Disable Email Confirmation (For Testing)

If you want users to login immediately without email verification:

1. Go to **Authentication** → **Providers**
2. Find **Email** section
3. Toggle OFF: **Confirm email**
4. Toggle OFF: **Secure email change**
5. Click **Save**

### 3.2 Enable Email Confirmation (For Production)

For production, keep email confirmation ON:
1. Users will receive a verification email
2. They must click the link to verify
3. Then they can sign in

---

## Step 4: Database Setup

Run this SQL in **SQL Editor**:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
```

---

## 🧪 Testing Authentication

### Test Google OAuth:
1. Click "Continue with Google"
2. Select your Google account
3. You should be redirected back and logged in
4. Profile should be auto-created

### Test Email/Password:
1. Click "Use Email Instead"
2. Toggle to "Sign Up"
3. Enter email and password (6+ characters)
4. If email confirmation is OFF, you'll be logged in immediately
5. If email confirmation is ON, check your email and click verify link

---

## 🐛 Common Issues & Fixes

### Issue: "redirect_uri_mismatch" error
**Fix:** Make sure the redirect URI in Google Cloud Console exactly matches:
```
https://nyevygppwrhadxegqqvl.supabase.co/auth/v1/callback
```

### Issue: "Email not confirmed" error
**Fix:** Either:
- Check your email and click verification link
- OR disable email confirmation in Supabase (for testing only)

### Issue: "Invalid login credentials"
**Fix:** 
- Make sure you're using the correct email/password
- If forgot password, you need to implement password reset flow

### Issue: Profile not created after login
**Fix:** 
- Run the database SQL setup above
- Check if RLS policies are correct
- Check Supabase logs for errors

### Issue: Google login redirects but doesn't complete
**Fix:**
- Check Site URL is correct in Supabase
- Check redirect URLs are added
- Check browser console for errors

---

## ✅ Verification Checklist

- [ ] Google Cloud OAuth credentials created
- [ ] Redirect URI set correctly in Google Console
- [ ] Google provider enabled in Supabase
- [ ] Client ID & Secret pasted in Supabase
- [ ] Site URL configured in Supabase
- [ ] Redirect URLs added in Supabase
- [ ] Database tables created
- [ ] RLS policies applied
- [ ] Realtime enabled for profiles table

---

## 📞 Need Help?

1. Check Supabase Dashboard → **Logs** for errors
2. Check browser **Developer Tools** → Console
3. Make sure all URLs match exactly (no trailing slashes mismatch)
4. Try incognito/private browser to clear cached auth state
