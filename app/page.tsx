'use client';

import { useState } from 'react';
import SessionRecorder from '@/components/SessionRecorder';
import Link from 'next/link';

// TODO: These should come from user context/auth in production
const DEFAULT_HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export default function Home() {
  const [householdId] = useState(DEFAULT_HOUSEHOLD_ID);
  const [userId] = useState(DEFAULT_USER_ID);

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      <div className="container mx-auto px-4 py-2 sm:py-4 max-w-md flex-1 flex flex-col">
        {/* Header */}
        <div className="text-center mb-2 sm:mb-4 flex-shrink-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
            <span className="block">Family Voice Bridge</span>
            <span className="block text-lg sm:text-xl md:text-2xl text-gray-700 mt-0.5 sm:mt-1">家庭语音桥</span>
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-600">
            <span className="block">Speak with one tap, learn as you practice</span>
            <span className="block text-xs sm:text-sm text-gray-500 mt-0.5">一键说话, 在练中学</span>
          </p>
        </div>

        {/* Main Session Recorder - Takes remaining space */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <SessionRecorder
            householdId={householdId}
            initiatedByUserId={userId}
            onSessionComplete={() => {
              console.log('Session completed');
            }}
          />
        </div>

        {/* Navigation */}
        <div className="mt-2 sm:mt-4 text-center space-y-2 sm:space-y-0 sm:space-x-4 flex flex-col sm:flex-row justify-center items-center flex-shrink-0 pb-2 sm:pb-4">
          <Link
            href="/vocabulary"
            className="w-full sm:w-auto inline-block px-4 sm:px-6 py-2 sm:py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-colors text-sm sm:text-base shadow-md"
          >
            <span className="block sm:inline">Daily Vocabulary</span>
            <span className="block sm:inline text-xs sm:text-sm sm:ml-2">每日词汇</span>
            <span className="sm:inline"> →</span>
          </Link>
          <Link
            href="/review"
            className="w-full sm:w-auto inline-block px-4 sm:px-6 py-2 sm:py-3 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-lg transition-colors text-sm sm:text-base shadow-md"
          >
            <span className="block sm:inline">Daily Learning</span>
            <span className="block sm:inline text-xs sm:text-sm sm:ml-2">每日小结</span>
            <span className="sm:inline"> →</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

