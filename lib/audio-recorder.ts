/**
 * Audio recording utilities using MediaRecorder API
 */

export interface RecordingState {
  isRecording: boolean;
  audioBlob: Blob | null;
  error: string | null;
}

/**
 * Request microphone access and create MediaRecorder
 */
export async function createAudioRecorder(): Promise<MediaRecorder> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        // Note: sampleRate constraint may not be supported in all browsers
        // Browser will use optimal rate, we optimize via bitrate instead
      },
    });

    // Prefer Opus codec in WebM for better compression (smaller files = faster upload)
    // Fallback to standard WebM or MP4
    let mimeType = 'audio/webm'; // default
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus'; // Best compression
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      mimeType = 'audio/webm';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    }

    // Optimize for speed: Lower bitrate for faster upload (32 kbps is sufficient for speech recognition)
    // This reduces file size by ~75%, significantly speeding up upload time
    const recorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: 32000, // 32 kbps - sufficient for speech recognition, much smaller files = faster upload
    });

    return recorder;
  } catch (error) {
    throw new Error(
      `Failed to access microphone: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Record audio for a specified duration
 */
export async function recordAudio(
  recorder: MediaRecorder,
  durationMs: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType });
      resolve(blob);
    };

    recorder.onerror = (event) => {
      reject(new Error('Recording error occurred'));
    };

    recorder.start();
    
    // Stop recording after duration
    setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    }, durationMs);
  });
}

/**
 * Stop recording and return the audio blob
 */
export function stopRecording(recorder: MediaRecorder): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType });
      resolve(blob);
    };

    recorder.onerror = (event) => {
      reject(new Error('Recording error occurred'));
    };

    if (recorder.state === 'recording') {
      recorder.stop();
    } else {
      reject(new Error('Recorder is not recording'));
    }
  });
}

/**
 * Clean up MediaRecorder and stop all tracks
 */
export function cleanupRecorder(recorder: MediaRecorder): void {
  if (recorder.state !== 'inactive') {
    recorder.stop();
  }
  
  // Stop all tracks
  recorder.stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

