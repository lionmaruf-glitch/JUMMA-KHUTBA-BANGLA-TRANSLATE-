// Synthesized crisp tactile Tasbih bead click and soft reminder chime via Web Audio API
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

export function playTasbihClickSound(isMilestone = false): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  if (isMilestone) {
    // Warm two-note chime on 33 / 99 / 100 completion
    const freqs = [523.25, 659.25, 783.99];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.08);
      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.46);
    });
    return;
  }

  // Crisp wooden/stone tasbih bead click
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(860, now);
  osc.frequency.exponentialRampToValueAtTime(280, now + 0.035);
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.045);
}

export function playPrayerKnockSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Two gentle resonant knocks / spiritual chime
  [0, 0.16].forEach((delay, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(idx === 0 ? 440 : 554.37, now + delay);
    gain.gain.setValueAtTime(0.001, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.16, now + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.36);
  });
}

export interface OmanCity {
  id: string;
  nameBn: string;
  lat: number;
  lng: number;
}

export const OMAN_CITIES: OmanCity[] = [
  { id: 'muscat', nameBn: 'মাস্কাট (Muscat)', lat: 23.588, lng: 58.3829 },
  { id: 'salalah', nameBn: 'সালালাহ (Salalah)', lat: 17.0151, lng: 54.0924 },
  { id: 'sohar', nameBn: 'সোহার (Sohar)', lat: 24.3461, lng: 56.7075 },
  { id: 'nizwa', nameBn: 'নিজওয়া (Nizwa)', lat: 22.9333, lng: 57.5333 },
  { id: 'sur', nameBn: 'সুর (Sur)', lat: 22.5667, lng: 59.5289 },
  { id: 'ibri', nameBn: 'ইবরি (Ibri)', lat: 23.2257, lng: 56.5157 },
  { id: 'buraimi', nameBn: 'বুরাইমি (Al Buraimi)', lat: 24.2509, lng: 55.7931 },
  { id: 'barka', nameBn: 'বারকা (Barka)', lat: 23.6787, lng: 57.8861 },
  { id: 'rustaq', nameBn: 'রুস্তাক (Rustaq)', lat: 23.3908, lng: 57.4244 },
  { id: 'khasab', nameBn: 'খাসাব (Khasab)', lat: 26.1799, lng: 56.2477 },
];

// Spherical trigonometry bearing from (lat, lng) to Kaaba (21.422487, 39.826206)
export function calculateQiblaAngle(lat: number, lng: number): number {
  const rad = Math.PI / 180;
  const kaabaLat = 21.422487 * rad;
  const kaabaLng = 39.826206 * rad;
  const userLat = lat * rad;
  const userLng = lng * rad;

  const dLng = kaabaLng - userLng;
  const y = Math.sin(dLng);
  const x =
    Math.cos(userLat) * Math.tan(kaabaLat) - Math.sin(userLat) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export interface DailyPrayerTimes {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  rawMinutes: Record<'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', number>;
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

function fixHour(a: number): number {
  let res = a - 24 * Math.floor(a / 24);
  if (res < 0) res += 24;
  return res;
}

function formatHourToTime(hourFloat: number): { label: string; totalMinutes: number } {
  const hNormalized = fixHour(hourFloat + 0.5 / 60);
  const hrs24 = Math.floor(hNormalized);
  const mins = Math.floor((hNormalized - hrs24) * 60);
  const period = hrs24 >= 12 ? 'PM' : 'AM';
  const hrs12 = hrs24 % 12 === 0 ? 12 : hrs24 % 12;
  return {
    label: `${hrs12}:${String(mins).padStart(2, '0')} ${period}`,
    totalMinutes: hrs24 * 60 + mins,
  };
}

// Astronomical prayer time calculation (Oman / Gulf Umm al-Qura standard: Fajr 18.5°, Isha 18°)
export function calculatePrayerTimes(
  lat: number,
  lng: number,
  date: Date = new Date(),
  tzOffsetHours = 4 // Oman GST = UTC+4
): DailyPrayerTimes {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  const jd =
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    B -
    1524.5;

  const d = jd - 2451545.0;
  const g = toRadians((357.529 + 0.98560028 * d) % 360);
  const q = (280.459 + 0.98564736 * d) % 360;
  const L = toRadians((q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) % 360);
  const e = toRadians(23.439 - 0.00000036 * d);

  const RA = toDegrees(Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L))) / 15;
  const decl = Math.asin(Math.sin(e) * Math.sin(L));
  const eqt = q / 15 - fixHour(RA);

  const dhuhrHour = 12 + tzOffsetHours - lng / 15 - eqt;

  const hourAngleForElevation = (angleDeg: number): number => {
    const phi = toRadians(lat);
    const num = -Math.sin(toRadians(angleDeg)) - Math.sin(phi) * Math.sin(decl);
    const den = Math.cos(phi) * Math.cos(decl);
    const cosVal = Math.max(-1, Math.min(1, num / den));
    return toDegrees(Math.acos(cosVal)) / 15;
  };

  const asrHourAngle = (): number => {
    const phi = toRadians(lat);
    const angle = -toDegrees(Math.atan(1 / (1 + Math.tan(Math.abs(phi - decl)))));
    return hourAngleForElevation(-angle);
  };

  const fajr = formatHourToTime(dhuhrHour - hourAngleForElevation(18.5));
  const sunrise = formatHourToTime(dhuhrHour - hourAngleForElevation(0.833));
  const dhuhr = formatHourToTime(dhuhrHour + 2 / 60); // 2 min safety margin
  const asr = formatHourToTime(dhuhrHour + asrHourAngle());
  const maghrib = formatHourToTime(dhuhrHour + hourAngleForElevation(0.833));
  const isha = formatHourToTime(dhuhrHour + hourAngleForElevation(18));

  return {
    fajr: fajr.label,
    sunrise: sunrise.label,
    dhuhr: dhuhr.label,
    asr: asr.label,
    maghrib: maghrib.label,
    isha: isha.label,
    rawMinutes: {
      fajr: fajr.totalMinutes,
      sunrise: sunrise.totalMinutes,
      dhuhr: dhuhr.totalMinutes,
      asr: asr.totalMinutes,
      maghrib: maghrib.totalMinutes,
      isha: isha.totalMinutes,
    },
  };
}
