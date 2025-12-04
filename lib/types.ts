/**
 * Shared TypeScript types for Family Voice Bridge
 */

export interface SessionStartRequest {
  householdId: string;
  initiatedByUserId: string;
}

export interface SessionStartResponse {
  sessionId: string;
}

export interface TurnResponse {
  sourceText: string;
  translatedText: string;
}

export interface TagResponse {
  situationTag: string;
}

export interface DailySummaryRequest {
  householdId: string;
  summaryDate?: string; // ISO date string (YYYY-MM-DD)
}

export interface DailySummaryResponse {
  summary: {
    topic_summary_zh: string;
    topic_summary_en: string;
    whats_new_zh?: string;
    whats_new_en?: string;
    phrases: Array<{
      phrase_en: string;
      phrase_zh: string;
      explanation_zh?: string;
      example_en?: string;
      example_zh?: string;
    }>;
  };
  summaryDate: string;
}

