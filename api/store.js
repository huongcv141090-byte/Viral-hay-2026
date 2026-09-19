/* =============================================================================
 * ViralForge 2026 — api/store.js  (ESM, Vercel Serverless)
 * Lưu/đọc JSON dataset vào Vercel Blob
 * (store "viral-hay-2026-blob" connect với project qua Vercel dashboard)
 *
 *   PUT  /api/store?key=vf2026/backup   body = JSON → ghi đè (public blob)
 *   GET  /api/store?key=vf2026/backup               → trả JSON đã lưu / 404
 *
 * Nếu lỗi thiếu token: dashboard → Storage → viral-hay-2026-blob →
 * .env.local → thêm biến BLOB_READ_WRITE_TOKEN vào project → Redeploy.
 * ============================================================================= */

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_BODY = 8 * 1024 * 1024; // 8 MB

/* Lazy-load @vercel/blob để tránh crash khi thiếu dep */
let blobCache = null;
async function getBlob() {
    if (!blobCache) blobCache = await import('@vercel/blob');
    return blobCache;
}

/* Kiểm tra BLOB_READ_WRITE_TOKEN trước khi làm bất cứ gì */
function checkToken(res) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        res.status(500).set(CORS).json({
            error:
                'Thiếu biến môi trường BLOB_READ_WRITE_TOKEN. ' +
                'Vercel dashboard → Storage → viral-hay-2026-blob → ' +
                '.env.local → thêm biến BLOB_READ_WRITE_TOKEN rồi Redeploy.',
        });
        return false;
    }
    return true;
}

/* Đọc toàn bộ body từ ReadableStream; trả chuỗi hoặc ném Error nếu quá lớn */
async function readBody(req) {
    /* Vercel Node.js runtime v3+ cấp req.body đã parse sẵn khi Content-Type là JSON,
       nhưng Edge runtime và một số cấu hình cấp raw stream — xử lý cả hai. */
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        /* Đã được parse sẵn bởi framework */
        return JSON.stringify(req.body);
    }
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        req.on('data', (chunk) => {
            total += chunk.length;
            if (total > MAX_BODY) {
                req.destroy(new Error('Payload quá lớn (giới hạn 8 MB)'));
                reject(new Error('Payload quá lớn (giới hạn 8 MB)'));
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        req.on('error', reject);
    });
}

export default async (req, res) => {
    /* Preflight CORS */
    if (req.method === 'OPTIONS') {
        res.status(204).set(CORS).end();
        return;
    }

    /* Validate key: chỉ cho phép vf2026/<alphanumeric_-_> */
    const key = String(req.query?.key || '');
    if (!/^vf2026\/[a-zA-Z0-9_\-]+$/.test(key)) {
        res.status(400).set(CORS).json({ error: 'key phải khớp vf2026/<tên>' });
        return;
    }

    if (!checkToken(res)) return;

    let blob;
    try {
        blob = await getBlob();
    } catch (e) {
        res.status(500).set(CORS).json({
            error: `Không nạp được @vercel/blob — kiểm tra package.json có "@vercel/blob" trong dependencies. Chi tiết: ${e?.message || e}`,
        });
        return;
    }

    try {
        /* ============ GHI ============ */
        if (req.method === 'PUT') {
            let body;
            try {
                body = await readBody(req);
            } catch (e) {
                res.status(413).set(CORS).json({ error: e.message });
                return;
            }

            /* Validate JSON trước khi ghi */
            try {
                JSON.parse(body);
            } catch (e) {
                res.status(400).set(CORS).json({ error: `Body không phải JSON hợp lệ: ${e.message}` });
                return;
            }

            const result = await blob.put(key, body, {
                access: 'public',
                addRandomSuffix: false,
                contentType: 'application/json',
            });
            res.status(200).set(CORS).json({ ok: true, url: result.url, key });
            return;
        }

        /* ============ ĐỌC ============ */
        if (req.method === 'GET') {
            let meta;
            try {
                meta = await blob.head(key);
            } catch (_) {
                res.status(404).set(CORS).json({ error: 'Chưa có dữ liệu trên cloud cho key này' });
                return;
            }
            const resp = await fetch(meta.url);
            if (!resp.ok) {
                res.status(502).set(CORS).json({ error: `Không lấy được blob từ CDN (HTTP ${resp.status})` });
                return;
            }
            const text = await resp.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                res.status(500).set(CORS).json({ error: `Blob không phải JSON hợp lệ: ${e.message}` });
                return;
            }
            res.status(200).set(CORS).json(data);
            return;
        }

        res.status(405).set(CORS).json({ error: 'Method không hỗ trợ — dùng GET hoặc PUT' });
    } catch (e) {
        const msg = String(e?.message || e);
        const isToken = /token|access|unauthorized/i.test(msg);
        res.status(500).set(CORS).json({
            error: isToken
                ? `Vercel Blob chưa có quyền — kiểm tra BLOB_READ_WRITE_TOKEN trong project env. (${msg})`
                : msg,
        });
    }
};
