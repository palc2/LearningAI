/**
 * Text-to-Speech utilities using Web Speech API
 */

export type Language = 'en-US' | 'zh-CN';

interface TTSOptions {
  language: Language;
  pitch?: number;
  rate?: number;
  volume?: number;
}

/**
 * Speak text using Web Speech API
 */
export function speakText(
  text: string,
  options: TTSOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.language;
    utterance.pitch = options.pitch ?? 1;
    utterance.rate = options.rate ?? 1;
    utterance.volume = options.volume ?? 1;

    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = (error) => {
      reject(error);
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Stop any ongoing speech
 */
export function stopSpeech(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Check if speech synthesis is available
 */
export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

