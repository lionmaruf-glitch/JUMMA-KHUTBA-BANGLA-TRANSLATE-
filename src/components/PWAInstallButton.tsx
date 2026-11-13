import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  onNewSession?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ onNewSession }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return onNewSession ? (
      <button
        type="button"
        onClick={onNewSession}
        className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0E7C66] text-white text-sm font-semibold hover:bg-[#0B6654] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        নতুন খুতবা
      </button>
    ) : null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="min-h-[40px] flex items-center gap-2 rounded-xl bg-[#0E7C66] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B6654] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>অ্যাপ ইনস্টল</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[40px] flex items-center gap-2 rounded-xl border border-slate-300 dark:border-emerald-900/60 px-3.5 py-2 text-sm font-medium text-slate-800 dark:text-stone-100 hover:bg-slate-100 dark:hover:bg-emerald-950/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Share className="w-4 h-4 shrink-0" />
          <span>হোম স্ক্রিনে নিন</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#101E19] border border-slate-200 dark:border-emerald-900/50 p-6 shadow-2xl">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-stone-100">
                  iPhone / iPad-এ ইনস্টল করুন
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-emerald-950 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-stone-300">
                <li>১. Safari ব্রাউজারের নিচে <strong>Share (শেয়ার)</strong> আইকনে ট্যাপ করুন।</li>
                <li>২. স্ক্রল করে <strong>Add to Home Screen</strong> নির্বাচন করুন।</li>
                <li>৩. উপরে <strong>Add</strong> চাপলে অ্যাপ হিসেবে সেভ হবে।</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-[#0E7C66] text-white text-sm font-semibold hover:bg-[#0B6654] transition-colors cursor-pointer"
              >
                বুঝেছি
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return onNewSession ? (
    <button
      type="button"
      onClick={onNewSession}
      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0E7C66] text-white text-sm font-semibold hover:bg-[#0B6654] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
    >
      নতুন খুতবা
    </button>
  ) : null;
};
