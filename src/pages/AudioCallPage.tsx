import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX,
  UserPlus, Pause, Play, ArrowLeft
} from 'lucide-react';
import { useCall } from '../contexts/CallContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function AudioCallPage() {
  const { oderId } = useParams<{ oderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    callState, endCall, toggleMute, isMuted, 
    localStream, remoteStream 
  } = useCall();
  
  const [callDuration, setCallDuration] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isOnHold, setIsOnHold] = useState(false);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Fetch other user info
  useEffect(() => {
    if (oderId) {
      fetchOtherUser();
    }
  }, [oderId]);

  const fetchOtherUser = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', oderId)
      .single();
    
    if (data) setOtherUser(data);
  };

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState === 'connected') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);

  // Setup audio analyzer for level visualization
  useEffect(() => {
    if (remoteStream && audioRef.current) {
      audioRef.current.srcObject = remoteStream;
      
      // Create audio analyzer
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(remoteStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Animate audio level
      const updateLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
        }
        requestAnimationFrame(updateLevel);
      };
      updateLevel();
    }
  }, [remoteStream]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    endCall();
    navigate(-1);
  };

  const toggleSpeaker = () => {
    if (audioRef.current) {
      audioRef.current.volume = isSpeakerOn ? 0.1 : 1;
      setIsSpeakerOn(!isSpeakerOn);
    }
  };

  const toggleHold = () => {
    setIsOnHold(!isOnHold);
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isOnHold;
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-violet-900 to-indigo-900 flex flex-col">
      {/* Hidden audio element */}
      <audio ref={audioRef} autoPlay playsInline />

      {/* Background animation */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white/5"
            style={{
              width: Math.random() * 300 + 100,
              height: Math.random() * 300 + 100,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="relative z-10 p-4 flex items-center">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <span className="ml-4 text-white/70 text-sm">Audio Call</span>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
        {/* Avatar with audio visualization */}
        <div className="relative mb-8">
          {/* Audio level rings */}
          <AnimatePresence>
            {callState === 'connected' && (
              <>
                {[1, 2, 3].map((ring) => (
                  <motion.div
                    key={ring}
                    className="absolute inset-0 rounded-full border-2 border-green-400"
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ 
                      scale: 1 + (audioLevel * ring * 0.3),
                      opacity: 0.5 - (ring * 0.15)
                    }}
                    transition={{ duration: 0.1 }}
                    style={{
                      margin: -ring * 15,
                    }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>

          {/* Avatar */}
          <motion.div
            className="w-40 h-40 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 
                       flex items-center justify-center shadow-2xl relative overflow-hidden"
            animate={callState === 'calling' ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {otherUser?.avatar_url ? (
              <img 
                src={otherUser.avatar_url} 
                alt={otherUser.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white text-5xl font-bold">
                {otherUser?.full_name?.charAt(0) || '?'}
              </span>
            )}

            {/* Muted indicator */}
            {isMuted && (
              <div className="absolute bottom-2 right-2 p-2 bg-red-500 rounded-full">
                <MicOff className="w-4 h-4 text-white" />
              </div>
            )}
          </motion.div>
        </div>

        {/* User info */}
        <h2 className="text-white text-2xl font-bold mb-2">
          {otherUser?.full_name || 'Calling...'}
        </h2>
        <p className="text-white/70 text-sm mb-2">
          @{otherUser?.username || '...'}
        </p>

        {/* Call status */}
        <div className="flex items-center gap-2 mb-8">
          {callState === 'calling' && (
            <motion.div
              className="flex items-center gap-2 text-yellow-400"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Phone className="w-4 h-4" />
              <span>Calling...</span>
            </motion.div>
          )}
          {callState === 'ringing' && (
            <motion.div
              className="flex items-center gap-2 text-blue-400"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Phone className="w-4 h-4" />
              <span>Ringing...</span>
            </motion.div>
          )}
          {callState === 'connected' && (
            <div className="flex items-center gap-2 text-green-400">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>{formatDuration(callDuration)}</span>
            </div>
          )}
          {isOnHold && (
            <span className="text-orange-400 ml-2">(On Hold)</span>
          )}
        </div>

        {/* Audio waveform visualization */}
        {callState === 'connected' && (
          <div className="flex items-center justify-center gap-1 h-16 mb-8">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full"
                animate={{
                  height: [10, 10 + audioLevel * 50 * Math.random(), 10],
                }}
                transition={{
                  duration: 0.2,
                  repeat: Infinity,
                  delay: i * 0.05,
                }}
              />
            ))}
          </div>
        )}

        {/* Quality indicator */}
        {callState === 'connected' && (
          <div className="flex items-center gap-1 mb-8">
            <div className="w-1.5 h-3 bg-green-400 rounded-sm" />
            <div className="w-1.5 h-4 bg-green-400 rounded-sm" />
            <div className="w-1.5 h-5 bg-green-400 rounded-sm" />
            <div className="w-1.5 h-6 bg-green-400 rounded-sm" />
            <span className="ml-2 text-white/50 text-xs">Excellent</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="relative z-10 p-6 pb-12">
        {/* Secondary controls */}
        <div className="flex justify-center gap-6 mb-8">
          <motion.button
            onClick={toggleMute}
            className={`p-4 rounded-full ${
              isMuted ? 'bg-red-500' : 'bg-white/20'
            }`}
            whileTap={{ scale: 0.9 }}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </motion.button>

          <motion.button
            onClick={toggleSpeaker}
            className={`p-4 rounded-full ${
              !isSpeakerOn ? 'bg-orange-500' : 'bg-white/20'
            }`}
            whileTap={{ scale: 0.9 }}
          >
            {isSpeakerOn ? (
              <Volume2 className="w-6 h-6 text-white" />
            ) : (
              <VolumeX className="w-6 h-6 text-white" />
            )}
          </motion.button>

          <motion.button
            onClick={toggleHold}
            className={`p-4 rounded-full ${
              isOnHold ? 'bg-orange-500' : 'bg-white/20'
            }`}
            whileTap={{ scale: 0.9 }}
          >
            {isOnHold ? (
              <Play className="w-6 h-6 text-white" />
            ) : (
              <Pause className="w-6 h-6 text-white" />
            )}
          </motion.button>

          <motion.button
            className="p-4 rounded-full bg-white/20"
            whileTap={{ scale: 0.9 }}
          >
            <UserPlus className="w-6 h-6 text-white" />
          </motion.button>
        </div>

        {/* End call button */}
        <div className="flex justify-center">
          <motion.button
            onClick={handleEndCall}
            className="p-5 rounded-full bg-red-500 shadow-lg shadow-red-500/50"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <PhoneOff className="w-8 h-8 text-white" />
          </motion.button>
        </div>

        {/* Control labels */}
        <div className="flex justify-center gap-6 mt-4 text-white/50 text-xs">
          <span className="w-14 text-center">{isMuted ? 'Unmute' : 'Mute'}</span>
          <span className="w-14 text-center">{isSpeakerOn ? 'Speaker' : 'Earpiece'}</span>
          <span className="w-14 text-center">{isOnHold ? 'Resume' : 'Hold'}</span>
          <span className="w-14 text-center">Add</span>
        </div>
      </div>
    </div>
  );
}
