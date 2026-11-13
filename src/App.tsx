import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Compass,
  Mic,
  Pause,
  Play,
  Sparkles,
  Square,
} from 'lucide-react';
import masjidHeroImg from './assets/images/masjid_gumbuj_hero_1794557084704.jpg';
import { KhutbahReaderModal } from './components/KhutbahReaderModal';
import { LiveMonitor } from './components/LiveMonitor';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OmanGuide } from './components/OmanGuide';
import { PrayerAndQibla } from './components/PrayerAndQibla';
import { PWAInstallButton } from './components/PWAInstallButton';
import { QuranHadithHub } from './components/QuranHadithHub';
import { SavedKhutbahs } from './components/SavedKhutbahs';
import { TasbihAndNames } from './components/TasbihAndNames';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useKhutbahRecorder } from './hooks/useKhutbahRecorder';
import { deleteSession, getAllSessions, saveSession } from './lib/db';
import type { KhutbahSegment, KhutbahSession } from './types/khutbah';

type MainTab = 'khutbah' | 'prayer' | 'tasbih' | 'quran';
type KhutbahSubTab = 'monitor' | 'saved' | 'guide';

function createFreshSession(mosqueName: string): KhutbahSession {
  const now = Date.now();
  const dateLabel = new Date(now).toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
  });
  return {
    id: `khutbah_${now}_${Math.random().toString(36).slice(2, 6)}`,
    title: `জুম্মার খুতবা — ${dateLabel}`,
    mosqueName,
    createdAt: now,
    updatedAt: now,
    durationSeconds: 0,
    segments: [],
  };
}

export default function App() {
  const [mainTab, setMainTab] = useState<MainTab>('khutbah');
  const [khutbahSubTab, setKhutbahSubTab] = useState<KhutbahSubTab>('monitor');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [mosqueName, setMosqueName] = useState<string>(
    'সুলতান কাবুস গ্র্যান্ড মসজিদ, মাস্কাট'
  );
  const [sessions, setSessions] = useState<KhutbahSession[]>([]);
  const [activeSession, setActiveSession] = useState<KhutbahSession>(() =>
    createFreshSession('সুলতান কাবুস গ্র্যান্ড মসজিদ, মাস্কাট')
  );
  const [openedSessionId, setOpenedSessionId] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState<boolean>(false);

  const activeSessionRef = useRef<KhutbahSession>(activeSession);
  activeSessionRef.current = activeSession;

  const audioPlayer = useAudioPlayer();

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    void (async () => {
      const loaded = await getAllSessions();
      setSessions(loaded);
    })();
  }, []);

  const persistActiveSession = useCallback(async (updated: KhutbahSession) => {
    activeSessionRef.current = updated;
    setActiveSession(updated);
    if (updated.segments.length > 0) {
      await saveSession(updated);
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === updated.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [updated, ...prev];
      });
    }
  }, []);

  const handleSegmentReceived = useCallback(
    (segment: KhutbahSegment) => {
      const curr = activeSessionRef.current;
      const updated: KhutbahSession = {
        ...curr,
        mosqueName,
        updatedAt: Date.now(),
        segments: [...curr.segments, segment],
      };
      void persistActiveSession(updated);
    },
    [mosqueName, persistActiveSession]
  );

  const recorder = useKhutbahRecorder({
    mosqueName,
    onSegmentReceived: handleSegmentReceived,
  });

  useEffect(() => {
    if (recorder.status === 'recording' && recorder.elapsedSeconds > 0) {
      const curr = activeSessionRef.current;
      if (recorder.elapsedSeconds % 5 === 0) {
        const updated: KhutbahSession = {
          ...curr,
          durationSeconds: Math.max(curr.durationSeconds, recorder.elapsedSeconds),
          updatedAt: Date.now(),
        };
        void persistActiveSession(updated);
      }
    }
  }, [recorder.elapsedSeconds, recorder.status, persistActiveSession]);

  const handleMosqueChange = (name: string) => {
    setMosqueName(name);
    const curr = activeSessionRef.current;
    const updated = { ...curr, mosqueName: name, updatedAt: Date.now() };
    void persistActiveSession(updated);
  };

  const handleNewSession = async () => {
    if (recorder.status === 'recording') {
      await recorder.stop();
    }
    recorder.resetTimer();
    const fresh = createFreshSession(mosqueName);
    activeSessionRef.current = fresh;
    setActiveSession(fresh);
    setMainTab('khutbah');
    setKhutbahSubTab('monitor');
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (openedSessionId === id) {
      setOpenedSessionId(null);
    }
    if (activeSession.id === id) {
      const fresh = createFreshSession(mosqueName);
      setActiveSession(fresh);
    }
  };

  const handleUpdateSavedSession = async (updated: KhutbahSession) => {
    await saveSession(updated);
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    if (activeSession.id === updated.id) {
      setActiveSession(updated);
    }
  };

  const handlePlaySingleSegment = (seg: KhutbahSegment) => {
    audioPlayer.playQueue(
      [
        {
          id: seg.id,
          text: seg.bengali,
          label: activeSession.mosqueName,
        },
      ],
      0
    );
  };

  const handleListenFullSavedSession = (session: KhutbahSession) => {
    setOpenedSessionId(session.id);
    const items = session.segments.map((seg, i) => ({
      id: seg.id,
      text: seg.bengali,
      label: `${session.summary?.titleBn || session.title} (${i + 1}/${session.segments.length})`,
    }));
    audioPlayer.playQueue(items, 0);
  };

  const openedSession = sessions.find((s) => s.id === openedSessionId) || null;
  const savedCount = sessions.filter((s) => s.segments.length > 0).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F0] text-[#111D19] dark:bg-[#08120F] dark:text-[#F4F1EA]">
      {/* Clean 3-Zone Top Bar Contract */}
      <header className="border-b border-slate-200/80 dark:border-emerald-950/80 bg-white/85 dark:bg-[#0B1713]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#khutbah"
            onClick={(e) => {
              e.preventDefault();
              setMainTab('khutbah');
            }}
            className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-950 dark:text-[#FAF7F0] whitespace-nowrap shrink-0"
          >
            খুতবা লাইভ
          </a>

          {/* Zone 2: 4 Clean Single-Line Text Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            <button
              type="button"
              onClick={() => setMainTab('khutbah')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mainTab === 'khutbah'
                  ? 'border-[#0E7C66] text-slate-950 dark:text-white font-semibold'
                  : 'border-transparent text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-100'
              }`}
            >
              লাইভ খুতবা
            </button>
            <button
              type="button"
              onClick={() => setMainTab('prayer')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mainTab === 'prayer'
                  ? 'border-[#0E7C66] text-slate-950 dark:text-white font-semibold'
                  : 'border-transparent text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-100'
              }`}
            >
              নামাজ ও কিবলা
            </button>
            <button
              type="button"
              onClick={() => setMainTab('tasbih')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mainTab === 'tasbih'
                  ? 'border-[#0E7C66] text-slate-950 dark:text-white font-semibold'
                  : 'border-transparent text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-100'
              }`}
            >
              তাসবিহ ও ৯৯ নাম
            </button>
            <button
              type="button"
              onClick={() => setMainTab('quran')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mainTab === 'quran'
                  ? 'border-[#0E7C66] text-slate-950 dark:text-white font-semibold'
                  : 'border-transparent text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-100'
              }`}
            >
              কুরআন ও হাদিস
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton onNewSession={() => void handleNewSession()} />
          </div>
        </div>
      </header>

      {/* Architectural Masjid Dome (Gumbuj) Banner */}
      <div className="relative overflow-hidden border-b border-slate-200/70 dark:border-emerald-950/80 bg-[#0B2922]">
        {!heroImgFailed ? (
          <img
            src={masjidHeroImg}
            alt="ওমানের মসজিদের গম্বুজ ও মিনার"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover object-center opacity-55"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#0B2922] via-[#10392E] to-[#08120F]" />
        )}
        {/* Measured Contrast Scrim */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#08120F] via-[#08120F]/70 to-[#0B2922]/55"
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <p className="font-arabic text-lg sm:text-xl text-[#DFC178]">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </p>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-[#FAF7F0] leading-tight">
              ওমান প্রবাসী মুসলিম ও জুম্মার খুতবা সহায়ক
            </h1>
            <p className="text-sm sm:text-base text-stone-200/90 leading-relaxed">
              আরবি খুতবার সরাসরি বাংলা অনুবাদ · নামাজের সময়, আমল টিক ও কিবলা · তাসবিহ ও ৯৯ নাম · দৈনিক কুরআন তাফসীর
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setMainTab('prayer')}
              className="min-h-[42px] px-4 rounded-xl bg-white/12 hover:bg-white/20 text-[#FAF7F0] border border-white/15 text-xs sm:text-sm font-medium backdrop-blur-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              নামাজ টিক ও কিবলা
            </button>
            <button
              type="button"
              onClick={() => setMainTab('tasbih')}
              className="min-h-[42px] px-4 rounded-xl bg-[#D4AF37] hover:bg-[#e1be4c] text-[#08120F] text-xs sm:text-sm font-bold transition-colors whitespace-nowrap cursor-pointer"
            >
              তাসবিহ ও ৯৯ নাম
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-12">
        {mainTab === 'khutbah' && (
          <div className="space-y-6">
            {/* Sub-Navigation inside Khutbah Tab */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-[#0D1A15] border border-slate-200 dark:border-emerald-950 self-start">
                <button
                  type="button"
                  onClick={() => setKhutbahSubTab('monitor')}
                  className={`min-h-[40px] px-4 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    khutbahSubTab === 'monitor'
                      ? 'bg-white dark:bg-[#142820] text-slate-950 dark:text-white shadow-sm font-semibold'
                      : 'text-slate-600 dark:text-stone-400'
                  }`}
                >
                  লাইভ মনিটর
                </button>
                <button
                  type="button"
                  onClick={() => setKhutbahSubTab('saved')}
                  className={`min-h-[40px] px-4 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    khutbahSubTab === 'saved'
                      ? 'bg-white dark:bg-[#142820] text-slate-950 dark:text-white shadow-sm font-semibold'
                      : 'text-slate-600 dark:text-stone-400'
                  }`}
                >
                  সংরক্ষিত খুতবা{savedCount > 0 ? ` (${savedCount})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setKhutbahSubTab('guide')}
                  className={`min-h-[40px] px-4 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    khutbahSubTab === 'guide'
                      ? 'bg-white dark:bg-[#142820] text-slate-950 dark:text-white shadow-sm font-semibold'
                      : 'text-slate-600 dark:text-stone-400'
                  }`}
                >
                  ব্যবহারবিধি
                </button>
              </div>

              {khutbahSubTab === 'monitor' && activeSession.segments.length > 0 && (
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setOpenedSessionId(activeSession.id)}
                    className="min-h-[40px] px-4 rounded-xl border border-slate-300 dark:border-emerald-900/70 text-xs sm:text-sm font-medium text-slate-800 dark:text-stone-100 hover:bg-slate-100 dark:hover:bg-emerald-950/60 whitespace-nowrap cursor-pointer"
                  >
                    সারসংক্ষেপ ও পুরো খুতবা
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleNewSession()}
                    className="min-h-[40px] px-4 rounded-xl bg-slate-900 dark:bg-emerald-900/60 text-white text-xs sm:text-sm font-medium hover:bg-slate-800 dark:hover:bg-emerald-900 whitespace-nowrap cursor-pointer"
                  >
                    নতুন সেশন
                  </button>
                </div>
              )}
            </div>

            {khutbahSubTab === 'monitor' && (
              <LiveMonitor
                mosqueName={mosqueName}
                onMosqueNameChange={handleMosqueChange}
                segments={activeSession.segments}
                onAddSegment={handleSegmentReceived}
                status={recorder.status}
                captureEngine={recorder.captureEngine}
                onCaptureEngineChange={recorder.setCaptureEngine}
                interimArabic={recorder.interimArabic}
                isProcessingChunk={recorder.isProcessingChunk}
                errorMessage={recorder.errorMessage}
                elapsedSeconds={recorder.elapsedSeconds}
                wakeLockActive={recorder.wakeLockActive}
                keepScreenOnPref={recorder.keepScreenOnPref}
                onToggleKeepScreenOn={(next) => void recorder.toggleKeepScreenOn(next)}
                audioLevels={recorder.audioLevels}
                isBackgroundProtected={recorder.isBackgroundProtected}
                queuedChunksCount={recorder.queuedChunksCount}
                onStartRecording={() => void recorder.start()}
                onStopRecording={() => void recorder.stop()}
                onPlaySegment={handlePlaySingleSegment}
                playingSegmentId={audioPlayer.isPlaying ? audioPlayer.currentItemId : null}
                isLoadingAudio={audioPlayer.isLoadingAudio}
                onStopAudio={audioPlayer.stop}
                isDarkMode={isDarkMode}
                onToggleDarkMode={() => setIsDarkMode((d) => !d)}
              />
            )}

            {khutbahSubTab === 'saved' && (
              <SavedKhutbahs
                sessions={sessions}
                activeSessionId={activeSession.id}
                onOpenSession={(session) => setOpenedSessionId(session.id)}
                onListenSession={handleListenFullSavedSession}
                onDeleteSession={(id) => void handleDeleteSession(id)}
              />
            )}

            {khutbahSubTab === 'guide' && <OmanGuide />}
          </div>
        )}

        {mainTab === 'prayer' && (
          <PrayerAndQibla
            onPlayAudio={(items) => audioPlayer.playQueue(items, 0)}
          />
        )}

        {mainTab === 'tasbih' && (
          <TasbihAndNames
            onPlayAudio={(items) => audioPlayer.playQueue(items, 0)}
          />
        )}

        {mainTab === 'quran' && (
          <QuranHadithHub
            onPlayAudio={(items) => audioPlayer.playQueue(items, 0)}
          />
        )}
      </main>

      {/* Mini Audio Player when playing outside Reader Modal */}
      {!openedSession && (audioPlayer.isPlaying || audioPlayer.isLoadingAudio) && (
        <div className="fixed bottom-16 md:bottom-4 right-4 left-4 md:left-auto md:w-80 z-40 rounded-2xl bg-white dark:bg-[#10211B] border border-slate-200 dark:border-emerald-900 p-3.5 shadow-xl flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-900 dark:text-stone-100 truncate">
              {audioPlayer.isLoadingAudio ? 'অডিও তৈরি হচ্ছে…' : 'বাংলা অডিও চলছে'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-stone-400">
              ভয়েস প্লেব্যাক
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={audioPlayer.togglePause}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-[#0E7C66] text-white cursor-pointer"
              aria-label="বিরতি বা চালান"
            >
              {audioPlayer.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={audioPlayer.stop}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-600 cursor-pointer"
              aria-label="বন্ধ করুন"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Tab Bar (4 tabs, h-14 = 56px, well under 15% sticky cap) */}
      <nav
        aria-label="মোবাইল নেভিগেশন"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 dark:bg-[#0B1713]/95 backdrop-blur-md border-t border-slate-200 dark:border-emerald-950 grid grid-cols-4 items-center"
      >
        <button
          type="button"
          onClick={() => setMainTab('khutbah')}
          className={`flex flex-col items-center justify-center h-full gap-0.5 cursor-pointer ${
            mainTab === 'khutbah'
              ? 'text-[#0E7C66] dark:text-[#DFC178] font-semibold'
              : 'text-slate-500 dark:text-stone-400'
          }`}
        >
          <Mic className="w-5 h-5" />
          <span className="text-[10px] leading-none">খুতবা</span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('prayer')}
          className={`flex flex-col items-center justify-center h-full gap-0.5 cursor-pointer ${
            mainTab === 'prayer'
              ? 'text-[#0E7C66] dark:text-[#DFC178] font-semibold'
              : 'text-slate-500 dark:text-stone-400'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] leading-none">নামাজ</span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('tasbih')}
          className={`flex flex-col items-center justify-center h-full gap-0.5 cursor-pointer ${
            mainTab === 'tasbih'
              ? 'text-[#0E7C66] dark:text-[#DFC178] font-semibold'
              : 'text-slate-500 dark:text-stone-400'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] leading-none">তাসবিহ</span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('quran')}
          className={`flex flex-col items-center justify-center h-full gap-0.5 cursor-pointer ${
            mainTab === 'quran'
              ? 'text-[#0E7C66] dark:text-[#DFC178] font-semibold'
              : 'text-slate-500 dark:text-stone-400'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] leading-none">কুরআন</span>
        </button>
      </nav>

      {/* Full Reader & Audio Player Modal */}
      {openedSession && (
        <KhutbahReaderModal
          session={openedSession}
          onClose={() => setOpenedSessionId(null)}
          onUpdateSession={(updated) => void handleUpdateSavedSession(updated)}
          isPlaying={audioPlayer.isPlaying}
          isLoadingAudio={audioPlayer.isLoadingAudio}
          currentItemId={audioPlayer.currentItemId}
          currentIndex={audioPlayer.currentIndex}
          totalItems={audioPlayer.totalItems}
          playbackRate={audioPlayer.playbackRate}
          onChangePlaybackRate={audioPlayer.setPlaybackRate}
          voiceName={audioPlayer.voiceName}
          onChangeVoiceName={audioPlayer.setVoiceName}
          onPlayQueue={audioPlayer.playQueue}
          onTogglePause={audioPlayer.togglePause}
          onStopAudio={audioPlayer.stop}
          onNextAudio={audioPlayer.next}
          onPrevAudio={audioPlayer.previous}
        />
      )}

      <OfflineIndicator />
    </div>
  );
}
