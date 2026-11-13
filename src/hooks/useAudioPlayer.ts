import { useCallback, useEffect, useRef, useState } from 'react';

export interface PlayableItem {
  id: string;
  text: string;
  label?: string;
}

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [voiceName, setVoiceName] = useState<string>('Charon');
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const queueRef = useRef<PlayableItem[]>([]);
  const indexRef = useRef<number>(-1);
  const isStoppedRef = useRef<boolean>(true);
  const rateRef = useRef<number>(1.0);
  const voiceRef = useRef<string>('Charon');

  useEffect(() => {
    rateRef.current = playbackRate;
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    voiceRef.current = voiceName;
  }, [voiceName]);

  const stop = useCallback(() => {
    isStoppedRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsLoadingAudio(false);
    setCurrentItemId(null);
    setCurrentIndex(-1);
  }, []);

  const playSingleItem = useCallback(async (items: PlayableItem[], idx: number) => {
    if (isStoppedRef.current || idx < 0 || idx >= items.length) {
      stop();
      return;
    }

    const item = items[idx];
    indexRef.current = idx;
    setCurrentIndex(idx);
    setTotalItems(items.length);
    setCurrentItemId(item.id);
    setError(null);

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: item.label || 'খুতবা বাংলা অডিও',
          artist: 'Khutbah Live',
          artwork: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
        });
        navigator.mediaSession.playbackState = 'playing';
      } catch {
        // ignore
      }
    }

    const cacheKey = `${voiceRef.current}:${item.id}:${item.text.slice(0, 60)}`;
    let audioUrl = cacheRef.current.get(cacheKey);

    if (!audioUrl) {
      setIsLoadingAudio(true);
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: item.text, voice: voiceRef.current }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || 'TTS failed');
        }
        const data = (await res.json()) as { audioBase64: string; mimeType: string };
        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
        audioUrl = URL.createObjectURL(blob);
        cacheRef.current.set(cacheKey, audioUrl);
      } catch (err) {
        setIsLoadingAudio(false);
        // Offline / fallback to browser SpeechSynthesis if available
        if ('speechSynthesis' in window && !isStoppedRef.current) {
          const utterance = new SpeechSynthesisUtterance(item.text);
          utterance.lang = 'bn-BD';
          utterance.rate = rateRef.current;
          utterance.onstart = () => setIsPlaying(true);
          utterance.onend = () => {
            if (!isStoppedRef.current) {
              void playSingleItem(items, idx + 1);
            }
          };
          utterance.onerror = () => {
            setError(err instanceof Error ? err.message : 'অডিও চালু করা যায়নি।');
            stop();
          };
          window.speechSynthesis.speak(utterance);
          return;
        }
        setError(err instanceof Error ? err.message : 'অডিও তৈরি করা যায়নি।');
        stop();
        return;
      }
      setIsLoadingAudio(false);
    }

    if (isStoppedRef.current) return;

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    audio.src = audioUrl;
    audio.playbackRate = rateRef.current;
    audio.onended = () => {
      if (!isStoppedRef.current) {
        void playSingleItem(items, idx + 1);
      }
    };
    audio.onerror = () => {
      setError('অডিও প্লেব্যাক সমস্যা হয়েছে।');
      stop();
    };

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setError('ব্রাউজার অডিও প্লে ব্লক করেছে—পুনরায় ট্যাপ করুন।');
      setIsPlaying(false);
    }
  }, [stop]);

  const playQueue = useCallback(
    (items: PlayableItem[], startIndex = 0) => {
      const valid = items.filter((i) => i.text && i.text.trim().length > 0);
      if (valid.length === 0) return;
      stop();
      isStoppedRef.current = false;
      queueRef.current = valid;
      void playSingleItem(valid, Math.max(0, Math.min(startIndex, valid.length - 1)));
    },
    [playSingleItem, stop]
  );

  const togglePause = useCallback(() => {
    if (audioRef.current && currentItemId) {
      if (audioRef.current.paused) {
        void audioRef.current.play();
        setIsPlaying(true);
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [currentItemId]);

  const next = useCallback(() => {
    if (queueRef.current.length > 0 && indexRef.current + 1 < queueRef.current.length) {
      isStoppedRef.current = false;
      void playSingleItem(queueRef.current, indexRef.current + 1);
    }
  }, [playSingleItem]);

  const previous = useCallback(() => {
    if (queueRef.current.length > 0 && indexRef.current - 1 >= 0) {
      isStoppedRef.current = false;
      void playSingleItem(queueRef.current, indexRef.current - 1);
    }
  }, [playSingleItem]);

  useEffect(() => {
    return () => {
      stop();
      cacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      cacheRef.current.clear();
    };
  }, [stop]);

  return {
    isPlaying,
    isLoadingAudio,
    currentItemId,
    currentIndex,
    totalItems,
    playbackRate,
    setPlaybackRate,
    voiceName,
    setVoiceName,
    error,
    playQueue,
    togglePause,
    stop,
    next,
    previous,
  };
}
