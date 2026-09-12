/* =============================================================================
 * ViralForge 2026 — Puter AI Edition
 * js/pro.js — TÀI KHOẢN PRO (BYOK): gọi TRỰC TIẾP API Google Gemini & OpenAI
 *             bằng API key của người dùng, song song với Puter.
 *
 * Endpoint đã xác minh:
 *  • Gemini REST  : https://generativelanguage.googleapis.com/v1beta
 *    - chat/image/tts  : models/{id}:generateContent
 *    - video (Veo)     : models/{id}:predictLongRunning → poll operation
 *                        → response.generateVideoResponse.generatedSamples[0].video.uri
 *  • OpenAI REST  : https://api.openai.com/v1
 *    - chat            : POST /chat/completions
 *    - image           : POST /images/generations (b64_json)
 *    - tts             : POST /audio/speech
 *    - video (Sora)    : POST /videos → poll GET /videos/{id} → GET /videos/{id}/content
 *
 * BẢO MẬT: key chỉ nằm trong localStorage của trình duyệt này và chỉ gửi
 * thẳng tới endpoint chính thức của nhà cung cấp. Không qua server nào khác.
 * LƯU Ý CHI PHÍ: ChatGPT Plus / Gemini Advanced KHÔNG bao gồm quota API —
 * key API tính phí riêng (Gemini có free tier; Veo/Sora cần billing bật).
 * ============================================================================= */

(function (global) {
    'use strict';

    const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
    const OPENAI_BASE = 'https://api.openai.com/v1';
    const STORE_KEY = 'vf2026:pro';

    const DEFAULT_CONFIG = {
        geminiKey: '',
        openaiKey: '',
        /* TokenForge gateway (ai.studio) — chat tương thích OpenAI */
        tfKey: '',
        tfBaseUrl: 'https://tokenforge.ai.studio/v1',
        /* engine cho từng loại tác vụ: 'auto' (Puter) | 'gemini' | 'openai' | 'tokenforge' (chat) | 'voicestudio' (voice) */
        engines: { chat: 'auto', image: 'auto', video: 'auto', voice: 'auto' },
        /* Khi Pro lỗi (hết quota free tier, key hết hạn, model limit 0…)
           tự chuyển sang Puter thay vì bỏ lỡ kết quả */
        autoFallback: true,
        /* model trực tiếp đang chọn — mặc định ưu tiên model CÓ free tier */
        models: {
            geminiChat: 'gemini-2.5-flash',
            openaiChat: 'gpt-5.5',
            tfChat: 'glm-5.3',
            geminiImage: 'gemini-2.5-flash-image',
            openaiImage: 'gpt-image-1',
            geminiVideo: 'veo-3.1-fast-generate-preview',
            openaiVideo: 'sora-2',
            geminiVoice: 'gemini-2.5-flash-preview-tts',
            openaiVoice: 'gpt-4o-mini-tts',
        },
    };

    /* ------------------------------------------------------------------ */
    /* Cấu hình                                                            */
    /* ------------------------------------------------------------------ */
    let config = null;
    function loadConfig() {
        if (config) return config;
        try {
            config = { ...structuredClone(DEFAULT_CONFIG), ...(JSON.parse(localStorage.getItem(STORE_KEY) || '{}')) };
            config.engines = { ...DEFAULT_CONFIG.engines, ...(config.engines || {}) };
            config.models = { ...DEFAULT_CONFIG.models, ...(config.models || {}) };
        } catch (_) {
            config = structuredClone(DEFAULT_CONFIG);
        }
        /* "Biến môi trường" từ js/secrets.js — tự điền khi còn trống */
        const env = global.VF_ENV || {};
        if (!config.tfKey && env.TOKENFORGE_API_KEY) config.tfKey = env.TOKENFORGE_API_KEY;
        if (env.TOKENFORGE_BASE_URL) config.tfBaseUrl = env.TOKENFORGE_BASE_URL;
        if (env.TOKENFORGE_MODEL && config.models.tfChat === DEFAULT_CONFIG.models.tfChat) config.models.tfChat = env.TOKENFORGE_MODEL;
        if (!config.geminiKey && env.GEMINI_API_KEY) config.geminiKey = env.GEMINI_API_KEY;
        if (!config.openaiKey && env.OPENAI_API_KEY) config.openaiKey = env.OPENAI_API_KEY;
        return config;
    }
    function saveConfig() {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(config)); } catch (_) { /* ignore */ }
    }
    function updateConfig(patch) {
        const c = loadConfig();
        if (patch.engines) c.engines = { ...c.engines, ...patch.engines };
        if (patch.models) c.models = { ...c.models, ...patch.models };
        if (patch.autoFallback !== undefined) c.autoFallback = !!patch.autoFallback;
        if (patch.geminiKey !== undefined) c.geminiKey = patch.geminiKey.trim();
        if (patch.openaiKey !== undefined) c.openaiKey = patch.openaiKey.trim();
        if (patch.tfKey !== undefined) c.tfKey = patch.tfKey.trim();
        if (patch.tfBaseUrl !== undefined) c.tfBaseUrl = patch.tfBaseUrl.trim();
        saveConfig();
        return c;
    }
    function getConfig() { return structuredClone(loadConfig()); }

    /* ------------------------------------------------------------------ */
    /* Router                                                              */
    /* ------------------------------------------------------------------ */
    function engineFor(kind) {
        const c = loadConfig();
        return c.engines[kind] || 'auto';
    }

    /* 'auto' KHÔNG còn nghĩa là "Puter" — ưu tiên key của user theo thứ tự,
       chỉ rơi về Puter khi không có key nào cho loại tác vụ đó.
       (video: chưa có lựa chọn trực tiếp miễn phí → Puter là mặc định) */
    function resolveAuto(kind) {
        const c = loadConfig();
        if (kind === 'chat') {
            if (c.tfKey) return 'tokenforge';
            if (c.geminiKey) return 'gemini';
            if (c.openaiKey) return 'openai';
        } else if (kind === 'image' || kind === 'voice') {
            if (c.geminiKey) return 'gemini';
            if (c.openaiKey) return 'openai';
        }
        return 'puter';
    }

    function isDirect(kind, engineOverride) {
        const e = engineOverride || engineFor(kind);
        if (e === 'gemini') return !!loadConfig().geminiKey || 'missing-key';
        if (e === 'openai') return !!loadConfig().openaiKey || 'missing-key';
        if (e === 'tokenforge') return !!loadConfig().tfKey || 'missing-key';
        /* VoiceStudio chạy trên máy user — chỉ cần bật trong panel của nó */
        if (e === 'voicestudio') {
            return (global.VFVS && global.VFVS.isEnabled()) || 'missing-key';
        }
        return false;
    }
    function proStatus() {
        const c = loadConfig();
        return { gemini: !!c.geminiKey, openai: !!c.openaiKey, tokenforge: !!c.tfKey };
    }

    /* ------------------------------------------------------------------ */
    /* Helper chung                                                        */
    /* ------------------------------------------------------------------ */
    async function readError(resp, provider) {
        let detail = `HTTP ${resp.status}`;
        try {
            const j = await resp.json();
            detail = j.error?.message || j.message || JSON.stringify(j).slice(0, 300);
        } catch (_) { /* giữ HTTP status */ }

        /* 429 — hết quota. Lỗi phổ biến nhất với key free: model không có
           free tier ("free_tier_requests, limit: 0") hoặc vượt RPM/RPD */
        if (resp.status === 429) {
            const noFreeTier = /limit:\s*0/.test(detail);
            const err = new Error(`${provider}: hết quota — ${detail}`);
            err.code = 'pro_quota';
            err.friendly = noFreeTier
                ? `Model này KHÔNG có gói miễn phí (free tier limit: 0) — cần bật thanh toán (billing) cho API key, hoặc đổi model có free tier, hoặc để app tự chuyển qua Puter.`
                : `${provider} hết quota tạm thời (vượt giới hạn phút/ngày). Chờ một lát, đổi model nhẹ hơn, hoặc để app tự chuyển qua Puter.`;
            throw err;
        }

        const err = new Error(`${provider}: ${detail}`);
        err.code = resp.status === 401 || resp.status === 403 ? 'pro_auth' : 'pro_api';
        if (resp.status === 401 || resp.status === 403) {
            err.friendly = `${provider} từ chối key — key sai, hết hạn hoặc chưa bật API cần thiết.`;
        } else if (/not found|not_supported|unsupported/i.test(detail)) {
            err.friendly = `${provider}: không nhận model này — kiểm tra lại tên model (bấm nút tải danh sách model để lấy id đúng).`;
        } else if (/maintainence|maintenance/i.test(detail)) {
            err.friendly = `${provider} đang bảo trì (do quá tải) — thử lại sau; app sẽ tự dùng Puter trong thời gian đó.`;
        } else {
            err.friendly = err.message;
        }
        throw err;
    }

    function dataUrlParts(dataUrl) {
        const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || '');
        return m ? { mime: m[1], b64: m[2] } : null;
    }

    function PCMtoWavBlob(pcmBuffer, sampleRate) {
        const out = new ArrayBuffer(44 + pcmBuffer.byteLength);
        const dv = new DataView(out);
        const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
        ws(0, 'RIFF'); dv.setUint32(4, 36 + pcmBuffer.byteLength, true); ws(8, 'WAVEfmt ');
        dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
        dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true);
        dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
        ws(36, 'data'); dv.setUint32(40, pcmBuffer.byteLength, true);
        new Uint8Array(out, 44).set(new Uint8Array(pcmBuffer));
        return new Blob([out], { type: 'audio/wav' });
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    /* ==================================================================== */
    /* GEMINI TRỰC TIẾP                                                     */
    /* ==================================================================== */
    async function gFetch(path, body, method = 'POST') {
        const key = loadConfig().geminiKey;
        if (!key) { const e = new Error('Chưa có Gemini API key'); e.code = 'pro_auth'; throw e; }
        const resp = await fetch(`${GEMINI_BASE}/${path}`, {
            method,
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!resp.ok) await readError(resp, 'Gemini');
        return resp.json();
    }

    function geminiPartsFromMessages(messages) {
        const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
        const contents = messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content) }] }));
        return { contents, systemInstruction: sys ? { parts: [{ text: sys }] } : undefined };
    }

    async function geminiChat(messages, opts = {}) {
        const { contents, systemInstruction } = geminiPartsFromMessages(messages);
        const json = await gFetch(`models/${opts.model || loadConfig().models.geminiChat}:generateContent`, {
            contents,
            systemInstruction,
            generationConfig: { temperature: opts.temperature },
        });
        const parts = json.candidates?.[0]?.content?.parts || [];
        const text = parts.map((p) => p.text || '').join('');
        if (!text) throw new Error('Gemini trả về rỗng (có thể do bộ lọc an toàn)');
        return text;
    }

    async function geminiTxt2img(prompt, opts = {}) {
        const model = opts.model || loadConfig().models.geminiImage;
        const imageConfig = {};
        if (opts.aspectRatio) imageConfig.aspectRatio = opts.aspectRatio;   // '9:16'
        if (opts.imageSize) imageConfig.imageSize = opts.imageSize;         // '1K'|'2K'|'4K'
        const json = await gFetch(`models/${model}:generateContent`, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig },
        });
        const part = (json.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
        if (!part) throw new Error('Gemini không trả về ảnh (có thể do bộ lọc an toàn)');
        return { url: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}` };
    }

    async function geminiTxt2vid(prompt, opts = {}) {
        const model = opts.model || loadConfig().models.geminiVideo;
        const instance = { prompt };
        const img = dataUrlParts(opts.imageDataUrl);
        if (img) instance.image = { inlineData: { mimeType: img.mime, data: img.b64 } };

        const parameters = {};
        if (opts.aspectRatio) parameters.aspectRatio = opts.aspectRatio;    // '9:16'|'16:9'
        if (opts.resolution) parameters.resolution = opts.resolution;       // '720p'|'1080p'
        if (opts.seconds) parameters.durationSeconds = Number(opts.seconds);
        if (opts.negativePrompt) parameters.negative_prompt = opts.negativePrompt;

        const op = await gFetch(`models/${model}:predictLongRunning`, {
            instances: [instance],
            parameters,
        });
        if (!op.name) throw new Error('Gemini không trả về operation cho video');

        /* Poll operation tới khi done (tối đa ~10 phút) */
        const started = Date.now();
        while (Date.now() - started < 10 * 60 * 1000) {
            await sleep(10000);
            const st = await gFetch(op.name, null, 'GET');
            if (st.error) throw new Error(`Gemini video lỗi: ${st.error.message || ''}`);
            if (st.done) {
                const sample =
                    st.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                    st.response?.generatedSamples?.videos?.[0]?.uri ||
                    st.response?.generatedVideos?.[0]?.video?.uri;
                if (!sample) {
                    const why = st.response?.generateVideoResponse?.raiMediaFilteredReasons?.[0]
                        || 'Không tìm thấy video trong phản hồi';
                    throw new Error(`Gemini video: ${why}`);
                }
                const key = loadConfig().geminiKey;
                const resp = await fetch(sample, { headers: { 'x-goog-api-key': key } });
                if (!resp.ok) throw new Error(`Tải video Gemini thất bại (HTTP ${resp.status})`);
                const blob = await resp.blob();
                return { url: URL.createObjectURL(blob), mime: blob.type || 'video/mp4' };
            }
            if (opts.onTick) opts.onTick(`Veo đang render… (${Math.round((Date.now() - started) / 1000)}s)`);
        }
        const e = new Error('Gemini video quá 10 phút không xong');
        e.code = 'upstream_timeout';
        throw e;
    }

    async function geminiTxt2speech(text, opts = {}) {
        const model = opts.model || loadConfig().models.geminiVoice;
        const generationConfig = {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.voice || 'Kore' } } },
        };
        if (opts.instructions) {
            /* Gemini TTS đọc cả chỉ dẫn inline trong text */
            text = `${opts.instructions}: ${text}`;
        }
        const json = await gFetch(`models/${model}:generateContent`, {
            contents: [{ parts: [{ text }] }],
            generationConfig,
        });
        const part = (json.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
        if (!part) throw new Error('Gemini không trả về audio');
        /* audio/L16;codec=pcm;rate=24000 → bọc WAV để phát/ghép được */
        const mime = part.inlineData.mimeType || 'audio/L16;rate=24000';
        const rate = Number(/rate=(\d+)/.exec(mime)?.[1] || 24000);
        const b64 = part.inlineData.data;
        const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
        const blob = /wav/i.test(mime) ? new Blob([bin], { type: 'audio/wav' }) : PCMtoWavBlob(bin.buffer, rate);
        const url = URL.createObjectURL(blob);
        return { el: new Audio(url), url, blob };
    }

    async function listGeminiModels() {
        const json = await gFetch('models?pageSize=200', null, 'GET');
        return (json.models || []).map((m) => String(m.name).replace(/^models\//, ''));
    }

    /* ==================================================================== */
    /* OPENAI TRỰC TIẾP                                                     */
    /* ==================================================================== */
    async function oFetch(path, opts = {}) {
        const key = loadConfig().openaiKey;
        if (!key) { const e = new Error('Chưa có OpenAI API key'); e.code = 'pro_auth'; throw e; }
        const resp = await fetch(`${OPENAI_BASE}${path}`, {
            method: opts.method || 'POST',
            headers: {
                Authorization: `Bearer ${key}`,
                ...(opts.json ? { 'Content-Type': 'application/json' } : {}),
            },
            body: opts.json ? JSON.stringify(opts.json) : opts.body,
        });
        if (!resp.ok) await readError(resp, 'OpenAI');
        return resp;
    }

    async function openaiChat(messages, opts = {}) {
        const resp = await oFetch('/chat/completions', {
            json: {
                model: opts.model || loadConfig().models.openaiChat,
                messages,
                temperature: opts.temperature,
            },
        });
        const json = await resp.json();
        const text = json.choices?.[0]?.message?.content || '';
        if (!text) throw new Error('OpenAI trả về rỗng');
        return text;
    }

    async function openaiTxt2img(prompt, opts = {}) {
        const resp = await oFetch('/images/generations', {
            json: {
                model: opts.model || loadConfig().models.openaiImage,
                prompt,
                size: opts.size || '1024x1536',          // 9:16 dọc
                quality: opts.quality || 'high',
                n: 1,
            },
        });
        const json = await resp.json();
        const d = json.data?.[0];
        if (!d) throw new Error('OpenAI không trả về ảnh');
        return { url: d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url };
    }

    async function openaiTxt2vid(prompt, opts = {}) {
        const body = {
            model: opts.model || loadConfig().models.openaiVideo,   // 'sora-2' | 'sora-2-pro'
            prompt,
            seconds: String(opts.seconds || 8),                     // '4'|'8'|'12'…
            size: opts.size || '720x1280',                          // dọc 9:16
        };
        let resp = await oFetch('/videos', { json: body });
        let job = await resp.json();
        if (!job.id) throw new Error('OpenAI không trả về video job');

        const started = Date.now();
        while (Date.now() - started < 15 * 60 * 1000) {
            await sleep(10000);
            resp = await oFetch(`/videos/${job.id}`, { method: 'GET' });
            job = await resp.json();
            if (job.status === 'completed') break;
            if (job.status === 'failed') throw new Error(`Sora lỗi: ${job.error?.message || 'không rõ'}`);
            if (opts.onTick) opts.onTick(`Sora đang render… ${job.progress != null ? `${Math.round(job.progress * 100)}%` : ''} (${Math.round((Date.now() - started) / 1000)}s)`);
        }
        if (job.status !== 'completed') {
            const e = new Error('Sora quá 15 phút không xong');
            e.code = 'upstream_timeout';
            throw e;
        }
        const content = await oFetch(`/videos/${job.id}/content`, { method: 'GET' });
        const blob = await content.blob();
        return { url: URL.createObjectURL(blob), mime: blob.type || 'video/mp4' };
    }

    async function openaiTxt2speech(text, opts = {}) {
        const body = {
            model: opts.model || loadConfig().models.openaiVoice,   // 'gpt-4o-mini-tts'
            voice: opts.voice || 'alloy',
            input: text,
            response_format: 'mp3',
        };
        if (opts.instructions) body.instructions = opts.instructions;
        const resp = await oFetch('/audio/speech', { json: body });
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        return { el: new Audio(url), url, blob };
    }

    async function listOpenaiModels() {
        const resp = await oFetch('/models', { method: 'GET' });
        const json = await resp.json();
        return (json.data || []).map((m) => m.id).sort();
    }

    /* ==================================================================== */
    /* TOKENFORGE GATEWAY (ai.studio) — chat tương thích OpenAI             */
    /* ==================================================================== */
    async function tfFetch(path, opts = {}) {
        const c = loadConfig();
        if (!c.tfKey) { const e = new Error('Chưa có TokenForge API key'); e.code = 'pro_auth'; throw e; }
        const base = (c.tfBaseUrl || DEFAULT_CONFIG.tfBaseUrl).replace(/\/+$/, '');
        const resp = await fetch(`${base}${path}`, {
            method: opts.method || 'POST',
            headers: {
                Authorization: `Bearer ${c.tfKey}`,
                'Content-Type': 'application/json',
            },
            body: opts.json ? JSON.stringify(opts.json) : undefined,
        });
        if (!resp.ok) await readError(resp, 'TokenForge');
        return resp;
    }

    async function tokenforgeChat(messages, opts = {}) {
        const c = loadConfig();
        const resp = await tfFetch('/chat/completions', {
            json: {
                model: opts.model || c.models.tfChat || 'glm-5.3',
                messages,
                stream: false,
                temperature: opts.temperature,
                max_tokens: opts.max_tokens,
            },
        });
        const json = await resp.json();
        const text = json.choices?.[0]?.message?.content ?? '';
        if (!text) throw new Error('TokenForge trả về rỗng');
        return typeof text === 'string' ? text : JSON.stringify(text);
    }

    async function listTokenforgeModels() {
        const resp = await tfFetch('/models', { method: 'GET' });
        const json = await resp.json();
        return (json.data || []).map((m) => m.id);
    }

    async function tokenforgeTest() {
        try {
            const models = await listTokenforgeModels();
            return { ok: true, info: `${models.length} model khả dụng` };
        } catch (err) {
            return { ok: false, info: err.friendly || err.message };
        }
    }

    /* ==================================================================== */
    /* Kiểm tra key                                                         */
    /* ==================================================================== */
    async function testKey(provider) {
        try {
            if (provider === 'gemini') {
                const models = await listGeminiModels();
                return { ok: true, info: `${models.length} model khả dụng` };
            }
            const models = await listOpenaiModels();
            return { ok: true, info: `${models.length} model khả dụng` };
        } catch (err) {
            return { ok: false, info: err.message };
        }
    }

    global.VFPro = {
        getConfig, updateConfig, engineFor, resolveAuto, isDirect, proStatus,
        geminiChat, geminiTxt2img, geminiTxt2vid, geminiTxt2speech, listGeminiModels,
        openaiChat, openaiTxt2img, openaiTxt2vid, openaiTxt2speech, listOpenaiModels,
        tokenforgeChat, tokenforgeTest, listTokenforgeModels,
        testKey,
        DIRECT_MODELS: {
            geminiChat: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-pro-preview', 'gemini-3-flash-preview'],
            openaiChat: ['gpt-5.5', 'gpt-5.2', 'gpt-5.1', 'gpt-5', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'],
            geminiImage: ['gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'],
            openaiImage: ['gpt-image-1', 'gpt-image-1-mini', 'gpt-image-2'],
            geminiVideo: ['veo-3.1-generate-preview', 'veo-3.1-fast-generate-preview', 'veo-3.1-lite-generate-preview'],
            openaiVideo: ['sora-2-pro', 'sora-2'],
            tfChat: ['glm-5.3', 'claude-opus-5'],
            geminiVoice: ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts', 'gemini-3.1-flash-tts-preview'],
            openaiVoice: ['gpt-4o-mini-tts', 'tts-1-hd', 'tts-1'],
        },
    };
})(window);
