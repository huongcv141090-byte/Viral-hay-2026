/* ViralForge 2026 — api/tf/v1/models.js  (Vercel Serverless, ESM)
 * GET /api/tf/v1/models → danh sách model từ Alibaba Cloud Model Studio.
 * Env: TOKENFORGE_API_KEY (bắt buộc), TOKENFORGE_BASE_URL (tuỳ chọn) */

const DEFAULT_BASE =
    'https://ws-zdt79h6linh4t7no.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1';

function baseUrl() {
    let b = (process.env.TOKENFORGE_BASE_URL || DEFAULT_BASE).trim().replace(/\/+$/, '');
    if (!/\/v1$/.test(b)) b += '/v1';
    return b;
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    if (req.method !== 'GET') { res.status(405).json({ error: { message: 'Chỉ hỗ trợ GET' } }); return; }

    const key = process.env.TOKENFORGE_API_KEY;
    if (!key) {
        res.status(500).json({ error: { message: 'Thiếu biến môi trường TOKENFORGE_API_KEY trên Vercel.' } });
        return;
    }

    try {
        const upstream = await fetch(`${baseUrl()}/models`, {
            headers: { Authorization: `Bearer ${key}` },
        });
        res.status(upstream.status)
           .setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
        res.send(await upstream.text());
    } catch (err) {
        res.status(502).json({ error: { message: `Không gọi được gateway: ${err.message}` } });
    }
}
