'use client';

import { useState, useEffect } from 'react';
import { speakText } from '@/lib/tts';
import Link from 'next/link';

// TODO: These should come from user context/auth in production
const DEFAULT_HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000000';

interface DailyPhrase {
  id: string;
  rank: number;
  phraseEn: string;
  phraseZh: string;
  explanationZh?: string;
  exampleEn?: string;
  exampleZh?: string;
  isNewToday: boolean;
}

interface DailySummary {
  id: string;
  summaryDate: string;
  topicSummaryZh: string;
  topicSummaryEn: string;
  whatsNewZh?: string;
  whatsNewEn?: string;
  generatedAt: string;
}

export default function ReviewPage() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [phrases, setPhrases] = useState<DailyPhrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [playingItem, setPlayingItem] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    fetchSummary();
  }, [selectedDate]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `/api/summaries/${DEFAULT_HOUSEHOLD_ID}?date=${selectedDate}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError('No summary available for this date. Generate one first! / 此日期没有摘要。请先生成一个！');
          setSummary(null);
          setPhrases([]);
          return;
        }
        throw new Error('Failed to fetch summary / 加载摘要失败');
      }

      const data = await response.json();
      setSummary(data.summary);
      setPhrases(data.phrases);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary / 加载摘要失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPhrase = async (phrase: string, itemId: string) => {
    try {
      setPlayingItem(itemId);
      await speakText(phrase, { language: 'en-US' });
    } catch (err) {
      console.error('Error playing audio:', err);
    } finally {
      setPlayingItem(null);
    }
  };

  const handleGenerateSummary = async () => {
    try {
      setGenerating(true);
      setError(null);
      
      const response = await fetch('/api/summaries/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: DEFAULT_HOUSEHOLD_ID,
          summaryDate: selectedDate
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate summary / 生成摘要失败' }));
        throw new Error(errorData.error || `Failed to generate summary (${response.status}) / 生成摘要失败`);
      }

      // Refresh the summary after generation
      await fetchSummary();
    } catch (err) {
      let errorMessage = 'Failed to generate summary / 生成摘要失败';
      
      if (err instanceof Error) {
        if (err.message.includes('fetch') || err.message.includes('network') || err.message === 'Failed to fetch') {
          errorMessage = 'Network error: Could not connect to the server. Please check your internet connection and try again. / 网络错误：无法连接到服务器。请检查您的网络连接后重试。';
        } else {
          errorMessage = err.message;
        }
      }
      
      console.error('Summary generation error:', err);
      setError(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            <span className="block">Loading daily review...</span>
            <span className="block text-sm text-gray-500 mt-1">正在加载每日小结...</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-4 sm:mb-8">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 mb-3 sm:mb-4 inline-block text-sm sm:text-base"
          >
            <span className="block sm:inline">← 返回首页</span>
            <span className="block sm:inline text-sm sm:ml-2">Back to Home</span>
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            <span className="block">每日小结</span>
            <span className="block text-2xl sm:text-3xl text-gray-700 mt-1">Daily Learning</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600">
            <span className="block">回顾您的每日对话和关键短语</span>
            <span className="block text-sm sm:text-base text-gray-500 mt-1">Review your daily conversations and key phrases</span>
          </p>
        </div>

        {/* Date Selector */}
        <div className="mb-4 sm:mb-6 flex justify-center">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <label htmlFor="date" className="text-gray-700 font-medium text-base sm:text-lg">
              <span className="block sm:inline">日期：</span>
              <span className="block sm:inline text-sm sm:ml-2 text-gray-500">Date:</span>
            </label>
              <input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-lg"
              />
              <button
                onClick={handleGenerateSummary}
                disabled={generating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-base sm:text-lg"
              >
                {generating ? (
                  <>
                    <span className="block sm:inline">生成中...</span>
                    <span className="block sm:inline text-xs sm:ml-2">Generating...</span>
                  </>
                ) : summary ? (
                  <>
                    <span className="block sm:inline">重新生成摘要</span>
                    <span className="block sm:inline text-xs sm:ml-2">Regenerate Summary</span>
                  </>
                ) : (
                  <>
                    <span className="block sm:inline">生成摘要</span>
                    <span className="block sm:inline text-xs sm:ml-2">Generate Summary</span>
                  </>
                )}
              </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 sm:mb-6 p-4 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-lg">
            <p className="mb-3 text-sm sm:text-base">{error}</p>
            {error.includes('No summary available') && (
              <button
                onClick={handleGenerateSummary}
                disabled={generating}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                {generating ? (
                  <>
                    <span className="block sm:inline">Generating...</span>
                    <span className="block sm:inline text-xs sm:ml-2">生成中...</span>
                  </>
                ) : (
                  <>
                    <span className="block sm:inline">Generate Summary</span>
                    <span className="block sm:inline text-xs sm:ml-2">生成摘要</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {summary && (
          <>
            {/* Topic Summary */}
            <section className="mb-6 sm:mb-8 bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h2 className="text-3xl sm:text-4xl font-semibold text-gray-900 mb-3 sm:mb-4">
                <span className="block">AI 摘要</span>
                <span className="block text-2xl sm:text-3xl text-gray-700 mt-1">AI Summary</span>
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-medium text-gray-500 mb-1">
                    <span className="block">中文</span>
                    <span className="block text-sm text-gray-400 mt-0.5">Chinese</span>
                  </h3>
                  <p className="text-base sm:text-lg text-gray-900">{summary.topicSummaryZh}</p>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500 mb-1">
                    <span className="block">英文</span>
                    <span className="block text-sm text-gray-400 mt-0.5">English</span>
                  </h3>
                  <p className="text-base sm:text-lg text-gray-900">{summary.topicSummaryEn}</p>
                </div>
              </div>

              {(summary.whatsNewEn || summary.whatsNewZh) && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">
                    <span className="block">今日新内容</span>
                    <span className="block text-base text-gray-700 mt-1">What&apos;s New Today</span>
                  </h3>
                  <div className="space-y-4">
                    {summary.whatsNewZh && (
                      <div>
                        <h4 className="text-base font-medium text-gray-500 mb-1">
                          <span className="block">中文</span>
                          <span className="block text-sm text-gray-400 mt-0.5">Chinese</span>
                        </h4>
                        <p className="text-base sm:text-lg text-gray-900">{summary.whatsNewZh}</p>
                      </div>
                    )}
                    {summary.whatsNewEn && (
                      <div>
                        <h4 className="text-base font-medium text-gray-500 mb-1">
                          <span className="block">英文</span>
                          <span className="block text-sm text-gray-400 mt-0.5">English</span>
                        </h4>
                        <p className="text-base sm:text-lg text-gray-900">{summary.whatsNewEn}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Key Phrases */}
            <section className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h2 className="text-3xl sm:text-4xl font-semibold text-gray-900 mb-3 sm:mb-4">
                <span className="block">短语金句</span>
                <span className="block text-2xl sm:text-3xl text-gray-700 mt-1">Key Phrases</span>
              </h2>
              <div className="space-y-4">
                {phrases.map((phrase) => (
                  <div
                    key={phrase.id}
                    className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between mb-2 gap-2">
                      <div className="flex-1 w-full sm:w-auto">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-blue-600">
                            #{phrase.rank}
                          </span>
                          {phrase.isNewToday && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              <span className="block sm:inline">New</span>
                              <span className="block sm:inline text-xs sm:ml-1">新</span>
                            </span>
                          )}
                        </div>
                        <p className="text-lg sm:text-xl font-medium text-gray-900 mb-1">
                          {phrase.phraseEn}
                        </p>
                        <p className="text-base sm:text-lg text-gray-700 mb-2">{phrase.phraseZh}</p>
                        {phrase.explanationZh && (
                          <p className="text-sm sm:text-base text-gray-600 mb-2">
                            {phrase.explanationZh}
                          </p>
                        )}
                        {phrase.exampleEn && (
                          <div className="mt-2 text-sm sm:text-base text-gray-500">
                            <span className="font-medium">
                              <span className="block sm:inline">Example:</span>
                              <span className="block sm:inline text-xs sm:ml-1">示例：</span>
                              {' '}
                            </span>
                            {phrase.exampleEn}
                            {phrase.exampleZh && (
                              <span className="ml-2">({phrase.exampleZh})</span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handlePlayPhrase(phrase.phraseEn, `phrase-${phrase.id}`)}
                        disabled={playingItem === `phrase-${phrase.id}`}
                        className="w-full sm:w-auto ml-0 sm:ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2 flex-shrink-0 text-base sm:text-lg"
                        aria-label={`Play "${phrase.phraseEn}"`}
                      >
                        {playingItem === `phrase-${phrase.id}` ? (
                          <>
                            <span className="inline-block animate-spin">⏸</span>
                            <span className="block sm:inline">播放中...</span>
                            <span className="block sm:inline text-sm sm:ml-2">Playing...</span>
                          </>
                        ) : (
                          <>
                            <span className="block sm:inline">🔊 播放</span>
                            <span className="block sm:inline text-sm sm:ml-2">Play</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

