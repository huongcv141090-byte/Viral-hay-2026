/* =============================================================================
 * ViralForge 2026 â€” Puter AI Edition
 * js/models.js â€” Catalog model AI Má»šI NHáº¤T (xÃ¡c minh tá»« docs.puter.com/AI)
 *
 * ToÃ n bá»™ model Ä‘á»u cháº¡y qua Puter.js (https://js.puter.com/v2/) theo mÃ´ hÃ¬nh
 * "User Pays" â€” ngÆ°á»i dÃ¹ng cuá»‘i tráº£ báº±ng AI credits cá»§a tÃ i khoáº£n Puter cá»§a
 * há», á»©ng dá»¥ng khÃ´ng cáº§n API key nÃ o.
 * ============================================================================= */

(function (global) {
    'use strict';

    /* -------------------------------------------------------------------------
     * 1. CHAT â€” sinh Ã½ tÆ°á»Ÿng, ká»‹ch báº£n, blueprint, caption
     * ------------------------------------------------------------------------- */
    const CHAT_MODELS = [
        { id: 'gpt-5.6-luna',       label: 'GPT-5.6 Luna',            vendor: 'OpenAI',    badge: 'Má»šI NHáº¤T', note: 'Flagship OpenAI, web search builtin' },
        { id: 'gpt-5.5',            label: 'GPT-5.5',                 vendor: 'OpenAI',    badge: 'Má»šI',      note: 'CÃ¢n báº±ng chi phÃ­/cháº¥t lÆ°á»£ng' },
        { id: 'gpt-5-nano',         label: 'GPT-5 Nano',              vendor: 'OpenAI',    badge: 'Ráºº',       note: 'Máº·c Ä‘á»‹nh cá»§a Puter, nháº¹ nháº¥t' },
        { id: 'claude-opus-4-8',    label: 'Claude Opus 4.8',         vendor: 'Anthropic', badge: 'Má»šI NHáº¤T', note: 'SÃ¡ng viáº¿t ká»‹ch báº£n hay nháº¥t' },
        { id: 'claude-sonnet-5',    label: 'Claude Sonnet 5',         vendor: 'Anthropic', badge: 'Má»šI',      note: 'Nhanh, cháº¥t lÆ°á»£ng cao' },
        { id: 'claude-sonnet-4-6',  label: 'Claude Sonnet 4.6',       vendor: 'Anthropic', badge: '',         note: 'á»”n Ä‘á»‹nh, phá»• biáº¿n' },
        { id: 'gemini-3.1-flash',   label: 'Gemini 3.1 Flash',        vendor: 'Google',    badge: 'Má»šI NHáº¤T', note: 'Multimodal, ráº¥t nhanh' },
        { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', vendor: 'Google',   badge: 'Ráºº',      note: 'Báº£n nháº¹ cá»§a Gemini 3.1' },
    ];

    /* -------------------------------------------------------------------------
     * 2. IMAGE â€” puter.ai.txt2img()
     *    quality: cÃ¡c má»©c Ä‘Æ°á»£c model há»— trá»£; ratios: kiá»ƒu khá»• há»— trá»£
     * ------------------------------------------------------------------------- */
    const IMAGE_MODELS = [
        {
            id: 'gpt-image-2.5-sunburst', provider: 'openai-image-generation', label: 'GPT Image 2.5 Sunburst',
            vendor: 'OpenAI', badge: 'Má»šI NHáº¤T',
            qualities: ['low', 'medium', 'high', 'xhigh', 'max', 'auto'], qualityDefault: 'high',
            ratioMode: 'free', note: 'Flagship má»›i nháº¥t cá»§a OpenAI, chá»¯ trong áº£nh cá»±c chuáº©n',
        },
        {
            id: 'gpt-image-2.5-flare', provider: 'openai-image-generation', label: 'GPT Image 2.5 Flare',
            vendor: 'OpenAI', badge: 'Má»šI NHáº¤T',
            qualities: ['low', 'medium', 'high', 'xhigh', 'max', 'auto'], qualityDefault: 'high',
            ratioMode: 'free', note: 'Biáº¿n thá»ƒ 2.5 tá»‘i Æ°u cho Ã¡nh sÃ¡ng/tÆ°Æ¡ng pháº£n',
        },
        {
            id: 'gpt-image-2', provider: 'openai-image-generation', label: 'GPT Image 2',
            vendor: 'OpenAI', badge: '',
            qualities: ['low', 'medium', 'high', 'auto'], qualityDefault: 'high',
            ratioMode: 'free', note: 'á»”n Ä‘á»‹nh, há»— trá»£ image-to-image nhiá»u áº£nh',
        },
        {
            id: 'gpt-image-1.5', provider: 'openai-image-generation', label: 'GPT Image 1.5',
            vendor: 'OpenAI', badge: '',
            qualities: ['low', 'medium', 'high'], qualityDefault: 'high',
            ratioMode: 'fixed', note: 'Khá»• cá»‘ Ä‘á»‹nh: 1024x1024, 1024x1536, 1536x1024',
        },
        {
            id: 'gemini-3.1-flash-image-preview', provider: 'gemini', label: 'Nano Banana 2 (Gemini 3.1 Flash Image)',
            vendor: 'Google', badge: 'Má»šI NHáº¤T',
            qualities: ['512', '1K', '2K', '4K'], qualityDefault: '2K',
            ratioMode: 'free', note: 'Nano Banana 2 â€” edit áº£nh conversational tá»‘t nháº¥t, tá»›i 4K',
        },
        {
            id: 'gemini-3-pro-image-preview', provider: 'gemini', label: 'Gemini 3 Pro Image',
            vendor: 'Google', badge: 'Má»šI',
            qualities: ['1K', '2K', '4K'], qualityDefault: '2K',
            ratioMode: 'free', note: 'Cháº¥t lÆ°á»£ng studio cá»§a Google, 4K',
        },
        {
            id: 'grok-imagine-image-quality', provider: 'xai', label: 'Grok Imagine (Quality)',
            vendor: 'xAI', badge: 'Má»šI',
            qualities: ['1k', '2k'], qualityDefault: '2k',
            ratioMode: 'free', note: 'Tá»‘i Ä‘a 3 áº£nh tham chiáº¿u Ä‘á»ƒ ghÃ©p chá»§ thá»ƒ/style',
        },
        {
            id: 'grok-imagine-image', provider: 'xai', label: 'Grok Imagine (Nhanh)',
            vendor: 'xAI', badge: '',
            qualities: ['1k', '2k'], qualityDefault: '1k',
            ratioMode: 'free', note: 'Máº·c Ä‘á»‹nh khi chá»n provider xai',
        },
        {
            id: 'black-forest-labs/flux-2-dev', provider: 'replicate-image-generation', label: 'FLUX.2 [dev]',
            vendor: 'Replicate', badge: 'Má»šI',
            qualities: ['0.25', '0.5', '1', '2'], qualityDefault: '1', qualityKey: 'output_megapixels',
            ratioMode: 'free', note: 'Open-weight máº¡nh nháº¥t, cÃ³ go_fast',
        },
        {
            id: 'black-forest-labs/flux-schnell', provider: 'replicate-image-generation', label: 'FLUX Schnell',
            vendor: 'Replicate', badge: 'Ráºº',
            qualities: ['0.25', '0.5', '1'], qualityDefault: '0.5', qualityKey: 'output_megapixels',
            ratioMode: 'free', note: 'Ráº» vÃ  cá»±c nhanh, 4 bÆ°á»›c diffusion',
        },
        {
            id: 'leonardoai/lucid-origin', provider: 'replicate-image-generation', label: 'Leonardo Lucid Origin',
            vendor: 'Replicate', badge: '',
            qualities: ['standard', 'ultra'], qualityDefault: 'standard', qualityKey: 'generation_mode',
            ratioMode: 'free', note: 'Phong cÃ¡ch Leonardo, prompt_enhance builtin',
        },
    ];

    /* -------------------------------------------------------------------------
     * 3. VIDEO â€” puter.ai.txt2vid()
     *    seconds: máº£ng hoáº·c [min,max] bÆ°á»›c 1s; sizes: giÃ¡ trá»‹ há»£p lá»‡ cá»§a `size`
     * ------------------------------------------------------------------------- */
    const VIDEO_MODELS = [
        {
            id: 'veo-3.1', label: 'Veo 3.1 (Cinematic 4K)', vendor: 'Google', badge: 'Má»šI NHáº¤T',
            seconds: [4, 6, 8], sizes: ['1280x720', '720x1280', '1920x1080', '1080x1920', '3840x2160', '2160x3840'],
            sizeDefault: '1080x1920', audio: 'always', refImages: 3, keyframes: 'first+last',
            note: 'Cinematic nháº¥t, luÃ´n kÃ¨m Ã¢m thanh; 4K + áº£nh tham chiáº¿u cá»‘ Ä‘á»‹nh 8s',
        },
        {
            id: 'veo-3.1-fast', label: 'Veo 3.1 Fast', vendor: 'Google', badge: 'Má»šI NHáº¤T',
            seconds: [4, 6, 8], sizes: ['1280x720', '720x1280', '1920x1080', '1080x1920', '3840x2160', '2160x3840'],
            sizeDefault: '720x1280', audio: 'always', refImages: 3, keyframes: 'first+last',
            note: 'Ráº» hÆ¡n Veo 3.1, váº«n 4K, cÃ³ Ã¢m thanh',
        },
        {
            id: 'veo-3.1-lite', label: 'Veo 3.1 Lite (máº·c Ä‘á»‹nh Puter)', vendor: 'Google', badge: '',
            seconds: [4, 6, 8], sizes: ['1280x720', '720x1280', '1920x1080', '1080x1920'],
            sizeDefault: '720x1280', audio: 'always', refImages: 3, keyframes: 'first+last',
            note: 'Model video máº·c Ä‘á»‹nh cá»§a Puter â€” ráº» nháº¥t nhÃ  Google',
        },
        {
            id: 'seedance-2-5', label: 'Seedance 2.5', vendor: 'BytePlus', badge: 'Má»šI NHáº¤T',
            seconds: { min: 4, max: 30, def: 5 }, sizes: ['480p', '720p', '1080p'],
            sizeDefault: '720p', audio: 'optional', refImages: 30, keyframes: 'first+last',
            note: 'Tá»‘i Ä‘a 30s vÃ  30 áº£nh tham chiáº¿u â€” king cá»§a video dÃ i',
        },
        {
            id: 'seedance-2-0', label: 'Seedance 2.0', vendor: 'BytePlus', badge: 'Má»šI',
            seconds: { min: 4, max: 15, def: 5 }, sizes: ['480p', '720p', '1080p', '4k'],
            sizeDefault: '720p', audio: 'optional', refImages: 9, keyframes: 'first+last',
            note: 'CÃ³ 4K, Ã¢m thanh máº·c Ä‘á»‹nh báº­t',
        },
        {
            id: 'seedance-2-0-mini', label: 'Seedance 2.0 Mini', vendor: 'BytePlus', badge: 'Ráºº',
            seconds: { min: 4, max: 15, def: 5 }, sizes: ['480p', '720p'],
            sizeDefault: '720p', audio: 'optional', refImages: 9, keyframes: 'first+last',
            note: 'Ráº» nháº¥t há» Seedance, váº«n cÃ³ Ã¢m thanh',
        },
        {
            id: 'kwaivgi/kling-2.1-pro', label: 'Kling 2.1 Pro', vendor: 'Together AI', badge: '',
            seconds: [5], sizes: ['1920x1080', '1080x1080', '1080x1920'],
            sizeDefault: '1080x1920', audio: 'none', refImages: 0, keyframes: 'first+last',
            note: 'Chuyá»ƒn Ä‘á»™ng tháº­t tay nghá» cao, i2v cáº§n frame Ä‘áº§u',
        },
        {
            id: 'kwaivgi/kling-2.1-master', label: 'Kling 2.1 Master', vendor: 'Together AI', badge: '',
            seconds: [5], sizes: ['1920x1080', '1080x1080', '1080x1920'],
            sizeDefault: '1080x1920', audio: 'none', refImages: 0, keyframes: 'first',
            note: 'Báº£n master cháº¥t lÆ°á»£ng Ä‘á»‰nh cá»§a Kling',
        },
        {
            id: 'wan-ai/wan2.7-i2v', label: 'Wan 2.7 (Image-to-Video)', vendor: 'Together AI', badge: 'Má»šI',
            seconds: { min: 2, max: 15, def: 5 }, sizes: ['720P', '1080P'],
            sizeDefault: '720P', audio: 'always', refImages: 0, keyframes: 'first+last',
            aspectFromWH: true, note: '30fps, tá»± sinh Ã¢m thanh, 9:16/16:9/1:1',
        },
        {
            id: 'wan-ai/wan2.7-t2v', label: 'Wan 2.7 (Text-to-Video)', vendor: 'Together AI', badge: 'Má»šI',
            seconds: { min: 2, max: 15, def: 5 }, sizes: ['720P', '1080P'],
            sizeDefault: '720P', audio: 'always', refImages: 0, keyframes: 'none',
            aspectFromWH: true, note: 'T2V thuáº§n, 30fps, cÃ³ soundtrack',
        },
        {
            id: 'minimax/hailuo-02', label: 'MiniMax Hailuo 02', vendor: 'Together AI', badge: '',
            seconds: [10], sizes: ['1366x768', '1920x1080'],
            sizeDefault: '1366x768', audio: 'none', refImages: 0, keyframes: 'first',
            note: 'Clip 10s giÃ¡ trá»n gÃ³i, chuyá»ƒn Ä‘á»™ng mÆ°á»£t',
        },
        {
            id: 'pixverse/pixverse-v5', label: 'PixVerse v5', vendor: 'Together AI', badge: '',
            seconds: [5], sizes: ['1280x720', '720x1280', '720x720', '1920x1080', '1080x1920'],
            sizeDefault: '720x1280', audio: 'none', refImages: 0, keyframes: 'first+last',
            note: 'Hiá»‡u á»©ng anime/effect máº¡nh',
        },
        {
            id: 'google/veo-2.0', label: 'Veo 2.0 (qua Together)', vendor: 'Together AI', badge: 'Ráºº',
            seconds: [5], sizes: ['1280x720', '720x1280'],
            sizeDefault: '720x1280', audio: 'none', refImages: 0, keyframes: 'first+last',
            note: 'GiÃ¡ trá»n clip 5s â€” ráº» Ä‘á»ƒ test i2v',
        },
    ];

    /* -------------------------------------------------------------------------
     * 4. VOICE (TTS) â€” puter.ai.txt2speech()
     * ------------------------------------------------------------------------- */
    const TTS_PROVIDERS = [
        {
            id: 'elevenlabs', label: 'ElevenLabs', badge: 'Tá»T NHáº¤T',
            models: [
                { id: 'eleven_v3', label: 'Eleven v3', badge: 'Má»šI NHáº¤T', note: 'Cáº£m xÃºc vÃ  biá»ƒu Ä‘áº¡t Ä‘á»‰nh nháº¥t' },
                { id: 'eleven_multilingual_v2', label: 'Multilingual v2', badge: 'DEFAULT', note: '50+ ngÃ´n ngá»¯, gá»“m tiáº¿ng Viá»‡t' },
                { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5', badge: '', note: 'Nhanh, latency tháº¥p' },
                { id: 'eleven_flash_v2_5', label: 'Flash v2.5', badge: 'Ráºº', note: 'Nhanh nháº¥t, ráº» nháº¥t' },
            ],
            voices: ['21m00Tcm4TlvDq8ikWAM (Rachel)', 'TX3LPaxmHKxFdv7VOQHJ (Liam)', 'pNInz6obpgDQGcFmaJgB (Adam)', 'EXAVITQu4vr4xnSDxMaL (Sarah)'],
            voiceDefault: '21m00Tcm4TlvDq8ikWAM',
            freeTextVoice: true, note: 'DÃ¡n báº¥t ká»³ voice ID nÃ o tá»« thÆ° viá»‡n ElevenLabs cá»§a báº¡n',
        },
        {
            id: 'gemini', label: 'Gemini TTS', badge: 'Má»šI NHáº¤T',
            models: [
                { id: 'gemini-3.1-flash-tts-preview', label: 'Gemini 3.1 Flash TTS', badge: 'Má»šI NHáº¤T', note: 'TTS tháº¿ há»‡ má»›i nháº¥t cá»§a Google' },
                { id: 'gemini-2.5-pro-preview-tts', label: 'Gemini 2.5 Pro TTS', badge: '', note: 'Cháº¥t lÆ°á»£ng pro' },
                { id: 'gemini-2.0-flash-preview-tts', label: 'Gemini 2.5 Flash TTS', badge: 'DEFAULT', note: 'Nhanh, 30 giá»ng dá»±ng sáºµn' },
            ],
            voices: ['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat', 'Autonoe'],
            voiceDefault: 'Kore',
            freeTextVoice: false, note: '30 giá»ng dá»±ng sáºµn, Ä‘iá»u khiá»ƒn cáº£m xÃºc báº±ng `instructions`',
        },
        {
            id: 'openai', label: 'OpenAI TTS', badge: '',
            models: [
                { id: 'gpt-4o-mini-tts', label: 'gpt-4o-mini-tts', badge: 'DEFAULT', note: 'Äiá»u khiá»ƒn style báº±ng `instructions`' },
                { id: 'tts-1-hd', label: 'tts-1-hd', badge: '', note: 'HD' },
                { id: 'tts-1', label: 'tts-1', badge: 'Ráºº', note: 'Cá»• Ä‘iá»ƒn' },
            ],
            voices: ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'],
            voiceDefault: 'alloy',
            freeTextVoice: false, note: '10 giá»ng Ä‘áº·c trÆ°ng',
        },
        {
            id: 'xai', label: 'Grok TTS (xAI)', badge: 'Má»šI',
            models: [{ id: '(default)', label: 'Máº·c Ä‘á»‹nh xAI', badge: '', note: 'xAI chá»n model server-side' }],
            voices: ['eve (nÄƒng lÆ°á»£ng)', 'ara (áº¥m Ã¡p)', 'rex (Ä‘Ã¡ng tin)', 'sal (trÃ´i cháº£y)', 'leo (quyá»n uy)'],
            voiceDefault: 'eve',
            freeTextVoice: false, note: 'Há»— trá»£ tháº» [pause], [laugh], <whisper>â€¦</whisper>',
        },
        {
            id: 'speechify', label: 'Speechify', badge: '',
            models: [
                { id: 'simba-3.2', label: 'Simba 3.2', badge: 'Má»šI NHáº¤T/DEFAULT', note: 'Báº£n má»›i nháº¥t' },
                { id: 'simba-multilingual', label: 'Simba Multilingual', badge: '', note: 'Äa ngÃ´n ngá»¯' },
                { id: 'simba-english', label: 'Simba English', badge: '', note: 'Tiáº¿ng Anh tá»‘i Æ°u' },
            ],
            voices: ['geffen_32', 'dominic_32', 'harper_32', 'hugh_32', 'imogen_32'],
            voiceDefault: 'geffen_32',
            freeTextVoice: false, note: 'Giá»ng Ä‘á»c sÃ¡ch tá»± nhiÃªn',
        },
        {
            id: 'aws-polly', label: 'AWS Polly', badge: 'VIá»†T',
            models: [{ id: '(engine)', label: 'Chá»n engine bÃªn dÆ°á»›i', badge: '', note: 'standard / neural / long-form / generative' }],
            voices: ['Khoa (vi-VN neural)', 'Joanna (en-US)', 'Ruth (en-US generative)', 'Lupe (es-US)', 'Hans (de-DE)'],
            voiceDefault: 'Khoa',
            freeTextVoice: true, note: 'CÃ¡ch ráº» nháº¥t Ä‘á»ƒ Ä‘á»c TIáº¾NG VIá»†T (vi-VN, giá»ng Khoa neural)',
            engines: ['standard', 'neural', 'long-form', 'generative'],
        },
    ];

    /* NgÃ´n ngá»¯ Ä‘á»c phá»• biáº¿n (Polly language codes; provider khÃ¡c tá»± detect) */
    const TTS_LANGUAGES = [
        { code: 'vi-VN', label: 'Tiáº¿ng Viá»‡t' },
        { code: 'en-US', label: 'English (US)' },
        { code: 'en-GB', label: 'English (UK)' },
        { code: 'es-ES', label: 'EspaÃ±ol' },
        { code: 'pt-BR', label: 'PortuguÃªs (BR)' },
        { code: 'fr-FR', label: 'FranÃ§ais' },
        { code: 'de-DE', label: 'Deutsch' },
        { code: 'ja-JP', label: 'æ—¥æœ¬èªž' },
        { code: 'ko-KR', label: 'í•œêµ­ì–´' },
        { code: 'zh-CN', label: 'ä¸­æ–‡' },
        { code: 'hi-IN', label: 'à¤¹à¤¿à¤¨à¥à¤¦à¥€' },
        { code: 'id-ID', label: 'Bahasa Indonesia' },
    ];

    /* -------------------------------------------------------------------------
     * 5. CÃ”NG Cá»¤ KHÃC â€” speech2speech (Ä‘á»•i giá»ng), speech2txt (phiÃªn Ã¢m),
     *    img2txt (OCR)
     * ------------------------------------------------------------------------- */
    const STS_MODELS = [
        { id: 'eleven_multilingual_sts_v2', label: 'Multilingual STS v2 (Ä‘a ngÃ´n ngá»¯)', note: 'Máº·c Ä‘á»‹nh' },
        { id: 'eleven_english_sts_v2', label: 'English STS v2', note: 'Chá»‰ tiáº¿ng Anh' },
    ];

    const STT_MODELS = [
        { id: 'gpt-4o-transcribe-diarize', label: 'GPT-4o Transcribe Diarize', badge: 'Má»šI NHáº¤T', note: 'TÃ¡ch ngÆ°á»i nÃ³i, xuáº¥t SRT/VTT' },
        { id: 'gpt-4o-transcribe', label: 'GPT-4o Transcribe', badge: '', note: 'ChÃ­nh xÃ¡c cao' },
        { id: 'gpt-4o-mini-transcribe', label: 'GPT-4o mini Transcribe', badge: 'DEFAULT', note: 'Ráº»' },
        { id: 'whisper-1', label: 'Whisper v1', badge: '', note: 'Dá»‹ch sang tiáº¿ng Anh + timestamp' },
    ];

    const OCR_PROVIDERS = [
        { id: 'aws-textract', label: 'AWS Textract (máº·c Ä‘á»‹nh)', note: 'Nhanh, chuáº©n' },
        { id: 'mistral', label: 'Mistral OCR', note: 'Äa ngÃ´n ngá»¯, richer annotation' },
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

    /* Gá»£i Ã½ cáº·p "tá»‘t nháº¥t" theo tá»«ng má»¥c Ä‘Ã­ch â€” dÃ¹ng cho nÃºt "Chá»n combo tá»‘t nháº¥t" */
    const BEST_COMBOS = {
        cinematic: {
            label: 'ðŸŽ¬ Combo Äiá»‡n áº£nh (cháº¥t lÆ°á»£ng tá»‘i Ä‘a)',
            chat: 'claude-opus-4-8',
            image: 'gpt-image-2.5-sunburst',
            video: 'veo-3.1',
            tts: { provider: 'elevenlabs', model: 'eleven_v3' },
        },
        value: {
            label: 'âš¡ Combo Tá»‘c Ä‘á»™ & Chi phÃ­ (khuyÃªn dÃ¹ng)',
            chat: 'gpt-5.5',
            image: 'gemini-3.1-flash-image-preview',
            video: 'seedance-2-0-mini',
            tts: { provider: 'gemini', model: 'gemini-3.1-flash-tts-preview' },
        },
        vietnamese: {
            label: 'ðŸ‡»ðŸ‡³ Combo Tiáº¿ng Viá»‡t',
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
