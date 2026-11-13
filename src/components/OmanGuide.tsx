import React from 'react';
import { Headphones, Lock, Mic, Monitor, Volume2 } from 'lucide-react';

const COMMON_KHUTBAH_PHRASES = [
  {
    arabic: 'أوصيكم ونفسي بتقوى الله',
    bengali: 'আমি নিজেকে এবং আপনাদেরকে আল্লাহকে ভয় করার (তাকওয়া অবলম্বনের) উপদেশ দিচ্ছি।',
  },
  {
    arabic: 'عباد الله، اتقوا الله حق تقاته',
    bengali: 'হে আল্লাহর বান্দাগণ, আল্লাহকে যথাযথভাবে ভয় করুন।',
  },
  {
    arabic: 'أقول قولي هذا وأستغفر الله لي ولكم',
    bengali: 'আমি আমার এই কথা বলছি এবং আমার ও আপনাদের সবার জন্য আল্লাহর কাছে ক্ষমা প্রার্থনা করছি।',
  },
  {
    arabic: 'اللهم أعز الإسلام والمسلمين',
    bengali: 'হে আল্লাহ, ইসলাম ও মুসলিমদের সম্মানিত ও শক্তিশালী করুন।',
  },
  {
    arabic: 'واذكروا الله يذكركم واشكروه على نعمه',
    bengali: 'আল্লাহকে স্মরণ করুন, তিনিও আপনাদের স্মরণ করবেন এবং তাঁর নিয়ামতের শুকরিয়া আদায় করুন।',
  },
];

export const OmanGuide: React.FC = () => {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="space-y-2">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-stone-100">
          ওমানে জুম্মার মসজিদে ব্যবহারের সহজ নিয়ম
        </h1>
        <p className="text-base text-slate-600 dark:text-stone-300 leading-relaxed">
          মসজিদের আদব রক্ষা করে স্ক্রিন অফ রেখেই সম্পূর্ণ আরবি খুতবা বাংলায় সেভ করুন এবং নামাজের পর পড়ুন বা শুনুন।
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-6 space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-[#0E7C66]/10 dark:bg-emerald-500/15 flex items-center justify-center text-[#0E7C66] dark:text-emerald-400">
            <Mic className="w-5 h-5" />
          </div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-stone-100">
            ১. খুতবা শুরুর আগে ভয়েস অন করুন
          </h2>
          <p className="text-sm text-slate-600 dark:text-stone-300 leading-relaxed">
            ইমাম সাহেব মিম্বরে ওঠার সাথে সাথে অ্যাপের “লাইভ ভয়েস ইনপুট চালু করুন” বাটনে চাপ দিন এবং মাইক্রোফোন পারমিশন দিন।
          </p>
        </div>

        <div className="rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-6 space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-[#0E7C66]/10 dark:bg-emerald-500/15 flex items-center justify-center text-[#0E7C66] dark:text-emerald-400">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-stone-100">
            ২. মোবাইলের স্ক্রিন অফ করে পকেটে রাখুন
          </h2>
          <p className="text-sm text-slate-600 dark:text-stone-300 leading-relaxed">
            খুতবার সময় মনোযোগ ধরে রাখতে “স্ক্রিন সচল রাখুন” সুইচটি অফ করে মোবাইলের পাওয়ার বাটন দিয়ে স্ক্রিন বন্ধ করে পকেটে রাখতে পারেন। ব্যাকগ্রাউন্ড অডিও ও অনুবাদ চলতেই থাকবে।
          </p>
        </div>

        <div className="rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-6 space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-[#0E7C66]/10 dark:bg-emerald-500/15 flex items-center justify-center text-[#0E7C66] dark:text-emerald-400">
            <Monitor className="w-5 h-5" />
          </div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-stone-100">
            ৩. বড় মনিটর ডিসপ্লে (বয়স্ক বা বাসা/মজলিশের জন্য)
          </h2>
          <p className="text-sm text-slate-600 dark:text-stone-300 leading-relaxed">
            বড় স্ক্রিন বা ট্যাবলেটে দেখতে চাইলে ফুলস্ক্রিন আইকনে চাপ দিন এবং লেখার সাইজ “মনিটর” সিলেক্ট করুন—বড় বড় অক্ষরে বাংলা অনুবাদ দেখা যাবে।
          </p>
        </div>

        <div className="rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-6 space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-[#0E7C66]/10 dark:bg-emerald-500/15 flex items-center justify-center text-[#0E7C66] dark:text-emerald-400">
            <Headphones className="w-5 h-5" />
          </div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-stone-100">
            ৪. নামাজের পর পড়ুন ও বাংলায় শুনুন
          </h2>
          <p className="text-sm text-slate-600 dark:text-stone-300 leading-relaxed">
            সম্পূর্ণ খুতবা স্বয়ংক্রিয়ভাবে “সংরক্ষিত খুতবা” তালিকায় সেভ থাকে। গাড়িতে বা বাসায় ফিরে বাংলা কণ্ঠস্বরে পুরো খুতবা শুনতে অথবা মূল সারসংক্ষেপ পড়তে পারবেন।
          </p>
        </div>
      </div>

      {/* Common Arabic Phrases Reference */}
      <section className="rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-2.5">
          <Volume2 className="w-5 h-5 text-[#0E7C66] dark:text-[#D6B25E]" />
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-stone-100">
            ওমানের খুতবায় নিয়মিত শোনা কিছু আরবি বাক্য ও অর্থ
          </h2>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-emerald-950/70">
          {COMMON_KHUTBAH_PHRASES.map((item, idx) => (
            <div key={idx} className="py-4 first:pt-0 last:pb-0 space-y-1.5">
              <p className="font-arabic text-2xl text-[#9C7B2F] dark:text-[#DFC178] leading-loose">
                {item.arabic}
              </p>
              <p className="text-base font-medium text-slate-800 dark:text-stone-200">
                {item.bengali}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
