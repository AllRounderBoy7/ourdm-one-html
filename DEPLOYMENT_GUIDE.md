# OurDM - Complete Deployment Guide

## 🚀 Quick Setup (5 Minutes)

### Step 1: Supabase Database Setup

1. **Go to your Supabase Dashboard**: https://app.supabase.com
2. **Navigate to**: SQL Editor (left sidebar)
3. **Copy the entire content** from `supabase-schema.sql` file
4. **Paste and run** the SQL script
5. **Wait for confirmation**: "Success. No rows returned"

### Step 2: Configure Storage Buckets

1. **Go to**: Storage (left sidebar)
2. **Create 5 public buckets** with these exact names:
   - `avatars` - For profile pictures
   - `chat-media` - For photos/videos in chats
   - `stories` - For story media
   - `chat-files` - For file attachments
   - `wallpapers` - For custom wallpapers

3. **Configure policies** for each bucket:
   - Click bucket → Policies → Add new policy
   - **For all buckets**, add these policies:
     ```
     Policy Name: Allow authenticated users to upload
     Policy: SELECT, INSERT, UPDATE, DELETE
     Target roles: authenticated
     ```

### Step 3: Enable Realtime

1. **Go to**: Database → Replication (left sidebar)
2. **Enable realtime** for these tables:
   - `profiles`
   - `friendships`
   - `chats`
   - `chat_participants`
   - `messages`
   - `message_reactions`
   - `message_receipts`
   - `stories`
   - `story_views`
   - `story_comments`
   - `calls`
   - `typing_indicators`

### Step 4: Configure Google OAuth

1. **Go to**: Authentication → Providers (left sidebar)
2. **Enable Google** provider
3. **Add your Google OAuth credentials**:
   - Get credentials from: https://console.cloud.google.com/apis/credentials
   - Create OAuth 2.0 Client ID
   - Add authorized redirect URIs:
     ```
     https://nyevygppwrhadxegqqvl.supabase.co/auth/v1/callback
     http://localhost:5173/auth/callback (for development)
     ```
4. **Copy Client ID and Secret** to Supabase

### Step 5: Environment Variables (Already Configured)

The app already has these credentials in `src/lib/supabase.ts`:
```typescript
Supabase URL: https://nyevygppwrhadxegqqvl.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📱 Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser at http://localhost:5173
```

---

## 🌐 Deploy to Production

### Option 1: Vercel (Recommended - 2 Minutes)

1. **Push code to GitHub**
2. **Go to**: https://vercel.com
3. **Click**: Import Project
4. **Select** your repository
5. **Deploy** - That's it!

### Option 2: Netlify

1. **Push code to GitHub**
2. **Go to**: https://netlify.com
3. **Click**: Add new site → Import from Git
4. **Build settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. **Deploy**

### Option 3: Static Hosting (Any Provider)

```bash
# Build for production
npm run build

# Upload the 'dist' folder to any static hosting:
# - GitHub Pages
# - Firebase Hosting
# - AWS S3
# - Cloudflare Pages
```

---

## 📱 Convert to Mobile App

### Android APK (Using Capacitor)

```bash
# Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# Initialize Capacitor
npx cap init OurDM com.ourdm.app

# Build web assets
npm run build

# Add Android platform
npx cap add android

# Sync web code
npx cap sync

# Open in Android Studio
npx cap open android

# Build APK in Android Studio
```

### iOS App (Using Capacitor - macOS only)

```bash
# Add iOS platform
npx cap add ios

# Sync web code
npx cap sync

# Open in Xcode
npx cap open ios

# Build in Xcode
```

### PWA (Progressive Web App)

The app is already PWA-ready! Users can:
1. Open the website on mobile
2. Tap "Add to Home Screen"
3. Use it like a native app

---

## ✅ Post-Deployment Checklist

- [ ] Database schema created
- [ ] Storage buckets configured
- [ ] Realtime enabled for all tables
- [ ] Google OAuth configured
- [ ] App deployed and accessible
- [ ] Test user registration
- [ ] Test sending messages
- [ ] Test friend requests
- [ ] Test audio/video calls
- [ ] Test file uploads
- [ ] Test stories

---

## 🧪 Testing Credentials

After deployment, create test accounts:

1. **User 1**: Sign in with Google
   - Set username: `testuser1`
   
2. **User 2**: Sign in with Google (different account)
   - Set username: `testuser2`

3. **Test Features**:
   - Search for each other by username
   - Send friend request
   - Accept request
   - Start chatting
   - Make a video call
   - Post a story

---

## 🔧 Troubleshooting

### "Failed to create profile"
- **Check**: Supabase schema is properly set up
- **Fix**: Re-run the SQL schema

### "Google OAuth not working"
- **Check**: OAuth credentials are correct
- **Fix**: Verify redirect URIs match exactly

### "Messages not sending"
- **Check**: Realtime is enabled for `messages` table
- **Fix**: Enable in Database → Replication

### "File upload fails"
- **Check**: Storage buckets exist and have policies
- **Fix**: Recreate buckets with proper policies

### "Calls not connecting"
- **Check**: Browser permissions for camera/microphone
- **Fix**: Allow permissions in browser settings

---

## 📊 Performance Monitoring

Monitor your app in Supabase Dashboard:
1. **Database**: Check query performance
2. **Auth**: Monitor user sign-ups
3. **Storage**: Track file uploads
4. **API**: View request logs

---

## 🔒 Security Checklist

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Google OAuth for secure authentication
- ✅ File upload size limits (handled by Supabase)
- ✅ User input validation
- ✅ Blocked users can't send messages
- ✅ Only friends can see stories

---

## 💡 Tips for Production

1. **Enable email confirmations** (optional):
   - Auth → Settings → Email confirmations

2. **Set up rate limiting** (optional):
   - Prevents spam and abuse

3. **Configure SMTP** (optional):
   - For custom email templates

4. **Add analytics** (optional):
   - Google Analytics or Plausible

5. **Setup error tracking** (optional):
   - Sentry for error monitoring

---

## 🎉 You're Done!

Your OurDM app is now live and ready to use. Share the link with your users and start chatting!

For support or questions, check the README.md file.
