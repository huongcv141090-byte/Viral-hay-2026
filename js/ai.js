/* =============================================================================
 * ViralForge 2026 — Puter AI Edition
 * js/ai.js — Lớp đấu nối puter.ai.* : chat, txt2img, txt2vid, txt2speech,
 *            speech2speech, speech2txt, img2txt, listModels, auth, kv, fs
 *
 * Mọi hàm trả về object thuần (url/blob/text) để UI và compositor dùng lại.
 * ========================================================================== */

(function (global) {
    'use strict';

    /* ---------------------------------------------------------------------
     * Kiểm tra Puter.js đã nạp chưa
     * ------------------------------------------------------------------ */
    function ensurePuter() {
        if (typeof window.puter === 'undefined') {
            const err = new Error(
                'Puter.js chưa được nạp. Kiểm tra kết nối mạng tới https://js.puter.com/v2/ rồi tải lại trang.'
            );
            err.code = 'puter_not_loaded';
            throw err;
        }
        return window.puter;
    }

    /* ---------------------------------------------------------------------
     * ROUTER TÀI KHOẢN PRO — nếu user chọn engine "gemini"/"openai" trong
     * thẻ Pro (Cài đặt) và đã nhập key, gọi thẳng API nhà cung cấp bằng key
     * của họ. "auto" hoặc thiếu key → Puter. testMode bật → luôn Puter
     * (media mẫu miễn phí, không đụng quota Pro).
     * ------------------------------------------------------------------ */
    function routeDirect(kind, opts = {}) {
        if (opts.testMode) return null;                       // test mode → Puter free
        if (typeof VFPro === 'undefined') return null;
        let engine = VFPro.engineFor(kind);
        /* 'auto' tự ưu tiên key của user (TokenForge → Gemini → OpenAI) */
        if (engine === 'auto') engine = VFPro.resolveAuto(kind);
        if (engine === 'puter') return null;
        return VFPro.isDirect(kind, engine) === true ? engine : null; // thiếu key → Puter
    }

    /* Chạy nhánh Pro trực tiếp; nếu lỗi có thể phục hồi (hết quota free
       tier, key sai/hết hạn, model limit 0, lỗi API tạm thời) và user bật
       autoFallback → tự chuyển sang Puter để không bỏ lỡ kết quả. */
    async function directWithFallback(kind, opts, directCall, puterCall) {
        const engine = routeDirect(kind, opts);
        if (!engine) return puterCall();
        try {
            return await directCall();
        } catch (err) {
            const cfg = typeof VFPro !== 'undefined' ? VFPro.getConfig() : {};
            const recoverable = ['pro_auth', 'pro_api', 'pro_quota', 'vs_offline', 'vs_api'].includes(err.code)
                || /quota exceeded|resource_exhausted/i.test(err.message || '');
            if (cfg.autoFallback !== false && recoverable) {
                const names = { gemini: 'Gemini', openai: 'OpenAI', tokenforge: 'TokenForge', voicestudio: 'VoiceStudio' };
                const name = names[engine] || engine;
                const msg = `💎 ${name} Pro lỗi: ${err.friendly || err.message} — đã tự chuyển sang Puter.`;
                if (typeof opts.onFallback === 'function') opts.onFallback(msg);
                return puterCall();
            }
            const displayNames = { gemini: 'Gemini', openai: 'OpenAI', tokenforge: 'TokenForge', voicestudio: 'VoiceStudio' };
            err.friendly = err.friendly || `${displayNames[engine] || engine}: ${err.message}`;
            throw err;
        }
    }

    /* ---------------------------------------------------------------------
     * Auth — AI calls cần user đăng nhập Puter (popup tự mở nếu chưa),
     * nhưng popup từ async call dễ bị chặn → nên bấm "Kết nối Puter" trước.
     * ------------------------------------------------------------------ */
    async function getUser() {
        const puter = ensurePuter();
        try {
            return await puter.auth.getUser();
        } catch (_) {
            return null;
        }
    }

    async function isSignedIn() {
        const puter = ensurePuter();
        try {
            return await puter.auth.isSignedIn();
        } catch (_) {
            return false;
        }
    }

    async function signIn() {
        const puter = ensurePuter();
        return puter.auth.signIn();
    }

    async function signOut() {
        const puter = ensurePuter();
        return puter.auth.signOut();
    }

    /* ---------------------------------------------------------------------
     * Map lỗi Puter → tiếng Việt thân thiện
     * ------------------------------------------------------------------ */
    function friendlyError(err) {
        const e = err || {};
        const code = e.errorCode || e.code || '';
        const msg = e.message || String(e);

        if (code === 'puter_not_loaded') return err;
        if (code === 'moderation_flagged')
            return { ...e, friendly: 'Nội dung bị bộ lọc của model từ chối. Hãy viết lại prompt theo hướng khác.' };
        if (code === 'insufficient_funds')
            return { ...e, friendly: 'Không đủ AI credits trong tài khoản Puter. Cách hay nhất: nhập key TokenForge/Gemini (Cài đặt → 💎 Pro) để chat chạy theo key của bạn — miễn phí theo free tier. Hoặc nạp thêm credits / chọn model rẻ hơn.' };
        if (code === 'upstream_timeout')
            return { ...e, friendly: 'Model mất quá lâu để tạo. Thử lại với video ngắn hơn hoặc model nhanh hơn.' };
        if (code === 'access_denied' || code === 'cannot_write_to_root')
            return { ...e, friendly: 'Không có quyền ghi tới đường dẫn trên Puter Drive.' };
        if (code === 'permission_required' || /auth|sign|token/i.test(msg))
            return { ...e, friendly: 'Cần đăng nhập Puter. Bấm "Kết nối Puter" ở góc trên rồi thử lại.' };
        if (/^upstream_/.test(code))
            return { ...e, friendly: `Nhà cung cấp model từ chối hoặc gặp sự cố: ${msg}` };
        return { ...e, friendly: msg };
    }

    function rethrowFriendly(err) {
        throw friendlyError(err);
    }

    /* ---------------------------------------------------------------------
     * CHAT — puter.ai.chat()
     * messages: [{role:'system'|'user'|'assistant', content}]
     * Trả về string nội dung (chuẩn hoá content-part array).
     * ------------------------------------------------------------------ */
    function extractContent(resp) {
        if (resp == null) return '';
        if (typeof resp === 'string') return resp;
        const content = resp.message ? resp.message.content : resp.content;
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content
                .map((part) => (typeof part === 'string' ? part : part.text || part.content || ''))
                .join('');
        }
        return String(resp);
    }

    async function chat(messages, options = {}) {
        const puterCall = async () => {
            const puter = ensurePuter();
            const params = { model: options.model || 'gpt-5-nano' };
            if (options.temperature !== undefined) params.temperature = options.temperature;
            if (options.max_tokens !== undefined) params.max_tokens = options.max_tokens;
            try {
                const resp = await puter.ai.chat(messages, params);
                return extractContent(resp);
            } catch (err) {
                rethrowFriendly(err);
            }
        };

        /* CHUỖI ƯU TIÊN CHO CHAT: engine người dùng chọn → TokenForge →
           Gemini → OpenAI → Puter. Chat KHÔNG bị Chế độ thử nghiệm chặn
           (chat không có media mẫu miễn phí — dùng key của bạn là miễn phí
           theo quota của chính bạn). KHÔNG truyền options.model sang engine
           trực tiếp — đó là model của Puter; engine trực tiếp dùng model
           đã cấu hình riêng trong thẻ 💎. */
        const callEngine = (engine) => {
            const directOpts = {
                temperature: options.temperature,
                max_tokens: options.max_tokens,
                onFallback: options.onFallback,
            };
            if (engine === 'tokenforge') return VFPro.tokenforgeChat(messages, directOpts);
            if (engine === 'gemini') return VFPro.geminiChat(messages, directOpts);
            return VFPro.openaiChat(messages, directOpts);
        };

        const candidates = [];
        const sel = VFPro.engineFor('chat');
        if (sel !== 'auto') candidates.push(sel);
        const auto = VFPro.resolveAuto('chat');
        if (auto !== 'puter') candidates.push(auto);
        ['tokenforge', 'gemini', 'openai'].forEach((e) => {
            if (!candidates.includes(e) && VFPro.isDirect('chat', e) === true) candidates.push(e);
        });
        if (!candidates.length) return puterCall();

        const names = { gemini: 'Gemini', openai: 'OpenAI', tokenforge: 'TokenForge' };
        let lastErr = null;
        for (const engine of candidates) {
            try {
                return await callEngine(engine);
            } catch (err) {
                lastErr = err;
                const recoverable = ['pro_auth', 'pro_api', 'pro_quota'].includes(err.code)
                    || /quota|maintenance|resource_exhausted/i.test(err.message || '');
                if (!recoverable) {
                    err.friendly = err.friendly || `${names[engine] || engine}: ${err.message}`;
                    throw err;
                }
                if (typeof options.onFallback === 'function') {
                    options.onFallback(`💎 ${names[engine]} lỗi: ${err.friendly || err.message} — thử bộ máy kế tiếp…`);
                }
            }
        }
        const cfg = typeof VFPro !== 'undefined' ? VFPro.getConfig() : {};
        if (cfg.autoFallback === false && lastErr) {
            lastErr.friendly = lastErr.friendly || lastErr.message;
            throw lastErr;
        }
        if (lastErr && typeof options.onFallback === 'function') {
            options.onFallback('💎 Tất cả key trực tiếp đều lỗi — chuyển sang Puter.');
        }
        return puterCall();
    }

    /* Ép model trả JSON sạch: cắt ```json fence, lấy {...} đầu→cuối */
    function parseJsonLoose(text) {
        if (!text) throw new Error('AI trả về rỗng');
        let t = String(text).trim();
        t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
        const first = t.indexOf('{');
        const last = t.lastIndexOf('}');
        if (first === -1 || last === -1) throw new Error('Không tìm thấy JSON trong phản hồi của AI');
        return JSON.parse(t.slice(first, last + 1));
    }

    async function chatJson(messages, options = {}) {
        const text = await chat(messages, options);
        try {
            return parseJsonLoose(text);
        } catch (e) {
            // Một lần nudge "chỉ trả JSON"
            const retry = await chat(
                [
                    ...messages,
                    { role: 'assistant', content: text },
                    { role: 'user', content: 'Phản hồi trước của bạn không phải JSON hợp lệ. Chỉ trả về JSON hợp lệ, không markdown, không giải thích.' },
                ],
                options
            );
            return parseJsonLoose(retry);
        }
    }

    /* ---------------------------------------------------------------------
     * IMAGE — puter.ai.txt2img()
     * Trả về { el, url } với url là dataURL của ảnh.
     * ------------------------------------------------------------------ */
    async function txt2img(prompt, opts = {}) {
        const puterCall = async () => {
            const puter = ensurePuter();
            const options = {
                prompt,
                model: opts.model || 'gpt-image-1-mini',
            };
            if (opts.provider) options.provider = opts.provider;
            if (opts.quality) options[opts.qualityKey || 'quality'] = opts.quality;
            if (opts.ratio) options.ratio = opts.ratio; // {w:9,h:16}
            if (opts.inputImages && opts.inputImages.length) options.input_images = opts.inputImages;
            if (opts.testMode) options.test_mode = true;
            if (opts.puterOutputPath) options.puter_output_path = opts.puterOutputPath;

            try {
                const el = await puter.ai.txt2img(options);
                return { el, url: el && el.src ? el.src : String(el) };
            } catch (err) {
                rethrowFriendly(err);
            }
        };

        return directWithFallback('image', opts, async () => {
            let engine = VFPro.engineFor('image');
            if (engine === 'auto') engine = VFPro.resolveAuto('image');
            const aspect = opts.ratio ? `${opts.ratio.w}:${opts.ratio.h}` : '9:16';
            if (engine === 'gemini') {
                const out = await VFPro.geminiTxt2img(prompt, {
                    aspectRatio: aspect,
                    imageSize: /^(512|1K|2K|4K)$/i.test(opts.quality || '') ? opts.quality : undefined,
                });
                return { el: null, url: out.url };
            }
            const sizeMap = { '16:9': '1536x1024', '9:16': '1024x1536', '1:1': '1024x1024' };
            const out = await VFPro.openaiTxt2img(prompt, {
                size: sizeMap[aspect] || '1024x1536',
                quality: ['low', 'medium', 'high'].includes(opts.quality) ? opts.quality : 'high',
            });
            return { el: null, url: out.url };
        }, puterCall);
    }

    /* ---------------------------------------------------------------------
     * VIDEO — puter.ai.txt2vid()
     * Trả về { el, url, mime } — url là https hoặc data URI.
     * ------------------------------------------------------------------ */
    async function txt2vid(prompt, opts = {}) {
        const puterCall = async () => {
            const puter = ensurePuter();
            const options = {
                prompt,
                model: opts.model || 'veo-3.1-lite',
            };
            if (opts.seconds) options.seconds = Number(opts.seconds);
            if (opts.size) options.size = opts.size;
            if (opts.negativePrompt) options.negative_prompt = opts.negativePrompt;
            if (opts.inputReference) options.input_reference = opts.inputReference;
            if (opts.lastFrame) options.last_frame = opts.lastFrame;
            if (opts.referenceImages && opts.referenceImages.length) options.reference_images = opts.referenceImages;
            if (opts.generateAudio !== undefined && opts.generateAudio !== null) options.generate_audio = !!opts.generateAudio;
            if (opts.testMode) options.test_mode = true;
            if (opts.puterOutputPath) options.puter_output_path = opts.puterOutputPath;

            try {
                const el = await puter.ai.txt2vid(options);
                const url = el && el.src ? el.src : String(el);
                const mime = el && el.getAttribute ? el.getAttribute('data-mime-type') || 'video/mp4' : 'video/mp4';
                return { el, url, mime };
            } catch (err) {
                rethrowFriendly(err);
            }
        };

        return directWithFallback('video', opts, async () => {
            let engine = VFPro.engineFor('video');
            if (engine === 'auto') engine = VFPro.resolveAuto('video');
            const m = /^(\d+)x(\d+)$/.exec(opts.size || '') || [0, 720, 1280];
            const w = Number(m[1]), h = Number(m[2]);
            const aspect = w > h ? '16:9' : '9:16';
            if (engine === 'gemini') {
                const shorter = Math.min(w, h);
                const resolution = /2160|4k/i.test(opts.size || '') ? '4k' : (shorter >= 1080 ? '1080p' : '720p');
                const out = await VFPro.geminiTxt2vid(prompt, {
                    aspectRatio: aspect,
                    resolution,
                    seconds: opts.seconds,
                    negativePrompt: opts.negativePrompt,
                    imageDataUrl: opts.inputReference,
                    onTick: opts.onTick,
                });
                return { el: null, url: out.url, mime: out.mime };
            }
            /* Sora: chỉ hỗ trợ t2v + khổ cố định của từng model */
            const soraSizes = ['720x1280', '1280x720', '1024x1792', '1792x1024'];
            const out = await VFPro.openaiTxt2vid(prompt, {
                seconds: opts.seconds,
                size: soraSizes.includes(opts.size) ? opts.size : (w > h ? '1280x720' : '720x1280'),
                onTick: opts.onTick,
            });
            return { el: null, url: out.url, mime: out.mime };
        }, puterCall);
    }

    /* ---------------------------------------------------------------------
     * TTS — puter.ai.txt2speech()
     * Trả về { el, url, blob } — blob để compositor ghépAudioContext.
     * ------------------------------------------------------------------ */
    async function fetchBlob(url) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Không tải được media (${resp.status})`);
        return await resp.blob();
    }

    async function txt2speech(text, opts = {}) {
        const puterCall = async () => {
            const puter = ensurePuter();
            const options = {
                provider: opts.provider || 'aws-polly',
                voice: opts.voice,
                test_mode: !!opts.testMode,
            };
            if (opts.model && opts.model !== '(default)' && opts.model !== '(engine)') options.model = opts.model;
            if (opts.language) options.language = opts.language;
            if (opts.engine && opts.engine !== 'auto') options.engine = opts.engine;
            if (opts.instructions) options.instructions = opts.instructions;
            if (opts.ssml) options.ssml = true;

            try {
                const el = await puter.ai.txt2speech(text, options);
                const url = el && el.src ? el.src : String(el);
                let blob = null;
                try {
                    blob = await fetchBlob(url);
                } catch (_) {
                    /* blob tuỳ chọn — compositor tự lo khi thiếu */
                }
                return { el, url, blob };
            } catch (err) {
                rethrowFriendly(err);
            }
        };

        return directWithFallback('voice', opts, () => {
            let engine = VFPro.engineFor('voice');
            if (engine === 'auto') engine = VFPro.resolveAuto('voice');
            if (engine === 'voicestudio' && typeof VFVS !== 'undefined') {
                /* VoiceStudio trên máy user — đa ngôn ngữ, clone giọng.
                   Giọng lấy từ cấu hình riêng của VoiceStudio (không dùng
                   giọng của select Puter phía trên). */
                return VFVS.speech(text, {
                    language: opts.language,
                    instruct: opts.instructions,
                });
            }
            return engine === 'gemini'
                ? VFPro.geminiTxt2speech(text, { voice: opts.voice, instructions: opts.instructions })
                : VFPro.openaiTxt2speech(text, { voice: opts.voice, instructions: opts.instructions });
        }, puterCall);
    }

    /* ---------------------------------------------------------------------
     * VOICE CHANGER — puter.ai.speech2speech() (ElevenLabs STS)
     * ------------------------------------------------------------------ */
    async function speech2speech(source, opts = {}) {
        const puter = ensurePuter();
        const options = {
            voice: opts.voice || '21m00Tcm4TlvDq8ikWAM',
            model: opts.model || 'eleven_multilingual_sts_v2',
            output_format: opts.outputFormat || 'mp3_44100_128',
            test_mode: !!opts.testMode,
        };
        if (opts.removeBackgroundNoise) options.remove_background_noise = true;
        try {
            const el = await puter.ai.speech2speech(source, options);
            return { el, url: el && el.src ? el.src : String(el) };
        } catch (err) {
            rethrowFriendly(err);
        }
    }

    /* ---------------------------------------------------------------------
     * STT — puter.ai.speech2txt()
     * ------------------------------------------------------------------ */
    async function speech2txt(source, opts = {}) {
        const puter = ensurePuter();
        const options = { provider: opts.provider || 'openai' };
        if (opts.model) options.model = opts.model;
        if (opts.translate) options.translate = true;
        if (opts.responseFormat) options.response_format = opts.responseFormat;
        if (opts.language) options.language = opts.language;
        if (opts.chunkingStrategy) options.chunking_strategy = opts.chunkingStrategy;
        if (opts.testMode) options.test_mode = true;
        try {
            const result = await puter.ai.speech2txt(source, options);
            return result;
        } catch (err) {
            rethrowFriendly(err);
        }
    }

    /* ---------------------------------------------------------------------
     * OCR — puter.ai.img2txt()
     * ------------------------------------------------------------------ */
    async function img2txt(source, opts = {}) {
        const puter = ensurePuter();
        const options = { provider: opts.provider || 'aws-textract' };
        if (opts.model) options.model = opts.model;
        if (opts.testMode) options.test_mode = true;
        try {
            return await puter.ai.img2txt(source, options);
        } catch (err) {
            rethrowFriendly(err);
        }
    }

    /* ---------------------------------------------------------------------
     * Danh sách model chat động (để điền dropdown "Model Hub")
     * ------------------------------------------------------------------ */
    async function listChatModels(provider = null) {
        const puter = ensurePuter();
        try {
            const models = provider ? await puter.ai.listModels(provider) : await puter.ai.listModels();
            return Array.isArray(models) ? models : [];
        } catch (err) {
            rethrowFriendly(err);
        }
    }

    /* ---------------------------------------------------------------------
     * PUTER KV + FS — lưu dự án & assets lên cloud Puter
     * ------------------------------------------------------------------ */
    async function kvSet(key, value) {
        const puter = ensurePuter();
        try {
            await puter.kv.set(key, typeof value === 'string' ? value : JSON.stringify(value));
            return true;
        } catch (_) {
            return false;
        }
    }

    async function kvGet(key) {
        const puter = ensurePuter();
        try {
            const raw = await puter.kv.get(key);
            if (raw == null) return null;
            try {
                return JSON.parse(raw);
            } catch (_) {
                return raw;
            }
        } catch (_) {
            return null;
        }
    }

    /* Lưu blob/dataURL tới Puter Drive, trả về path (null nếu thất bại) */
    async function fsWriteBlob(path, blobOrDataUrl) {
        const puter = ensurePuter();
        try {
            let blob = blobOrDataUrl;
            if (typeof blobOrDataUrl === 'string' && !blobOrDataUrl.startsWith('blob:')) {
                blob = await (await fetch(blobOrDataUrl)).blob();
            } else if (typeof blobOrDataUrl === 'string') {
                blob = await (await fetch(blobOrDataUrl)).blob();
            }
            await puter.fs.write(path, blob, { createMissingParents: true, overwrite: true });
            return path;
        } catch (_) {
            return null;
        }
    }

    global.VFAI = {
        ensurePuter,
        getUser,
        isSignedIn,
        signIn,
        signOut,
        chat,
        chatJson,
        parseJsonLoose,
        txt2img,
        txt2vid,
        txt2speech,
        speech2speech,
        speech2txt,
        img2txt,
        listChatModels,
        kvSet,
        kvGet,
        fsWriteBlob,
        fetchBlob,
        friendlyError,
        proStatus: () => (typeof VFPro !== 'undefined' ? VFPro.proStatus() : { gemini: false, openai: false, tokenforge: false }),
        routeDirect,
    };
})(window);
