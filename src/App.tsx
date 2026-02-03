import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import { CallProvider } from './contexts/CallContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Pages
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import VideoCallPage from './pages/VideoCallPage';
import AudioCallPage from './pages/AudioCallPage';
import StoriesPage from './pages/StoriesPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';

// Loading spinner component (Full Screen)
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 relative">
          <div className="absolute inset-0 rounded-full border-4 border-purple-500/30" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" />
        </div>
        <p className="text-white/70 animate-pulse">Loading OurDM...</p>
      </div>
    </div>
  );
}

// 🛡️ Protected Route: Logged-in users only
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // Sabse pehle loading check karo, bina user check kiye
  if (loading) return <LoadingScreen />;

  // Agar loading khatam ho gayi aur user nahi mila, tab hi login pe bhejo
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// 🔓 Public Route: Redirect to home if already logged in
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // Refresh par loading screen dikhao taaki redirect loop na bane
  if (loading) return <LoadingScreen />;

  // Agar user already logged in hai, toh login page dikhane ki bajaye home pe bhej do
  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// 🗺️ Main App Routes logic
function AppRoutes() {
  return (
    <Routes>
      {/* Login Route */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      {/* Home Route */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />

      {/* Chat Route */}
      <Route
        path="/chat/:chatId"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />

      {/* 🟢 Video Call Route (Fixed path for your callId) */}
      <Route
        path="/call/:callId"
        element={
          <ProtectedRoute>
            <VideoCallPage />
          </ProtectedRoute>
        }
      />
      
      {/* 🟢 Compatibility Routes (for audio-call or video-call paths) */}
      <Route
        path="/video-call/:callId"
        element={
          <ProtectedRoute>
            <VideoCallPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/audio-call/:callId"
        element={
          <ProtectedRoute>
            <AudioCallPage />
          </ProtectedRoute>
        }
      />

      {/* Stories & Profile */}
      <Route
        path="/stories"
        element={
          <ProtectedRoute>
            <StoriesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      {/* 404 Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// 🚀 Main Root Component
export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ChatProvider>
            <CallProvider>
              <div className="min-h-screen bg-gray-950">
                <AppRoutes />
              </div>
            </CallProvider>
          </ChatProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
