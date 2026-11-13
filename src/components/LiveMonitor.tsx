import React, { useEffect, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  FileAudio,
  Lock,
  Maximize2,
  Minimize2,
  Mic,
  Send,
  Sparkles,
  Square,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Type as TypeIcon,
} from 'lucide-react';
import { blobToBase64 } from '../lib/audioKeepAlive';
import type { CaptureEngine, RecorderStatus } from '../hooks/useKhutbahRecorder';
import type { FontSizePreset, KhutbahSegment } from '../types/khutbah';

const OMAN_MOSQUES = [
  'সুলতান কাবুস গ্র্যান্ড মসজিদ, মাস্কাট',
  'আল-খুয়াইর জামে মসজিদ, মাস্কাট',
  'রুয়ি জামে মসজিদ, মাস্কাট',
  'সিব জামে মসজিদ, ওমান',
  'সোহার জামে মসজিদ, ওমান',
  'সালালাহ জামে মসজিদ, ওমান',
  'নিজওয়া জামে মসজিদ, ওমান',
];

const SAMPLE_ARABIC_KHUTBAH =
  'الحمد لله نحمده ونستعينه ونستغفره، عباد الله، أوصيكم ونفسي بتقوى الله عز وجل، فإن التقوى هي زاد المؤمن في الدنيا والآخرة. واعلموا أن بر الوالدين وصلة الأرحام من أعظم القربات إلى الله.';

interface LiveMonitorProps {
  mosqueName: string;
  onMosqueNameChange: (name: string) => void;
  segments: KhutbahSegment[];
  onAddSegment: (segment: KhutbahSegment) => void;
  status: RecorderStatus;
  captureEngine: CaptureEngine;
  onCaptureEngineChange: (engine: CaptureEngine) => void;
  interimArabic: string;
  isProcessingChunk: boolean;
  errorMessage: string | null;
  elapsedSeconds: number;
  wakeLockActive: boolean;
  keepScreenOnPref: boolean;
  onToggleKeepScreenOn: (next: boolean) => void;
  audioLevels: number[];
  isBackgroundProtected: boolean;
  queuedChunksCount: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPlaySegment: (segment: KhutbahSegment) => void;
  playingSegmentId: string | null;
  isLoadingAudio: boolean;
  onStopAudio: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

const FONT_SCALE_MAP: Record<FontSizePreset, { latest: string; history: string; label: string }> = {
  md: {
    latest: 'text-2xl sm:text-3xl leading-[1.6]',
    history: 'text-lg sm:text-xl leading-[1.65]',
    label: 'সাধারণ',
  },
  lg: {
    latest: 'text-3xl sm:text-4xl leading-[1.55]',
    history: 'text-xl sm:text-2xl leading-[1.6]',
    label: 'বড়',
  },
  xl: {
    latest: 'text-4xl sm:text-5xl leading-[1.48]',
    history: 'text-2xl sm:text-3xl leading-[1.55]',
    label: 'আরও বড়',
  },
  '2xl': {
    latest: 'text-4xl sm:text-5xl lg:text-6xl leading-[1.42]',
    history: 'text-2xl sm:text-3xl leading-[1.5]',
    label: 'মনিটর',
  },
};

const CATEGORY_LABELS: Record<KhutbahSegment['category'], string> = {
  quran: 'কুরআনের আয়াত',
  hadith: 'হাদিসে নববী',
  dua: 'দোয়া ও মুনাজাত',
  sermon: 'খুতবার বয়ান',
};

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const LiveMonitor: React.FC<LiveMonitorProps> = ({
  mosqueName,
  onMosqueNameChange,
  segments,
  onAddSegment,
  status,
  captureEngine,
  onCaptureEngineChange,
  interimArabic,
  isProcessingChunk,
  errorMessage,
  elapsedSeconds,
  wakeLockActive,
  keepScreenOnPref,
  onToggleKeepScreenOn,
  audioLevels,
  isBackgroundProtected,
  queuedChunksCount,
  onStartRecording,
  onStopRecording,
  onPlaySegment,
  playingSegmentId,
  isLoadingAudio,
  onStopAudio,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [fontSize, setFontSize] = useState<FontSizePreset>('xl');
  const [showArabic, setShowArabic] = useState<boolean>(true);
  const [isFullscreenMonitor, setIsFullscreenMonitor] = useState<boolean>(false);
  const [manualArabicInput, setManualArabicInput] = useState<string>('');
  const [isTranslatingManual, setIsTranslatingManual] = useState<boolean>(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  const monitorFeedRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoScroll && monitorFeedRef.current) {
      monitorFeedRef.current.scrollTop = monitorFeedRef.current.scrollHeight;
    }
  }, [segments.length, interimArabic, autoScroll]);

  const latestSegment = segments.length > 0 ? segments[segments.length - 1] : null;
  const previousSegments = segments.length > 1 ? segments.slice(0, -1) : [];
  const fontClasses = FONT_SCALE_MAP[fontSize];

  const handleTranslateText = async (textToTranslate: string) => {
    const trimmed = textToTranslate.trim();
    if (!trimmed) return;
    setIsTranslatingManual(true);
    setLocalError(null);
    try {
      const res = await fetch('/api/khutbah/translate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arabic: trimmed,
          previousContext: segments.slice(-2).map((s) => s.bengali).join(' '),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'অনুবাদ করা যায়নি।');
      }
      const data = (await res.json()) as { segment?: KhutbahSegment };
      if (data.segment) {
        onAddSegment(data.segment);
        setManualArabicInput('');
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'অনুবাদে ত্রুটি হয়েছে।');
    } finally {
      setIsTranslatingManual(false);
    }
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAudio(true);
    setLocalError(null);
    try {
      const base64 = await blobToBase64(file);
      const res = await fetch('/api/khutbah/process-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType: file.type || 'audio/mp3',
          previousContext: segments.slice(-2).map((s) => s.bengali).join(' '),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'অডিও ফাইল প্রসেস করা যায়নি।');
      }
      const data = (await res.json()) as { empty?: boolean; segment?: KhutbahSegment };
      if (data.empty) {
        setLocalError('অডিও ফাইলে পরিষ্কার কোনো আরবি কথা পাওয়া যায়নি।');
      } else if (data.segment) {
        onAddSegment(data.segment);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'ফাইল আপলোড ব্যর্থ হয়েছে।');
    } finally {
      setIsUploadingAudio(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const cycleFontSize = () => {
    const order: FontSizePreset[] = ['md', 'lg', 'xl', '2xl'];
    const idx = order.indexOf(fontSize);
    setFontSize(order[(idx + 1) % order.length]);
  };

  const combinedError = errorMessage || localError;
  const isRecording = status === 'recording';
  const isConnecting = status === 'connecting';

  return (
    <div
      className={
        isFullscreenMonitor
          ? 'fixed inset-0 z-50 flex flex-col bg-[#F6F5F0] dark:bg-[#060E0B] p-4 sm:p-6 overflow-hidden'
          : 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'
      }
    >
      {/* Left / Main 8 Columns: Large Bengali Monitor Display */}
      <section
        aria-label="লাইভ খুতবা মনিটর ডিসপ্লে"
        className={
          isFullscreenMonitor
            ? 'flex-1 flex flex-col min-h-0 max-w-6xl w-full mx-auto'
            : 'lg:col-span-8 flex flex-col rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 shadow-sm overflow-hidden'
        }
      >
        {/* Monitor Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200/70 dark:border-emerald-950/70">
          <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-600 dark:text-stone-300">
            <span className="font-semibold text-slate-900 dark:text-stone-100">
              {isRecording ? 'লাইভ খুতবা মনিটর চালু' : 'বাংলা মনিটর ডিসপ্লে'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-nums">{formatTimer(elapsedSeconds)}</span>
            {segments.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-nums">{segments.length} টি অংশ</span>
              </>
            )}
            {isProcessingChunk && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#0E7C66] dark:text-emerald-400 font-medium">
                  অনুবাদ হচ্ছে…
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cycleFontSize}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-medium text-slate-700 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-emerald-950/60 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="লেখার সাইজ পরিবর্তন করুন"
            >
              <TypeIcon className="w-3.5 h-3.5" />
              <span>সাইজ: {fontClasses.label}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowArabic((v) => !v)}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-medium text-slate-700 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-emerald-950/60 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {showArabic ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{showArabic ? 'আরবি চালু' : 'শুধু বাংলা'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label="থিম পরিবর্তন"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-emerald-900/60 text-slate-700 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-emerald-950/60 transition-colors cursor-pointer"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreenMonitor((v) => !v)}
              aria-label="বড় মনিটর মোড"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-emerald-900/60 text-slate-700 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-emerald-950/60 transition-colors cursor-pointer"
            >
              {isFullscreenMonitor ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Main Monitor Canvas */}
        <div
          ref={monitorFeedRef}
          onScroll={() => {
            const el = monitorFeedRef.current;
            if (!el) return;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            setAutoScroll(atBottom);
          }}
          className={
            isFullscreenMonitor
              ? 'flex-1 overflow-y-auto px-2 sm:px-6 py-6 space-y-8'
              : 'min-h-[460px] max-h-[68vh] overflow-y-auto px-5 sm:px-8 py-6 sm:py-8 space-y-8'
          }
        >
          {/* Empty / Welcome State */}
          {segments.length === 0 && !interimArabic && (
            <div className="flex flex-col items-center justify-center text-center py-10 sm:py-14 max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-[#0E7C66]/10 dark:bg-emerald-500/10 flex items-center justify-center text-[#0E7C66] dark:text-emerald-400 mb-5">
                <Mic className="w-8 h-8" />
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-stone-100">
                জুম্মার খুতবা সরাসরি বাংলায় পড়ুন ও শুনুন
              </h2>
              <p className="mt-3 text-base text-slate-600 dark:text-stone-300 leading-relaxed">
                মসজিদে ইমামের আরবি খুতবা শুরু হলে <strong>ভয়েস ইনপুট চালু করুন</strong> বাটনে চাপ দিন।
                মোবাইলের স্ক্রিন অফ করে পকেটে রাখলেও ব্যাকগ্রাউন্ডে স্বয়ংক্রিয়ভাবে অনুবাদ ও সেভ হতে থাকবে।
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={isRecording ? () => void onStopRecording() : () => void onStartRecording()}
                  className="min-h-[48px] px-6 py-3 rounded-2xl bg-[#0E7C66] hover:bg-[#0B6654] text-white font-semibold text-base flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Mic className="w-5 h-5" />
                  <span>{isRecording ? 'রেকর্ডিং বন্ধ করুন' : 'ভয়েস ইনপুট চালু করুন'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleTranslateText(SAMPLE_ARABIC_KHUTBAH)}
                  disabled={isTranslatingManual}
                  className="min-h-[48px] px-5 py-3 rounded-2xl border border-slate-300 dark:border-emerald-900/70 text-slate-800 dark:text-stone-100 hover:bg-slate-100 dark:hover:bg-emerald-950/60 font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Sparkles className="w-4 h-4 text-[#C69C3A]" />
                  <span>
                    {isTranslatingManual ? 'টেস্ট অনুবাদ হচ্ছে…' : 'নমুনা আরবি খুতবা টেস্ট করুন'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Previous History Segments */}
          {previousSegments.length > 0 && (
            <div className="space-y-6 pb-6 border-b border-slate-200/70 dark:border-emerald-950/80">
              {previousSegments.map((seg) => {
                const isThisPlaying = playingSegmentId === seg.id;
                return (
                  <article
                    key={seg.id}
                    className="group space-y-2 pb-5 border-b border-slate-100 dark:border-emerald-950/50 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-4 text-xs text-slate-500 dark:text-stone-400">
                      <div className="flex items-center gap-2">
                        <span>{CATEGORY_LABELS[seg.category]}</span>
                        {seg.topicHint && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{seg.topicHint}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-nums">
                          {new Date(seg.timestamp).toLocaleTimeString('bn-BD', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => (isThisPlaying ? onStopAudio() : onPlaySegment(seg))}
                        className="min-h-[36px] px-2.5 rounded-lg text-xs font-medium text-[#0E7C66] dark:text-emerald-400 hover:bg-[#0E7C66]/10 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {isThisPlaying ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5" />
                            <span>থামান</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>শুনুন</span>
                          </>
                        )}
                      </button>
                    </div>

                    {showArabic && seg.arabic && (
                      <p className="font-arabic text-xl sm:text-2xl text-slate-500 dark:text-stone-400 leading-loose">
                        {seg.arabic}
                      </p>
                    )}

                    <p
                      className={`font-medium text-slate-700 dark:text-stone-200 ${fontClasses.history}`}
                    >
                      {seg.bengali}
                    </p>
                  </article>
                );
              })}
            </div>
          )}

          {/* Focal Anchor: Latest Live Translated Bengali Text in Large Monitor Typography */}
          {latestSegment && (
            <article className="space-y-4 py-2">
              <div className="flex items-center justify-between gap-4 text-xs sm:text-sm text-slate-500 dark:text-stone-400">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#0E7C66] dark:text-[#D6B25E]">
                    সর্বশেষ অনুবাদ
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{CATEGORY_LABELS[latestSegment.category]}</span>
                  {latestSegment.topicHint && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{latestSegment.topicHint}</span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    playingSegmentId === latestSegment.id
                      ? onStopAudio()
                      : onPlaySegment(latestSegment)
                  }
                  disabled={isLoadingAudio}
                  className="min-h-[40px] px-3.5 rounded-xl bg-[#0E7C66]/10 dark:bg-emerald-500/15 text-[#0E7C66] dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-[#0E7C66]/20 transition-colors cursor-pointer"
                >
                  {playingSegmentId === latestSegment.id ? (
                    <>
                      <VolumeX className="w-4 h-4" />
                      <span>অডিও থামান</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" />
                      <span>{isLoadingAudio ? 'লোড হচ্ছে…' : 'বাংলায় শুনুন'}</span>
                    </>
                  )}
                </button>
              </div>

              {showArabic && latestSegment.arabic && (
                <p className="font-arabic text-2xl sm:text-3xl text-[#9C7B2F] dark:text-[#DFC178] leading-[1.9]">
                  {latestSegment.arabic}
                </p>
              )}

              <p
                className={`font-display font-bold text-slate-950 dark:text-[#FAF7F0] tracking-tight ${fontClasses.latest}`}
              >
                {latestSegment.bengali}
              </p>
            </article>
          )}

          {/* Live Interim Arabic Transcript while speaker is mid-sentence */}
          {interimArabic && (
            <div className="pt-4 border-t border-dashed border-slate-200 dark:border-emerald-900/50">
              <div className="text-xs text-slate-500 dark:text-stone-400 mb-1.5">
                শোনা যাচ্ছে (লাইভ আরবি)…
              </div>
              <p className="font-arabic text-xl sm:text-2xl text-slate-500 dark:text-stone-400 leading-loose">
                {interimArabic}
              </p>
            </div>
          )}
        </div>

        {/* Fullscreen Bottom Quick Mic Bar */}
        {isFullscreenMonitor && (
          <div className="pt-4 border-t border-slate-200 dark:border-emerald-950 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={isRecording ? () => void onStopRecording() : () => void onStartRecording()}
              className={`min-h-[48px] px-6 rounded-2xl font-semibold text-sm flex items-center gap-2 transition-colors cursor-pointer ${
                isRecording
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-[#0E7C66] hover:bg-[#0B6654] text-white'
              }`}
            >
              {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isRecording ? 'রেকর্ডিং থামান' : 'ভয়েস ইনপুট চালু'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreenMonitor(false)}
              className="min-h-[48px] px-5 rounded-2xl border border-slate-300 dark:border-emerald-900 text-sm font-medium text-slate-800 dark:text-stone-200 cursor-pointer"
            >
              সাধারণ ভিউ
            </button>
          </div>
        )}
      </section>

      {/* Right 4 Columns: Voice Capture Console, Screen-Off Controls & Tools */}
      {!isFullscreenMonitor && (
        <aside className="lg:col-span-4 space-y-5">
          {/* Voice Control Card */}
          <div className="rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-stone-100">
                ভয়েস ইনপুট ও রেকর্ডিং
              </h2>
              <span className="text-xs font-mono-nums text-slate-500 dark:text-stone-400">
                {formatTimer(elapsedSeconds)}
              </span>
            </div>

            {/* Real-time Audio Waveform Bars */}
            <div
              aria-hidden="true"
              className="h-14 rounded-2xl bg-slate-100/80 dark:bg-[#07100D] border border-slate-200/60 dark:border-emerald-950/70 px-4 flex items-center justify-between gap-1.5"
            >
              {audioLevels.map((lvl, idx) => (
                <div
                  key={idx}
                  className={`flex-1 rounded-full transition-all duration-100 ${
                    isRecording
                      ? 'bg-[#0E7C66] dark:bg-emerald-400'
                      : 'bg-slate-300 dark:bg-emerald-950'
                  }`}
                  style={{ height: `${Math.round(lvl * 100)}%` }}
                />
              ))}
            </div>

            {/* Primary Mic Action CTA */}
            <button
              type="button"
              disabled={isConnecting}
              onClick={isRecording ? () => void onStopRecording() : () => void onStartRecording()}
              className={`w-full min-h-[52px] rounded-2xl font-semibold text-base flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60 ${
                isRecording
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-[#0E7C66] hover:bg-[#0B6654] text-white'
              }`}
            >
              {isRecording ? (
                <>
                  <Square className="w-5 h-5" />
                  <span>খুতবা রেকর্ডিং বন্ধ করুন</span>
                </>
              ) : isConnecting ? (
                <span>মাইক্রোফোন চালু হচ্ছে…</span>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  <span>লাইভ ভয়েস ইনপুট চালু করুন</span>
                </>
              )}
            </button>

            {/* Screen-Off & Background Protection Status */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-emerald-950/60">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-slate-900 dark:text-stone-100">
                    স্ক্রিন সচল রাখুন (মনিটর মোড)
                  </div>
                  <div className="text-xs text-slate-500 dark:text-stone-400">
                    {wakeLockActive
                      ? 'মনিটর স্ক্রিন অফ হবে না'
                      : 'বন্ধ করলে স্ক্রিন অফ অবস্থাতেও রেকর্ডিং চলবে'}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={keepScreenOnPref}
                  onClick={() => void onToggleKeepScreenOn(!keepScreenOnPref)}
                  className={`min-h-[32px] w-12 rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                    keepScreenOnPref
                      ? 'bg-[#0E7C66]'
                      : 'bg-slate-300 dark:bg-emerald-950'
                  }`}
                >
                  <span
                    className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${
                      keepScreenOnPref ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-stone-300 leading-relaxed">
                <Lock className="w-4 h-4 shrink-0 mt-0.5 text-[#0E7C66] dark:text-emerald-400" />
                <span>
                  {isBackgroundProtected
                    ? 'ব্যাকগ্রাউন্ড সেশন সুরক্ষিত: আপনি মোবাইলের স্ক্রিন অফ করলেও অডিও রেকর্ড ও বাংলা অনুবাদ চলতে থাকবে এবং অটো সেভ হবে।'
                    : 'ভয়েস চালু করলে স্ক্রিন-অফ ব্যাকগ্রাউন্ড রেকর্ডিং ও অটো-সেভ স্বয়ংক্রিয়ভাবে সক্রিয় হবে।'}
                </span>
              </div>

              {queuedChunksCount > 0 && (
                <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  অফলাইনে {queuedChunksCount} টি অডিও অংশ জমা আছে — নেট পেলেই অনুবাদ হবে।
                </div>
              )}
            </div>

            {/* Capture Mode Selector */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-medium text-slate-500 dark:text-stone-400">
                অডিও প্রসেসিং ইঞ্জিন (ফ্রি জেমিনি এআই)
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#07100D]">
                <button
                  type="button"
                  onClick={() => onCaptureEngineChange('hybrid')}
                  className={`min-h-[40px] px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    captureEngine === 'hybrid'
                      ? 'bg-white dark:bg-[#13261F] text-slate-900 dark:text-stone-100 shadow-sm'
                      : 'text-slate-600 dark:text-stone-400'
                  }`}
                >
                  লাইভ + ব্যাকগ্রাউন্ড
                </button>
                <button
                  type="button"
                  onClick={() => onCaptureEngineChange('chunk')}
                  className={`min-h-[40px] px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    captureEngine === 'chunk'
                      ? 'bg-white dark:bg-[#13261F] text-slate-900 dark:text-stone-100 shadow-sm'
                      : 'text-slate-600 dark:text-stone-400'
                  }`}
                >
                  মসজিদ ইকো মোড
                </button>
              </div>
            </div>

            {/* Mosque Name in Oman */}
            <div className="space-y-2 pt-1">
              <label
                htmlFor="mosque-select"
                className="block text-xs font-medium text-slate-500 dark:text-stone-400"
              >
                ওমানের মসজিদের নাম (অটো সেভ হবে)
              </label>
              <input
                id="mosque-select"
                list="oman-mosques"
                value={mosqueName}
                onChange={(e) => onMosqueNameChange(e.target.value)}
                placeholder="মসজিদের নাম লিখুন…"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#07100D] border border-slate-200 dark:border-emerald-950 text-sm text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#0E7C66]"
              />
              <datalist id="oman-mosques">
                {OMAN_MOSQUES.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>

            {combinedError && (
              <div
                role="alert"
                className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300"
              >
                {combinedError}
              </div>
            )}
          </div>

          {/* Audio Upload & Quick Arabic Text Translator Card */}
          <div className="rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-stone-100">
              অডিও ফাইল বা আরবি টেক্সট অনুবাদ
            </h3>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={(e) => void handleAudioFileUpload(e)}
                className="hidden"
                id="audio-upload-input"
              />
              <label
                htmlFor="audio-upload-input"
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-emerald-900/70 hover:bg-slate-50 dark:hover:bg-emerald-950/40 text-sm font-medium text-slate-700 dark:text-stone-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <FileAudio className="w-4 h-4 text-[#0E7C66] dark:text-emerald-400" />
                <span>
                  {isUploadingAudio
                    ? 'অডিও অনুবাদ হচ্ছে…'
                    : 'রেকর্ড করা খুতবার অডিও আপলোড করুন'}
                </span>
              </label>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleTranslateText(manualArabicInput);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={manualArabicInput}
                onChange={(e) => setManualArabicInput(e.target.value)}
                placeholder="যেকোনো আরবি বাক্য লিখে টেস্ট করুন…"
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#07100D] border border-slate-200 dark:border-emerald-950 text-sm text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#0E7C66]"
              />
              <button
                type="submit"
                disabled={isTranslatingManual || !manualArabicInput.trim()}
                aria-label="অনুবাদ করুন"
                className="min-h-[44px] min-w-[44px] px-3.5 rounded-xl bg-[#0E7C66] text-white hover:bg-[#0B6654] disabled:opacity-50 flex items-center justify-center transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </aside>
      )}
    </div>
  );
};
