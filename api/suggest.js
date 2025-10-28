// api/suggest.js  — Vercel Serverless Function

// === Yapılandırma ===
const MODEL_NAME = process.env.MODEL_NAME || "gemini-2.5-flash-image-preview";
const KEY_POOL = (process.env.GEMINI_KEY_POOL || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const IS_DEMO = KEY_POOL.length === 0;                 // key yoksa: kota harcamayan DEMO
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MINUTE || "10", 10);

// basit IP-limit deposu (in-memory)
const buckets = new Map();
let rr = 0; // round-robin index

const sleep = ms => new Promise(r => setTimeout(r, ms));

function pickKey() {
  if (KEY_POOL.length === 0) return null;
  const k = KEY_POOL[rr % KEY_POOL.length];
  rr = (rr + 1) % KEY_POOL.length;
  return k;
}

function rateLimitOk(ip) {
  const now = Date.now(), windowStart = now - 60_000;
  for (const [k, v] of buckets) if (v.ts < windowStart) buckets.delete(k);
  const rec = buckets.get(ip);
  if (rec && rec.c >= RATE_LIMIT) return false;
  if (rec) { rec.c++; rec.ts = now; } else { buckets.set(ip, { c:1, ts: now }); }
  return true;
}

function error(res, code, msg, log) {
  if (log) console.error("[API ERROR]", log);
  res.status(code).json({ error: msg, is_mock: IS_DEMO });
}

// === DEMO (kotasız) ===
const MOCK_IMG = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzBL7zAAAAAXNSR0IArs4c6QAAADFJREFUWEft0SEBAAAAg7Da3P8qW60c3gSFEIQAChCEAArhAARXgAIJXQAhCCEEIYSf9984AGK0iO7nAAAAAElFTkSuQmCC";
const MOCK = {
  OutdoorDay:   { t: "Demo (Gündüz): Parlak doğal ışık." , b64: MOCK_IMG },
  OutdoorSunset:{ t: "Demo (Gün batımı): Altın saat."     , b64: MOCK_IMG },
  OutdoorNight: { t: "Demo (Gece): Yapay ışık."           , b64: MOCK_IMG },
  Indoor:       { t: "Demo (İç Mekan): Dengeli ışık."     , b64: MOCK_IMG },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return error(res, 405, "Yalnızca POST desteklenir.");

  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anon";
  if (!IS_DEMO && !rateLimitOk(ip)) return error(res, 429, "Hız limiti aşıldı. 1 dk sonra tekrar deneyin.");

  const { image_base64, image_mime_type, user_prompt, scene_type, scene_desc } = req.body || {};
  if (!image_base64 || !image_mime_type || !user_prompt || !scene_type || !scene_desc)
    return error(res, 400, "Gerekli alanlar eksik (görsel, mime, stil, sahne).");

  // DEMO mod: kota harcamaz
  if (IS_DEMO) {
    await sleep(800);
    const m = MOCK[scene_type] || MOCK.OutdoorDay;
    return res.status(200).json({ image_base64: m.b64, result_text: m.t, is_mock: true });
  }

  // Gerçek istek (Gemini)
  const API_KEY = pickKey();
  if (!API_KEY) return error(res, 500, "API anahtarı bulunamadı.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
  const fullPrompt =
    `Kullanıcının eskizindeki kompozisyonu koruyarak fotogerçekçi render üret. ` +
    `Malzeme/stil: ${user_prompt}. Sahne: ${scene_desc}. ` +
    `Yüksek çözünürlük, gerçekçi doku ve ışık-gölge.`;

  const payload = {
    contents: [{
      role: "user",
      parts: [
        { text: fullPrompt },
        { inlineData: { mimeType: image_mime_type, data: image_base64 } }
      ]
    }],
    generationConfig: { temperature: 0.5, responseModalities: ["IMAGE","TEXT"] }
  };

  const TRY = 3;
  let lastErr;

  for (let i = 0; i < TRY; i++) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();

      if (!r.ok) {
        const msg = j?.error?.message || `HTTP ${r.status}`;
        if (r.status === 429 || r.status >= 500) { lastErr = msg; await sleep((i+1)*1000); continue; }
        return error(res, r.status, `API hatası: ${msg}`, msg);
      }

      const cand = j?.candidates?.[0]?.content?.parts || [];
      const img = cand.find(p => p.inlineData?.mimeType?.startsWith("image/"));
      const txt = cand.find(p => typeof p.text === "string");
      if (!img || !img.inlineData?.data) throw new Error("Görsel bulunamadı");
      return res.status(200).json({
        image_base64: img.inlineData.data,
        result_text: txt?.text || "",
        is_mock: false
      });
    } catch (e) {
      lastErr = e?.message || String(e);
      await sleep((i+1)*1000);
    }
  }

  return error(res, 500, "Görsel oluşturma başarısız (tekrar deneyiniz).", lastErr);
}
