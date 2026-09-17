/* =============================================================================
 * ViralForge 2026 — Puter AI Edition
 * js/models.js — Catalog model AI MỚI NHẤT (xác minh từ docs.puter.com/AI)
 *
 * Toàn bộ model đều chạy qua Puter.js (https://js.puter.com/v2/) theo mô hình
 * "User Pays" — người dùng cuối trả bằng AI credits của tài khoản Puter của
 * họ, ứng dụng không cần API key nào.
 * ============================================================================= */

(function (global) {
    'use strict';

    /* -------------------------------------------------------------------------
     * 1. CHAT — sinh ý tưởng, kịch bản, blueprint, caption
     * ------------------------------------------------------------------------- */
    const CHAT_MODELS = [
        { id: 'gpt-5.6-luna',       label: 'GPT-5.6 Luna',            vendor: 'OpenAI',    badge: 'MỚI NHẤT', note: 'Flagship OpenAI, web search builtin' },
        { id: 'gpt-5.5',            label: 'GPT-5.5',                 vendor: 'OpenAI',    badge: 'MỚI',      note: 'Cân bằng chi phí/chất lượng' },
        { id: 'gpt-5-nano',         label: 'GPT-5 Nano',              vendor: 'OpenAI',    badge: 'RẺ',       note: 'Mặc định của Puter, nhẹ nhất' },
        { id: 'claude-opus-4-8',    label: 'Claude Opus 4.8',         vendor: 'Anthropic', badge: 'MỚI NHẤT', note: 'Sáng viết kịch bản hay nhất' },
        { id: 'claude-sonnet-5',    label: 'Claude Sonnet 5',         vendor: 'Anthropic', badge: 'MỚI',      note: 'Nhanh, chất lượng cao' },
        { id: 'claude-sonnet-4-6',  label: 'Claude Sonnet 4.6',       vendor: 'Anthropic', badge: '',         note: 'Ổn định, phổ biến' },
        { id: 'gemini-3.1-flash',   label: 'Gemini 3.1 Flash',        vendor: 'Google',    badge: 'MỚI NHẤT', note: 'Multimodal, rất nhanh' },
        { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', vendor: 'Google',   badge: 'RẺ',      note: 'Bản nhẹ của Gemini 3.1' },
    ];

    /* -------------------------------------------------------------------------
     * 2. IMAGE — puter.ai.txt2img()
     *    quality: các mức được model hỗ trợ; ratios: kiểu khổ hỗ trợ
     * ------------------------------------------------------------------------- */
    const IMAGE_MODELS = [
        {
            id: 'gpt-image-2.5-sunburst', provider: 'openai-image-generation', label: 'GPT Image 2.5 Sunburst',
            vendor: 'OpenAI', badge: 'MỚI NHẤT',
            qualities: ['low', 'medium', 'high', 'xhigh', 'max', 'auto'], qualityDefault: 'high',
            ratioMode: 'free', note: 'Flagship mới nhất của OpenAI, chữ trong ảnh cực chuẩn',
        },
        {
            id: 'gpt-image-2.5-flare', provider: 'openai-image-generation', label: 'GPT Image 2.5 Flare',
            vendor: 'OpenAI', badge: 'MỚI NHẤT',
            qualities: ['low', 'medium', 'high', 'xhigh', 'max', 'auto'], qualityDefault: 'high',
            ratioMode: 'free', note: 'Biến thể 2.5 tối ưu cho ánh sáng/tương phản',
        },
        {
            id: 'gpt-image-2', provider: 'openai-image-generation', label: 'GPT Image 2',
            vendor: 'OpenAI', badge: '',
            qualities: ['low', 'medium', 'high', 'auto'], qualityDefault: 'high',
            ratioMode: 'free', note: 'Ổn định, hỗ trợ image-to-image nhiều ảnh',
        },
        {
            id: 'gpt-image-1.5', provider: 'openai-image-generation', label: 'GPT Image 1.5',
            vendor: 'OpenAI', badge: '',
            qualities: ['low', 'medium', 'high'], qualityDefault: 'high',
            ratioMode: 'fixed', note: 'Khổ cố định: 1024x1024, 1024x1536, 1536x1024',
        },
        {
            id: 'gemini-3.1-flash-image-preview', provider: 'gemini', label: 'Nano Banana 2 (Gemini 3.1 Flash Image)',
            vendor: 'Google', badge: 'MỚI NHẤT',
            qualities: ['512', '1K', '2K', '4K'], qualityDefault: '2K',
            ratioMode: 'free', note: 'Nano Banana 2 — edit ảnh conversational tốt nhất, tới 4K',
        },
        {
            id: 'gemini-3-pro-image-preview', provider: 'gemini', label: 'Gemini 3 Pro Image',
            vendor: 'Google', badge: 'MỚI',
            qualities: ['1K', '2K', '4K'], qualityDefault: '2K',
            ratioMode: 'free', note: 'Chất lượng studio của Google, 4K',
        },
        {
            id: 'grok-imagine-image-quality', provider: 'xai', label: 'Grok Imagine (Quality)',
            vendor: 'xAI', badge: 'MỚI',
            qualities: ['1k', '2k'], qualityDefault: '2k',
            ratioMode: 'free', note: 'Tối đa 3 ảnh tham chiếu để ghép chủ thể/style',
        },
        {
            id: 'grok-imagine-image', provider: 'xai', label: 'Grok Imagine (Nhanh)',
            vendor: 'xAI', badge: '',
            qualities: ['1k', '2k'], qualityDefault: '1k',
            ratioMode: 'free', note: 'Mặc định khi chọn provider xai',
        },
        {
            id: 'black-forest-labs/flux-2-dev', provider: 'replicate-image-generation', label: 'FLUX.2 [dev]',
            vendor: 'Replicate', badge: 'MỚI',
            qualities: ['0.25', '0.5', '1', '2'], qualityDefault: '1', qualityKey: 'output_megapixels',
            ratioMode: 'free', note: 'Open-weight mạnh nhất, có go_fast',
        },
        {
            id: 'black-forest-labs/flux-schnell', provider: 'replicate-image-generation', label: 'FLUX Schnell',
            vendor: 'Replicate', badge: 'RẺ',
            qualities: ['0.25', '0.5', '1'], qualityDefault: '0.5', qualityKey: 'output_megapixels',
            ratioMode: 'free', note: 'Rẻ và cực nhanh, 4 bước diffusion',
        },
        {
            id: 'leonardoai/lucid-origin', provider: 'replicate-image-generation', label: 'Leonardo Lucid Origin',
            vendor: 'Replicate', badge: '',
            qualities: ['standard', 'ultra'], qualityDefault: 'standard', qualityKey: 'generation_mode',
            ratioMode: 'free', note: 'Phong cách Leonardo, prompt_enhance builtin',
        },
    ];

    /* -------------------------------------------------------------------------
     * 3. VIDEO — puter.ai.txt2vid()
     *    seconds: mảng hoặc [min,max] bước 1s; sizes: giá trị hợp lệ của `size`
     * ------------------------------------------------------------------------- */
    const VIDEO_MODELS = [
        {
            id: 'veo-3.1', label: 'Veo 3.1 (Cinematic 4K)', vendor: 'Google', badge: 'MỚI NHẤT',
            seconds: [4, 6, 8], sizes: ['1280x720', '720x1280', '1920x1080', '1080x1920', '3840x2160', '2160x3840'],
            sizeDefault: '1080x1920', audio: 'always', refImages: 3, keyframes: 'first+last',
            note: 'Cinematic nhất, luôn kèm âm thanh; 4K + ảnh tham chiếu cố định 8s',
        },
        {
            id: 'veo-3.1-fast', label: 'Veo 3.1 Fast', vendor: 'Google', badge: 'MỚI NHẤT',
            seconds: [4, 6, 8], sizes: ['1280x720', '720x1280', '1920x1080', '1080x1920', '3840x2160', '2160x3840'],
            sizeDefault: '720x1280', audio: 'always', refImages: 3, keyframes: 'first+last',
            note: 'Rẻ hơn Veo 3.1, vẫn 4K, có âm thanh',
        },
        {
            id: 'veo-3.1-lite', label: 'Veo 3.1 Lite (mặc định Puter)', vendor: 'Google', badge: '',
            seconds: [4, 6, 8], sizes: ['1280x720', '720x1280', '1920x1080', '1080x1920'],
            sizeDefault: '720x1280', audio: 'always', refImages: 3, keyframes: 'first+last',
            note: 'Model video mặc định của Puter — rẻ nhất nhà Google',
        },
        {
            id: 'seedance-2-5', label: 'Seedance 2.5', vendor: 'BytePlus', badge: 'MỚI NHẤT',
            seconds: { min: 4, max: 30, def: 5 }, sizes: ['480p', '720p', '1080p'],
            sizeDefault: '720p', audio: 'optional', refImages: 30, keyframes: 'first+last',
            note: 'Tối đa 30s và 30 ảnh tham chiếu — king của video dài',
        },
        {
            id: 'seedance-2-0', label: 'Seedance 2.0', vendor: 'BytePlus', badge: 'MỚI',
            seconds: { min: 4, max: 15, def: 5 }, sizes: ['480p', '720p', '1080p', '4k'],
            sizeDefault: '720p', audio: 'optional', refImages: 9, keyframes: 'first+last',
            note: 'Có 4K, âm thanh mặc định bật',
        },
        {
            id: 'seedance-2-0-mini', label: 'Seedance 2.0 Mini', vendor: 'BytePlus', badge: 'RẺ',
            seconds: { min: 4, max: 15, def: 5 }, sizes: ['480p', '720p'],
            sizeDefault: '720p', audio: 'optional', refImages: 9, keyframes: 'first+last',
            note: 'Rẻ nhất họ Seedance, vẫn có âm thanh',
        },
        {
            id: 'kwaivgi/kling-2.1-pro', label: 'Kling 2.1 Pro', vendor: 'Together AI', badge: '',
            seconds: [5], sizes: ['1920x1080', '1080x1080', '1080x1920'],
            sizeDefault: '1080x1920', audio: 'none', refImages: 0, keyframes: 'first+last',
            note: 'Chuyển động thật tay nghề cao, i2v cần frame đầu',
        },
        {
            id: 'kwaivgi/kling-2.1-master', label: 'Kling 2.1 Master', vendor: 'Together AI', badge: '',
            seconds: [5], sizes: ['1920x1080', '1080x1080', '1080x1920'],
            sizeDefault: '1080x1920', audio: 'none', refImages: 0, keyframes: 'first',
            note: 'Bản master chất lượng đỉnh của Kling',
        },
        {
            id: 'wan-ai/wan2.7-i2v', label: 'Wan 2.7 (Image-to-Video)', vendor: 'Together AI', badge: 'MỚI',
            seconds: { min: 2, max: 15, def: 5 }, sizes: ['720P', '1080P'],
            sizeDefault: '720P', audio: 'always', refImages: 0, keyframes: 'first+last',
            aspectFromWH: true, note: '30fps, tự sinh âm thanh, 9:16/16:9/1:1',
        },
        {
            id: 'wan-ai/wan2.7-t2v', label: 'Wan 2.7 (Text-to-Video)', vendor: 'Together AI', badge: 'MỚI',
            seconds: { min: 2, max: 15, def: 5 }, sizes: ['720P', '1080P'],
            sizeDefault: '720P', audio: 'always', refImages: 0, keyframes: 'none',
            aspectFromWH: true, note: 'T2V thuần, 30fps, có soundtrack',
        },
        {
            id: 'minimax/hailuo-02', label: 'MiniMax Hailuo 02', vendor: 'Together AI', badge: '',
            seconds: [10], sizes: ['1366x768', '1920x1080'],
            sizeDefault: '1366x768', audio: 'none', refImages: 0, keyframes: 'first',
            note: 'Clip 10s giá trọn gói, chuyển động mượt',
        },
        {
            id: 'pixverse/pixverse-v5', label: 'PixVerse v5', vendor: 'Together AI', badge: '',
            seconds: [5], sizes: ['1280x720', '720x1280', '720x720', '1920x1080', '1080x1920'],
            sizeDefault: '720x1280', audio: 'none', refImages: 0, keyframes: 'first+last',
            note: 'Hiệu ứng anime/effect mạnh',
        },
        {
            id: 'google/veo-2.0', label: 'Veo 2.0 (qua Together)', vendor: 'Together AI', badge: 'RẺ',
            seconds: [5], sizes: ['1280x720', '720x1280'],
            sizeDefault: '720x1280', audio: 'none', refImages: 0, keyframes: 'first+last',
            note: 'Giá trọn clip 5s — rẻ để test i2v',
        },
    ];

    /* -------------------------------------------------------------------------
     * 4. VOICE (TTS) — puter.ai.txt2speech()
     * ------------------------------------------------------------------------- */
    const TTS_PROVIDERS = [
        {
            id: 'elevenlabs', label: 'ElevenLabs', badge: 'TỐT NHẤT',
            models: [
                { id: 'eleven_v3', label: 'Eleven v3', badge: 'MỚI NHẤT', note: 'Cảm xúc và biểu đạt đỉnh nhất' },
                { id: 'eleven_multilingual_v2', label: 'Multilingual v2', badge: 'DEFAULT', note: '50+ ngôn ngữ, gồm tiếng Việt' },
                { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5', badge: '', note: 'Nhanh, latency thấp' },
                { id: 'eleven_flash_v2_5', label: 'Flash v2.5', badge: 'RẺ', note: 'Nhanh nhất, rẻ nhất' },
            ],
            voices: ['21m00Tcm4TlvDq8ikWAM (Rachel)', 'TX3LPaxmHKxFdv7VOQHJ (Liam)', 'pNInz6obpgDQGcFmaJgB (Adam)', 'EXAVITQu4vr4xnSDxMaL (Sarah)'],
            voiceDefault: '21m00Tcm4TlvDq8ikWAM',
            freeTextVoice: true, note: 'Dán bất kỳ voice ID nào từ thư viện ElevenLabs của bạn',
        },
        {
            id: 'gemini', label: 'Gemini TTS', badge: 'MỚI NHẤT',
            models: [
                { id: 'gemini-3.1-flash-tts-preview', label: 'Gemini 3.1 Flash TTS', badge: 'MỚI NHẤT', note: 'TTS thế hệ mới nhất của Google' },
                { id: 'gemini-2.5-pro-preview-tts', label: 'Gemini 2.5 Pro TTS', badge: '', note: 'Chất lượng pro' },
                { id: 'gemini-2.0-flash-preview-tts', label: 'Gemini 2.5 Flash TTS', badge: 'DEFAULT', note: 'Nhanh, 30 giọng dựng sẵn' },
            ],
            voices: ['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat', 'Autonoe'],
            voiceDefault: 'Kore',
            freeTextVoice: false, note: '30 giọng dựng sẵn, điều khiển cảm xúc bằng `instructions`',
        },
        {
            id: 'openai', label: 'OpenAI TTS', badge: '',
            models: [
                { id: 'gpt-4o-mini-tts', label: 'gpt-4o-mini-tts', badge: 'DEFAULT', note: 'Điều khiển style bằng `instructions`' },
                { id: 'tts-1-hd', label: 'tts-1-hd', badge: '', note: 'HD' },
                { id: 'tts-1', label: 'tts-1', badge: 'RẺ', note: 'Cổ điển' },
            ],
            voices: ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'],
            voiceDefault: 'alloy',
            freeTextVoice: false, note: '10 giọng đặc trưng',
        },
        {
            id: 'xai', label: 'Grok TTS (xAI)', badge: 'MỚI',
            models: [{ id: '(default)', label: 'Mặc định xAI', badge: '', note: 'xAI chọn model server-side' }],
            voices: ['eve (năng lượng)', 'ara (ấm áp)', 'rex (đáng tin)', 'sal (trôi chảy)', 'leo (quyền uy)'],
            voiceDefault: 'eve',
            freeTextVoice: false, note: 'Hỗ trợ thẻ [pause], [laugh], <whisper>…</whisper>',
        },
        {
            id: 'speechify', label: 'Speechify', badge: '',
            models: [
                { id: 'simba-3.2', label: 'Simba 3.2', badge: 'MỚI NHẤT/DEFAULT', note: 'Bản mới nhất' },
                { id: 'simba-multilingual', label: 'Simba Multilingual', badge: '', note: 'Đa ngôn ngữ' },
                { id: 'simba-english', label: 'Simba English', badge: '', note: 'Tiếng Anh tối ưu' },
            ],
            voices: ['geffen_32', 'dominic_32', 'harper_32', 'hugh_32', 'imogen_32'],
            voiceDefault: 'geffen_32',
            freeTextVoice: false, note: 'Giọng đọc sách tự nhiên',
        },
        {
            id: 'aws-polly', label: 'AWS Polly', badge: 'VIỆT',
            models: [{ id: '(engine)', label: 'Chọn engine bên dưới', badge: '', note: 'standard / neural / long-form / generative' }],
            voices: ['Khoa (vi-VN neural)', 'Joanna (en-US)', 'Ruth (en-US generative)', 'Lupe (es-US)', 'Hans (de-DE)'],
            voiceDefault: 'Khoa',
            freeTextVoice: true, note: 'Cách rẻ nhất để đọc TIẾNG VIỆT (vi-VN, giọng Khoa neural)',
            engines: ['standard', 'neural', 'long-form', 'generative'],
        },
    ];

    /* Ngôn ngữ đọc phổ biến (Polly language codes; provider khác tự detect) */
    const TTS_LANGUAGES = [
        { code: 'vi-VN', label: 'Tiếng Việt' },
        { code: 'en-US', label: 'English (US)' },
        { code: 'en-GB', label: 'English (UK)' },
        { code: 'es-ES', label: 'Español' },
        { code: 'pt-BR', label: 'Português (BR)' },
        { code: 'fr-FR', label: 'Français' },
        { code: 'de-DE', label: 'Deutsch' },
        { code: 'ja-JP', label: '日本語' },
        { code: 'ko-KR', label: '한국어' },
        { code: 'zh-CN', label: '中文' },
        { code: 'hi-IN', label: 'हिन्दी' },
        { code: 'id-ID', label: 'Bahasa Indonesia' },
    ];

    /* -------------------------------------------------------------------------
     * 5. CÔNG CỤ KHÁC — speech2speech (đổi giọng), speech2txt (phiên âm),
     *    img2txt (OCR)
     * ------------------------------------------------------------------------- */
    const STS_MODELS = [
        { id: 'eleven_multilingual_sts_v2', label: 'Multilingual STS v2 (đa ngôn ngữ)', note: 'Mặc định' },
        { id: 'eleven_english_sts_v2', label: 'English STS v2', note: 'Chỉ tiếng Anh' },
    ];

    const STT_MODELS = [
        { id: 'gpt-4o-transcribe-diarize', label: 'GPT-4o Transcribe Diarize', badge: 'MỚI NHẤT', note: 'Tách người nói, xuất SRT/VTT' },
        { id: 'gpt-4o-transcribe', label: 'GPT-4o Transcribe', badge: '', note: 'Chính xác cao' },
        { id: 'gpt-4o-mini-transcribe', label: 'GPT-4o mini Transcribe', badge: 'DEFAULT', note: 'Rẻ' },
        { id: 'whisper-1', label: 'Whisper v1', badge: '', note: 'Dịch sang tiếng Anh + timestamp' },
    ];

    const OCR_PROVIDERS = [
        { id: 'aws-textract', label: 'AWS Textract (mặc định)', note: 'Nhanh, chuẩn' },
        { id: 'mistral', label: 'Mistral OCR', note: 'Đa ngôn ngữ, richer annotation' },
    ];

    /* -------------------------------------------------------------------------
     * Helpers
     * ------------------------------------------------------------------------- */
    function imageOptionsFor(modelId) {
        const m = IMAGE_MODELS.find((x) => x.id === modelId);
        return m || IMAGE_MODELS[0];
    }

    function videoOptionsFor(modelId) {
        const m = VIDEO_MODELS.find((x) => x.id === modelId);
        return m || VIDEO_MODELS[2];
    }

    function ttsProviderFor(providerId) {
        return TTS_PROVIDERS.find((p) => p.id === providerId) || TTS_PROVIDERS[0];
    }

    /* Gợi ý cặp "tốt nhất" theo từng mục đích — dùng cho nút "Chọn combo tốt nhất" */
    const BEST_COMBOS = {
        cinematic: {
            label: '🎬 Combo Điện ảnh (chất lượng tối đa)',
            chat: 'claude-opus-4-8',
            image: 'gpt-image-2.5-sunburst',
            video: 'veo-3.1',
            tts: { provider: 'elevenlabs', model: 'eleven_v3' },
        },
        value: {
            label: '⚡ Combo Tốc độ & Chi phí (khuyên dùng)',
            chat: 'gpt-5.5',
            image: 'gemini-3.1-flash-image-preview',
            video: 'seedance-2-0-mini',
            tts: { provider: 'gemini', model: 'gemini-3.1-flash-tts-preview' },
        },
        vietnamese: {
            label: '🇻🇳 Combo Tiếng Việt',
            chat: 'claude-sonnet-5',
            image: 'gemini-3.1-flash-image-preview',
            video: 'veo-3.1-lite',
            tts: { provider: 'aws-polly', model: 'neural', voice: 'Khoa' },
        },
    };

    global.VFModels = {
        CHAT_MODELS,
        IMAGE_MODELS,
        VIDEO_MODELS,
        TTS_PROVIDERS,
        TTS_LANGUAGES,
        STS_MODELS,
        STT_MODELS,
        OCR_PROVIDERS,
        BEST_COMBOS,
        imageOptionsFor,
        videoOptionsFor,
        ttsProviderFor,
    };
})(window);
