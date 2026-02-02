import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff,
  Volume2, VolumeX, RotateCcw, Maximize, Minimize,
  MoreVertical, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// ICE Servers for WebRTC
const ICE_SERVERS = [
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
  { urls: 'stun:stun.sip.us:3478' },
  { urls: 'stun:stun.softjoys.com' },
  { urls: 'stun:stun.voxgratia.org' }
];

interface Participant {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
}

export default function CallPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const callType = searchParams.get('type') as 'audio' | 'video' || 'audio';
  const isIncoming = searchParams.get('incoming') === 'true';
  
  const [callState, setCallState] = useState<'connecting' | 'ringing' | 'connected' | 'ended'>('connecting');
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  // Load participant info
  useEffect(() => {
    if (!chatId || !user) return;
    
    const loadParticipant = async () => {
      try {
        const { data: chat } = await supabase
          .from('chat_participants')
          .select(`
            user_id,
            profile:profiles (
              id,
              username,
              full_name,
              avatar_url
            )
          `)
          .eq('chat_id', chatId)
          .neq('user_id', user.id)
          .single();
        
        if (chat?.profile) {
          const profile = chat.profile as unknown as Participant;
          setParticipant(profile);
        }
      } catch (error) {
        console.error('Error loading participant:', error);
      }
    };
    
    loadParticipant();
  }, [chatId, user]);

  // Initialize WebRTC
  const initializeCall = useCallback(async () => {
    if (!chatId || !user) return;
    
    try {
      // Get local media stream
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: callType === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 10
      });
      peerConnectionRef.current = pc;
      
      // Add local tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      
      // Handle remote stream
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        remoteStreamRef.current = remoteStream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };
      
      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channelRef.current?.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: {
              candidate: event.candidate.toJSON(),
              from: user.id
            }
          });
        }
      };
      
      // Connection state changes
      pc.onconnectionstatechange = () => {
        switch (pc.connectionState) {
          case 'connected':
            setCallState('connected');
            startCallTimer();
            break;
          case 'disconnected':
          case 'failed':
            endCall();
            break;
        }
      };
      
      // Setup signaling channel
      const channel = supabase.channel(`call:${chatId}`);
      channelRef.current = channel;
      
      channel
        .on('broadcast', { event: 'offer' }, async ({ payload }) => {
          if (payload.from !== user.id) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            channel.send({
              type: 'broadcast',
              event: 'answer',
              payload: { answer, from: user.id }
            });
          }
        })
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          if (payload.from !== user.id) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          }
        })
        .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
          if (payload.from !== user.id && payload.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) {
              console.error('Error adding ICE candidate:', e);
            }
          }
        })
        .on('broadcast', { event: 'call-ended' }, () => {
          endCall();
        })
        .on('broadcast', { event: 'call-answered' }, () => {
          setCallState('connected');
        })
        .subscribe();
      
      // If not incoming, create and send offer
      if (!isIncoming) {
        setCallState('ringing');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        channel.send({
          type: 'broadcast',
          event: 'offer',
          payload: { offer, from: user.id, callType }
        });
        
        // Save call to database
        await supabase.from('calls').insert({
          chat_id: chatId,
          caller_id: user.id,
          callee_id: participant?.id,
          call_type: callType,
          status: 'ringing',
          started_at: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('Error initializing call:', error);
      toast.error('Could not access camera/microphone');
      endCall();
    }
  }, [chatId, user, callType, isIncoming, participant]);

  // Start call when component mounts
  useEffect(() => {
    initializeCall();
    
    return () => {
      cleanupCall();
    };
  }, [initializeCall]);

  // Start call timer
  const startCallTimer = () => {
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  // Toggle speaker
  const toggleSpeaker = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = isSpeakerOn;
      setIsSpeakerOn(!isSpeakerOn);
    }
  };

  // Switch camera
  const switchCamera = async () => {
    if (!localStreamRef.current) return;
    
    try {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const constraints = videoTrack.getConstraints();
        const currentFacing = (constraints as any).facingMode;
        const newFacing = currentFacing === 'user' ? 'environment' : 'user';
        
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newFacing }
        });
        
        const newVideoTrack = newStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current?.getSenders().find(s => s.track?.kind === 'video');
        
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
        
        videoTrack.stop();
        localStreamRef.current.removeTrack(videoTrack);
        localStreamRef.current.addTrack(newVideoTrack);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      }
    } catch (error) {
      console.error('Error switching camera:', error);
    }
  };

  // Cleanup call resources
  const cleanupCall = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
  };

  // End call
  const endCall = async () => {
    setCallState('ended');
    
    // Notify other party
    channelRef.current?.send({
      type: 'broadcast',
      event: 'call-ended',
      payload: { from: user?.id }
    });
    
    // Update call record
    if (chatId && user) {
      await supabase
        .from('calls')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          duration: callDuration
        })
        .eq('chat_id', chatId)
        .eq('caller_id', user.id)
        .eq('status', 'ringing');
    }
    
    cleanupCall();
    
    setTimeout(() => {
      navigate(-1);
    }, 1000);
  };

  // Answer incoming call
  const answerCall = async () => {
    setCallState('connecting');
    
    channelRef.current?.send({
      type: 'broadcast',
      event: 'call-answered',
      payload: { from: user?.id }
    });
    
    // Update call status
    if (chatId) {
      await supabase
        .from('calls')
        .update({ status: 'answered' })
        .eq('chat_id', chatId)
        .eq('status', 'ringing');
    }
  };

  // Reject incoming call
  const rejectCall = async () => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'call-ended',
      payload: { from: user?.id, reason: 'rejected' }
    });
    
    if (chatId) {
      await supabase
        .from('calls')
        .update({ status: 'rejected', ended_at: new Date().toISOString() })
        .eq('chat_id', chatId)
        .eq('status', 'ringing');
    }
    
    cleanupCall();
    navigate(-1);
  };

  // Toggle fullscreen
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  // Hide controls after 3 seconds
  useEffect(() => {
    if (callState === 'connected') {
      const timeout = setTimeout(() => setShowControls(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [callState, showControls]);

  return (
    <div 
      className="h-screen bg-gray-900 relative overflow-hidden"
      onClick={() => setShowControls(true)}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 via-gray-900 to-gray-900" />
      
      {/* Remote video (full screen) */}
      {callType === 'video' && callState === 'connected' && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      
      {/* Connecting/Ringing state */}
      {(callState === 'connecting' || callState === 'ringing') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            {/* Avatar with pulse */}
            <div className="relative mb-8">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 bg-purple-500/30 rounded-full"
              />
              <motion.div
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ repeat: Infinity, duration: 2, delay: 0.3 }}
                className="absolute inset-0 bg-purple-500/20 rounded-full"
              />
              {participant?.avatar_url ? (
                <img
                  src={participant.avatar_url}
                  alt={participant.full_name}
                  className="w-32 h-32 rounded-full object-cover relative z-10 border-4 border-white/20"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center relative z-10 border-4 border-white/20">
                  <span className="text-4xl text-white font-bold">
                    {participant?.full_name?.[0] || '?'}
                  </span>
                </div>
              )}
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-2">
              {participant?.full_name || 'Unknown'}
            </h2>
            <p className="text-gray-400">
              {callState === 'ringing' 
                ? (isIncoming ? 'Incoming call...' : 'Ringing...')
                : 'Connecting...'
              }
            </p>
            
            {/* Call type indicator */}
            <div className="mt-4 flex items-center justify-center gap-2 text-gray-400">
              {callType === 'video' ? (
                <>
                  <Video className="w-5 h-5" />
                  <span>Video Call</span>
                </>
              ) : (
                <>
                  <Phone className="w-5 h-5" />
                  <span>Audio Call</span>
                </>
              )}
            </div>
          </motion.div>
          
          {/* Incoming call buttons */}
          {isIncoming && callState === 'ringing' && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute bottom-20 left-0 right-0 flex justify-center gap-8"
            >
              <button
                onClick={rejectCall}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg"
              >
                <PhoneOff className="w-8 h-8 text-white" />
              </button>
              <button
                onClick={answerCall}
                className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg"
              >
                <Phone className="w-8 h-8 text-white" />
              </button>
            </motion.div>
          )}
        </div>
      )}
      
      {/* Connected state - Audio only */}
      {callState === 'connected' && callType === 'audio' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="text-center">
            {participant?.avatar_url ? (
              <img
                src={participant.avatar_url}
                alt={participant.full_name}
                className="w-32 h-32 rounded-full object-cover mx-auto mb-6 border-4 border-purple-500"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl text-white font-bold">
                  {participant?.full_name?.[0] || '?'}
                </span>
              </div>
            )}
            
            <h2 className="text-2xl font-bold text-white mb-2">
              {participant?.full_name || 'Unknown'}
            </h2>
            <p className="text-green-400 text-lg">
              {formatDuration(callDuration)}
            </p>
          </div>
        </div>
      )}
      
      {/* Local video (picture-in-picture) */}
      {callType === 'video' && !isVideoOff && (
        <motion.div
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          className="absolute top-20 right-4 z-20"
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-32 h-44 rounded-2xl object-cover border-2 border-white/20 shadow-lg"
          />
        </motion.div>
      )}
      
      {/* Hidden audio element for audio calls */}
      {callType === 'audio' && (
        <audio ref={remoteVideoRef} autoPlay />
      )}
      
      {/* Call ended overlay */}
      {callState === 'ended' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
          <div className="text-center">
            <PhoneOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Call Ended</h2>
            <p className="text-gray-400">{formatDuration(callDuration)}</p>
          </div>
        </div>
      )}
      
      {/* Top bar */}
      <AnimatePresence>
        {showControls && callState !== 'ended' && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="absolute top-0 left-0 right-0 p-4 z-20 bg-gradient-to-b from-black/60 to-transparent"
          >
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-white/10 rounded-full"
              >
                <X className="w-6 h-6 text-white" />
              </button>
              
              {callState === 'connected' && (
                <div className="text-center">
                  <p className="text-white font-medium">{participant?.full_name}</p>
                  <p className="text-green-400 text-sm">{formatDuration(callDuration)}</p>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                {callType === 'video' && (
                  <button
                    onClick={toggleFullScreen}
                    className="p-2 hover:bg-white/10 rounded-full"
                  >
                    {isFullScreen ? (
                      <Minimize className="w-5 h-5 text-white" />
                    ) : (
                      <Maximize className="w-5 h-5 text-white" />
                    )}
                  </button>
                )}
                <button className="p-2 hover:bg-white/10 rounded-full">
                  <MoreVertical className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Bottom controls */}
      <AnimatePresence>
        {showControls && callState !== 'ended' && !isIncoming && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 p-6 z-20 bg-gradient-to-t from-black/60 to-transparent"
          >
            <div className="flex items-center justify-center gap-4">
              {/* Mute button */}
              <button
                onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                  isMuted ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                {isMuted ? (
                  <MicOff className="w-6 h-6 text-white" />
                ) : (
                  <Mic className="w-6 h-6 text-white" />
                )}
              </button>
              
              {/* Video button */}
              {callType === 'video' && (
                <button
                  onClick={toggleVideo}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                    isVideoOff ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  {isVideoOff ? (
                    <VideoOff className="w-6 h-6 text-white" />
                  ) : (
                    <Video className="w-6 h-6 text-white" />
                  )}
                </button>
              )}
              
              {/* End call button */}
              <button
                onClick={endCall}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <PhoneOff className="w-7 h-7 text-white" />
              </button>
              
              {/* Speaker button */}
              <button
                onClick={toggleSpeaker}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                  !isSpeakerOn ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                {isSpeakerOn ? (
                  <Volume2 className="w-6 h-6 text-white" />
                ) : (
                  <VolumeX className="w-6 h-6 text-white" />
                )}
              </button>
              
              {/* Switch camera */}
              {callType === 'video' && (
                <button
                  onClick={switchCamera}
                  className="w-14 h-14 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <RotateCcw className="w-6 h-6 text-white" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
