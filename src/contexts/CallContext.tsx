import { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

// 20 STUN servers for reliable connections
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
  { urls: 'stun:stun.rixtelecom.se' },
  { urls: 'stun:stun.schlund.de' },
  { urls: 'stun:stun.stunprotocol.org:3478' },
  { urls: 'stun:stun.voiparound.com' },
  { urls: 'stun:stun.sip.us:3478' },
  { urls: 'stun:stun.sipgate.net' },
  { urls: 'stun:stun.stunprotocol.org' },
  { urls: 'stun:stun.antisip.com' },
];

type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';
type CallType = 'audio' | 'video';

interface IncomingCall {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  type: CallType;
}

interface CallContextType {
  // State
  callState: CallState;
  callType: CallType | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeakerOn: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  incomingCall: IncomingCall | null;
  callDuration: number;
  
  // Actions
  startCall: (userId: string, type: CallType) => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleSpeaker: () => void;
  switchCamera: () => Promise<void>;
}

const CallContext = createContext<CallContextType | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  
  // State
  const [callState, setCallState] = useState<CallState>('idle');
  const [callType, setCallType] = useState<CallType | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  
  // Refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const currentCallIdRef = useRef<string | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for incoming calls
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`calls:${user.id}`)
      .on('broadcast', { event: 'incoming_call' }, async (payload) => {
        const { callId, callerId, callerName, callerAvatar, type } = payload.payload;
        
        setIncomingCall({
          callId,
          callerId,
          callerName,
          callerAvatar,
          type,
        });
        setCallState('ringing');
      })
      .on('broadcast', { event: 'call_offer' }, async (payload) => {
        // Handle SDP offer
        if (peerConnectionRef.current && payload.payload.offer) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(payload.payload.offer)
          );
        }
      })
      .on('broadcast', { event: 'call_answer' }, async (payload) => {
        // Handle SDP answer
        if (peerConnectionRef.current && payload.payload.answer) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(payload.payload.answer)
          );
          setCallState('connected');
          startDurationTimer();
        }
      })
      .on('broadcast', { event: 'ice_candidate' }, async (payload) => {
        // Handle ICE candidates
        if (peerConnectionRef.current && payload.payload.candidate) {
          try {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(payload.payload.candidate)
            );
          } catch (error) {
            console.error('Error adding ICE candidate:', error);
          }
        }
      })
      .on('broadcast', { event: 'call_ended' }, () => {
        cleanup();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const startDurationTimer = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    setCallDuration(0);
    durationIntervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && currentCallIdRef.current) {
        // Send ICE candidate to remote peer
        supabase.channel(`calls:${currentCallIdRef.current}`).send({
          type: 'broadcast',
          event: 'ice_candidate',
          payload: { candidate: event.candidate.toJSON() },
        });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE Connection State:', pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        // Try to reconnect
        pc.restartIce();
      }
    };

    return pc;
  };

  const getLocalMedia = async (type: CallType): Promise<MediaStream> => {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: type === 'video' ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      } : false,
    };

    return await navigator.mediaDevices.getUserMedia(constraints);
  };

  const startCall = async (receiverId: string, type: CallType) => {
    if (!user || !profile) return;

    try {
      setCallType(type);
      setCallState('calling');

      // Get local media
      const stream = await getLocalMedia(type);
      setLocalStream(stream);

      // Create peer connection
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Generate call ID
      const callId = `${user.id}_${receiverId}_${Date.now()}`;
      currentCallIdRef.current = callId;

      // Send call notification to receiver
      await supabase.channel(`calls:${receiverId}`).send({
        type: 'broadcast',
        event: 'incoming_call',
        payload: {
          callId,
          callerId: user.id,
          callerName: profile.full_name,
          callerAvatar: profile.avatar_url,
          type,
        },
      });

      // Send SDP offer
      await supabase.channel(`calls:${receiverId}`).send({
        type: 'broadcast',
        event: 'call_offer',
        payload: { offer: pc.localDescription?.toJSON() },
      });

      // Save call to database
      await supabase.from('calls').insert({
        id: callId,
        caller_id: user.id,
        receiver_id: receiverId,
        type,
        status: 'calling',
      });

    } catch (error) {
      console.error('Error starting call:', error);
      cleanup();
    }
  };

  const answerCall = async () => {
    if (!incomingCall || !user) return;

    try {
      setCallState('connected');
      setCallType(incomingCall.type);
      currentCallIdRef.current = incomingCall.callId;

      // Get local media
      const stream = await getLocalMedia(incomingCall.type);
      setLocalStream(stream);

      // Create peer connection
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer to caller
      await supabase.channel(`calls:${incomingCall.callerId}`).send({
        type: 'broadcast',
        event: 'call_answer',
        payload: { answer: pc.localDescription?.toJSON() },
      });

      // Update call status in database
      await supabase
        .from('calls')
        .update({ status: 'connected', started_at: new Date().toISOString() })
        .eq('id', incomingCall.callId);

      setIncomingCall(null);
      startDurationTimer();

    } catch (error) {
      console.error('Error answering call:', error);
      cleanup();
    }
  };

  const rejectCall = () => {
    if (!incomingCall) return;

    // Notify caller that call was rejected
    supabase.channel(`calls:${incomingCall.callerId}`).send({
      type: 'broadcast',
      event: 'call_ended',
      payload: { reason: 'rejected' },
    });

    // Update database
    supabase
      .from('calls')
      .update({ status: 'rejected', ended_at: new Date().toISOString() })
      .eq('id', incomingCall.callId);

    setIncomingCall(null);
    setCallState('idle');
  };

  const endCall = () => {
    if (currentCallIdRef.current) {
      // Notify other peer
      supabase.channel(`calls:${currentCallIdRef.current}`).send({
        type: 'broadcast',
        event: 'call_ended',
        payload: { reason: 'ended' },
      });

      // Update database
      supabase
        .from('calls')
        .update({ 
          status: 'ended', 
          ended_at: new Date().toISOString(),
          duration: callDuration,
        })
        .eq('id', currentCallIdRef.current);
    }

    cleanup();
  };

  const cleanup = () => {
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Reset state
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setCallType(null);
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoOff(false);
    setIncomingCall(null);
    currentCallIdRef.current = null;
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    // In a real app, you'd switch audio output device here
  };

  const switchCamera = async () => {
    if (!localStream || callType !== 'video') return;

    try {
      const videoTrack = localStream.getVideoTracks()[0];
      const currentFacing = videoTrack.getSettings().facingMode;
      const newFacing = currentFacing === 'user' ? 'environment' : 'user';

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      
      // Replace track in peer connection
      const sender = peerConnectionRef.current?.getSenders().find(
        s => s.track?.kind === 'video'
      );
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }

      // Update local stream
      videoTrack.stop();
      localStream.removeTrack(videoTrack);
      localStream.addTrack(newVideoTrack);
      
    } catch (error) {
      console.error('Error switching camera:', error);
    }
  };

  return (
    <CallContext.Provider value={{
      callState,
      callType,
      isMuted,
      isVideoOff,
      isSpeakerOn,
      localStream,
      remoteStream,
      incomingCall,
      callDuration,
      startCall,
      answerCall,
      rejectCall,
      endCall,
      toggleMute,
      toggleVideo,
      toggleSpeaker,
      switchCamera,
    }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}
