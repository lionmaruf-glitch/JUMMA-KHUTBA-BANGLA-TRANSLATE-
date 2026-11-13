import React, { useState } from 'react';
import { BookOpen, RefreshCw, Send, Sparkles, Volume2 } from 'lucide-react';
import {
  CURATED_DAILY_AYATS,
  CURATED_HADITH_LIST,
  type DailyAyatData,
} from '../data/dailyIslamicContent';
import type { PlayableItem } from '../hooks/useAudioPlayer';

interface AdviceResponse {
  titleBn: string;
  answerBn: string;
  quranOrHadithRefBn: string;
  actionTipBn: string;
}

interface QuranHadithHubProps {
  onPlayAudio: (items: PlayableItem[]) => void;
}

const QUICK_TOPICS = [
  'প্রবাসে কাজের চাপে নামাজ সময়মতো আদায়ের উপায়',
  'মন অশান্ত বা পরিবারের কথা মনে পড়লে কোন দোয়া পড়ব?',
  'জুম্মার দিনে বিশেষ সুন্নত ও আমল কী কী?',
  'হালাল উপার্জন ও আমানত রক্ষার গুরুত্ব',
];

export const QuranHadithHub: React.FC<QuranHadithHubProps> = ({ onPlayAudio }) => {
  const [ayatIndex, setAyatIndex] = useState(0);
  const [currentAyat, setCurrentAyat] = useState<DailyAyatData>(CURATED_DAILY_AYATS[0]);
  const [isLoadingAyat, setIsLoadingAyat] = useState(false);

  const [questionInput, setQuestionInput] = useState('');
  const [adviceResult, setAdviceResult] = useState<AdviceResponse | null>(null);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);

  const handleNextOfflineAyat = () => {
    const nextIdx = (ayatIndex + 1) % CURATED_DAILY_AYATS.length;
    setAyatIndex(nextIdx);
    setCurrentAyat(CURATED_DAILY_AYATS[nextIdx]);
  };

  const handleFetchAiAyat = async () => {
    setIsLoadingAyat(true);
    try {
      const res = await fetch('/api/islamic/daily-ayat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = (await res.json()) as DailyAyatData;
        if (data.arabic && data.tafsirBekhhaBn) {
          setCurrentAyat(data);
        }
      } else {
        handleNextOfflineAyat();
      }
    } catch {
      handleNextOfflineAyat();
    } finally {
      setIsLoadingAyat(false);
    }
  };

  const handleAskAdvice = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setIsLoadingAdvice(true);
    setAdviceError(null);
    try {
      const res = await fetch('/api/islamic/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'পরামর্শ আনতে সমস্যা হয়েছে।');
      }
      const data = (await res.json()) as AdviceResponse;
      setAdviceResult(data);
      setQuestionInput('');
    } catch (err) {
      setAdviceError(err instanceof Error ? err.message : 'সার্ভারে ত্রুটি হয়েছে।');
    } finally {
      setIsLoadingAdvice(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Daily Quran Ayat & Bangla Tafsir Bekhha */}
      <section className="rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-medium text-[#0E7C66] dark:text-[#DFC178]">
              প্রতিদিনের কুরআনের আয়াত ও তাফসীর ব্যাখ্যা · {currentAyat.surahInfoBn}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-stone-100">
              দৈনিক কুরআন, তাফসীর ও হাদিসের আলো
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                onPlayAudio([
                  {
                    id: `ayat_${currentAyat.surahInfoBn}`,
                    text: `${currentAyat.surahInfoBn}। অনুবাদ: ${currentAyat.bengaliTranslation}। তাফসীর ব্যাখ্যা: ${currentAyat.tafsirBekhhaBn}। পরামর্শ: ${currentAyat.dailyAdviceBn}`,
                    label: currentAyat.surahInfoBn,
                  },
                ])
              }
              className="min-h-[42px] px-4 rounded-xl bg-[#0E7C66] hover:bg-[#0B6654] text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
              <span>তাফসীর বাংলায় শুনুন</span>
            </button>

            <button
              type="button"
              onClick={() => void handleFetchAiAyat()}
              disabled={isLoadingAyat}
              className="min-h-[42px] px-4 rounded-xl border border-slate-300 dark:border-emerald-900/70 text-slate-800 dark:text-stone-100 hover:bg-slate-100 dark:hover:bg-emerald-950/60 text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingAyat ? 'animate-spin' : ''}`} />
              <span>{isLoadingAyat ? 'লোড হচ্ছে…' : 'নতুন আয়াত (AI)'}</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-[#0B2922] text-[#FAF7F0] p-6 sm:p-7 space-y-4">
          <p className="font-arabic text-3xl sm:text-4xl text-[#DFC178] leading-[2.1] text-right">
            {currentAyat.arabic}
          </p>
          <p className="font-display text-xl sm:text-2xl font-semibold text-white leading-relaxed">
            “{currentAyat.bengaliTranslation}”
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 space-y-2">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-stone-100">
              তাফসীর ব্যাখ্যা
            </h2>
            <p className="text-base text-slate-700 dark:text-stone-300 leading-relaxed">
              {currentAyat.tafsirBekhhaBn}
            </p>
          </div>

          <div className="lg:col-span-4 rounded-2xl bg-slate-50 dark:bg-[#07100D] border border-slate-200/70 dark:border-emerald-950 p-5 space-y-2">
            <div className="text-xs font-bold text-[#0E7C66] dark:text-[#DFC178]">
              আজকের আমলি পরামর্শ
            </div>
            <p className="text-sm sm:text-base text-slate-700 dark:text-stone-200 leading-relaxed">
              {currentAyat.dailyAdviceBn}
            </p>
          </div>
        </div>
      </section>

      {/* Ask Free Gemini Islamic Advisor in Bangla */}
      <section className="rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-[#C69C3A]" />
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-stone-100">
            কুরআন ও হাদিসের আলোকে বাংলা পরামর্শ নিন (ফ্রি এআই গাইড)
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => void handleAskAdvice(topic)}
              disabled={isLoadingAdvice}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#13261F] hover:bg-slate-200 dark:hover:bg-emerald-950 text-xs sm:text-sm text-slate-800 dark:text-stone-200 transition-colors cursor-pointer text-left"
            >
              {topic}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleAskAdvice(questionInput);
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <input
            type="text"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            placeholder="প্রবাস জীবন, নামাজ, রোজা বা যেকোনো ইসলামী পরামর্শ বাংলায় লিখুন…"
            className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07100D] border border-slate-200 dark:border-emerald-950 text-sm sm:text-base text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#0E7C66]"
          />
          <button
            type="submit"
            disabled={isLoadingAdvice || !questionInput.trim()}
            className="min-h-[48px] px-6 rounded-xl bg-[#0E7C66] hover:bg-[#0B6654] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>{isLoadingAdvice ? 'উত্তর তৈরি হচ্ছে…' : 'পরামর্শ চান'}</span>
          </button>
        </form>

        {adviceError && (
          <p className="text-xs text-rose-600 dark:text-rose-400">{adviceError}</p>
        )}

        {adviceResult && (
          <div className="rounded-2xl bg-slate-50 dark:bg-[#07100D] border border-slate-200 dark:border-emerald-900/70 p-5 sm:p-6 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-stone-100">
                {adviceResult.titleBn}
              </h3>
              <button
                type="button"
                onClick={() =>
                  onPlayAudio([
                    {
                      id: `advice_${Date.now()}`,
                      text: `${adviceResult.titleBn}। ${adviceResult.answerBn}। দলিল: ${adviceResult.quranOrHadithRefBn}। আমল: ${adviceResult.actionTipBn}`,
                      label: adviceResult.titleBn,
                    },
                  ])
                }
                className="min-h-[38px] px-3 rounded-xl bg-[#0E7C66]/10 text-[#0E7C66] dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>শুনুন</span>
              </button>
            </div>
            <p className="text-base text-slate-700 dark:text-stone-200 leading-relaxed">
              {adviceResult.answerBn}
            </p>
            <div className="text-sm text-[#9C7B2F] dark:text-[#DFC178]">
              সূত্র: {adviceResult.quranOrHadithRefBn}
            </div>
            <div className="text-sm font-medium text-[#0E7C66] dark:text-emerald-400">
              আমল: {adviceResult.actionTipBn}
            </div>
          </div>
        )}
      </section>

      {/* Authentic Hadith Collection */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-[#0E7C66] dark:text-[#DFC178]" />
          <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-stone-100">
            মুসল্লি ও প্রবাসীদের জন্য নির্বাচিত সহীহ হাদিস
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {CURATED_HADITH_LIST.map((h) => (
            <article
              key={h.id}
              className="rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-stone-400">
                  <span className="font-semibold text-[#0E7C66] dark:text-[#DFC178]">
                    {h.topicBn}
                  </span>
                  <span>{h.sourceBn}</span>
                </div>
                <p className="font-arabic text-2xl text-[#9C7B2F] dark:text-[#DFC178] leading-loose text-right">
                  {h.arabic}
                </p>
                <p className="text-base font-medium text-slate-900 dark:text-stone-100 leading-relaxed">
                  {h.bengali}
                </p>
                <p className="text-sm text-slate-600 dark:text-stone-300 leading-relaxed">
                  শিক্ষা: {h.adviceBn}
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    onPlayAudio([
                      {
                        id: h.id,
                        text: `${h.topicBn}। হাদিসের অর্থ: ${h.bengali}। শিক্ষা: ${h.adviceBn}`,
                        label: h.topicBn,
                      },
                    ])
                  }
                  className="min-h-[40px] px-3.5 rounded-xl bg-[#0E7C66]/10 dark:bg-emerald-500/15 text-[#0E7C66] dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>বাংলায় শুনুন</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
