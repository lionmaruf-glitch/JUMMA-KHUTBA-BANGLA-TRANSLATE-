import React, { useMemo, useState } from 'react';
import { RotateCcw, Search, Volume2, VolumeX } from 'lucide-react';
import { ASMAUL_HUSNA, type AllahNameItem } from '../data/asmaulHusna';
import type { PlayableItem } from '../hooks/useAudioPlayer';
import { playTasbihClickSound } from '../lib/islamicUtils';

interface TasbihPreset {
  id: string;
  arabic: string;
  bengali: string;
  meaningBn: string;
  target: number;
}

const TASBIH_PRESETS: TasbihPreset[] = [
  {
    id: 'subhanallah',
    arabic: 'سُبْحَانَ اللَّهِ',
    bengali: 'সুবহানাল্লাহ',
    meaningBn: 'আল্লাহ সকল ত্রুটি থেকে পবিত্র',
    target: 33,
  },
  {
    id: 'alhamdulillah',
    arabic: 'الْحَمْدُ لِلَّهِ',
    bengali: 'আলহামদুলিল্লাহ',
    meaningBn: 'সকল প্রশংসা একমাত্র আল্লাহর জন্য',
    target: 33,
  },
  {
    id: 'allahuakbar',
    arabic: 'اللَّهُ أَكْبَرُ',
    bengali: 'আল্লাহু আকবার',
    meaningBn: 'আল্লাহ সর্বশ্রেষ্ঠ',
    target: 34,
  },
  {
    id: 'astaghfirullah',
    arabic: 'أَسْتَغْفِرُ اللَّهَ',
    bengali: 'আস্তাগফিরুল্লাহ',
    meaningBn: 'আমি আল্লাহর কাছে ক্ষমা প্রার্থনা করছি',
    target: 100,
  },
  {
    id: 'lailaha',
    arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ',
    bengali: 'লা ইলাহা ইল্লাল্লাহ',
    meaningBn: 'আল্লাহ ছাড়া কোনো ইলাহ নেই',
    target: 100,
  },
  {
    id: 'durood',
    arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ',
    bengali: 'দরুদ শরীফ',
    meaningBn: 'হে আল্লাহ, হযরত মুহাম্মদ (সা.)-এর ওপর রহমত বর্ষণ করুন',
    target: 100,
  },
];

interface TasbihAndNamesProps {
  onPlayAudio: (items: PlayableItem[]) => void;
}

export const TasbihAndNames: React.FC<TasbihAndNamesProps> = ({ onPlayAudio }) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('subhanallah');
  const [count, setCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('khutbah_tasbih_total_v1') || '0');
    } catch {
      return 0;
    }
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedName, setSelectedName] = useState<AllahNameItem>(ASMAUL_HUSNA[0]);

  const activePreset =
    TASBIH_PRESETS.find((p) => p.id === selectedPresetId) || TASBIH_PRESETS[0];

  const handleTasbihTap = () => {
    const nextCount = count + 1;
    const isMilestone = nextCount === activePreset.target;
    if (soundEnabled) {
      playTasbihClickSound(isMilestone);
    }
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(isMilestone ? [30, 40, 30] : 15);
      } catch {
        // ignore
      }
    }
    setCount(nextCount);
    const nextTotal = totalCount + 1;
    setTotalCount(nextTotal);
    try {
      localStorage.setItem('khutbah_tasbih_total_v1', String(nextTotal));
    } catch {
      // ignore
    }
  };

  const handleSelectName = (item: AllahNameItem) => {
    if (soundEnabled) {
      playTasbihClickSound(false);
    }
    setSelectedName(item);
  };

  const filteredNames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ASMAUL_HUSNA;
    return ASMAUL_HUSNA.filter(
      (n) =>
        n.bengali.toLowerCase().includes(q) ||
        n.meaningBn.toLowerCase().includes(q) ||
        n.arabic.includes(q) ||
        String(n.number) === q
    );
  }, [searchQuery]);

  const progressPct = Math.min(100, Math.round((count / activePreset.target) * 100));

  return (
    <div className="space-y-8">
      {/* Top Section: Digital Tasbih */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-stone-100">
                ডিজিটাল তাসবিহ ও জিকির
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-stone-400 mt-1">
                সর্বমোট তাসবিহ পাঠ: <span className="font-mono-nums font-bold">{totalCount}</span> বার
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSoundEnabled((s) => !s)}
                aria-label="ক্লিক সাউন্ড চালু বা বন্ধ"
                className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-medium text-slate-700 dark:text-stone-200 flex items-center gap-1.5 cursor-pointer"
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-[#0E7C66]" /> : <VolumeX className="w-4 h-4" />}
                <span>{soundEnabled ? 'সাউন্ড চালু' : 'মিউট'}</span>
              </button>

              <button
                type="button"
                onClick={() => setCount(0)}
                aria-label="কাউন্ট রিসেট"
                className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-medium text-slate-700 dark:text-stone-200 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>রিসেট</span>
              </button>
            </div>
          </div>

          {/* Zikr Preset Chips (interactive filter buttons) */}
          <div className="flex flex-wrap gap-2">
            {TASBIH_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  if (soundEnabled) playTasbihClickSound(false);
                  setSelectedPresetId(preset.id);
                  setCount(0);
                }}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                  selectedPresetId === preset.id
                    ? 'bg-[#0E7C66] text-white font-semibold'
                    : 'bg-slate-100 dark:bg-[#13261F] text-slate-700 dark:text-stone-300 hover:bg-slate-200 dark:hover:bg-emerald-950'
                }`}
              >
                {preset.bengali} ({preset.target})
              </button>
            ))}
          </div>

          {/* Big Ergonomic Tasbih Tap Area */}
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <p className="font-arabic text-3xl sm:text-4xl text-[#9C7B2F] dark:text-[#DFC178] leading-loose">
                {activePreset.arabic}
              </p>
              <p className="text-sm text-slate-600 dark:text-stone-300">
                {activePreset.bengali} — {activePreset.meaningBn}
              </p>
            </div>

            <button
              type="button"
              onClick={handleTasbihTap}
              className="w-full min-h-[168px] rounded-3xl bg-[#0B2922] hover:bg-[#0f382e] active:scale-[0.985] text-white border-2 border-[#D4AF37]/40 flex flex-col items-center justify-center gap-2 transition-transform shadow-lg cursor-pointer select-none"
            >
              <span className="font-mono-nums text-6xl sm:text-7xl font-bold tracking-tight text-[#FAF7F0]">
                {count}
              </span>
              <span className="text-xs sm:text-sm text-[#DFC178] font-medium">
                টার্গেট {activePreset.target} · এখানে ট্যাপ করুন
              </span>
            </button>

            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#07100D] overflow-hidden">
              <div
                className="h-full bg-[#0E7C66] dark:bg-[#D4AF37] transition-all duration-150"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Selected Name Spotlight & Bangla Advice (5 columns) */}
        <div className="lg:col-span-5 rounded-3xl bg-[#0B2922] text-[#FAF7F0] border border-[#D4AF37]/35 p-6 sm:p-8 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#DFC178]">
              <span>আসমাউল হুসনা · নাম #{selectedName.number} / ৯৯</span>
              <button
                type="button"
                onClick={() =>
                  onPlayAudio([
                    {
                      id: `name_${selectedName.number}`,
                      text: `${selectedName.bengali}। অর্থ: ${selectedName.meaningBn}। আমল ও নসিহত: ${selectedName.adviceBn}`,
                      label: selectedName.bengali,
                    },
                  ])
                }
                className="min-h-[38px] px-3.5 rounded-xl bg-[#D4AF37] text-[#08120F] font-bold flex items-center gap-1.5 hover:bg-[#e5c458] transition-colors cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>কণ্ঠে শুনুন</span>
              </button>
            </div>

            <div className="py-4 text-center space-y-2 border-y border-white/10">
              <p className="font-arabic text-5xl sm:text-6xl text-[#DFC178] leading-relaxed">
                {selectedName.arabic}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                {selectedName.bengali}
              </h2>
              <p className="text-base text-emerald-100">{selectedName.meaningBn}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white/8 border border-white/10 p-4 space-y-1.5">
            <div className="text-xs font-semibold text-[#DFC178]">
              দৈনন্দিন জীবনে আমল ও বাংলা নসিহত:
            </div>
            <p className="text-sm sm:text-base text-[#F4F1EA] leading-relaxed">
              {selectedName.adviceBn}
            </p>
          </div>
        </div>
      </section>

      {/* Bottom Section: All 99 Names of Allah Grid */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-stone-100">
              আল্লাহ তা’আলার ৯৯টি গুণবাচক নাম (ক্লিক সাউন্ড ও বাংলা অর্থসহ)
            </h2>
            <p className="text-sm text-slate-500 dark:text-stone-400">
              যেকোনো নামে টাচ করলে ক্লিক সাউন্ডসহ বাংলা অর্থ ও আমলের নসিহত দেখতে ও শুনতে পারবেন।
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="নাম বা অর্থ খুঁজুন…"
              className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-[#0D1A15] border border-slate-200 dark:border-emerald-950 text-sm text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#0E7C66]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredNames.map((item) => {
            const isSelected = selectedName.number === item.number;
            return (
              <button
                key={item.number}
                type="button"
                onClick={() => handleSelectName(item)}
                className={`text-left rounded-2xl p-4 border transition-colors cursor-pointer flex items-center justify-between gap-4 ${
                  isSelected
                    ? 'bg-[#0E7C66]/10 dark:bg-emerald-500/15 border-[#0E7C66]'
                    : 'bg-white dark:bg-[#0D1A15] border-slate-200/80 dark:border-emerald-950/80 hover:border-[#0E7C66]/50'
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="text-xs font-mono-nums text-slate-500 dark:text-stone-400">
                    #{item.number}
                  </div>
                  <div className="font-display text-base font-bold text-slate-900 dark:text-stone-100 truncate">
                    {item.bengali}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-stone-300 line-clamp-1">
                    {item.meaningBn}
                  </div>
                </div>
                <div className="font-arabic text-2xl sm:text-3xl text-[#9C7B2F] dark:text-[#DFC178] shrink-0">
                  {item.arabic}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
