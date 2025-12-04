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

  const handlePlayPhrase = (phrase: string) => {
    speakText(phrase, { language: 'en-US' });
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
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-2xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 mb-3 sm:mb-4 inline-block text-sm sm:text-base"
          >
            <span className="block sm:inline">← Back to Home</span>
            <span className="block sm:inline text-sm sm:ml-2">返回首页</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-4">
            <span className="block">Daily Learning</span>
            <span className="block text-xl sm:text-2xl text-gray-700 mt-1">每日小结</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mb-4">
            Review your daily conversations and key phrases / 回顾您的每日对话和关键短语
          </p>
          
          {/* Date Selector */}
          <div className="mb-4">
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
              <span className="block">Select date:</span>
              <span className="block text-xs text-gray-500 mt-1">选择日期：</span>
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
              <input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
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
                ) : summary ? (
                  <>
                    <span className="block sm:inline">Regenerate Summary</span>
                    <span className="block sm:inline text-xs sm:ml-2">重新生成摘要</span>
                  </>
                ) : (
                  <>
                    <span className="block sm:inline">Generate Summary</span>
                    <span className="block sm:inline text-xs sm:ml-2">生成摘要</span>
                  </>
                )}
              </button>
            </div>
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
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">
                <span className="block">AI Summary</span>
                <span className="block text-lg sm:text-xl text-gray-700 mt-1">AI 摘要</span>
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                    <span className="block">English</span>
                    <span className="block text-xs text-gray-400 mt-0.5">英文</span>
                  </h3>
                  <p className="text-sm sm:text-base text-gray-900">{summary.topicSummaryEn}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                    <span className="block">中文</span>
                    <span className="block text-xs text-gray-400 mt-0.5">Chinese</span>
                  </h3>
                  <p className="text-sm sm:text-base text-gray-900">{summary.topicSummaryZh}</p>
                </div>
              </div>

              {(summary.whatsNewEn || summary.whatsNewZh) && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">
                    <span className="block">What&apos;s New Today</span>
                    <span className="block text-sm text-gray-700 mt-1">今日新内容</span>
                  </h3>
                  <div className="space-y-4">
                    {summary.whatsNewEn && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">
                          <span className="block">English</span>
                          <span className="block text-xs text-gray-400 mt-0.5">英文</span>
                        </h4>
                        <p className="text-sm sm:text-base text-gray-900">{summary.whatsNewEn}</p>
                      </div>
                    )}
                    {summary.whatsNewZh && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">
                          <span className="block">中文</span>
                          <span className="block text-xs text-gray-400 mt-0.5">Chinese</span>
                        </h4>
                        <p className="text-sm sm:text-base text-gray-900">{summary.whatsNewZh}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Key Phrases */}
            <section className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">
                <span className="block">短语金句</span>
                <span className="block text-lg sm:text-xl text-gray-700 mt-1">Key Phrases</span>
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
                        <p className="text-base sm:text-lg font-medium text-gray-900 mb-1">
                          {phrase.phraseEn}
                        </p>
                        <p className="text-sm sm:text-base text-gray-700 mb-2">{phrase.phraseZh}</p>
                        {phrase.explanationZh && (
                          <p className="text-xs sm:text-sm text-gray-600 mb-2">
                            {phrase.explanationZh}
                          </p>
                        )}
                        {phrase.exampleEn && (
                          <div className="mt-2 text-xs sm:text-sm text-gray-500">
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
                        onClick={() => handlePlayPhrase(phrase.phraseEn)}
                        className="w-full sm:w-auto ml-0 sm:ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex-shrink-0 text-sm sm:text-base"
                        aria-label={`Play "${phrase.phraseEn}"`}
                      >
                        <span className="block sm:inline">🔊 Play</span>
                        <span className="block sm:inline text-xs sm:ml-2">播放</span>
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

