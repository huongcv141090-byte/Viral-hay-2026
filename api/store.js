/* =============================================================================
 * ViralForge 2026 — api/store.js  (ESM)
 * Vercel Serverless Function: lưu/đọc JSON dataset vào Vercel Blob
 * (store "viral-hay-2026-blob" đã connect với project qua dashboard).
 *
 *   PUT  /api/store?key=vf2026/backup   body = JSON   → ghi đè (public blob)
 *   GET  /api/store?key=vf2026/backup                 → trả JSON đã lưu / 404
 *
 * Thiết kế phòng thủ: SDK được nạp TRONG handler bằng dynamic import — mọi
 * lỗi (thiếu token, SDK lỗi, sai method…) đều trả JSON {error} để client
 * hiển thị đúng nguyên nhân thay vì "HTTP 500" vô nghĩa.
 *
 * Nếu lỗi nói thiếu token: dashboard → Storage → viral-hay-2026-blob →
 * .env.local → thêm biến BLOB_READ_WRITE_TOKEN vào project → redeploy.
 * ============================================================================= */

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_BODY = 8 * 1024 * 1024; // 8MB — đủ cho JSON dự án (không chứa media)

let blobCache = null;
async function getBlob() {
    if (!blobCache) {
        blobCache = await import('@vercel/blob');
    }
    return blobCache;
}

function json(res, status, obj) {
    res.status(status).set(CORS).json(obj);
}

export default async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.status(204).set(CORS).end();
        return;
    }

    /* chỉ cho phép key trong không gian tên vf2026/, ký tự an toàn */
    const key = String(req.query?.key || '');
    if (!/^vf2026\/[a-zA-Z0-9_\-]+$/.test(key)) {
        json(res, 400, { error: 'key phải khớp vf2026/<tên>' });
        return;
    }

    let blob;
    try {
        blob = await getBlob();
    } catch (e) {
        json(res, 500, {
            error: `Không nạp được @vercel/blob — kiểm tra Build Logs có bước "npm install" và package.json có dependency "@vercel/blob". Chi tiết: ${e?.message || e}`,
        });
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
                if (tooBig) return; // request đã bị huỷ
                try {
                    JSON.parse(body); // phải là JSON hợp lệ
                    const result = await blob.put(key, body, {
                        access: 'public',
                        addRandomSuffix: false,       // ghi đè cùng key
                        contentType: 'application/json',
                    });
                    json(res, 200, { ok: true, url: result.url, key });
                } catch (e) {
                    const msg = String(e?.message || e);
                    json(res, /token|access/i.test(msg) ? 500 : 400, {
                        error: /token|access/i.test(msg)
                            ? `Vercel Blob chưa có quyền ghi — dashboard → Storage → viral-hay-2026-blob → .env.local → thêm biến BLOB_READ_WRITE_TOKEN vào project rồi Redeploy. (${msg})`
                            : `Dữ liệu không hợp lệ: ${msg}`,
                    });
                }
            });
            return;
        }

        /* ---------- ĐỌC ---------- */
        if (req.method === 'GET') {
            try {
                const meta = await blob.head(key);
                const resp = await fetch(meta.url);
                const text = await resp.text();
                json(res, 200, JSON.parse(text));
            } catch (_) {
                json(res, 404, { error: 'Chưa có dữ liệu trên cloud cho key này' });
            }
            return;
        }

        json(res, 405, { error: 'Method không hỗ trợ' });
    } catch (e) {
        json(res, 500, { error: String(e?.message || e) });
    }
};
