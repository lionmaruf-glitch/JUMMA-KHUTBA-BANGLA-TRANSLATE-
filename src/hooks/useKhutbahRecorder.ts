import { useCallback, useEffect, useRef, useState } from 'react';
import {
  blobToBase64,
  clearMediaSession,
  createSilentWavDataUri,
  downsampleTo16kPcmBase64,
  setMediaSessionRecordingMetadata,
} from '../lib/audioKeepAlive';
import type { KhutbahSegment } from '../types/khutbah';

export type RecorderStatus = 'idle' | 'connecting' | 'recording' | 'paused' | 'error';
export type CaptureEngine = 'hybrid' | 'chunk';

interface UseKhutbahRecorderOptions {
  mosqueName: string;
  onSegmentReceived: (segment: KhutbahSegment) => void;
}

export function useKhutbahRecorder({
  mosqueName,
  onSegmentReceived,
}: UseKhutbahRecorderOptions) {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [captureEngine, setCaptureEngine] = useState<CaptureEngine>('hybrid');
  const [interimArabic, setInterimArabic] = useState<string>('');
  const [isProcessingChunk, setIsProcessingChunk] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [keepScreenOnPref, setKeepScreenOnPref] = useState<boolean>(true);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(16).fill(0.08));
  const [isBackgroundProtected, setIsBackgroundProtected] = useState<boolean>(false);
  const [queuedChunksCount, setQueuedChunksCount] = useState<number>(0);

  const onSegmentRef = useRef(onSegmentReceived);
  onSegmentRef.current = onSegmentReceived;

  const mosqueRef = useRef(mosqueName);
  mosqueRef.current = mosqueName;

  const statusRef = useRef<RecorderStatus>('idle');
  statusRef.current = status;

  const captureEngineRef = useRef<CaptureEngine>('hybrid');
  captureEngineRef.current = captureEngine;

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsConnectedRef = useRef<boolean>(false);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recentBengaliContextRef = useRef<string[]>([]);
  const pendingOfflineQueueRef = useRef<Array<{ base64: string; mimeType: string }>>([]);
  const lastLiveSegmentAtRef = useRef<number>(0);

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setWakeLockActive(true);
      wakeLockRef.current.addEventListener('release', () => {
        setWakeLockActive(false);
      });
    } catch {
      setWakeLockActive(false);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // ignore
      }
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
  }, []);

  const toggleKeepScreenOn = useCallback(
    async (next: boolean) => {
      setKeepScreenOnPref(next);
      if (statusRef.current === 'recording') {
        if (next) {
          await requestWakeLock();
        } else {
          await releaseWakeLock();
        }
      }
    },
    [releaseWakeLock, requestWakeLock]
  );

  const sendChunkToServer = useCallback(async (base64: string, mimeType: string) => {
    setIsProcessingChunk(true);
    try {
      const res = await fetch('/api/khutbah/process-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType,
          previousContext: recentBengaliContextRef.current.slice(-3).join(' '),
        }),
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error || 'অডিও অনুবাদে সমস্যা হয়েছে।');
      }
      const data = (await res.json()) as {
        empty?: boolean;
        segment?: KhutbahSegment;
      };
      if (!data.empty && data.segment) {
        recentBengaliContextRef.current.push(data.segment.bengali);
        onSegmentRef.current(data.segment);
        setErrorMessage(null);
      }
    } catch (err) {
      if (!navigator.onLine) {
        pendingOfflineQueueRef.current.push({ base64, mimeType });
        setQueuedChunksCount(pendingOfflineQueueRef.current.length);
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'সার্ভারের সাথে সংযোগ সমস্যা।');
      }
    } finally {
      setIsProcessingChunk(false);
    }
  }, []);

  // Flush queued chunks when back online
  useEffect(() => {
    const handleOnline = async () => {
      if (pendingOfflineQueueRef.current.length === 0) return;
      const items = [...pendingOfflineQueueRef.current];
      pendingOfflineQueueRef.current = [];
      setQueuedChunksCount(0);
      for (const item of items) {
        await sendChunkToServer(item.base64, item.mimeType);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [sendChunkToServer]);

  const startChunkCycle = useCallback(
    (stream: MediaStream) => {
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const supportedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';

      const recordSingleSlice = () => {
        if (statusRef.current !== 'recording') return;

        // Only upload chunk via REST if:
        // 1. User selected 'chunk' mode, OR
        // 2. Screen is off / page hidden (MediaRecorder survives screen lock best!), OR
        // 3. WebSocket isn't connected or hasn't yielded a live segment in the past 14 seconds while audio is active
        const shouldUseChunkFallback =
          captureEngineRef.current === 'chunk' ||
          document.visibilityState === 'hidden' ||
          !wsConnectedRef.current ||
          Date.now() - lastLiveSegmentAtRef.current > 16000;

        if (!shouldUseChunkFallback) return;

        try {
          const recorder = supportedMime
            ? new MediaRecorder(stream, { mimeType: supportedMime })
            : new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          const chunks: BlobPart[] = [];

          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              chunks.push(ev.data);
            }
          };

          recorder.onstop = async () => {
            if (chunks.length === 0) return;
            const blob = new Blob(chunks, {
              type: recorder.mimeType || supportedMime || 'audio/webm',
            });
            if (blob.size < 1800) return;
            const base64 = await blobToBase64(blob);
            await sendChunkToServer(base64, blob.type);
          };

          recorder.start();
          setTimeout(() => {
            if (recorder.state === 'recording') {
              recorder.stop();
            }
          }, 9500);
        } catch (err) {
          console.error('MediaRecorder slice failed:', err);
        }
      };

      recordSingleSlice();
      chunkIntervalRef.current = setInterval(recordSingleSlice, 10000);
    },
    [sendChunkToServer]
  );

  const connectWebSocket = useCallback(() => {
    if (captureEngineRef.current === 'chunk') return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/khutbah`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      wsConnectedRef.current = true;
      lastLiveSegmentAtRef.current = Date.now();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          arabic?: string;
          segment?: KhutbahSegment;
          state?: string;
          message?: string;
        };
        if (msg.type === 'interim' && typeof msg.arabic === 'string') {
          setInterimArabic(msg.arabic);
        } else if (msg.type === 'segment' && msg.segment) {
          lastLiveSegmentAtRef.current = Date.now();
          setInterimArabic('');
          recentBengaliContextRef.current.push(msg.segment.bengali);
          onSegmentRef.current(msg.segment);
        } else if (msg.type === 'status' && msg.state === 'error') {
          wsConnectedRef.current = false;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      wsConnectedRef.current = false;
    };

    ws.onclose = () => {
      wsConnectedRef.current = false;
    };
  }, []);

  const stop = useCallback(async () => {
    setStatus('idle');
    setInterimArabic('');
    setIsBackgroundProtected(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'flush' }));
        }
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
      wsConnectedRef.current = false;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        await audioCtxRef.current.close();
      } catch {
        // ignore
      }
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (silentAudioRef.current) {
      silentAudioRef.current.pause();
      silentAudioRef.current = null;
    }
    clearMediaSession();
    await releaseWakeLock();
    setAudioLevels(new Array(16).fill(0.08));
  }, [releaseWakeLock]);

  const start = useCallback(async () => {
    setErrorMessage(null);
    setStatus('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Silent background audio loop + MediaSession keeps recording alive when mobile screen turns off
      try {
        const silentAudio = new Audio(createSilentWavDataUri());
        silentAudio.loop = true;
        silentAudio.volume = 0.01;
        await silentAudio.play();
        silentAudioRef.current = silentAudio;
        setMediaSessionRecordingMetadata(mosqueRef.current, () => {
          void stop();
        });
        setIsBackgroundProtected(true);
      } catch {
        setIsBackgroundProtected(false);
      }

      if (keepScreenOnPref) {
        await requestWakeLock();
      }

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      source.connect(analyser);

      // ScriptProcessor to send 16kHz PCM frames over WebSocket
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(audioCtx.destination);

      processor.onaudioprocess = (e) => {
        if (
          statusRef.current !== 'recording' ||
          captureEngineRef.current === 'chunk' ||
          document.visibilityState === 'hidden'
        ) {
          return;
        }
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const base64Pcm = downsampleTo16kPcmBase64(inputData, audioCtx.sampleRate);
          ws.send(JSON.stringify({ type: 'audio', audio: base64Pcm }));
        }
      };

      // Visual level meter loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        if (statusRef.current !== 'recording') return;
        analyser.getByteFrequencyData(dataArray);
        const bars: number[] = [];
        for (let i = 0; i < 16; i++) {
          const v = dataArray[i] / 255;
          bars.push(Math.max(0.08, Math.min(1, v * 1.35)));
        }
        setAudioLevels(bars);
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      setStatus('recording');
      statusRef.current = 'recording';
      setElapsedSeconds(0);

      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      connectWebSocket();
      startChunkCycle(stream);
      animFrameRef.current = requestAnimationFrame(updateMeter);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'মাইক্রোফোন অ্যাক্সেস পাওয়া যায়নি। অনুগ্রহ করে পারমিশন দিন।';
      setErrorMessage(message);
      setStatus('error');
      await stop();
    }
  }, [connectWebSocket, keepScreenOnPref, requestWakeLock, startChunkCycle, stop]);

  // Re-acquire wakeLock & resume AudioContext when returning from screen-off
  useEffect(() => {
    const handleVisibility = async () => {
      if (statusRef.current !== 'recording') return;
      if (document.visibilityState === 'visible') {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          try {
            await audioCtxRef.current.resume();
          } catch {
            // ignore
          }
        }
        if (keepScreenOnPref) {
          await requestWakeLock();
        }
        if (
          captureEngineRef.current === 'hybrid' &&
          (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
        ) {
          connectWebSocket();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [connectWebSocket, keepScreenOnPref, requestWakeLock]);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  const resetTimer = useCallback(() => {
    setElapsedSeconds(0);
    recentBengaliContextRef.current = [];
  }, []);

  return {
    status,
    captureEngine,
    setCaptureEngine,
    interimArabic,
    isProcessingChunk,
    errorMessage,
    setErrorMessage,
    elapsedSeconds,
    wakeLockActive,
    keepScreenOnPref,
    toggleKeepScreenOn,
    audioLevels,
    isBackgroundProtected,
    queuedChunksCount,
    start,
    stop,
    resetTimer,
  };
}
