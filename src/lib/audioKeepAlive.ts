// Generates a tiny valid 1-second silent WAV data URI so mobile browsers
// keep the audio session alive when the screen turns off.
export function createSilentWavDataUri(): string {
  const sampleRate = 8000;
  const numSamples = 8000; // 1 second of silence
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

// Downsample Float32 audio from inputSampleRate to 16000Hz 16-bit PCM base64
export function downsampleTo16kPcmBase64(
  float32Samples: Float32Array,
  inputSampleRate: number
): string {
  const targetRate = 16000;
  let output: Int16Array;

  if (inputSampleRate === targetRate) {
    output = new Int16Array(float32Samples.length);
    for (let i = 0; i < float32Samples.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Samples[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  } else {
    const ratio = inputSampleRate / targetRate;
    const newLength = Math.round(float32Samples.length / ratio);
    output = new Int16Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < newLength) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < float32Samples.length; i++) {
        accum += float32Samples[i];
        count++;
      }
      const avg = count > 0 ? accum / count : 0;
      const s = Math.max(-1, Math.min(1, avg));
      output[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7fff;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
  }

  const bytes = new Uint8Array(output.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const idx = res.indexOf(',');
      resolve(idx >= 0 ? res.slice(idx + 1) : res);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function setMediaSessionRecordingMetadata(mosqueName: string, onStop?: () => void) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'খুতবা লাইভ — অনুবাদ চলছে',
      artist: mosqueName || 'জুম্মার খুতবা (ওমান)',
      album: 'Khutbah Live Companion',
      artwork: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
    navigator.mediaSession.playbackState = 'playing';
    if (onStop) {
      navigator.mediaSession.setActionHandler('stop', onStop);
      navigator.mediaSession.setActionHandler('pause', onStop);
    }
  } catch {
    // Ignore unsupported mediaSession actions
  }
}

export function clearMediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.playbackState = 'none';
  } catch {
    // ignore
  }
}
