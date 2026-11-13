import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import type { PlayableItem } from '../hooks/useAudioPlayer';
import type { KhutbahSession, KhutbahSummary } from '../types/khutbah';

interface KhutbahReaderModalProps {
  session: KhutbahSession;
  onClose: () => void;
  onUpdateSession: (updated: KhutbahSession) => void;
  isPlaying: boolean;
  isLoadingAudio: boolean;
  currentItemId: string | null;
  currentIndex: number;
  totalItems: number;
  playbackRate: number;
  onChangePlaybackRate: (rate: number) => void;
  voiceName: string;
  onChangeVoiceName: (voice: string) => void;
  onPlayQueue: (items: PlayableItem[], startIndex?: number) => void;
  onTogglePause: () => void;
  onStopAudio: () => void;
  onNextAudio: () => void;
  onPrevAudio: () => void;
}

export const KhutbahReaderModal: React.FC<KhutbahReaderModalProps> = ({
  session,
  onClose,
  onUpdateSession,
  isPlaying,
  isLoadingAudio,
  currentItemId,
  currentIndex,
  totalItems,
  playbackRate,
  onChangePlaybackRate,
  voiceName,
  onChangeVoiceName,
  onPlayQueue,
  onTogglePause,
  onStopAudio,
  onNextAudio,
  onPrevAudio,
}) => {
  const [showArabic, setShowArabic] = useState(true);
  const [largeText, setLargeText] = useState(true);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateSummary = async () => {
    setIsSummarizing(true);
    setSummaryError(null);
    try {
      const res = await fetch('/api/khutbah/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: session.segments.map((s) => ({ arabic: s.arabic, bengali: s.bengali })),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'সারসংক্ষেপ তৈরি করা যায়নি।');
      }
      const summary = (await res.json()) as KhutbahSummary;
      onUpdateSession({
        ...session,
        title: summary.titleBn || session.title,
        summary,
        updatedAt: Date.now(),
      });
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'সারসংক্ষেপ তৈরিতে ত্রুটি হয়েছে।');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handlePlayFullKhutbah = (startIndex = 0) => {
    const items: PlayableItem[] = session.segments.map((seg, i) => ({
      id: seg.id,
      text: seg.bengali,
      label: `${session.summary?.titleBn || session.title} (${i + 1}/${session.segments.length})`,
    }));
    onPlayQueue(items, startIndex);
  };

  const handlePlaySummary = () => {
    if (!session.summary) return;
    const text = `${session.summary.titleBn}। ${session.summary.summaryBn}। মূল শিক্ষা: ${session.summary.keyPointsBn.join('। ')}`;
    onPlayQueue([{ id: `summary_${session.id}`, text, label: 'খুতবার সারসংক্ষেপ' }], 0);
  };

  const handleCopyAll = async () => {
    const content = [
      session.summary?.titleBn || session.title,
      session.mosqueName,
      new Date(session.createdAt).toLocaleDateString('bn-BD'),
      '',
      ...session.segments.map((s) => (showArabic && s.arabic ? `${s.arabic}\n${s.bengali}` : s.bengali)),
    ].join('\n\n');
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const content = [
      session.summary?.titleBn || session.title,
      session.mosqueName,
      new Date(session.createdAt).toLocaleDateString('bn-BD'),
      '',
      session.summary ? `সারসংক্ষেপ:\n${session.summary.summaryBn}\n\nমূল শিক্ষা:\n${session.summary.keyPointsBn.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\n---\n` : '',
      ...session.segments.map((s) => `${s.arabic}\n${s.bengali}`),
    ].join('\n\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `khutbah-${new Date(session.createdAt).toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isSessionPlaying = session.segments.some((s) => s.id === currentItemId) || currentItemId === `summary_${session.id}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F6F5F0] dark:bg-[#08120F]">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-emerald-950 bg-white/90 dark:bg-[#0D1A15]/90 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-stone-100 truncate">
              {session.summary?.titleBn || session.title}
            </h2>
            <div className="text-xs text-slate-500 dark:text-stone-400 flex items-center gap-2 truncate">
              <span>{session.mosqueName}</span>
              <span aria-hidden="true">·</span>
              <span>
                {new Date(session.createdAt).toLocaleDateString('bn-BD', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleCopyAll()}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-medium text-slate-700 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-emerald-950/60 flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-[#0E7C66]" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'কপি হয়েছে' : 'কপি'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadTxt}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-medium text-slate-700 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-emerald-950/60 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">ডাউনলোড</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="বন্ধ করুন"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-[#13261F] text-slate-700 dark:text-stone-200 hover:bg-slate-200 dark:hover:bg-emerald-950 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 pb-32">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Audio Listen & AI Summary Action Strip */}
          <div className="rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    isSessionPlaying && isPlaying ? onTogglePause() : handlePlayFullKhutbah(0)
                  }
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0E7C66] hover:bg-[#0B6654] text-white text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {isSessionPlaying && isPlaying ? (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>বিরতি দিন</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" />
                      <span>সম্পূর্ণ খুতবা বাংলায় শুনুন</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void handleGenerateSummary()}
                  disabled={isSummarizing}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-emerald-900/70 text-slate-800 dark:text-stone-100 hover:bg-slate-100 dark:hover:bg-emerald-950/60 text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Sparkles className="w-4 h-4 text-[#C69C3A]" />
                  <span>
                    {isSummarizing
                      ? 'সারসংক্ষেপ তৈরি হচ্ছে…'
                      : session.summary
                      ? 'সারসংক্ষেপ আপডেট'
                      : 'মূল সারসংক্ষেপ ও শিক্ষা তৈরি করুন'}
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLargeText((v) => !v)}
                  className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-medium text-slate-700 dark:text-stone-200 cursor-pointer"
                >
                  {largeText ? 'সাধারণ ফন্ট' : 'বড় ফন্ট'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowArabic((v) => !v)}
                  className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-medium text-slate-700 dark:text-stone-200 cursor-pointer"
                >
                  {showArabic ? 'আরবি লুকান' : 'আরবি দেখান'}
                </button>
              </div>
            </div>

            {/* Voice & Speed preferences */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100 dark:border-emerald-950/60 text-xs text-slate-600 dark:text-stone-300">
              <div className="flex items-center gap-2">
                <span>কণ্ঠস্বর:</span>
                <select
                  value={voiceName}
                  onChange={(e) => onChangeVoiceName(e.target.value)}
                  className="min-h-[36px] px-2.5 rounded-lg bg-slate-100 dark:bg-[#13261F] border border-slate-200 dark:border-emerald-900/60 text-xs"
                >
                  <option value="Charon">পুরুষ কণ্ঠ (গম্ভীর)</option>
                  <option value="Puck">পুরুষ কণ্ঠ (স্পষ্ট)</option>
                  <option value="Kore">মহিলা কণ্ঠ (শান্ত)</option>
                  <option value="Zephyr">সাবলীল কণ্ঠ</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span>গতি:</span>
                {[0.85, 1.0, 1.2].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => onChangePlaybackRate(rate)}
                    className={`min-h-[32px] px-2.5 rounded-lg font-mono-nums transition-colors cursor-pointer ${
                      playbackRate === rate
                        ? 'bg-[#0E7C66] text-white'
                        : 'bg-slate-100 dark:bg-[#13261F] text-slate-700 dark:text-stone-300'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            {summaryError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{summaryError}</p>
            )}
          </div>

          {/* Summary Card if generated */}
          {session.summary && (
            <section className="rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-5 sm:p-7 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-stone-100">
                  খুতবার মূল সারসংক্ষেপ ও শিক্ষা
                </h3>
                <button
                  type="button"
                  onClick={handlePlaySummary}
                  className="min-h-[38px] px-3.5 rounded-xl bg-[#0E7C66]/10 dark:bg-emerald-500/15 text-[#0E7C66] dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>সারসংক্ষেপ শুনুন</span>
                </button>
              </div>

              <p className="text-base leading-relaxed text-slate-700 dark:text-stone-200">
                {session.summary.summaryBn}
              </p>

              {session.summary.keyPointsBn.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-sm font-semibold text-slate-900 dark:text-stone-100">
                    গুরুত্বপূর্ণ শিক্ষাসমূহ:
                  </div>
                  <ul className="space-y-2 text-sm sm:text-base text-slate-700 dark:text-stone-300">
                    {session.summary.keyPointsBn.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="font-mono-nums text-[#0E7C66] dark:text-[#D6B25E] font-bold">
                          {i + 1}.
                        </span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {session.summary.referencesBn.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-emerald-950/60">
                  <div className="text-xs font-semibold text-slate-500 dark:text-stone-400">
                    কুরআন ও হাদিসের উল্লেখ:
                  </div>
                  <ul className="space-y-1 text-sm text-slate-600 dark:text-stone-300">
                    {session.summary.referencesBn.map((ref, i) => (
                      <li key={i}>• {ref}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Full Transcript Segments */}
          <section className="rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-5 sm:p-8 space-y-6">
            {session.segments.map((seg, idx) => {
              const isActive = currentItemId === seg.id;
              return (
                <article
                  key={seg.id}
                  className={`rounded-2xl p-4 sm:p-5 transition-colors border ${
                    isActive
                      ? 'bg-[#0E7C66]/8 dark:bg-emerald-500/10 border-[#0E7C66]/50'
                      : 'border-transparent border-b-slate-100 dark:border-b-emerald-950/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-2 text-xs text-slate-500 dark:text-stone-400">
                    <span className="font-mono-nums">
                      অংশ {idx + 1} ·{' '}
                      {new Date(seg.timestamp).toLocaleTimeString('bn-BD', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        isActive && isPlaying ? onTogglePause() : handlePlayFullKhutbah(idx)
                      }
                      className="min-h-[36px] px-3 rounded-lg text-xs font-semibold text-[#0E7C66] dark:text-emerald-400 hover:bg-[#0E7C66]/10 flex items-center gap-1.5 cursor-pointer"
                    >
                      {isActive && isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>বিরতি</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>এখান থেকে শুনুন</span>
                        </>
                      )}
                    </button>
                  </div>

                  {showArabic && seg.arabic && (
                    <p className="font-arabic text-xl sm:text-2xl text-[#9C7B2F] dark:text-[#DFC178] leading-loose mb-2">
                      {seg.arabic}
                    </p>
                  )}

                  <p
                    className={`text-slate-900 dark:text-stone-100 font-medium leading-relaxed ${
                      largeText ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'
                    }`}
                  >
                    {seg.bengali}
                  </p>
                </article>
              );
            })}
          </section>
        </div>
      </div>

      {/* Persistent Bottom Audio Player Bar when active */}
      {(isPlaying || isLoadingAudio || currentItemId) && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 dark:border-emerald-950 bg-white/95 dark:bg-[#0D1A15]/95 backdrop-blur-md px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-stone-100 truncate">
                {isLoadingAudio ? 'বাংলা কণ্ঠস্বর তৈরি হচ্ছে…' : 'খুতবা অডিও চলছে'}
              </div>
              <div className="text-xs font-mono-nums text-slate-500 dark:text-stone-400">
                {totalItems > 0 ? `অংশ ${currentIndex + 1} / ${totalItems}` : 'প্রস্তুত'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPrevAudio}
                disabled={currentIndex <= 0}
                aria-label="আগের অংশ"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-emerald-950 disabled:opacity-40 cursor-pointer"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={onTogglePause}
                aria-label={isPlaying ? 'বিরতি' : 'চালান'}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#0E7C66] text-white hover:bg-[#0B6654] cursor-pointer"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={onNextAudio}
                disabled={currentIndex + 1 >= totalItems}
                aria-label="পরের অংশ"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-emerald-950 disabled:opacity-40 cursor-pointer"
              >
                <SkipForward className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={onStopAudio}
                aria-label="বন্ধ করুন"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
              >
                <Square className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
