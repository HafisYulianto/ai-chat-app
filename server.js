// server.js (ESM) — backend Gemini
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* --- CORS --- */
const corsOrigin = process.env.FRONTEND_ORIGIN || true; // dev: reflect origin
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '1mb' }));

/* --- Rate limit sederhana --- */
app.use('/api/', rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
}));

/* --- Static: serve /public untuk dev --- */
app.use(express.static(path.join(__dirname, 'public')));

/* --- Gemini setup --- */
if (!process.env.GEMINI_API_KEY) {
  console.warn('[WARN] GEMINI_API_KEY belum di-set di .env');
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

/* --- Health --- */
app.get('/health', (_req, res) => {
  res.json({ ok: true, model: MODEL, time: new Date().toISOString() });
});

/* --- Chat endpoint --- */
app.post('/api/chat', async (req, res) => {
  try {
    const text = (req.body?.message || '').trim();

    if (!text) return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
    if (text.length > 500) return res.status(400).json({ error: 'Panjang pesan maksimal 500 karakter.' });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'Server belum dikonfigurasi GEMINI_API_KEY.' });

    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(text);
    const reply = result?.response?.text?.() || 'Maaf, tidak ada respons.';

    res.json({ reply });
  } catch (err) {
    console.error('[API ERROR]', err);
    res.status(500).json({ error: err?.message || 'Terjadi kesalahan tak terduga.' });
  }
});

/* --- Start server --- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server (Gemini) berjalan di http://localhost:${PORT}`);
});
