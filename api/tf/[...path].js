/* =============================================================================
 * ViralForge 2026 — api/tf/[...path].js   (ESM, Vercel Serverless)
 * Proxy OpenAI-compatible → Alibaba Cloud Model Studio (gateway MaaS)
 *
 * Vì sao cần proxy: gateway trả 401 cho preflight OPTIONS của /chat/completions
 * nên trình duyệt chặn request. Gọi từ server thì không dính CORS, và API key
 * không bị lộ trong code client.
 *
 *   GET  /api/tf/v1/models
 *   POST /api/tf/v1/chat/completions
 *
 * Env (Vercel → Settings → Environment Variables):
 *   TOKENFORGE_API_KEY  = sk-ws-...                               (bắt buộc)
 *   TOKENFORGE_BASE_URL = https://ws-xxx.../compatible-mode/v1    (tuỳ chọn)
 * ============================================================================= */

const DEFAULT_BASE =
    'https://ws-zdt79h6linh4t7no.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1';

export const config = { maxDuration: 60 };

function baseUrl() {
    let b = (process.env.TOKENFORGE_BASE_URL || DEFAULT_BASE).trim().replace(/\/+$/, '');
    if (!/\/v1$/.test(b)) b += '/v1';          // nhận cả dạng có và không có /v1
    return b;
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    const key = process.env.TOKENFORGE_API_KEY;
    if (!key) {
        res.status(500).json({ error: { message: 'Thiếu biến môi trường TOKENFORGE_API_KEY trên Vercel.' } });
        return;
    }

    const parts = [].concat(req.query?.path || []).filter(Boolean);
    const sub = parts.join('/').replace(/^v1\/?/, '');            // chống lặp /v1
    if (!sub) {
        res.status(400).json({ error: { message: 'Thiếu path. Ví dụ: /api/tf/v1/chat/completions' } });
        return;
    }

    let upstream;
    try {
        upstream = await fetch(`${baseUrl()}/${sub}`, {
            method: req.method,
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: req.method === 'GET' || req.method === 'HEAD'
                ? undefined
                : JSON.stringify(typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})),
        });
    } catch (err) {
        res.status(502).json({ error: { message: `Không gọi được gateway: ${err.message}` } });
        return;
    }

    const ct = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status);
    res.setHeader('Content-Type', ct);

    if (ct.includes('text/event-stream') && upstream.body) {      // hỗ trợ stream
        for await (const chunk of upstream.body) res.write(Buffer.from(chunk));
        res.end();
        return;
    }
    res.send(await upstream.text());
}
