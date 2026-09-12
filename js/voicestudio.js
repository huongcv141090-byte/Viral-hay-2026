/* =============================================================================
 * ViralForge 2026 — Puter AI Edition
 * js/voicestudio.js — Đấu nối **VoiceStudio** (github.com/debpalash/VoiceStudio)
 * đang chạy TRÊN MÁY BẠN để tạo giọng đọc đa ngôn ngữ (646 ngôn ngữ), clone
 * giọng và voice-design — miễn phí, không tốn credits.
 *
 * API đã xác minh từ mã nguồn VoiceStudio (backend/api/routers/openai_compat.py):
 *   GET  /health                 → 200 khi backend sống
 *   GET  /v1/audio/voices        → { voices:[{voice_id,name,type,language?}],
 *                                    engines:[...] }
 *   POST /v1/audio/speech        → audio bytes (wav/mp3/opus/flac/pcm)
 *        body: { model (engine id: omnivoice|voxcpm2|cosyvoice|kittentts|…),
 *                input (≤4096 ký tự), voice ('default'|voice_id|preset),
 *                response_format, speed, language (ISO 639-1: 'vi'),
 *                description (voice-design, VoxCPM2), instruct (style),
 *                seed, denoise, preprocess_prompt }
 *   Auth: tuỳ chọn Bearer khi đặt OMNIVOICE_API_KEY; PIN tuỳ chọn.
 *   CORS: mặc định chỉ cho phép UI của VoiceStudio (cổng 3901) — cần thêm
 *   origin của app qua env OMNIVOICE_ALLOWED_ORIGINS (hướng dẫn trong UI).
 * ============================================================================= */

(function (global) {
    'use strict';

    const STORE_KEY = 'vf2026:voicestudio';
    const DEFAULT_CONFIG = {
        url: 'http://127.0.0.1:3900',
        apiKey: '',
        engine: 'omnivoice',
        voice: 'default',
        speed: 1.0,
        instruct: '',
        enabled: false, // dùng VoiceStudio làm bộ máy giọng đọc cho pipeline
    };

    let config = null;
    let voicesCache = null;
    let enginesCache = null;

    function loadConfig() {
        if (config) return config;
        try {
            config = { ...structuredClone(DEFAULT_CONFIG), ...(JSON.parse(localStorage.getItem(STORE_KEY) || '{}')) };
        } catch (_) {
            config = structuredClone(DEFAULT_CONFIG);
        }
        return config;
    }

    function saveConfig() {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(config)); } catch (_) { /* ignore */ }
    }

    function updateConfig(patch) {
        const c = loadConfig();
        Object.assign(c, patch);
        if (typeof c.url === 'string') c.url = c.url.trim().replace(/\/+$/, '');
        saveConfig();
        return c;
    }

    function getConfig() { return structuredClone(loadConfig()); }
    function isEnabled() { return !!loadConfig().enabled; }

    function headers() {
        const h = { 'Content-Type': 'application/json' };
        const key = loadConfig().apiKey;
        if (key) h.Authorization = `Bearer ${key}`;
        return h;
    }

    function baseUrl() {
        return loadConfig().url.replace(/\/+$/, '') || 'http://127.0.0.1:3900';
    }

    /* Bọc lỗi mạng → tiếng Việt có chỉ dẫn khắc phục */
    function networkError(err) {
        const e = new Error(
            'Không kết nối được VoiceStudio. Kiểm tra: ① VoiceStudio đang chạy (app desktop hoặc docker, cổng 3900); ' +
            '② đã thêm origin của app vào CORS: OMNIVOICE_ALLOWED_ORIGINS=http://127.0.0.1:8899,http://localhost:8899'
        );
        e.code = 'vs_offline';
        e.friendly = e.message;
        e.cause = err;
        return e;
    }

    /* GET /health — kiểm tra backend sống */
    async function health() {
        try {
            const resp = await fetch(`${baseUrl()}/health`, { method: 'GET' });
            if (!resp.ok) {
                const e = new Error(`VoiceStudio trả về HTTP ${resp.status}`);
                e.code = 'vs_offline';
                e.friendly = e.message;
                throw e;
            }
            return true;
        } catch (err) {
            if (err.code === 'vs_offline') throw err;
            throw networkError(err);
        }
    }

    /* GET /v1/audio/voices — danh sách giọng (profile đã clone + alias) và engines */
    async function listVoices(force = false) {
        if (!force && voicesCache) return { voices: voicesCache, engines: enginesCache };
        let resp;
        try {
            resp = await fetch(`${baseUrl()}/v1/audio/voices`, { headers: headers() });
        } catch (err) {
            throw networkError(err);
        }
        if (!resp.ok) {
            const e = new Error(`VoiceStudio HTTP ${resp.status}`);
            e.code = 'vs_api';
            e.friendly = e.message;
            throw e;
        }
        const json = await resp.json();
        voicesCache = Array.isArray(json.voices) ? json.voices : [];
        enginesCache = Array.isArray(json.engines) ? json.engines : [];
        return { voices: voicesCache, engines: enginesCache };
    }

    /* 'vi-VN' → 'vi' (VoiceStudio nhận ISO 639-1) */
    function shortLang(lang) {
        if (!lang) return undefined;
        return String(lang).split(/[-_]/)[0].toLowerCase();
    }

    /* POST /v1/audio/speech — sinh giọng, trả {el, url, blob} như các engine khác */
    async function speech(text, opts = {}) {
        const c = loadConfig();
        const body = {
            model: opts.engine || c.engine || 'omnivoice',
            input: String(text || '').slice(0, 4096),
            voice: opts.voice || c.voice || 'default',
            response_format: opts.responseFormat || 'wav',
            speed: Number(opts.speed || c.speed || 1.0),
        };
        const lang = shortLang(opts.language);
        if (lang) body.language = lang;
        const instruct = opts.instruct !== undefined ? opts.instruct : c.instruct;
        if (instruct) body.instruct = instruct;

        let resp;
        try {
            resp = await fetch(`${baseUrl()}/v1/audio/speech`, {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify(body),
            });
        } catch (err) {
            throw networkError(err);
        }
        if (!resp.ok) {
            let detail = `HTTP ${resp.status}`;
            try { detail = (await resp.json())?.detail || detail; } catch (_) { /* giữ */ }
            const e = new Error(`VoiceStudio: ${detail}`);
            e.code = resp.status === 401 || resp.status === 403 ? 'pro_auth' : 'vs_api';
            e.friendly = e.message;
            throw e;
        }
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        return { el: new Audio(url), url, blob };
    }

    global.VFVS = {
        getConfig, updateConfig, isEnabled, health, listVoices, speech,
    };
})(window);
