import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import {
  GoogleGenAI,
  Modality,
  ThinkingLevel,
  Type,
  type LiveServerMessage,
} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface TranslatedSegmentResult {
  arabic: string;
  bengali: string;
  category: 'quran' | 'hadith' | 'dua' | 'sermon';
  topicHint: string;
}

const KHUTBAH_SYSTEM_INSTRUCTION = `You are an expert Islamic scholar and Arabic-to-Bengali translator assisting Bengali-speaking expatriates in Oman during Friday (Jumu'ah) Khutbah.
Translate the Arabic Khutbah speech into clear, natural, respectful, and deeply understandable Bengali (বাংলা).
Rules:
1. Preserve the spiritual tone and complete meaning—do not summarize away details; translate thoroughly so the listener understands every point the Imam is making.
2. If the Arabic contains a Quranic verse (আয়াত), Hadith (হাদিস), or Du'a (দোয়া), translate its full meaning accurately into natural Bengali and tag the category appropriately.
3. For classical Islamic salutations (like "أما بعد", "عباد الله", "اتقوا الله"), render them in natural, dignified Bengali ("অতঃপর", "হে আল্লাহর বান্দাগণ", "আল্লাহকে ভয় করুন / তাকওয়া অবলম্বন করুন").
4. If the Arabic input contains minor ASR noise or Omani dialect pronunciation quirks, infer the intended Islamic/Arabic meaning smoothly from context.
5. Output ONLY valid JSON matching the requested schema.`;

async function translateArabicToBengali(
  ai: GoogleGenAI,
  arabicText: string,
  previousContext = ''
): Promise<TranslatedSegmentResult> {
  const trimmed = arabicText.trim();
  if (!trimmed) {
    return { arabic: '', bengali: '', category: 'sermon', topicHint: '' };
  }

  const prompt = previousContext
    ? `Recent Khutbah context (for continuity only):\n${previousContext}\n\nNew Arabic speech to translate completely into Bengali:\n"${trimmed}"`
    : `Arabic Khutbah speech to translate completely into Bengali:\n"${trimmed}"`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction: KHUTBAH_SYSTEM_INSTRUCTION,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          arabicCleaned: {
            type: Type.STRING,
            description: 'The clean, punctuated Arabic text.',
          },
          bengali: {
            type: Type.STRING,
            description: 'Complete, clear, respectful Bengali translation of the Arabic speech.',
          },
          category: {
            type: Type.STRING,
            description: 'One of: quran, hadith, dua, sermon',
          },
          topicHint: {
            type: Type.STRING,
            description: 'Very short 2-4 word Bengali topic label if evident, or empty string.',
          },
        },
        required: ['arabicCleaned', 'bengali', 'category', 'topicHint'],
      },
    },
  });

  const raw = (response.text ?? '{}').trim();
  try {
    const parsed = JSON.parse(raw) as {
      arabicCleaned?: string;
      bengali?: string;
      category?: string;
      topicHint?: string;
    };
    const validCategories = ['quran', 'hadith', 'dua', 'sermon'] as const;
    const cat = validCategories.includes(parsed.category as (typeof validCategories)[number])
      ? (parsed.category as 'quran' | 'hadith' | 'dua' | 'sermon')
      : 'sermon';

    return {
      arabic: (parsed.arabicCleaned || trimmed).trim(),
      bengali: (parsed.bengali || '').trim(),
      category: cat,
      topicHint: (parsed.topicHint || '').trim(),
    };
  } catch {
    return {
      arabic: trimmed,
      bengali: raw,
      category: 'sermon',
      topicHint: '',
    };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, hasKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  // Chunked Audio Transcription + Translation Endpoint (reliable fallback & background mobile capture)
  app.post('/api/khutbah/process-audio', async (req, res) => {
    try {
      const { audioBase64, mimeType, previousContext } = req.body as {
        audioBase64?: string;
        mimeType?: string;
        previousContext?: string;
      };

      if (!audioBase64 || !mimeType) {
        res.status(400).json({ error: 'Missing audioBase64 or mimeType.' });
        return;
      }

      const ai = getAIClient();
      const cleanMime = mimeType.split(';')[0].trim() || 'audio/webm';

      // Step 1: Dedicated Gemini audio transcription model (free tier)
      const transcribeResp = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: cleanMime,
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe the spoken Arabic Islamic Khutbah speech accurately in Arabic script. Do not translate. If the audio contains only silence, breathing, ambient noise, or unintelligible static with no spoken words, reply with exactly: [SILENCE]',
            },
          ],
        },
      });

      const transcribedText = (transcribeResp.text ?? '').trim();
      if (
        !transcribedText ||
        transcribedText === '[SILENCE]' ||
        transcribedText.includes('[SILENCE]') ||
        transcribedText.length < 3
      ) {
        res.json({ empty: true });
        return;
      }

      // Step 2: Translate Arabic transcript into clear, full Bengali
      const translated = await translateArabicToBengali(
        ai,
        transcribedText,
        previousContext || ''
      );

      if (!translated.bengali) {
        res.json({ empty: true });
        return;
      }

      res.json({
        empty: false,
        segment: {
          id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          arabic: translated.arabic,
          bengali: translated.bengali,
          category: translated.category,
          topicHint: translated.topicHint,
          timestamp: Date.now(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Audio processing failed.';
      console.error('[/api/khutbah/process-audio]', err);
      res.status(500).json({ error: message });
    }
  });

  // Translate plain Arabic text to Bengali
  app.post('/api/khutbah/translate-text', async (req, res) => {
    try {
      const { arabic, previousContext } = req.body as {
        arabic?: string;
        previousContext?: string;
      };
      if (!arabic || !arabic.trim()) {
        res.status(400).json({ error: 'Arabic text is required.' });
        return;
      }

      const ai = getAIClient();
      const translated = await translateArabicToBengali(ai, arabic, previousContext || '');
      res.json({
        segment: {
          id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          arabic: translated.arabic,
          bengali: translated.bengali,
          category: translated.category,
          topicHint: translated.topicHint,
          timestamp: Date.now(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Translation failed.';
      console.error('[/api/khutbah/translate-text]', err);
      res.status(500).json({ error: message });
    }
  });

  // Summarize full Khutbah into Bengali title, summary, and actionable takeaways
  app.post('/api/khutbah/summarize', async (req, res) => {
    try {
      const { segments } = req.body as {
        segments?: Array<{ arabic: string; bengali: string }>;
      };
      if (!segments || segments.length === 0) {
        res.status(400).json({ error: 'No Khutbah segments provided.' });
        return;
      }

      const ai = getAIClient();
      const combinedBengali = segments.map((s) => s.bengali).join('\n');
      const combinedArabic = segments.map((s) => s.arabic).join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Here is a recorded Friday Khutbah (Arabic and Bengali translation).\n\nBengali Translation:\n${combinedBengali}\n\nArabic Reference:\n${combinedArabic.slice(0, 6000)}`,
        config: {
          systemInstruction:
            'Create a clear, structured Bengali summary of this Jumuah Khutbah for Bengali expatriate Muslims in Oman. Output valid JSON only.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titleBn: {
                type: Type.STRING,
                description: 'Concise Bengali title of the Khutbah topic (4-8 words).',
              },
              summaryBn: {
                type: Type.STRING,
                description: '3 to 5 sentence warm, clear Bengali summary of the entire Khutbah.',
              },
              keyPointsBn: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 to 5 key Islamic lessons or practical takeaways in Bengali.',
              },
              referencesBn: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Any Quran verses or Hadith themes mentioned, explained briefly in Bengali.',
              },
            },
            required: ['titleBn', 'summaryBn', 'keyPointsBn', 'referencesBn'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Summary generation failed.';
      console.error('[/api/khutbah/summarize]', err);
      res.status(500).json({ error: message });
    }
  });

  // Bengali Audio Playback (Gemini TTS - free tier)
  app.post('/api/tts', async (req, res) => {
    try {
      const { text, voice } = req.body as { text?: string; voice?: string };
      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Text is required for TTS.' });
        return;
      }

      const ai = getAIClient();
      const allowedVoices = ['Kore', 'Charon', 'Puck', 'Fenrir', 'Zephyr'];
      const selectedVoice = voice && allowedVoices.includes(voice) ? voice : 'Charon';

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text.trim().slice(0, 1200),
                speechMetadata: {
                  style: 'Calm, respectful, clear Bengali narration for an Islamic Friday sermon translation',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({ error: 'No audio returned by TTS model.' });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TTS generation failed.';
      console.error('[/api/tts]', err);
      res.status(500).json({ error: message });
    }
  });

  // Daily Quran Ayat + Bangla Tafsir Bekhha (gemini-4-hydrogen free tier)
  app.post('/api/islamic/daily-ayat', async (req, res) => {
    try {
      const { theme } = req.body as { theme?: string };
      const ai = getAIClient();
      const prompt = theme
        ? `Select an authentic, uplifting verse from the Holy Quran related to "${theme}" for a Bengali Muslim expatriate in Oman. Provide the exact Arabic verse, accurate Bengali translation, detailed Bangla Tafsir Bekhha (তাফসীর ব্যাখ্যা), and practical daily Bangla advice.`
        : `Select an inspiring, authentic verse from the Holy Quran (such as from Surah Al-Baqarah, Al-Imran, Ar-Ra'd, Az-Zumar, Ash-Sharh, Al-Furqan, or Luqman) suitable for today's reflection. Provide the exact Arabic verse, accurate Bengali translation, clear Bangla Tafsir Bekhha (তাফসীর ব্যাখ্যা), and practical daily Bangla advice.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a knowledgeable Islamic scholar providing authentic Quranic verses with accurate Arabic script (Uthmani/standard), faithful Bengali translation, and accessible Tafsir explanation in clear Bengali. Return valid JSON only.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              surahInfoBn: {
                type: Type.STRING,
                description: 'Surah name and Ayah number in Bengali (e.g., সূরা আশ-শারহ, আয়াত ৫-৬).',
              },
              arabic: {
                type: Type.STRING,
                description: 'Exact Arabic text of the Quranic Ayah with diacritics.',
              },
              bengaliTranslation: {
                type: Type.STRING,
                description: 'Clear Bengali translation of the Ayah.',
              },
              tafsirBekhhaBn: {
                type: Type.STRING,
                description: 'Detailed 4-6 sentence Bangla Tafsir explanation (তাফসীর ব্যাখ্যা) based on classical Sunni Tafsir.',
              },
              dailyAdviceBn: {
                type: Type.STRING,
                description: 'Practical 2-3 sentence Bengali advice on applying this Ayah in daily life.',
              },
            },
            required: [
              'surahInfoBn',
              'arabic',
              'bengaliTranslation',
              'tafsirBekhhaBn',
              'dailyAdviceBn',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load daily Ayah.';
      console.error('[/api/islamic/daily-ayat]', err);
      res.status(500).json({ error: message });
    }
  });

  // Uncompleted Prayer Knock / Allah Sees Reminder in Bangla (gemini-4-hydrogen free tier)
  app.post('/api/islamic/prayer-reminder', async (req, res) => {
    try {
      const { prayerNameBn, statusText } = req.body as {
        prayerNameBn?: string;
        statusText?: string;
      };
      const prayer = prayerNameBn || 'নামাজ';
      const ai = getAIClient();

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `A Muslim user tapped on "${prayer}" which is currently marked as "${statusText || 'পড়া হয়নি'}". Give a gentle, deeply moving Bengali spiritual reminder (নসিহত) reminding them that Allah Ta'ala sees everything ("আল্লাহ সব দেখছেন"), the blessing of ${prayer}, and encouraging them to stand up for Salah with love and hope in Allah's mercy.`,
        config: {
          systemInstruction:
            'You are a compassionate Islamic mentor speaking in warm, respectful Bengali. Avoid harshness; inspire sincerity, Taqwa, and remembrance that Allah sees every effort. Return valid JSON only.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prayerNameBn: { type: Type.STRING },
              allahReminderBn: {
                type: Type.STRING,
                description: '2-3 heartfelt sentences in Bengali reminding that Allah sees us and awaits our Salah.',
              },
              quranOrHadithBn: {
                type: Type.STRING,
                description: 'A relevant Quran Ayah meaning or authentic Hadith about Salah/this prayer in Bengali.',
              },
              practicalStepBn: {
                type: Type.STRING,
                description: '1 encouraging practical sentence (e.g., making Wudu and praying right now).',
              },
            },
            required: ['prayerNameBn', 'allahReminderBn', 'quranOrHadithBn', 'practicalStepBn'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load reminder.';
      console.error('[/api/islamic/prayer-reminder]', err);
      res.status(500).json({ error: message });
    }
  });

  // Interactive Quran, Hadith & Muslim Life Advice in Bangla (gemini-4-hydrogen free tier)
  app.post('/api/islamic/advice', async (req, res) => {
    try {
      const { question } = req.body as { question?: string };
      if (!question || !question.trim()) {
        res.status(400).json({ error: 'প্রশ্ন লিখুন।' });
        return;
      }
      const ai = getAIClient();

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Question from a Bengali Muslim expatriate in Oman: "${question.trim()}"`,
        config: {
          systemInstruction:
            'You are a helpful, trustworthy Islamic advisor answering questions in clear, respectful Bengali based on the Quran and authentic Sunnah/Hadith. Keep advice practical, gentle, and easy to understand. Return valid JSON only.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titleBn: { type: Type.STRING, description: 'Short Bengali heading for the answer.' },
              answerBn: { type: Type.STRING, description: 'Clear 4-6 sentence guidance in Bengali.' },
              quranOrHadithRefBn: {
                type: Type.STRING,
                description: 'Supporting Quran or Hadith reference in Bengali.',
              },
              actionTipBn: {
                type: Type.STRING,
                description: 'Simple daily action or Dua to practice.',
              },
            },
            required: ['titleBn', 'answerBn', 'quranOrHadithRefBn', 'actionTipBn'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Advice request failed.';
      console.error('[/api/islamic/advice]', err);
      res.status(500).json({ error: message });
    }
  });

  // Vite middleware (dev) or static dist (prod)
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  // WebSocket Server for Real-time Live Khutbah Streaming
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host}`);
    if (reqUrl.pathname === '/ws/khutbah') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs: WebSocket) => {
    let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let isClosed = false;
    let pendingArabic = '';
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const recentBengaliHistory: string[] = [];
    let ai: GoogleGenAI;

    const sendToClient = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    const flushPendingArabic = async () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      const phrase = pendingArabic.trim();
      if (!phrase) return;
      pendingArabic = '';

      try {
        const contextStr = recentBengaliHistory.slice(-3).join(' ');
        const translated = await translateArabicToBengali(ai, phrase, contextStr);
        if (translated.bengali) {
          recentBengaliHistory.push(translated.bengali);
          sendToClient({
            type: 'segment',
            segment: {
              id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              arabic: translated.arabic,
              bengali: translated.bengali,
              category: translated.category,
              topicHint: translated.topicHint,
              timestamp: Date.now(),
            },
          });
        }
      } catch (err) {
        console.error('[WS translate error]', err);
        sendToClient({
          type: 'error',
          message: err instanceof Error ? err.message : 'Translation error',
        });
      }
    };

    try {
      ai = getAIClient();
      liveSession = await ai.live.connect({
        model: 'gemini-3.5-transcribe-live',
        config: {
          responseModalities: [Modality.TEXT],
          inputAudioTranscription: {
            languageCodes: [],
          },
        },
        callbacks: {
          onopen: () => {
            sendToClient({ type: 'status', state: 'connected' });
          },
          onmessage: (message: LiveServerMessage) => {
            if (isClosed) return;
            const content = message.serverContent;
            if (content?.interimInputTranscription?.text) {
              sendToClient({
                type: 'interim',
                arabic: `${pendingArabic} ${content.interimInputTranscription.text}`.trim(),
              });
            }
            if (content?.inputTranscription?.text) {
              const newChunk = content.inputTranscription.text.trim();
              if (newChunk) {
                pendingArabic = `${pendingArabic} ${newChunk}`.trim();
                sendToClient({ type: 'interim', arabic: pendingArabic });

                const wordCount = pendingArabic.split(/\s+/).length;
                const endsSentence = /[.،؟!؛\n]$/.test(pendingArabic);

                if (endsSentence || wordCount >= 10) {
                  void flushPendingArabic();
                } else {
                  if (flushTimer) clearTimeout(flushTimer);
                  flushTimer = setTimeout(() => {
                    void flushPendingArabic();
                  }, 2400);
                }
              }
            }
          },
          onerror: (err) => {
            console.error('[Gemini Live error]', err);
            sendToClient({
              type: 'status',
              state: 'error',
              message: 'Live stream interrupted; audio chunk backup remains active.',
            });
          },
          onclose: () => {
            if (!isClosed) {
              sendToClient({ type: 'status', state: 'closed' });
            }
          },
        },
      });
    } catch (err) {
      console.error('[WS connection setup error]', err);
      sendToClient({
        type: 'status',
        state: 'error',
        message: err instanceof Error ? err.message : 'Unable to start live stream.',
      });
    }

    clientWs.on('message', (data) => {
      if (isClosed) return;
      try {
        const msg = JSON.parse(data.toString()) as {
          type?: string;
          audio?: string;
        };
        if (msg.type === 'ping') {
          sendToClient({ type: 'pong' });
          return;
        }
        if (msg.type === 'flush') {
          void flushPendingArabic();
          return;
        }
        if (msg.audio && liveSession) {
          liveSession.sendRealtimeInput({
            audio: {
              data: msg.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        }
      } catch (err) {
        console.error('[WS message parse error]', err);
      }
    });

    clientWs.on('close', () => {
      isClosed = true;
      if (flushTimer) clearTimeout(flushTimer);
      try {
        liveSession?.close();
      } catch {
        // ignore close errors
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Khutbah Live server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
