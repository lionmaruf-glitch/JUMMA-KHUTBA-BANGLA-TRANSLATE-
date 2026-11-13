import React, { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  Check,
  Compass,
  LocateFixed,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { FALLBACK_PRAYER_REMINDERS } from '../data/dailyIslamicContent';
import type { PlayableItem } from '../hooks/useAudioPlayer';
import {
  calculatePrayerTimes,
  calculateQiblaAngle,
  OMAN_CITIES,
  playPrayerKnockSound,
  playTasbihClickSound,
} from '../lib/islamicUtils';

type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

interface PrayerInfo {
  key: PrayerKey;
  nameBn: string;
  arabic: string;
  time: string;
  minutes: number;
}

interface KnockAdvice {
  prayerNameBn: string;
  allahReminderBn: string;
  quranOrHadithBn: string;
  practicalStepBn: string;
}

interface PrayerAndQiblaProps {
  onPlayAudio: (items: PlayableItem[]) => void;
}

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export const PrayerAndQibla: React.FC<PrayerAndQiblaProps> = ({ onPlayAudio }) => {
  const [selectedCityId, setSelectedCityId] = useState<string>('muscat');
  const [customCoords, setCustomCoords] = useState<{ lat: number; lng: number; label: string } | null>(
    null
  );
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Prayer ticks persisted per date
  const todayKey = getTodayKey();
  const [completedMap, setCompletedMap] = useState<Record<string, Record<PrayerKey, boolean>>>(() => {
    try {
      const raw = localStorage.getItem('khutbah_namaz_tracker_v1');
      return raw ? (JSON.parse(raw) as Record<string, Record<PrayerKey, boolean>>) : {};
    } catch {
      return {};
    }
  });

  const todayStatus: Record<PrayerKey, boolean> = completedMap[todayKey] || {
    fajr: false,
    dhuhr: false,
    asr: false,
    maghrib: false,
    isha: false,
  };

  // Spiritual knock advice modal/panel
  const [knockAdvice, setKnockAdvice] = useState<KnockAdvice | null>(null);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);

  // Device compass heading
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [compassEnabled, setCompassEnabled] = useState(false);
  const [compassNote, setCompassNote] = useState<string | null>(null);

  const activeLocation = useMemo(() => {
    if (customCoords) return customCoords;
    const city = OMAN_CITIES.find((c) => c.id === selectedCityId) || OMAN_CITIES[0];
    return { lat: city.lat, lng: city.lng, label: city.nameBn };
  }, [customCoords, selectedCityId]);

  const prayerTimes = useMemo(
    () => calculatePrayerTimes(activeLocation.lat, activeLocation.lng, new Date(), 4),
    [activeLocation.lat, activeLocation.lng]
  );

  const qiblaAngle = useMemo(
    () => Math.round(calculateQiblaAngle(activeLocation.lat, activeLocation.lng)),
    [activeLocation.lat, activeLocation.lng]
  );

  const isFriday = new Date().getDay() === 5;
  const prayerList: PrayerInfo[] = useMemo(
    () => [
      {
        key: 'fajr',
        nameBn: 'ফজর',
        arabic: 'الفجر',
        time: prayerTimes.fajr,
        minutes: prayerTimes.rawMinutes.fajr,
      },
      {
        key: 'dhuhr',
        nameBn: isFriday ? 'যোহর / জুম্মা' : 'যোহর',
        arabic: isFriday ? 'الجمعة' : 'الظهر',
        time: prayerTimes.dhuhr,
        minutes: prayerTimes.rawMinutes.dhuhr,
      },
      {
        key: 'asr',
        nameBn: 'আসর',
        arabic: 'العصر',
        time: prayerTimes.asr,
        minutes: prayerTimes.rawMinutes.asr,
      },
      {
        key: 'maghrib',
        nameBn: 'মাগরিব',
        arabic: 'المغرب',
        time: prayerTimes.maghrib,
        minutes: prayerTimes.rawMinutes.maghrib,
      },
      {
        key: 'isha',
        nameBn: 'এশা',
        arabic: 'العشاء',
        time: prayerTimes.isha,
        minutes: prayerTimes.rawMinutes.isha,
      },
    ],
    [isFriday, prayerTimes]
  );

  const nowDate = new Date();
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const nextPrayer =
    prayerList.find((p) => p.minutes > nowMinutes) || prayerList[0];

  const completedCount = Object.values(todayStatus).filter(Boolean).length;

  const saveDayStatus = (nextDay: Record<PrayerKey, boolean>) => {
    const updated = { ...completedMap, [todayKey]: nextDay };
    setCompletedMap(updated);
    try {
      localStorage.setItem('khutbah_namaz_tracker_v1', JSON.stringify(updated));
    } catch {
      // ignore storage quota errors
    }
  };

  const triggerUncompletedKnock = async (prayerNameBn: string) => {
    playPrayerKnockSound();
    const lookupKey = prayerNameBn.includes('যোহর') ? 'যোহর / জুম্মা' : prayerNameBn;
    const fallback = FALLBACK_PRAYER_REMINDERS[lookupKey] || FALLBACK_PRAYER_REMINDERS['ফজর'];
    setKnockAdvice({
      prayerNameBn,
      ...fallback,
    });
    setIsLoadingAdvice(true);
    try {
      const res = await fetch('/api/islamic/prayer-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prayerNameBn, statusText: 'এখনো পড়া হয়নি' }),
      });
      if (res.ok) {
        const aiData = (await res.json()) as KnockAdvice;
        if (aiData.allahReminderBn) {
          setKnockAdvice(aiData);
        }
      }
    } catch {
      // keep instant fallback
    } finally {
      setIsLoadingAdvice(false);
    }
  };

  const togglePrayerTick = (prayer: PrayerInfo) => {
    const nextVal = !todayStatus[prayer.key];
    playTasbihClickSound(nextVal);
    saveDayStatus({ ...todayStatus, [prayer.key]: nextVal });
    if (!nextVal) {
      void triggerUncompletedKnock(prayer.nameBn);
    }
  };

  const handleLocateGPS = () => {
    if (!('geolocation' in navigator)) {
      setGeoError('এই ডিভাইসে GPS সুবিধা নেই।');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: 'আপনার বর্তমান অবস্থান (GPS)',
        });
        setGeoLoading(false);
      },
      () => {
        setGeoError('লোকেশন পারমিশন পাওয়া যায়নি—তালিকা থেকে শহর নির্বাচন করুন।');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const enableCompassSensor = async () => {
    setCompassNote(null);
    const DevOrientation = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof DevOrientation?.requestPermission === 'function') {
      try {
        const perm = await DevOrientation.requestPermission();
        if (perm !== 'granted') {
          setCompassNote('কম্পাস সেন্সর পারমিশন পাওয়া যায়নি।');
          return;
        }
      } catch {
        setCompassNote('কম্পাস চালু করা যায়নি।');
        return;
      }
    }
    setCompassEnabled(true);
  };

  useEffect(() => {
    if (!compassEnabled) return;
    const handler = (event: DeviceOrientationEvent) => {
      const ev = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
      if (typeof ev.webkitCompassHeading === 'number') {
        setDeviceHeading(ev.webkitCompassHeading);
      } else if (typeof event.alpha === 'number') {
        setDeviceHeading((360 - event.alpha) % 360);
      }
    };
    window.addEventListener('deviceorientationabsolute', handler as EventListener, true);
    window.addEventListener('deviceorientation', handler, true);
    return () => {
      window.removeEventListener('deviceorientationabsolute', handler as EventListener, true);
      window.removeEventListener('deviceorientation', handler, true);
    };
  }, [compassEnabled]);

  const needleRotation =
    deviceHeading !== null ? (qiblaAngle - deviceHeading + 360) % 360 : qiblaAngle;

  return (
    <div className="space-y-6">
      {/* Location & Next Prayer Header Strip */}
      <div className="rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 dark:text-stone-400 flex flex-wrap items-center gap-2">
            <span>{activeLocation.label}</span>
            <span aria-hidden="true">·</span>
            <span>সূর্যোদয় {prayerTimes.sunrise}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-nums">
              পরবর্তী ওয়াক্ত: {nextPrayer.nameBn} ({nextPrayer.time})
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-stone-100">
            নামাজের সময়, আমল টিক চিহ্ন ও কিবলা কম্পাস
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="ওমানের শহর নির্বাচন করুন"
            value={customCoords ? 'gps' : selectedCityId}
            onChange={(e) => {
              setCustomCoords(null);
              setSelectedCityId(e.target.value);
            }}
            className="min-h-[44px] px-3.5 rounded-xl bg-slate-100 dark:bg-[#13261F] border border-slate-200 dark:border-emerald-900/60 text-sm text-slate-900 dark:text-stone-100"
          >
            {customCoords && <option value="gps">বর্তমান GPS লোকেশন</option>}
            {OMAN_CITIES.map((city) => (
              <option key={city.id} value={city.id}>
                {city.nameBn}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleLocateGPS}
            disabled={geoLoading}
            className="min-h-[44px] px-4 rounded-xl bg-[#0E7C66] hover:bg-[#0B6654] text-white text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
          >
            <LocateFixed className="w-4 h-4" />
            <span>{geoLoading ? 'খোঁজা হচ্ছে…' : 'অটো লোকেশন'}</span>
          </button>
        </div>
      </div>

      {geoError && (
        <p className="text-xs text-amber-600 dark:text-amber-400 px-1">{geoError}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: Prayer Times + Checkmark Tracker + Allah Sees Knock Advice */}
        <section className="lg:col-span-7 space-y-5">
          <div className="rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-stone-100">
                  আজকের ৫ ওয়াক্ত নামাজ ট্র্যাকার
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-stone-400 mt-0.5">
                  পড়ে থাকলে টিক দিন · না পড়ে থাকলে &ldquo;নক / স্মরণ&rdquo; বাটনে টাচ করুন
                </p>
              </div>
              <div className="font-mono-nums text-sm font-bold text-[#0E7C66] dark:text-[#D6B25E]">
                {completedCount} / ৫ ওয়াক্ত সম্পন্ন
              </div>
            </div>

            {/* 5 Prayer Rows */}
            <div className="divide-y divide-slate-100 dark:divide-emerald-950/70">
              {prayerList.map((prayer) => {
                const isDone = Boolean(todayStatus[prayer.key]);
                const isNext = nextPrayer.key === prayer.key;
                return (
                  <div
                    key={prayer.key}
                    className="py-3.5 first:pt-1 last:pb-1 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div
                      onClick={() => {
                        if (!isDone) {
                          void triggerUncompletedKnock(prayer.nameBn);
                        }
                      }}
                      className={`flex items-center gap-3.5 min-w-[180px] ${
                        !isDone ? 'cursor-pointer' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePrayerTick(prayer);
                        }}
                        aria-label={`${prayer.nameBn} ${isDone ? 'পড়েছি' : 'পড়ি নাই'}`}
                        className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center border transition-colors cursor-pointer ${
                          isDone
                            ? 'bg-[#0E7C66] border-[#0E7C66] text-white'
                            : 'bg-slate-50 dark:bg-[#08120F] border-slate-300 dark:border-emerald-900 text-transparent hover:border-[#0E7C66]'
                        }`}
                      >
                        <Check className="w-5 h-5 stroke-[2.5]" />
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-stone-100">
                            {prayer.nameBn}
                          </span>
                          <span className="font-arabic text-base text-[#9C7B2F] dark:text-[#DFC178]">
                            {prayer.arabic}
                          </span>
                          {isNext && (
                            <span className="text-xs font-semibold text-[#0E7C66] dark:text-emerald-400">
                              · পরবর্তী
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-stone-400">
                          {isDone ? 'আলহামদুলিল্লাহ, পড়া সম্পন্ন ✓' : 'এখনো পড়া হয়নি — টাচ করে নসিহত দেখুন'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 ml-auto">
                      <span className="font-mono-nums text-sm sm:text-base font-semibold text-slate-800 dark:text-stone-200">
                        {prayer.time}
                      </span>

                      {!isDone ? (
                        <button
                          type="button"
                          onClick={() => void triggerUncompletedKnock(prayer.nameBn)}
                          className="min-h-[40px] px-3 rounded-xl bg-amber-500/12 text-amber-700 dark:text-[#DFC178] hover:bg-amber-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <BellRing className="w-3.5 h-3.5" />
                          <span>নক / নসিহত</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => togglePrayerTick(prayer)}
                          className="min-h-[40px] px-3 rounded-xl bg-[#0E7C66]/10 text-[#0E7C66] dark:text-emerald-400 text-xs font-semibold cursor-pointer"
                        >
                          পড়েছি ✓
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Allah Sees You — Spiritual Knock Reminder Card */}
          {knockAdvice && (
            <div
              role="region"
              aria-label="আল্লাহ সব দেখছেন নসিহত"
              className="rounded-3xl bg-[#0B2922] text-[#FAF7F0] border border-[#D4AF37]/40 p-6 space-y-4 shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-[#DFC178] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>আল্লাহ তা’আলা সব দেখছেন · {knockAdvice.prayerNameBn}</span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-white">
                    {knockAdvice.prayerNameBn} নামাজের বিশেষ তাগিদ ও বাংলা নসিহত
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onPlayAudio([
                      {
                        id: `knock_${knockAdvice.prayerNameBn}`,
                        text: `${knockAdvice.allahReminderBn} ${knockAdvice.quranOrHadithBn} ${knockAdvice.practicalStepBn}`,
                        label: `${knockAdvice.prayerNameBn} নসিহত`,
                      },
                    ])
                  }
                  className="min-h-[40px] px-3.5 rounded-xl bg-[#D4AF37] text-[#08120F] text-xs font-bold flex items-center gap-1.5 hover:bg-[#e1be4c] transition-colors shrink-0 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>শুনুন</span>
                </button>
              </div>

              {isLoadingAdvice && (
                <p className="text-xs text-emerald-200/80">ফ্রি এআই দ্বারা বিশেষ নসিহত আপডেট হচ্ছে…</p>
              )}

              <p className="text-base leading-relaxed text-[#F4F1EA]">
                {knockAdvice.allahReminderBn}
              </p>

              <div className="rounded-2xl bg-white/8 border border-white/10 p-4 text-sm text-[#DFC178] leading-relaxed">
                {knockAdvice.quranOrHadithBn}
              </div>

              <p className="text-sm font-medium text-emerald-200">
                করণীয়: {knockAdvice.practicalStepBn}
              </p>
            </div>
          )}
        </section>

        {/* Right 5 Columns: Qibla Compass with Mosque Dome Dial */}
        <section className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#0D1A15] border border-slate-200/80 dark:border-emerald-950/80 p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-stone-100">
                কিবলা কম্পাস (মক্কা শরীফ)
              </h2>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-0.5">
                {activeLocation.label} থেকে কাবা শরীফের দিক
              </p>
            </div>
            <span className="font-mono-nums text-lg font-bold text-[#0E7C66] dark:text-[#DFC178]">
              {qiblaAngle}°
            </span>
          </div>

          {/* Geometric Compass Dial */}
          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative w-64 h-64 rounded-full bg-slate-50 dark:bg-[#07100D] border-2 border-slate-200 dark:border-emerald-900/80 flex items-center justify-center shadow-inner">
              {/* Cardinal Markers */}
              <span className="absolute top-3 text-xs font-bold text-slate-500 dark:text-stone-400">
                উত্তর (N)
              </span>
              <span className="absolute bottom-3 text-xs font-bold text-slate-500 dark:text-stone-400">
                দক্ষিণ (S)
              </span>
              <span className="absolute right-3 text-xs font-bold text-slate-500 dark:text-stone-400">
                পূর্ব (E)
              </span>
              <span className="absolute left-3 text-xs font-bold text-[#0E7C66] dark:text-[#DFC178]">
                পশ্চিম (W)
              </span>

              {/* Rotating Qibla Needle */}
              <div
                className="w-full h-full flex items-center justify-center transition-transform duration-200"
                style={{ transform: `rotate(${needleRotation}deg)` }}
              >
                <div className="relative flex flex-col items-center">
                  {/* Kaaba Indicator at needle tip */}
                  <div className="w-7 h-7 rounded-md bg-[#0B2922] border-2 border-[#D4AF37] flex items-center justify-center shadow-md -mt-28">
                    <span className="w-full h-1 bg-[#D4AF37] block" />
                  </div>
                  <div className="w-1.5 h-20 bg-gradient-to-b from-[#D4AF37] to-[#0E7C66] rounded-full" />
                  <div className="w-4 h-4 rounded-full bg-[#D4AF37] border-2 border-white dark:border-[#07100D] -mt-1" />
                  <div className="w-1 h-14 bg-slate-300 dark:bg-emerald-950 rounded-full -mt-1" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-center">
            <p className="text-sm text-slate-600 dark:text-stone-300">
              ওমান থেকে কাবা শরীফের দিক প্রায় <strong>{qiblaAngle}° (পশ্চিম-সামান্য উত্তর বা দক্ষিণ)</strong>।
              {deviceHeading !== null && (
                <span className="block text-xs text-[#0E7C66] dark:text-emerald-400 mt-1 font-mono-nums">
                  লাইভ ফোনের দিক: {Math.round(deviceHeading)}°
                </span>
              )}
            </p>

            {!compassEnabled ? (
              <button
                type="button"
                onClick={() => void enableCompassSensor()}
                className="w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#13261F] hover:bg-slate-200 dark:hover:bg-emerald-950 text-slate-900 dark:text-stone-100 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Compass className="w-4 h-4 text-[#0E7C66] dark:text-[#DFC178]" />
                <span>মোবাইল লাইভ কম্পাস সেন্সর চালু করুন</span>
              </button>
            ) : (
              <div className="text-xs font-medium text-[#0E7C66] dark:text-emerald-400">
                লাইভ কম্পাস সক্রিয় — ফোন সমতলভাবে ধরে কাবার দিকে ঘুরুন
              </div>
            )}

            {compassNote && (
              <p className="text-xs text-amber-600 dark:text-amber-400">{compassNote}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
