import { useState, useRef, useEffect } from 'react';
import { X, Send, Pause, Play, Square } from 'lucide-react';

interface VoiceRecorderProps {
  onSend: (blob: Blob) => void;
  onCancel: () => void;
  theme?: 'dark' | 'light';
}

export function VoiceRecorder({ onSend, onCancel, theme = 'dark' }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      onCancel();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
  };

  const handleSend = () => {
    if (audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      onSend(audioBlob);
    }
    cleanup();
  };

  const handleCancel = () => {
    cleanup();
    onCancel();
  };

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} p-4 z-50`}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          {/* Cancel Button */}
          <button
            onClick={handleCancel}
            className={`p-3 rounded-full ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`}
          >
            <X className={`h-5 w-5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} />
          </button>

          {/* Recording Indicator */}
          <div className="flex-1 flex items-center gap-3">
            {isRecording && !isPaused && (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                  Recording
                </span>
              </div>
            )}
            {isPaused && (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>
                  Paused
                </span>
              </div>
            )}
            
            {/* Duration */}
            <span className={`text-lg font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {formatTime(duration)}
            </span>

            {/* Waveform Animation */}
            {isRecording && !isPaused && (
              <div className="flex items-center gap-1 h-8">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-purple-500 rounded-full animate-pulse"
                    style={{
                      height: `${Math.random() * 100}%`,
                      animationDelay: `${i * 50}ms`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-2">
            {isRecording && !isPaused && (
              <button
                onClick={pauseRecording}
                className={`p-3 rounded-full ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`}
              >
                <Pause className={`h-5 w-5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} />
              </button>
            )}
            {isPaused && (
              <button
                onClick={resumeRecording}
                className={`p-3 rounded-full ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`}
              >
                <Play className={`h-5 w-5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} />
              </button>
            )}
            {isRecording && (
              <button
                onClick={stopRecording}
                className="p-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
              >
                <Square className="h-5 w-5 text-white" />
              </button>
            )}
            {!isRecording && audioUrl && (
              <button
                onClick={handleSend}
                className="p-3 rounded-full bg-purple-500 hover:bg-purple-600 transition-colors"
              >
                <Send className="h-5 w-5 text-white" />
              </button>
            )}
          </div>
        </div>

        {/* Instructions */}
        <p className={`text-xs text-center mt-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          {isRecording && !isPaused && 'Tap pause to pause, tap stop to finish'}
          {isPaused && 'Tap play to resume recording'}
          {!isRecording && 'Tap send to share your voice message'}
        </p>
      </div>
    </div>
  );
}
