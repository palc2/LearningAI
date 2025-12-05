'use client';

import { useState, useEffect, useRef } from 'react';
import { createAudioRecorder, cleanupRecorder } from '@/lib/audio-recorder';
import { speakText, stopSpeech } from '@/lib/tts';
// MediaRecorder is a browser API, no need to import types

type SessionState =
  | 'idle'
  | 'recording-mom'
  | 'processing-mom'
  | 'playing-english'
  | 'recording-partner'
  | 'processing-partner'
  | 'playing-chinese'
  | 'completed';

interface SessionRecorderProps {
  householdId: string;
  initiatedByUserId: string;
  onSessionComplete?: () => void;
}

export default function SessionRecorder({
  householdId,
  initiatedByUserId,
  onSessionComplete,
}: SessionRecorderProps) {
  const [state, setState] = useState<SessionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const countdownRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        cleanupRecorder(recorderRef.current);
      }
      stopSpeech();
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, []);

  const startSession = async () => {
    try {
      setError(null);
      
      console.log('Starting session with:', { householdId, initiatedByUserId });
      
      // Start session
      const response = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId, initiatedByUserId }),
      }).catch((fetchError) => {
        // Network error - provide more details
        console.error('Fetch error:', fetchError);
        throw new Error(
          `Network error: ${fetchError.message}. ` +
          `Check browser console and server logs for details.`
        );
      });

      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: Failed to start session`;
        try {
          const errorData = await response.json();
          console.error('Error response:', errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
          if (errorData.details) {
            console.error('Server error details:', errorData.details);
          }
        } catch (e) {
          // If JSON parsing fails, try to get text
          const text = await response.text().catch(() => '');
          console.error('Non-JSON error response:', text);
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      
      // Initialize recorder and start recording immediately
      const recorder = await createAudioRecorder();
      recorderRef.current = recorder;
      audioChunksRef.current = [];
      
      // Set up data collection handlers
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Start recording
      recorder.start();
      setState('recording-mom');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    }
  };

  const handleMomRecording = async () => {
    if (!recorderRef.current || !sessionId) return;

    try {
      setState('processing-mom');
      
      // Stop recording and collect audio
      const recorder = recorderRef.current;
      const audioBlob = await new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
          resolve(blob);
        };
        recorder.onerror = () => {
          reject(new Error('Recording error occurred'));
        };
        
        if (recorder.state === 'recording') {
          recorder.stop();
        } else {
          // If already stopped, create blob from existing chunks
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
          resolve(blob);
        }
      });
      
      cleanupRecorder(recorderRef.current);
      audioChunksRef.current = [];

      // Upload and process mom's turn
      const formData = new FormData();
      formData.append('file', audioBlob);

      // Use keep-alive for faster connection reuse
      const response = await fetch(`/api/sessions/${sessionId}/mom-turn`, {
        method: 'POST',
        body: formData,
        keepalive: true, // Keep connection alive for reuse
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to process mom turn: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Start preparing partner recorder while TTS plays (parallel operation for speed)
      const partnerRecorderPromise = createAudioRecorder();
      
      // Play English translation
      setState('playing-english');
      
      // Wait for both TTS and recorder to be ready in parallel
      const [partnerRecorder] = await Promise.all([
        partnerRecorderPromise,
        speakText(data.translatedText, { language: 'en-US' })
      ]);
      
      // Immediately start partner recording (no delay)
      recorderRef.current = partnerRecorder;
      audioChunksRef.current = [];
      
      // Set up data collection handlers
      partnerRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Start recording immediately after TTS finishes
      partnerRecorder.start();
      setState('recording-partner');
      
      // Auto-stop after 10 seconds with countdown
      let remainingSeconds = 10;
      setCountdown(remainingSeconds);
      
      const countdownInterval = setInterval(() => {
        remainingSeconds--;
        if (remainingSeconds > 0) {
          setCountdown(remainingSeconds);
        } else {
          clearInterval(countdownInterval);
          countdownIntervalRef.current = null;
          setCountdown(null);
        }
      }, 1000);
      
      countdownIntervalRef.current = countdownInterval;
      
      countdownRef.current = window.setTimeout(() => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setCountdown(null);
        if (recorderRef.current && recorderRef.current.state === 'recording') {
          stopPartnerRecording();
        }
      }, 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process recording');
      setState('idle');
    }
  };


  const stopPartnerRecording = async () => {
    if (!recorderRef.current || !sessionId) return;

    // Clear the auto-stop timeout and countdown interval if they exist
    if (countdownRef.current) {
      clearTimeout(countdownRef.current);
      countdownRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);

    try {
      setState('processing-partner');
      
      // Stop recording and collect audio
      const recorder = recorderRef.current;
      const audioBlob = await new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
          resolve(blob);
        };
        recorder.onerror = () => {
          reject(new Error('Recording error occurred'));
        };
        
        if (recorder.state === 'recording') {
          recorder.stop();
        } else {
          // If already stopped, create blob from existing chunks
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
          resolve(blob);
        }
      });
      
      cleanupRecorder(recorderRef.current);
      audioChunksRef.current = [];

      // Upload and process partner's turn
      const formData = new FormData();
      formData.append('file', audioBlob);

      // Use keep-alive for faster connection reuse
      const response = await fetch(`/api/sessions/${sessionId}/reply-turn`, {
        method: 'POST',
        body: formData,
        keepalive: true, // Keep connection alive for reuse
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to process partner turn: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Play Chinese translation
      setState('playing-chinese');
      await speakText(data.translatedText, { language: 'zh-CN' });
      
      // Tag the conversation in background (non-blocking)
      fetch(`/api/sessions/${sessionId}/tag`, {
        method: 'POST',
      }).catch(err => {
        console.error('Background tagging failed (non-critical):', err);
      });
      
      setState('completed');
      onSessionComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process partner recording');
      setState('idle');
    }
  };

  const reset = () => {
    stopSpeech();
    if (recorderRef.current) {
      cleanupRecorder(recorderRef.current);
      recorderRef.current = null;
    }
    if (countdownRef.current) {
      clearTimeout(countdownRef.current);
      countdownRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
    setState('idle');
    setSessionId(null);
    setError(null);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full p-2 sm:p-4">
      <div className="w-full max-w-md space-y-3 sm:space-y-4 md:space-y-6">
        {/* Status Display */}
        <div className="text-center">
          {state === 'idle' && (
            <p className="text-xl sm:text-2xl md:text-3xl text-gray-600 mb-4 font-medium">
              <span className="block">开始对话</span>
              <span className="block text-base sm:text-lg md:text-xl text-gray-500 mt-2 font-normal">Ready to speak?</span>
            </p>
          )}
          {state === 'recording-mom' && (
            <div className="space-y-2">
              <p className="text-2xl sm:text-3xl md:text-4xl font-semibold text-red-600">
                <span className="block">正在录音...</span>
                <span className="block text-xl sm:text-2xl text-red-500 mt-1">Recording...</span>
              </p>
              <div className="flex justify-center space-x-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-8 bg-red-500 rounded animate-pulse"
                    style={{
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: '0.6s',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          {state === 'processing-mom' && (
            <p className="text-xl sm:text-2xl md:text-3xl text-blue-600">
              <span className="block">处理中...</span>
              <span className="block text-lg sm:text-xl text-blue-500 mt-1">Processing...</span>
            </p>
          )}
          {state === 'playing-english' && (
            <p className="text-xl sm:text-2xl md:text-3xl text-green-600">
              <span className="block">正在播放英文翻译...</span>
              <span className="block text-lg sm:text-xl text-green-500 mt-1">Playing English translation...</span>
            </p>
          )}
          {state === 'recording-partner' && (
            <div className="space-y-2">
              <p className="text-2xl sm:text-3xl md:text-4xl font-semibold text-blue-600">
                <span className="block">对方正在录音...</span>
                <span className="block text-xl sm:text-2xl text-blue-500 mt-1">Partner Recording...</span>
              </p>
              {countdown !== null && (
                <p className="text-base sm:text-lg text-gray-600">
                  <span className="block">{countdown} 秒后自动停止</span>
                  <span className="block text-gray-500 mt-1">Auto-stopping in {countdown} second{countdown !== 1 ? 's' : ''}</span>
                </p>
              )}
              <div className="flex justify-center space-x-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-8 bg-blue-500 rounded animate-pulse"
                    style={{
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: '0.6s',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          {state === 'processing-partner' && (
            <p className="text-xl sm:text-2xl md:text-3xl text-blue-600">
              <span className="block">处理中...</span>
              <span className="block text-lg sm:text-xl text-blue-500 mt-1">Processing...</span>
            </p>
          )}
          {state === 'playing-chinese' && (
            <p className="text-xl sm:text-2xl md:text-3xl text-green-600">
              <span className="block">正在播放中文翻译...</span>
              <span className="block text-lg sm:text-xl text-green-500 mt-1">Playing Chinese translation...</span>
            </p>
          )}
          {state === 'completed' && (
            <p className="text-xl sm:text-2xl md:text-3xl text-green-600 font-semibold">
              <span className="block">会话已保存！</span>
              <span className="block text-lg sm:text-xl text-green-500 mt-1 font-normal">Session Saved!</span>
            </p>
          )}
        </div>

        {/* Main Button */}
        {state === 'idle' && (
          <button
            onClick={startSession}
            className="w-full py-6 sm:py-8 md:py-10 px-4 sm:px-6 bg-green-600 hover:bg-green-700 text-white text-2xl sm:text-3xl md:text-4xl font-bold rounded-lg shadow-lg transition-colors"
          >
            <span className="block">说中文</span>
            <span className="block text-xl sm:text-2xl md:text-3xl mt-1 sm:mt-2">Speak Chinese</span>
          </button>
        )}

        {state === 'recording-mom' && (
          <button
            onClick={handleMomRecording}
            className="w-full py-6 sm:py-8 md:py-10 px-4 sm:px-6 bg-red-600 hover:bg-red-700 text-white text-2xl sm:text-3xl md:text-4xl font-bold rounded-lg shadow-lg animate-pulse"
          >
            <span className="block">停止录音</span>
            <span className="block text-xl sm:text-2xl md:text-3xl mt-1 sm:mt-2">Stop Recording</span>
          </button>
        )}

        {state === 'recording-partner' && (
          <button
            onClick={stopPartnerRecording}
            className="w-full py-6 sm:py-8 md:py-10 px-4 sm:px-6 bg-blue-600 hover:bg-blue-700 text-white text-2xl sm:text-3xl md:text-4xl font-bold rounded-lg shadow-lg animate-pulse"
          >
            <span className="block">停止录音</span>
            <span className="block text-xl sm:text-2xl md:text-3xl mt-1 sm:mt-2">Stop Recording</span>
          </button>
        )}

        {state === 'completed' && (
          <button
            onClick={reset}
            className="w-full py-6 sm:py-8 md:py-10 px-4 sm:px-6 bg-pink-600 hover:bg-pink-700 text-white text-2xl sm:text-3xl md:text-4xl font-bold rounded-lg shadow-lg"
          >
            <span className="block">开始新会话</span>
            <span className="block text-xl sm:text-2xl md:text-3xl mt-1 sm:mt-2">Start New Session</span>
          </button>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg text-lg sm:text-xl">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

