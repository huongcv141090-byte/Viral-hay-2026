/* =============================================================================
 * ViralForge 2026 — api/store.js
 * Vercel Serverless Function: lưu/đọc JSON dataset vào Vercel Blob
 * (store "viral-hay-2026-blob" đã connect với project qua dashboard).
 *
 *   PUT  /api/store?key=vf2026/backup   body = JSON   → ghi đè (public blob)
 *   GET  /api/store?key=vf2026/backup                 → trả JSON đã lưu / 404
 *
 * Xác thực blob: dùng OIDC / BLOB_READ_WRITE_TOKEN do Vercel inject tự động
 * khi Blob store đã "Connect to Project". Nếu 500 kèm lỗi token, thêm biến
 * môi trường BLOB_READ_WRITE_TOKEN từ tab Storage → .env.local rồi redeploy.
 * ============================================================================= */
const { put, head } = require('@vercel/blob');

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_BODY = 8 * 1024 * 1024; // 8MB — đủ cho JSON dự án (không chứa media)

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.status(204).set(CORS).end();
        return;
    }

    /* chỉ cho phép key trong không gian tên vf2026/, ký tự an toàn */
    const key = String(req.query.key || '');
    if (!/^vf2026\/[a-zA-Z0-9_\-]+$/.test(key)) {
        res.status(400).set(CORS).json({ error: 'key phải khớp vf2026/<tên>' });
        return;
    }

    try {
        /* ---------- GHI ---------- */
        if (req.method === 'PUT') {
            let body = '';
            let tooBig = false;
            req.on('data', (chunk) => {
                body += chunk;
                if (body.length > MAX_BODY) { tooBig = true; req.destroy(); }
            });
            req.on('end', async () => {
                if (tooBig) return; // đã destroy
                try {
                    JSON.parse(body); // phải là JSON hợp lệ
                    const result = await put(key, body, {
                        access: 'public',
                        addRandomSuffix: false,       // ghi đè cùng key
                        contentType: 'application/json',
                    });
                    res.status(200).set(CORS).json({ ok: true, url: result.url, key });
                } catch (e) {
                    res.status(400).set(CORS).json({ error: `Dữ liệu không hợp lệ: ${e?.message || e}` });
                }
            });
            return;
        }

        /* ---------- ĐỌC ---------- */
        if (req.method === 'GET') {
            try {
                const meta = await head(key);
                const resp = await fetch(meta.url);
                const text = await resp.text();
                res.status(200).set(CORS).json(JSON.parse(text));
            } catch (_) {
                res.status(404).set(CORS).json({ error: 'Chưa có dữ liệu trên cloud cho key này' });
            }
            return;
        }

        res.status(405).set(CORS).json({ error: 'Method không hỗ trợ' });
    } catch (e) {
        const msg = String(e?.message || e);
        res.status(500).set(CORS).json({
            error: /token|unauthorized|401|403/i.test(msg)
                ? `Vercel Blob chưa có quyền ghi — vào dashboard: Storage → viral-hay-2026-blob → .env.local → thêm biến BLOB_READ_WRITE_TOKEN vào project rồi redeploy. (${msg})`
                : msg,
        });
    }
};
