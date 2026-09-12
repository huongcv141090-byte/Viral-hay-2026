/* =============================================================================
 * ViralForge 2026 — Puter AI Edition
 * js/store.js — Lưu dự án vào localStorage (+ đồng bộ Puter KV khi đăng nhập)
 * Lưu ý: blob/dataURL lớn KHÔNG lưu localStorage — chỉ lưu JSON của dự án.
 * ============================================================================= */

(function (global) {
    'use strict';

    const KEY_PROJECT = 'vf2026:project';
    const KEY_REVENUE = 'vf2026:revenue';
    const KEY_LIBRARY = 'vf2026:library';
    const KEY_SETTINGS = 'vf2026:settings';

    function safeGet(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (raw == null) return fallback;
            return JSON.parse(raw);
        } catch (_) {
            return fallback;
        }
    }

    function safeSet(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn('[store] Lưu thất bại (có thể do hết quota):', e);
            return false;
        }
    }

    function defaultProject() {
        return {
            createdAt: new Date().toISOString(),
            brief: {
                topic: '',
                niche: '',
                duration: 45,
                audience: '',
                platform: 'tiktok_youtube',
                style: 'storytelling',
                goal: 'views',
                chatModel: 'gpt-5.5',
                voiceLang: 'vi-VN',
            },
            ideas: [],
            refined: null,
            blueprint: null,
            /* scenes: [{id, text, imagePrompt, camera, seconds,
                        imageDataUrl, imageModel, clipUrl, clipModel, audioUrl}] */
            scenes: [],
            voice: { provider: 'aws-polly', model: '', voice: 'Khoa', language: 'vi-VN', engine: 'neural', instructions: '' },
            render: null, // {url, mime, size, createdAt, mode}
            viralKit: null, // {platform: {caption, hashtags[], time}}
        };
    }

    const Store = {
        defaultProject,

        loadProject() {
            return { ...defaultProject(), ...safeGet(KEY_PROJECT, {}) };
        },
        saveProject(project) {
            /* Bỏ các trường blob/dataURL quá lớn trước khi lưu */
            const light = JSON.parse(
                JSON.stringify(project, (k, v) => {
                    if (typeof v === 'string' && v.startsWith('data:') && v.length > 200000) return '__STRIPPED_DATA_URL__';
                    if (typeof v === 'string' && v.startsWith('blob:')) return '__SESSION_BLOB__';
                    return v;
                })
            );
            return safeSet(KEY_PROJECT, light);
        },
        clearProject() {
            localStorage.removeItem(KEY_PROJECT);
        },

        loadRevenue() {
            return safeGet(KEY_REVENUE, []);
        },
        saveRevenue(rows) {
            return safeSet(KEY_REVENUE, rows);
        },

        loadLibrary() {
            return safeGet(KEY_LIBRARY, []);
        },
        /* item: {id, title, createdAt, blueprint, brief, note} */
        addToLibrary(item) {
            const lib = Store.loadLibrary();
            lib.unshift(item);
            return safeSet(KEY_LIBRARY, lib.slice(0, 50));
        },
        removeFromLibrary(id) {
            const lib = Store.loadLibrary().filter((x) => x.id !== id);
            return safeSet(KEY_LIBRARY, lib);
        },

        loadSettings() {
            return { testMode: true, saveToPuter: false, ...safeGet(KEY_SETTINGS, {}) };
        },
        saveSettings(s) {
            return safeSet(KEY_SETTINGS, s);
        },

        exportProject(project) {
            const data = JSON.stringify(project, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `viralforge-project-${Date.now()}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        },

        async importProject(file) {
            const text = await file.text();
            const data = JSON.parse(text);
            return { ...defaultProject(), ...data };
        },

        usageBytes() {
            let total = 0;
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('vf2026:')) {
                        total += (localStorage.getItem(k) || '').length * 2;
                    }
                }
            } catch (_) { /* ignore */ }
            return total;
        },
    };

    global.VFStore = Store;
})(window);
