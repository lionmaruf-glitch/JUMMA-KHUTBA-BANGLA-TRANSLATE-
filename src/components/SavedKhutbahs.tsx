import React, { useMemo, useState } from 'react';
import { BookOpen, Headphones, Search, Trash2, Volume2 } from 'lucide-react';
import type { KhutbahSession } from '../types/khutbah';

interface SavedKhutbahsProps {
  sessions: KhutbahSession[];
  activeSessionId: string;
  onOpenSession: (session: KhutbahSession) => void;
  onListenSession: (session: KhutbahSession) => void;
  onDeleteSession: (id: string) => void;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 60) return `${seconds || 0} সেকেন্ড`;
  const mins = Math.floor(seconds / 60);
  return `${mins} মিনিট`;
}

export const SavedKhutbahs: React.FC<SavedKhutbahsProps> = ({
  sessions,
  activeSessionId,
  onOpenSession,
  onListenSession,
  onDeleteSession,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const nonEmpty = sessions.filter((s) => s.segments.length > 0);
    if (!q) return nonEmpty;
    return nonEmpty.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.mosqueName.toLowerCase().includes(q) ||
        s.summary?.titleBn?.toLowerCase().includes(q) ||
        s.segments.some((seg) => seg.bengali.toLowerCase().includes(q))
    );
  }, [sessions, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-stone-100">
            সংরক্ষিত জুম্মার খুতবা
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-stone-400">
            প্রতিটি খুতবা অটোমেটিক সেভ থাকে — পরবর্তীতে যেকোনো সময় পড়ুন অথবা বাংলায় শুনুন।
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="মসজিদ বা বিষয় দিয়ে খুঁজুন…"
            className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-[#0D1A15] border border-slate-200 dark:border-emerald-950 text-sm text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#0E7C66]"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-10 text-center max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[#0E7C66]/10 dark:bg-emerald-500/10 flex items-center justify-center text-[#0E7C66] dark:text-emerald-400 mx-auto mb-4">
            <Headphones className="w-7 h-7" />
          </div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-stone-100">
            এখনো কোনো খুতবা সংরক্ষিত নেই
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-stone-400 leading-relaxed">
            লাইভ মনিটর থেকে ভয়েস ইনপুট চালু করলে বা নমুনা খুতবা টেস্ট করলে তা স্বয়ংক্রিয়ভাবে এখানে জমা হয়ে যাবে।
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((session) => {
            const displayTitle = session.summary?.titleBn || session.title;
            const previewText = session.segments[0]?.bengali || '';
            const formattedDate = new Date(session.createdAt).toLocaleDateString('bn-BD', {
              weekday: 'long',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });

            return (
              <article
                key={session.id}
                className="flex flex-col justify-between rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-5 sm:p-6 shadow-sm hover:border-[#0E7C66]/50 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-stone-400">
                    <span className="truncate">{formattedDate}</span>
                    {session.id === activeSessionId && (
                      <span className="text-[#0E7C66] dark:text-emerald-400 font-semibold shrink-0">
                        চলমান সেশন
                      </span>
                    )}
                  </div>

                  <h3
                    onClick={() => onOpenSession(session)}
                    className="font-display text-xl font-bold text-slate-900 dark:text-stone-100 leading-snug cursor-pointer hover:text-[#0E7C66] dark:hover:text-emerald-400 transition-colors"
                  >
                    {displayTitle}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-stone-400">
                    <span className="truncate max-w-[200px]">{session.mosqueName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-nums">{session.segments.length} অংশ</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-nums">{formatDuration(session.durationSeconds)}</span>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-stone-300 line-clamp-3 leading-relaxed">
                    {session.summary?.summaryBn || previewText}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-emerald-950/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenSession(session)}
                      className="min-h-[40px] px-3.5 rounded-xl bg-slate-100 dark:bg-[#13261F] text-slate-800 dark:text-stone-100 hover:bg-slate-200 dark:hover:bg-emerald-950 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>পড়ুন</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onListenSession(session)}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#0E7C66]/10 dark:bg-emerald-500/15 text-[#0E7C66] dark:text-emerald-300 hover:bg-[#0E7C66]/20 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>শুনুন</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteSession(session.id)}
                    aria-label="খুতবা মুছুন"
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
