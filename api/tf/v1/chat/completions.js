/* ViralForge 2026 — api/tf/v1/chat/completions.js  (Vercel Serverless, ESM)
 * POST /api/tf/v1/chat/completions → chat qua Alibaba Cloud Model Studio.
 * Env: TOKENFORGE_API_KEY (bắt buộc), TOKENFORGE_BASE_URL (tuỳ chọn) */

const DEFAULT_BASE =
    'https://ws-zdt79h6linh4t7no.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1';

export const config = { maxDuration: 60 };

function baseUrl() {
    let b = (process.env.TOKENFORGE_BASE_URL || DEFAULT_BASE).trim().replace(/\/+$/, '');
    if (!/\/v1$/.test(b)) b += '/v1';
    return b;
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: { message: 'Chỉ hỗ trợ POST' } }); return; }

    const key = process.env.TOKENFORGE_API_KEY;
    if (!key) {
        res.status(500).json({ error: { message: 'Thiếu biến môi trường TOKENFORGE_API_KEY trên Vercel.' } });
        return;
    }

    let upstream;
    try {
        upstream = await fetch(`${baseUrl()}/chat/completions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})),
        });
    } catch (err) {
        res.status(502).json({ error: { message: `Không gọi được gateway: ${err.message}` } });
        return;
    }

    const ct = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status).setHeader('Content-Type', ct);
    if (ct.includes('text/event-stream') && upstream.body) {   // hỗ trợ stream
        for await (const chunk of upstream.body) res.write(Buffer.from(chunk));
        res.end();
        return;
    }
    res.send(await upstream.text());
}
