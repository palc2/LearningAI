'use client';

import { useState, useEffect } from 'react';
import { speakText } from '@/lib/tts';
import Link from 'next/link';

interface VocabularyItem {
  word: string;
  translation: string;
  count: number;
}

interface Phrase {
  phrase: string;
  translation: string;
  count: number;
}

interface VocabularyData {
  date: string;
  turnCount: number;
  nouns: VocabularyItem[];
  verbs: VocabularyItem[];
  phrases: Phrase[];
  timezone?: string;
}

// TODO: These should come from user context/auth in production
const DEFAULT_HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000000';

// Cache key for sessionStorage
const VOCABULARY_CACHE_KEY = 'vocabulary_cache';

// Helper functions for sessionStorage cache
const getCachedVocabulary = (date: string): VocabularyData | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cacheStr = sessionStorage.getItem(VOCABULARY_CACHE_KEY);
    if (!cacheStr) return null;
    const cache = JSON.parse(cacheStr);
    return cache[date] || null;
  } catch {
    return null;
  }
};

const setCachedVocabulary = (date: string, data: VocabularyData) => {
  if (typeof window === 'undefined') return;
  try {
    const cacheStr = sessionStorage.getItem(VOCABULARY_CACHE_KEY);
    const cache = cacheStr ? JSON.parse(cacheStr) : {};
    cache[date] = data;
    sessionStorage.setItem(VOCABULARY_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Failed to cache vocabulary data:', e);
  }
};

export default function VocabularyPage() {
  // Initialize date to today (like Daily Review)
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<VocabularyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingItem, setPlayingItem] = useState<string | null>(null);

  // Load cached data on mount and when date changes
  useEffect(() => {
    const cachedData = getCachedVocabulary(date);
    if (cachedData) {
      setData(cachedData);
      setError(null);
    } else {
      // Clear data if no cache for this date
      setData(null);
      setError(null);
    }
  }, [date]); // Run when date changes

  const fetchVocabulary = async (targetDate: string, forceRefresh: boolean = false) => {
    // Check sessionStorage cache first unless forcing refresh
    if (!forceRefresh) {
      const cachedData = getCachedVocabulary(targetDate);
      if (cachedData) {
        setData(cachedData);
        setError(null);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/vocabulary/daily?date=${targetDate}&householdId=${DEFAULT_HOUSEHOLD_ID}`);
      const text = await response.text();
      
      if (!response.ok) {
        try {
          const errorData = JSON.parse(text);
          const errorMsg = errorData.error || 'Failed to fetch vocabulary';
          const details = errorData.details ? `\n\nDetails: ${errorData.details}` : '';
          const type = errorData.type ? `\n\nType: ${errorData.type}` : '';
          throw new Error(`${errorMsg}${details}${type}`);
        } catch (parseError) {
          throw new Error(`Server error: ${response.status} ${response.statusText}\n\nResponse: ${text.substring(0, 500)}`);
        }
      }
      
      try {
        const result = JSON.parse(text);
        // Only set data if we have valid vocabulary data
        if (result && (result.nouns || result.verbs || result.phrases || result.turnCount === 0)) {
          setData(result);
          // Cache the result in sessionStorage
          setCachedVocabulary(targetDate, result);
          setError(null); // Clear any previous errors if data loads successfully
          // Play success sound effect only on new fetches (not cached)
          if (forceRefresh || !getCachedVocabulary(targetDate)) {
            playSuccessSound();
          }
        } else {
          throw new Error('Invalid response: missing vocabulary data');
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError, 'Response text:', text);
        throw new Error('Invalid response from server. Please try again.');
      }
    } catch (err) {
      console.error('Error fetching vocabulary:', err);
      console.error('Error details:', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        error: err
      });
      // Only set error if we don't have data (don't overwrite successful loads)
      if (!data) {
        setError(err instanceof Error ? err.message : 'Failed to load vocabulary');
      } else {
        // If we have data, just log the error but don't show it to user
        console.warn('Error occurred but vocabulary data is available, hiding error from UI');
      }
      // Don't clear data if we already have it
      if (!data) {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle date change - check cache first, only fetch if not cached
  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    // Check if we have cached data for this date
    const cachedData = getCachedVocabulary(newDate);
    if (cachedData) {
      setData(cachedData);
      setError(null);
      return;
    }
    // If not cached, don't auto-fetch - user must click Generate
    setData(null);
    setError(null);
  };

  const handlePlayAudio = async (text: string, itemId: string) => {
    try {
      setPlayingItem(itemId);
      await speakText(text, { language: 'en-US' });
    } catch (err) {
      console.error('Error playing audio:', err);
    } finally {
      setPlayingItem(null);
    }
  };

  // Play success sound effect when vocabulary loads
  const playSuccessSound = () => {
    try {
      // Create a simple "applause" or "success" sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create a pleasant chime/applause-like sound
      // Multiple tones that sound like applause/clapping
      const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5 - a pleasant chord
      const duration = 0.3; // 300ms
      const gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);
      gainNode.gain.value = 0.3; // Not too loud
      
      frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = freq;
        oscillator.connect(gainNode);
        
        // Stagger the start times slightly for a more natural sound
        oscillator.start(audioContext.currentTime + index * 0.05);
        oscillator.stop(audioContext.currentTime + index * 0.05 + duration);
      });
      
      // Clean up after sound finishes
      setTimeout(() => {
        audioContext.close().catch(() => {
          // Ignore errors when closing
        });
      }, duration * 1000 + 200);
    } catch (err) {
      // Fallback: use a simple beep if Web Audio API fails
      console.warn('Could not play success sound:', err);
      try {
        // Try using a simple beep via Audio element
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi77+efTRAMUKfj8LZjHAY4kdfyzHksBSR3x/DdkEAKFF206euoVRQKRp/g8r5sIQUrgc7y2Yk2CBlou+/nn00QDFCn4/C2YxwGOJHX8sx5LAUkd8fw3ZBAC');
        audio.volume = 0.3;
        audio.play().catch(() => {
          // Ignore play errors
        });
      } catch (fallbackErr) {
        // If all else fails, just log it
        console.warn('Could not play fallback sound:', fallbackErr);
      }
    }
  };

  const formatDate = (dateStr: string, timezone?: string) => {
    // Parse the date string (YYYY-MM-DD) and format it
    // Since dateStr is already a local date string, we just need to format it nicely
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    // Use the timezone from the API if available, otherwise use browser's timezone
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: timezone || undefined,
    };
    
    return date.toLocaleDateString('en-US', options);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-4xl">
        <div className="text-center mb-4 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            <span className="block">每日词汇</span>
            <span className="block text-2xl sm:text-3xl text-gray-700 mt-1">Daily Vocabulary</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600">
            <span className="block">最常用的单词和短语</span>
            <span className="block text-sm sm:text-base text-gray-500 mt-1">Most frequently used words and phrases</span>
          </p>
        </div>

        <div className="mb-4 sm:mb-6 flex justify-center">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <label htmlFor="date-input" className="text-gray-700 font-medium text-base sm:text-lg">
              <span className="block sm:inline">日期：</span>
              <span className="block sm:inline text-sm sm:ml-2 text-gray-500">Date:</span>
            </label>
            <input
              id="date-input"
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base sm:text-lg"
            />
            <button
              onClick={() => fetchVocabulary(date, true)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-base sm:text-lg"
            >
              {loading ? (
                <>
                  <span className="block sm:inline">生成中...</span>
                  <span className="block sm:inline text-xs sm:ml-2">Generating...</span>
                </>
              ) : getCachedVocabulary(date) ? (
                <>
                  <span className="block sm:inline">重新生成</span>
                  <span className="block sm:inline text-xs sm:ml-2">Regenerate</span>
                </>
              ) : (
                <>
                  <span className="block sm:inline">生成</span>
                  <span className="block sm:inline text-xs sm:ml-2">Generate</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mb-4 sm:mb-6 text-center">
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors text-sm sm:text-base"
          >
            <span className="block sm:inline">← 返回首页</span>
            <span className="block sm:inline text-sm sm:ml-2">Back to Home</span>
          </Link>
        </div>

        {error && !data && (
          <div className="mb-4 sm:mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <div className="font-semibold mb-2 text-sm sm:text-base">
              <span className="block">Error:</span>
              <span className="block text-xs text-red-600 mt-1">错误：</span>
            </div>
            <div className="whitespace-pre-wrap text-xs sm:text-sm">{error}</div>
            <div className="mt-2 text-xs text-red-600">
              <span className="block">Check the browser console (F12) and server logs for more details.</span>
              <span className="block mt-1">请检查浏览器控制台（F12）和服务器日志以获取更多详细信息。</span>
            </div>
          </div>
        )}

        {loading && !data && (
          <div className="text-center py-8 sm:py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-sm sm:text-base text-gray-600">
              <span className="block">Analyzing conversation logs...</span>
              <span className="block text-xs text-gray-500 mt-1">正在分析对话记录...</span>
            </p>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-6 sm:space-y-8">
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-2">
                {formatDate(data.date, data.timezone)}
              </h2>
              <p className="text-base sm:text-lg text-gray-600">
                <span className="block">{data.turnCount} conversation turn{data.turnCount !== 1 ? 's' : ''} analyzed</span>
                <span className="block text-sm text-gray-500 mt-1">分析了 {data.turnCount} 个对话轮次</span>
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
                <span className="block">Top 5 Nouns</span>
                <span className="block text-xl sm:text-2xl text-gray-700 mt-1">前5个名词</span>
              </h2>
              {data.nouns.length > 0 ? (
                <div className="space-y-4">
                  {data.nouns.map((noun, index) => (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3 sm:p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors gap-2"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold text-blue-600">
                            {index + 1}
                          </span>
                          <div>
                            <div className="text-lg font-semibold text-gray-900">
                              {noun.word}
                            </div>
                            <div className="text-md text-gray-600">
                              {noun.translation}
                            </div>
                            <div className="text-xs sm:text-sm text-gray-500 mt-1">
                              <span className="block sm:inline">Used {noun.count} time{noun.count !== 1 ? 's' : ''}</span>
                              <span className="block sm:inline text-xs sm:ml-2">使用了 {noun.count} 次</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handlePlayAudio(noun.word, `noun-${index}`)}
                        disabled={playingItem === `noun-${index}`}
                        className="w-full sm:w-auto ml-0 sm:ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        {playingItem === `noun-${index}` ? (
                          <>
                            <span className="inline-block animate-spin">⏸</span>
                            <span className="block sm:inline">Playing...</span>
                            <span className="block sm:inline text-xs sm:ml-2">播放中...</span>
                          </>
                        ) : (
                          <>
                            <span className="block sm:inline">🔊 Play</span>
                            <span className="block sm:inline text-xs sm:ml-2">播放</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm sm:text-base text-gray-500">
                  <span className="block">No nouns found</span>
                  <span className="block text-xs text-gray-400 mt-1">未找到名词</span>
                </p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
                <span className="block">Top 5 Verbs</span>
                <span className="block text-xl sm:text-2xl text-gray-700 mt-1">前5个动词</span>
              </h2>
              {data.verbs.length > 0 ? (
                <div className="space-y-4">
                  {data.verbs.map((verb, index) => (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3 sm:p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors gap-2"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold text-green-600">
                            {index + 1}
                          </span>
                          <div>
                            <div className="text-lg font-semibold text-gray-900">
                              {verb.word}
                            </div>
                            <div className="text-md text-gray-600">
                              {verb.translation}
                            </div>
                            <div className="text-xs sm:text-sm text-gray-500 mt-1">
                              <span className="block sm:inline">Used {verb.count} time{verb.count !== 1 ? 's' : ''}</span>
                              <span className="block sm:inline text-xs sm:ml-2">使用了 {verb.count} 次</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handlePlayAudio(verb.word, `verb-${index}`)}
                        disabled={playingItem === `verb-${index}`}
                        className="w-full sm:w-auto ml-0 sm:ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        {playingItem === `verb-${index}` ? (
                          <>
                            <span className="inline-block animate-spin">⏸</span>
                            <span className="block sm:inline">Playing...</span>
                            <span className="block sm:inline text-xs sm:ml-2">播放中...</span>
                          </>
                        ) : (
                          <>
                            <span className="block sm:inline">🔊 Play</span>
                            <span className="block sm:inline text-xs sm:ml-2">播放</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm sm:text-base text-gray-500">
                  <span className="block">No verbs found</span>
                  <span className="block text-xs text-gray-400 mt-1">未找到动词</span>
                </p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
                <span className="block">Top 3 Phrases</span>
                <span className="block text-xl sm:text-2xl text-gray-700 mt-1">前3个短语</span>
              </h2>
              {data.phrases && data.phrases.length > 0 ? (
                <div className="space-y-4">
                  {data.phrases.map((phrase, index) => (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3 sm:p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors gap-2"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold text-purple-600">
                            {index + 1}
                          </span>
                          <div>
                            <div className="text-lg font-semibold text-gray-900">
                              {phrase.phrase}
                            </div>
                            <div className="text-md text-gray-600">
                              {phrase.translation}
                            </div>
                            <div className="text-xs sm:text-sm text-gray-500 mt-1">
                              <span className="block sm:inline">Used {phrase.count} time{phrase.count !== 1 ? 's' : ''}</span>
                              <span className="block sm:inline text-xs sm:ml-2">使用了 {phrase.count} 次</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handlePlayAudio(phrase.phrase, `phrase-${index}`)}
                        disabled={playingItem === `phrase-${index}`}
                        className="w-full sm:w-auto ml-0 sm:ml-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        {playingItem === `phrase-${index}` ? (
                          <>
                            <span className="inline-block animate-spin">⏸</span>
                            <span className="block sm:inline">Playing...</span>
                            <span className="block sm:inline text-xs sm:ml-2">播放中...</span>
                          </>
                        ) : (
                          <>
                            <span className="block sm:inline">🔊 Play</span>
                            <span className="block sm:inline text-xs sm:ml-2">播放</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm sm:text-base text-gray-500">
                  <span className="block">No phrases found</span>
                  <span className="block text-xs text-gray-400 mt-1">未找到短语</span>
                </p>
              )}
            </div>
          </div>
        )}

        {data && data.turnCount === 0 && !loading && (
          <div className="bg-white rounded-lg shadow-md p-6 sm:p-8 text-center">
            <p className="text-base sm:text-lg text-gray-600">
              <span className="block">No conversation turns found for {formatDate(data.date, data.timezone)}</span>
              <span className="block text-sm text-gray-500 mt-1">未找到 {formatDate(data.date, data.timezone)} 的对话轮次</span>
            </p>
            <p className="text-sm sm:text-base text-gray-500 mt-2">
              <span className="block">Try selecting a different date or start a conversation!</span>
              <span className="block text-xs text-gray-400 mt-1">请尝试选择其他日期或开始对话！</span>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

