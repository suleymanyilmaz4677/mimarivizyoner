
// api/suggest.js
// Vercel Serverless Function — DEMO (quota harcamaz)

export default async function suggest(req, res) {
  // Sadece POST kabul et
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Yalnızca POST isteği kabul edilir.', is_mock: true });
  }

  try {
    const { image_base64, image_mime_type, user_prompt, scene_type, scene_desc } = req.body || {};

    // Basit validasyon
    if (!user_prompt || !scene_type) {
      return res.status(400).json({ error: 'Eksik alan: user_prompt ve scene_type gerekli.', is_mock: true });
    }

    // DEMO: Gerçek API çağrısı YOK. Burada SVG oluşturup base64 döndürüyoruz.
    // Scene'e göre renk/palet seçimi:
    const scenePalettes = {
      OutdoorDay: { bg: '#E8F6FF', accent: '#2B93E8', label: 'Dış Mekan / Gündüz' },
      OutdoorSunset: { bg: '#FFF0E6', accent: '#FF7A59', label: 'Gün batımı / Altın saat' },
      OutdoorNight: { bg: '#0E1B2A', accent: '#7BD0FF', label: 'Gece / Atmosferik ışık' },
      Indoor: { bg: '#F7F7F9', accent: '#5B7CFA', label: 'İç Mekan / Dengeli ışık' },
    };

    const scene = scenePalettes[scene_type] || scenePalettes.OutdoorDay;

    // SVG oluştur (basit, hızlı, demo-uygun)
    // Prompt'tan kısa bir başlık üret:
    const shortPrompt = (user_prompt || '').replace(/\s+/g, ' ').trim().slice(0, 120).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
        <rect width="100%" height="100%" fill="${scene.bg}" />
        <!-- basit bina/kubbe ikonografisi -->
        <g transform="translate(120,120) scale(1.1)">
          <rect x="200" y="120" width="520" height="340" rx="12" fill="#ffffff" opacity="0.95" stroke="${scene.accent}" stroke-width="6"/>
          <rect x="240" y="160" width="80" height="60" rx="4" fill="${scene.bg}" stroke="${scene.accent}" stroke-width="3"/>
          <rect x="360" y="160" width="80" height="60" rx="4" fill="${scene.bg}" stroke="${scene.accent}" stroke-width="3"/>
          <rect x="480" y="160" width="80" height="60" rx="4" fill="${scene.bg}" stroke="${scene.accent}" stroke-width="3"/>
          <rect x="600" y="160" width="80" height="60" rx="4" fill="${scene.bg}" stroke="${scene.accent}" stroke-width="3"/>
          <rect x="240" y="260" width="440" height="140" rx="6" fill="#f8f8f8" opacity="0.8" />
        </g>

        <!-- sahne etiketi -->
        <rect x="24" y="24" rx="10" fill="${scene.accent}" opacity="0.12" />
        <text x="40" y="58" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="20" fill="${scene.accent}" font-weight="700">
          ${scene.label}
        </text>

        <!-- prompt özet -->
        <foreignObject x="40" y="520" width="1120" height="120">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, Arial, Helvetica, sans-serif; color:#222; font-size:16px; line-height:1.25;">
            <div style="background:rgba(255,255,255,0.9);padding:10px;border-radius:10px;border:1px solid ${scene.accent};">
              <strong style="color:${scene.accent}">Prompt (kısa):</strong>
              <div style="margin-top:6px;color:#333">${shortPrompt || '—'}</div>
            </div>
          </div>
        </foreignObject>

        <!-- küçük not -->
        <text x="40" y="660" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="12" fill="#666">
          Demo mod: Gerçek üretim yapılmadı — kota harcanmaz.
        </text>
      </svg>
    `;

    // Base64 encode
    const image_base64_out = Buffer.from(svg).toString('base64');
    const image_mime = 'image/svg+xml';

    // Kullanıcıya dönecek açıklama
    const result_text = `Demo (${scene.label}): ${shortPrompt ? shortPrompt : 'Kısa prompt yok'}`;

    return res.status(200).json({
      image_base64: image_base64_out,
      image_mime,
      result_text,
      is_mock: true
    });

  } catch (err) {
    console.error('Suggest DEMO hata:', err);
    return res.status(500).json({ error: 'Sunucu hatası (demo).', is_mock: true });
  }
}
