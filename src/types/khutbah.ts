export type KhutbahCategory = 'quran' | 'hadith' | 'dua' | 'sermon';

export interface KhutbahSegment {
  id: string;
  arabic: string;
  bengali: string;
  category: KhutbahCategory;
  topicHint?: string;
  timestamp: number;
}

export interface KhutbahSummary {
  titleBn: string;
  summaryBn: string;
  keyPointsBn: string[];
  referencesBn: string[];
}

export interface KhutbahSession {
  id: string;
  title: string;
  mosqueName: string;
  createdAt: number;
  updatedAt: number;
  durationSeconds: number;
  segments: KhutbahSegment[];
  summary?: KhutbahSummary;
}

export type FontSizePreset = 'md' | 'lg' | 'xl' | '2xl';
