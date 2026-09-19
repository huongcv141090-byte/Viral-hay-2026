/* =============================================================================
 * ViralForge 2026 â€” Puter AI Edition
 * js/pro.js â€” TÃ€I KHOáº¢N PRO (BYOK): gá»i TRá»°C TIáº¾P API Google Gemini & OpenAI
 *             báº±ng API key cá»§a ngÆ°á»i dÃ¹ng, song song vá»›i Puter.
 *
 * Endpoint Ä‘Ã£ xÃ¡c minh:
 *  â€¢ Gemini REST  : https://generativelanguage.googleapis.com/v1beta
 *    - chat/image/tts  : models/{id}:generateContent
 *    - video (Veo)     : models/{id}:predictLongRunning â†’ poll operation
 *                        â†’ response.generateVideoResponse.generatedSamples[0].video.uri
 *  â€¢ OpenAI REST  : https://api.openai.com/v1
 *    - chat            : POST /chat/completions
 *    - image           : POST /images/generations (b64_json)
 *    - tts             : POST /audio/speech
 *    - video (Sora)    : POST /videos â†’ poll GET /videos/{id} â†’ GET /videos/{id}/content
 *
 * Báº¢O Máº¬T: key chá»‰ náº±m trong localStorage cá»§a trÃ¬nh duyá»‡t nÃ y vÃ  chá»‰ gá»­i
 * tháº³ng tá»›i endpoint chÃ­nh thá»©c cá»§a nhÃ  cung cáº¥p. KhÃ´ng qua server nÃ o khÃ¡c.
 * LÆ¯U Ã CHI PHÃ: ChatGPT Plus / Gemini Advanced KHÃ”NG bao gá»“m quota API â€”
 * key API tÃ­nh phÃ­ riÃªng (Gemini cÃ³ free tier; Veo/Sora cáº§n billing báº­t).
 * ============================================================================= */

(function (global) {
    'use strict';

    const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
    const OPENAI_BASE = 'https://api.openai.com/v1';
    const STORE_KEY = 'vf2026:pro';

    const DEFAULT_CONFIG = {
        geminiKey: '',
        openaiKey: '',
        /* Multi-key pools (moi key tren mot dong hoac ngan cach dau phay) */
        geminiKeys: [],
        openaiKeys: [],
        tfKeys: [],
        /* TokenForge gateway â€” Anthropic Messages-compatible */
        tfKey: '',
        tfBaseUrl: '/api/tf',
        /* engine cho tá»«ng loáº¡i tÃ¡c vá»¥: 'auto' (Puter) | 'gemini' | 'openai' | 'tokenforge' (chat) | 'voicestudio' (voice) */
        engines: { chat: 'auto', image: 'auto', video: 'auto', voice: 'auto' },
        /* Khi Pro lá»—i (háº¿t quota free tier, key háº¿t háº¡n, model limit 0â€¦)
           tá»± chuyá»ƒn sang Puter thay vÃ¬ bá» lá»¡ káº¿t quáº£ */
        autoFallback: true,
        /* model trá»±c tiáº¿p Ä‘ang chá»n â€” máº·c Ä‘á»‹nh Æ°u tiÃªn model CÃ“ free tier */
        models: {
            geminiChat: 'gemini-2.0-flash-lite',
            openaiChat: 'gpt-5.5',
            tfChat: 'claude-sonnet-5[1m]',
            geminiImage: 'gemini-2.0-flash-exp',
            openaiImage: 'gpt-image-1',
            geminiVideo: 'veo-3.1-fast-generate-preview',
            openaiVideo: 'sora-2',
            geminiVoice: 'gemini-2.5-flash-preview-tts',
            openaiVoice: 'gpt-4o-mini-tts',
        },
    };

    /* ------------------------------------------------------------------ */
    /* Cáº¥u hÃ¬nh                                                            */
    /* ------------------------------------------------------------------ */
    let config = null;
    function loadConfig() {
        if (config) return config;
        try {
            config = { ...structuredClone(DEFAULT_CONFIG), ...(JSON.parse(localStorage.getItem(STORE_KEY) || '{}')) };
            config.engines = { ...DEFAULT_CONFIG.engines, ...(config.engines || {}) };
            config.models = migrateModels({ ...DEFAULT_CONFIG.models, ...(config.models || {}) });
            if (!Array.isArray(config.geminiKeys)) config.geminiKeys = [];
            if (!Array.isArray(config.openaiKeys)) config.openaiKeys = [];
            if (!Array.isArray(config.tfKeys)) config.tfKeys = [];
        } catch (_) {
            config = structuredClone(DEFAULT_CONFIG);
        }
        /* "Biáº¿n mÃ´i trÆ°á»ng" tá»« js/secrets.js â€” tá»± Ä‘iá»n khi cÃ²n trá»‘ng */
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
        /* Multi-key pools */
        if (patch.geminiKeys !== undefined) c.geminiKeys = parseKeyList(patch.geminiKeys);
        if (patch.openaiKeys !== undefined) c.openaiKeys = parseKeyList(patch.openaiKeys);
        if (patch.tfKeys !== undefined) c.tfKeys = parseKeyList(patch.tfKeys);
        saveConfig();
        return c;
    }
    function getConfig() { return structuredClone(loadConfig()); }
    /* ------------------------------------------------------------------ */
    /* Key pool helpers                                                     */
    /* ------------------------------------------------------------------ */
    /** Chuyen chuoi nhieu dong / dau phay thanh mang key sach. */
    /* ------------------------------------------------------------------ */
    /* Auto-migrate deprecated model names saved in localStorage          */
    /* ------------------------------------------------------------------ */
    const MODEL_MIGRATIONS = {
        'gemini-2.5-flash':             'gemini-2.0-flash-lite',
        'gemini-2.5-flash-exp':         'gemini-2.0-flash-lite',
        'gemini-2.5-flash-001':         'gemini-2.0-flash-lite',
        'gemini-2.5-flash-image':       'gemini-2.0-flash-exp',
        'gemini-2.5-flash-preview-tts': 'gemini-2.0-flash-preview-tts',
        'gemini-1.5-flash':             'gemini-2.0-flash-lite',
        'gemini-1.5-pro':               'gemini-2.0-flash',
        'gemini-pro':                   'gemini-2.0-flash-lite',
        'gemini-2.5-flash-lite':        'gemini-2.0-flash-lite',
    };
    function migrateModels(models) {
        if (!models || typeof models !== 'object') return models;
        const out = { ...models };
        Object.keys(out).forEach((k) => {
            if (MODEL_MIGRATIONS[out[k]]) out[k] = MODEL_MIGRATIONS[out[k]];
        });
        return out;
    }

    function parseKeyList(raw) {
        if (Array.isArray(raw)) return raw.map((k) => k.trim()).filter(Boolean);
        return String(raw || '').split(/[\n,]+/).map((k) => k.trim()).filter(Boolean);
    }
    /** Gop primary key + pool (khong trung), tra mang. */
    function resolveKeyPool(primary, pool) {
        const all = [primary, ...(pool || [])].map((k) => (k || '').trim()).filter(Boolean);
        return [...new Set(all)];
    }
    /** Round-robin index luu trong sessionStorage de toan bo tab trong session dung chung. */
    function nextKeyIdx(poolName, len) {
        if (len <= 1) return 0;
        const SK = `vf2026:kidx:${poolName}`;
        const cur = parseInt(sessionStorage.getItem(SK) || '0', 10);
        const next = (cur + 1) % len;
        sessionStorage.setItem(SK, String(next));
        return next;
    }
    function currentKeyIdx(poolName) {
        const SK = `vf2026:kidx:${poolName}`;
        return parseInt(sessionStorage.getItem(SK) || '0', 10);
    }
    /** Lay key Gemini hien tai (round-robin tren pool). */
    function pickGeminiKey() {
        const c = loadConfig();
        const pool = resolveKeyPool(c.geminiKey, c.geminiKeys);
        if (!pool.length) { const e = new Error('Chua co Gemini API key'); e.code = 'pro_auth'; throw e; }
        const idx = currentKeyIdx('gemini') % pool.length;
        return { key: pool[idx], pool, idx };
    }
    /** Lay key OpenAI hien tai. */
    function pickOpenaiKey() {
        const c = loadConfig();
        const pool = resolveKeyPool(c.openaiKey, c.openaiKeys);
        if (!pool.length) { const e = new Error('Chua co OpenAI API key'); e.code = 'pro_auth'; throw e; }
        const idx = currentKeyIdx('openai') % pool.length;
        return { key: pool[idx], pool, idx };
    }
    /** Lay key TokenForge hien tai. */
    function pickTfKey() {
        const c = loadConfig();
        const pool = resolveKeyPool(c.tfKey, c.tfKeys);
        if (!pool.length) { const e = new Error('Chua co TokenForge API key'); e.code = 'pro_auth'; throw e; }
        const idx = currentKeyIdx('tf') % pool.length;
        return { key: pool[idx], pool, idx };
    }
    /** Thong tin pool key de hien thi trong UI. */
    function keyPoolStatus() {
        const c = loadConfig();
        return {
            gemini: resolveKeyPool(c.geminiKey, c.geminiKeys).length,
            openai: resolveKeyPool(c.openaiKey, c.openaiKeys).length,
            tf: resolveKeyPool(c.tfKey, c.tfKeys).length,
            geminiIdx: currentKeyIdx('gemini'),
            openaiIdx: currentKeyIdx('openai'),
            tfIdx: currentKeyIdx('tf'),
        };
    }
    /** Chuyen sang key ke trong pool (dung khi mot key bi loi quota). */
    function rotateKey(provider) {
        const c = loadConfig();
        if (provider === 'gemini') {
            const pool = resolveKeyPool(c.geminiKey, c.geminiKeys);
            nextKeyIdx('gemini', pool.length);
        } else if (provider === 'openai') {
            const pool = resolveKeyPool(c.openaiKey, c.openaiKeys);
            nextKeyIdx('openai', pool.length);
        } else if (provider === 'tf') {
            const pool = resolveKeyPool(c.tfKey, c.tfKeys);
            nextKeyIdx('tf', pool.length);
        }
    }
    /* ------------------------------------------------------------------ */
    /* Router                                                              */
    /* ------------------------------------------------------------------ */
    function engineFor(kind) {
        const c = loadConfig();
        return c.engines[kind] || 'auto';
    }

    /* 'auto' KHÃ”NG cÃ²n nghÄ©a lÃ  "Puter" â€” Æ°u tiÃªn key cá»§a user theo thá»© tá»±,
       chá»‰ rÆ¡i vá» Puter khi khÃ´ng cÃ³ key nÃ o cho loáº¡i tÃ¡c vá»¥ Ä‘Ã³.
       (video: chÆ°a cÃ³ lá»±a chá»n trá»±c tiáº¿p miá»…n phÃ­ â†’ Puter lÃ  máº·c Ä‘á»‹nh) */
    function resolveAuto(kind) {
        const c = loadConfig();
        const hasGemini = resolveKeyPool(c.geminiKey, c.geminiKeys).length > 0;
        const hasOpenai = resolveKeyPool(c.openaiKey, c.openaiKeys).length > 0;
        const hasTf = resolveKeyPool(c.tfKey, c.tfKeys).length > 0;
        if (kind === 'chat') {
            if (hasTf) return 'tokenforge';
            if (hasGemini) return 'gemini';
            if (hasOpenai) return 'openai';
        } else if (kind === 'image' || kind === 'voice') {
            if (hasGemini) return 'gemini';
            if (hasOpenai) return 'openai';
        }
        return 'puter';
    }

    function isDirect(kind, engineOverride) {
        const e = engineOverride || engineFor(kind);
        const c = loadConfig();
        if (e === 'gemini') return (resolveKeyPool(c.geminiKey, c.geminiKeys).length > 0) || 'missing-key';
        if (e === 'openai') return (resolveKeyPool(c.openaiKey, c.openaiKeys).length > 0) || 'missing-key';
        if (e === 'tokenforge') return (resolveKeyPool(c.tfKey, c.tfKeys).length > 0) || 'missing-key';
        if (e === 'voicestudio') {
            return (global.VFVS && global.VFVS.isEnabled()) || 'missing-key';
        }
        return false;
    }
    function proStatus() {
        const c = loadConfig();
        return {
            gemini: !!c.geminiKey || c.geminiKeys.length > 0,
            openai: !!c.openaiKey || c.openaiKeys.length > 0,
            tokenforge: !!c.tfKey || c.tfKeys.length > 0,
        };
    }

    /* ------------------------------------------------------------------ */
    /* Helper chung                                                        */
    /* ------------------------------------------------------------------ */
    async function readError(resp, provider) {
        let detail = `HTTP ${resp.status}`;
        try {
            const j = await resp.json();
            detail = j.error?.message || j.message || JSON.stringify(j).slice(0, 300);
        } catch (_) { /* giá»¯ HTTP status */ }

        /* 429 â€” háº¿t quota. Lá»—i phá»• biáº¿n nháº¥t vá»›i key free: model khÃ´ng cÃ³
           free tier ("free_tier_requests, limit: 0") hoáº·c vÆ°á»£t RPM/RPD */
        if (resp.status === 429) {
            const noFreeTier = /limit:\s*0/.test(detail);
            const err = new Error(`${provider}: háº¿t quota â€” ${detail}`);
            err.code = 'pro_quota';
            err.friendly = noFreeTier
                ? `Model nÃ y KHÃ”NG cÃ³ gÃ³i miá»…n phÃ­ (free tier limit: 0) â€” cáº§n báº­t thanh toÃ¡n (billing) cho API key, hoáº·c Ä‘á»•i model cÃ³ free tier, hoáº·c Ä‘á»ƒ app tá»± chuyá»ƒn qua Puter.`
                : `${provider} háº¿t quota táº¡m thá»i (vÆ°á»£t giá»›i háº¡n phÃºt/ngÃ y). Chá» má»™t lÃ¡t, Ä‘á»•i model nháº¹ hÆ¡n, hoáº·c Ä‘á»ƒ app tá»± chuyá»ƒn qua Puter.`;
            throw err;
        }

        const err = new Error(`${provider}: ${detail}`);
        err.code = resp.status === 401 || resp.status === 403 ? 'pro_auth' : 'pro_api';
        if (resp.status === 401 || resp.status === 403) {
            err.friendly = `${provider} tá»« chá»‘i key â€” key sai, háº¿t háº¡n hoáº·c chÆ°a báº­t API cáº§n thiáº¿t.`;
        } else if (/not found|not_supported|unsupported/i.test(detail)) {
            err.friendly = `${provider}: khÃ´ng nháº­n model nÃ y â€” kiá»ƒm tra láº¡i tÃªn model (báº¥m nÃºt táº£i danh sÃ¡ch model Ä‘á»ƒ láº¥y id Ä‘Ãºng).`;
        } else if (/maintainence|maintenance/i.test(detail)) {
            err.friendly = `${provider} Ä‘ang báº£o trÃ¬ (do quÃ¡ táº£i) â€” thá»­ láº¡i sau; app sáº½ tá»± dÃ¹ng Puter trong thá»i gian Ä‘Ã³.`;
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
    /* GEMINI TRá»°C TIáº¾P                                                     */
    /* ==================================================================== */
    async function gFetch(path, body, method = 'POST') {
        const { key, pool } = pickGeminiKey();
        const resp = await fetch(`${GEMINI_BASE}/${path}`, {
            method,
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!resp.ok) {
            /* 429 quota → xoay sang key ke neu co nhieu key */
            if (resp.status === 429 && pool.length > 1) rotateKey('gemini');
            await readError(resp, 'Gemini');
        }
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
        const FALLBACK_MODELS = ['gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash'];
        const modelToUse = opts.model || loadConfig().models.geminiChat;
        const tryModel = async (model) => {
            const json = await gFetch(`models/${model}:generateContent`, {
                contents,
                systemInstruction,
                generationConfig: { temperature: opts.temperature },
            });
            const parts = json.candidates?.[0]?.content?.parts || [];
            const text = parts.map((p) => p.text || '').join('');
            if (!text) throw new Error('Gemini tra ve rong (co the do bo loc an toan)');
            return text;
        };
        // Try chosen model first, then fallbacks if deprecated/not available
        const modelsToTry = [modelToUse, ...FALLBACK_MODELS.filter((m) => m !== modelToUse)];
        let lastErr;
        for (const m of modelsToTry) {
            try {
                return await tryModel(m);
            } catch (err) {
                lastErr = err;
                const deprecated = /no longer available|not found|deprecated|404/i.test(err.message || '');
                if (!deprecated) throw err; // auth/quota error - don't retry with same key
                // model deprecated - try next in list
            }
        }
        throw lastErr;
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
        if (!part) throw new Error('Gemini khÃ´ng tráº£ vá» áº£nh (cÃ³ thá»ƒ do bá»™ lá»c an toÃ n)');
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
        if (!op.name) throw new Error('Gemini khÃ´ng tráº£ vá» operation cho video');

        /* Poll operation tá»›i khi done (tá»‘i Ä‘a ~10 phÃºt) */
        const started = Date.now();
        while (Date.now() - started < 10 * 60 * 1000) {
            await sleep(10000);
            const st = await gFetch(op.name, null, 'GET');
            if (st.error) throw new Error(`Gemini video lá»—i: ${st.error.message || ''}`);
            if (st.done) {
                const sample =
                    st.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                    st.response?.generatedSamples?.videos?.[0]?.uri ||
                    st.response?.generatedVideos?.[0]?.video?.uri;
                if (!sample) {
                    const why = st.response?.generateVideoResponse?.raiMediaFilteredReasons?.[0]
                        || 'KhÃ´ng tÃ¬m tháº¥y video trong pháº£n há»“i';
                    throw new Error(`Gemini video: ${why}`);
                }
                const key = loadConfig().geminiKey;
                const resp = await fetch(sample, { headers: { 'x-goog-api-key': key } });
                if (!resp.ok) throw new Error(`Táº£i video Gemini tháº¥t báº¡i (HTTP ${resp.status})`);
                const blob = await resp.blob();
                return { url: URL.createObjectURL(blob), mime: blob.type || 'video/mp4' };
            }
            if (opts.onTick) opts.onTick(`Veo Ä‘ang renderâ€¦ (${Math.round((Date.now() - started) / 1000)}s)`);
        }
        const e = new Error('Gemini video quÃ¡ 10 phÃºt khÃ´ng xong');
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
            /* Gemini TTS Ä‘á»c cáº£ chá»‰ dáº«n inline trong text */
            text = `${opts.instructions}: ${text}`;
        }
        const json = await gFetch(`models/${model}:generateContent`, {
            contents: [{ parts: [{ text }] }],
            generationConfig,
        });
        const part = (json.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
        if (!part) throw new Error('Gemini khÃ´ng tráº£ vá» audio');
        /* audio/L16;codec=pcm;rate=24000 â†’ bá»c WAV Ä‘á»ƒ phÃ¡t/ghÃ©p Ä‘Æ°á»£c */
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
    /* OPENAI TRá»°C TIáº¾P                                                     */
    /* ==================================================================== */
    async function oFetch(path, opts = {}) {
        const { key, pool } = pickOpenaiKey();
        const resp = await fetch(`${OPENAI_BASE}${path}`, {
            method: opts.method || 'POST',
            headers: {
                Authorization: `Bearer ${key}`,
                ...(opts.json ? { 'Content-Type': 'application/json' } : {}),
            },
            body: opts.json ? JSON.stringify(opts.json) : opts.body,
        });
        if (!resp.ok) {
            if (resp.status === 429 && pool.length > 1) rotateKey('openai');
            await readError(resp, 'OpenAI');
        }
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
        if (!text) throw new Error('OpenAI tráº£ vá» rá»—ng');
        return text;
    }

    async function openaiTxt2img(prompt, opts = {}) {
        const resp = await oFetch('/images/generations', {
            json: {
                model: opts.model || loadConfig().models.openaiImage,
                prompt,
                size: opts.size || '1024x1536',          // 9:16 dá»c
                quality: opts.quality || 'high',
                response_format: 'b64_json',              // luÃ´n tráº£ b64 â€” URL táº¡m thá»i hay háº¿t háº¡n
                n: 1,
            },
        });
        const json = await resp.json();
        const d = json.data?.[0];
        if (!d) throw new Error('OpenAI khÃ´ng tráº£ vá» áº£nh');
        return { url: d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url };
    }

    async function openaiTxt2vid(prompt, opts = {}) {
        const body = {
            model: opts.model || loadConfig().models.openaiVideo,   // 'sora-2' | 'sora-2-pro'
            prompt,
            seconds: Number(opts.seconds || 8),                     // Sora expects integer
            size: opts.size || '720x1280',                          // dá»c 9:16
        };
        let resp = await oFetch('/videos', { json: body });
        let job = await resp.json();
        if (!job.id) throw new Error('OpenAI khÃ´ng tráº£ vá» video job');

        const started = Date.now();
        while (Date.now() - started < 15 * 60 * 1000) {
            await sleep(10000);
            resp = await oFetch(`/videos/${job.id}`, { method: 'GET' });
            job = await resp.json();
            if (job.status === 'completed') break;
            if (job.status === 'failed') throw new Error(`Sora lá»—i: ${job.error?.message || 'khÃ´ng rÃµ'}`);
            if (opts.onTick) opts.onTick(`Sora Ä‘ang renderâ€¦ ${job.progress != null ? `${Math.round(job.progress * 100)}%` : ''} (${Math.round((Date.now() - started) / 1000)}s)`);
        }
        if (job.status !== 'completed') {
            const e = new Error('Sora quÃ¡ 15 phÃºt khÃ´ng xong');
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
    /* TOKENFORGE GATEWAY — OpenAI-compatible (Alibaba Cloud Model Studio)  */
    /* ==================================================================== */
    async function tfFetch(path, opts = {}) {
        const c = loadConfig();
        const base = (c.tfBaseUrl || DEFAULT_CONFIG.tfBaseUrl || '').trim().replace(/\/+$/, '');
        const viaProxy = base.startsWith('/');

        const { key: tfKey, pool: tfPool } = viaProxy
            ? { key: null, pool: [] }
            : pickTfKey();

        /* Base URL ket thuc bang /v1 thi khong noi them /v1 nua */
        const p = /\/v1$/.test(base) ? path.replace(/^\/v1(?=\/|$)/, '') : path;

        const headers = { 'Content-Type': 'application/json' };
        if (!viaProxy && tfKey) headers['Authorization'] = `Bearer ${tfKey}`;

        const resp = await fetch(`${base}${p}`, {
            method: opts.method || 'POST',
            headers,
            body: opts.json ? JSON.stringify(opts.json) : undefined,
        });
        if (!resp.ok) {
            if (resp.status === 429 && tfPool.length > 1) rotateKey('tf');
            await readError(resp, 'TokenForge');
        }
        return resp;
    }
    async function tokenforgeChat(messages, opts = {}) {
        const c = loadConfig();
        const resp = await tfFetch('/v1/chat/completions', {
            json: {
                model: opts.model || c.models.tfChat || 'qwen3.8-max',
                messages: messages.map((m) => ({
                    role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
                    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
                })),
                max_tokens: opts.max_tokens || 4096,
                temperature: opts.temperature,
            },
        });
        const json = await resp.json();
        const text = json?.choices?.[0]?.message?.content || '';
        if (!text) throw new Error('TokenForge trả về rỗng');
        return text;
    }

    async function listTokenforgeModels() {
        const resp = await tfFetch('/v1/models', { method: 'GET' });
        const json = await resp.json();
        return (json.data || json.models || []).map((m) => m.id || m.name).filter(Boolean).sort();
    }

    async function tokenforgeTest() {
        try {
            const models = await listTokenforgeModels();
            return { ok: true, info: `${models.length} model kháº£ dá»¥ng` };
        } catch (err) {
            return { ok: false, info: err.friendly || err.message };
        }
    }

    /* ==================================================================== */
    /* Kiá»ƒm tra key                                                         */
    /* ==================================================================== */
    async function testKey(provider) {
        try {
            if (provider === 'gemini') {
                const models = await listGeminiModels();
                return { ok: true, info: `${models.length} model kháº£ dá»¥ng` };
            }
            const models = await listOpenaiModels();
            return { ok: true, info: `${models.length} model kháº£ dá»¥ng` };
        } catch (err) {
            return { ok: false, info: err.message };
        }
    }

    global.VFPro = {
        getConfig, updateConfig, engineFor, resolveAuto, isDirect, proStatus,
        keyPoolStatus, rotateKey, parseKeyList,
        geminiChat, geminiTxt2img, geminiTxt2vid, geminiTxt2speech, listGeminiModels,
        openaiChat, openaiTxt2img, openaiTxt2vid, openaiTxt2speech, listOpenaiModels,
        tokenforgeChat, tokenforgeTest, listTokenforgeModels,
        testKey,
        DIRECT_MODELS: {
            geminiChat: ['gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-3-flash-preview', 'gemini-3-pro-preview'],
            openaiChat: ['gpt-5.5', 'gpt-5.2', 'gpt-5.1', 'gpt-5', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'],
            geminiImage: ['gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-2.0-flash-exp', 'gemini-2.0-flash-lite'],
            openaiImage: ['gpt-image-1', 'gpt-image-1-mini', 'gpt-image-2'],
            geminiVideo: ['veo-3.1-generate-preview', 'veo-3.1-fast-generate-preview', 'veo-3.1-lite-generate-preview'],
            openaiVideo: ['sora-2-pro', 'sora-2'],
            tfChat: ['claude-sonnet-5[1m]', 'claude-opus-5[1m]', 'claude-opus-4.8[1m]', 'claude-haiku-4-5', 'claude-sonnet-5'],
            geminiVoice: ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts', 'gemini-3.1-flash-tts-preview'],
            openaiVoice: ['gpt-4o-mini-tts', 'tts-1-hd', 'tts-1'],
        },
    };
})(window);
