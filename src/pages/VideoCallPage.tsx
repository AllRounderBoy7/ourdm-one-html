import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Phone, Video, Mic, MicOff, VideoOff, Speaker, Volume2, VolumeX, Maximize2, Minimize2, MoreVertical, MonitorUp, PhoneOff, Users, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface CallParticipant {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
}

// 20 STUN/TURN Servers for reliable connectivity
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'stun:stun.services.mozilla.com' },
  { urls: 'stun:stun.voip.blackberry.com:3478' },
  { urls: 'stun:stun.voipbuster.com' },
  { urls: 'stun:stun.voipstunt.com' },
  { urls: 'stun:stun.ekiga.net' },
  { urls: 'stun:stun.ideasip.com' },
  { urls: 'stun:stun.iptel.org' },
  { urls: 'stun:stun.rixtelecom.se' },
  { urls: 'stun:stun.schlund.de' },
  { urls: 'stun:stun.stunprotocol.org:3478' },
  { urls: 'stun:stun.voiparound.com' },
  { urls: 'stun:stun.voxgratia.org' },
  { urls: 'stun:stun.counterpath.com' },
  { urls: 'stun:stun.xten.com' }
];

export default function VideoCallPage() {
  const { callId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Video refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Call state
  const [callState, setCallState] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [otherUser, setOtherUser] = useState<CallParticipant | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');

  // Controls state
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showStats, setShowStats] = useState(false);

  // Network stats
  const [stats, setStats] = useState({
    bitrate: 0,
    packetLoss: 0,
    latency: 0,
    resolution: '0x0'
  });

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState === 'connected') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);

  // Auto-hide controls
  useEffect(() => {
    const timer = setTimeout(() => {
      if (callState === 'connected') {
        setShowControls(false);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [showControls, callState]);

  // Initialize WebRTC
  useEffect(() => {
    if (!user || !callId) return;

    initializeCall();

    return () => {
      cleanup();
    };
  }, [user, callId]);

  // Monitor connection quality
  useEffect(() => {
    const interval = setInterval(() => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.getStats(null).then(stats => {
          stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              const bytesReceived = report.bytesReceived || 0;
              const packetsLost = report.packetsLost || 0;
              const packetsReceived = report.packetsReceived || 1;
              
              // Calculate bitrate (rough estimate)
              const bitrate = Math.round(bytesReceived * 8 / 1024); // kbps
              
              // Calculate packet loss percentage
              const packetLoss = Math.round((packetsLost / packetsReceived) * 100);
              
              setStats(prev => ({
                ...prev,
                bitrate,
                packetLoss
              }));

              // Determine quality
              if (packetLoss > 5 || bitrate < 500) {
                setConnectionQuality('poor');
              } else if (packetLoss > 2 || bitrate < 1000) {
                setConnectionQuality('good');
              } else {
                setConnectionQuality('excellent');
              }
            }
          });
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const initializeCall = async () => {
    try {
      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection with multiple STUN servers
      const peerConnection = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 10
      });

      peerConnectionRef.current = peerConnection;

      // Add local tracks to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setCallState('connected');
          toast.success('Call connected!');
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          // Send ICE candidate to other peer via Supabase
          await supabase.from('call_signals').insert({
            call_id: callId,
            sender_id: user!.id,
            type: 'ice-candidate',
            data: JSON.stringify(event.candidate)
          });
        }
      };

      // Monitor connection state
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log('Connection state:', state);
        
        if (state === 'connected') {
          setCallState('connected');
        } else if (state === 'disconnected' || state === 'failed') {
          toast.error('Connection lost. Reconnecting...');
          // Try to reconnect
          setTimeout(() => initializeCall(), 2000);
        } else if (state === 'closed') {
          endCall();
        }
      };

      // Load call data and other participant
      const { data: call } = await supabase
        .from('calls')
        .select('*, caller:profiles!calls_caller_id_fkey(*), receiver:profiles!calls_receiver_id_fkey(*)')
        .eq('id', callId)
        .single();

      if (call) {
        const other = call.caller_id === user!.id ? call.receiver : call.caller;
        setOtherUser(other);
      }

      // Subscribe to signaling messages
      const channel = supabase
        .channel(`call-${callId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `call_id=eq.${callId}`
        }, async (payload) => {
          const signal = payload.new;
          if (signal.sender_id !== user!.id) {
            handleSignal(signal);
          }
        })
        .subscribe();

      // Create or join call
      const { data: existingSignal } = await supabase
        .from('call_signals')
        .select('*')
        .eq('call_id', callId)
        .eq('type', 'offer')
        .single();

      if (!existingSignal) {
        // Create offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        await supabase.from('call_signals').insert({
          call_id: callId,
          sender_id: user!.id,
          type: 'offer',
          data: JSON.stringify(offer)
        });
      } else {
        // Answer existing offer
        const offer = JSON.parse(existingSignal.data);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        await supabase.from('call_signals').insert({
          call_id: callId,
          sender_id: user!.id,
          type: 'answer',
          data: JSON.stringify(answer)
        });
      }

    } catch (error) {
      console.error('Error initializing call:', error);
      toast.error('Failed to start call. Please check camera/microphone permissions.');
      setTimeout(() => navigate('/'), 3000);
    }
  };

  const handleSignal = async (signal: any) => {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection) return;

    try {
      if (signal.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(signal.data)));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        await supabase.from('call_signals').insert({
          call_id: callId,
          sender_id: user!.id,
          type: 'answer',
          data: JSON.stringify(answer)
        });
      } else if (signal.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(signal.data)));
      } else if (signal.type === 'ice-candidate') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(signal.data)));
      }
    } catch (error) {
      console.error('Error handling signal:', error);
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
        toast.success(audioTrack.enabled ? 'Microphone on' : 'Microphone muted');
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        toast.success(videoTrack.enabled ? 'Camera on' : 'Camera off');
      }
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = isSpeakerOn;
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = peerConnectionRef.current?.getSenders().find(s => s.track?.kind === 'video');
      
      if (sender) {
        sender.replaceTrack(screenTrack);
        setIsScreenSharing(true);
        toast.success('Screen sharing started');

        screenTrack.onended = () => {
          stopScreenShare();
        };
      }
    } catch (error) {
      console.error('Error sharing screen:', error);
      toast.error('Failed to share screen');
    }
  };

  const stopScreenShare = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      const sender = peerConnectionRef.current?.getSenders().find(s => s.track?.kind === 'video');
      
      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack);
        setIsScreenSharing(false);
        toast.success('Screen sharing stopped');
      }
    }
  };

  const endCall = async () => {
    cleanup();
    
    // Update call status in database
    if (callId) {
      await supabase
        .from('calls')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          duration: callDuration
        })
        .eq('id', callId);
    }

    setCallState('ended');
    toast.success('Call ended');
    setTimeout(() => navigate('/'), 1000);
  };

  const cleanup = () => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getQualityColor = () => {
    switch (connectionQuality) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div 
      className="relative w-full h-screen bg-black overflow-hidden"
      onMouseMove={() => setShowControls(true)}
      onClick={() => setShowControls(true)}
    >
      {/* Remote Video (Full Screen) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Local Video (Picture-in-Picture) */}
      <motion.div
        className="absolute top-4 right-4 w-32 h-40 sm:w-40 sm:h-48 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-gray-900"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover mirror"
        />
        {isVideoOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white text-2xl font-bold">
              {user?.email?.[0]?.toUpperCase() || 'Y'}
            </div>
          </div>
        )}
      </motion.div>

      {/* Top Info Bar */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 sm:p-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white font-bold">
                  {otherUser?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm sm:text-base">
                    {otherUser?.full_name || 'Connecting...'}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${callState === 'connected' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
                    <p className={`text-xs sm:text-sm ${getQualityColor()}`}>
                      {callState === 'connected' ? formatDuration(callDuration) : 'Connecting...'}
                    </p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => setShowStats(!showStats)}
                className="p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
              >
                <MoreVertical className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Network Stats */}
            <AnimatePresence>
              {showStats && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-3 rounded-xl bg-black/40 backdrop-blur-md"
                >
                  <div className="grid grid-cols-2 gap-2 text-xs text-white/80">
                    <div>Quality: <span className={getQualityColor()}>{connectionQuality}</span></div>
                    <div>Bitrate: {stats.bitrate} kbps</div>
                    <div>Packet Loss: {stats.packetLoss}%</div>
                    <div>Resolution: {stats.resolution}</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 sm:p-8"
          >
            <div className="flex items-center justify-center gap-3 sm:gap-6">
              {/* Mic Toggle */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleAudio}
                className={`p-4 sm:p-5 rounded-full transition-all ${
                  isAudioMuted
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-white/20 hover:bg-white/30 backdrop-blur-md'
                }`}
              >
                {isAudioMuted ? (
                  <MicOff className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                ) : (
                  <Mic className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                )}
              </motion.button>

              {/* Video Toggle */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleVideo}
                className={`p-4 sm:p-5 rounded-full transition-all ${
                  isVideoOff
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-white/20 hover:bg-white/30 backdrop-blur-md'
                }`}
              >
                {isVideoOff ? (
                  <VideoOff className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                ) : (
                  <Video className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                )}
              </motion.button>

              {/* End Call */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={endCall}
                className="p-5 sm:p-6 rounded-full bg-red-500 hover:bg-red-600 transition-all shadow-lg shadow-red-500/50"
              >
                <PhoneOff className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </motion.button>

              {/* Speaker Toggle */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleSpeaker}
                className="p-4 sm:p-5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md transition-all"
              >
                {isSpeakerOn ? (
                  <Volume2 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                ) : (
                  <VolumeX className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                )}
              </motion.button>

              {/* Screen Share */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                className={`p-4 sm:p-5 rounded-full transition-all ${
                  isScreenSharing
                    ? 'bg-purple-500 hover:bg-purple-600'
                    : 'bg-white/20 hover:bg-white/30 backdrop-blur-md'
                }`}
              >
                <MonitorUp className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </motion.button>

              {/* Fullscreen */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleFullscreen}
                className="hidden sm:block p-4 sm:p-5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md transition-all"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                ) : (
                  <Maximize2 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connecting Overlay */}
      <AnimatePresence>
        {callState === 'connecting' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center mb-6 animate-pulse">
              <Video className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <p className="text-white text-xl sm:text-2xl font-semibold mb-2">Connecting...</p>
            <p className="text-white/60 text-sm sm:text-base">Please wait while we connect you</p>
            <div className="mt-6 flex gap-2">
              <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}
