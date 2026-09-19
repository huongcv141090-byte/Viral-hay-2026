/* =============================================================================
 * js/secrets.template.js — Hướng dẫn tạo secrets.js cho ViralForge 2026
 *
 * CÁCH DÙNG:
 *   1. Copy file này thành js/secrets.js (cùng thư mục)
 *   2. Điền API key của bạn vào các trường bên dưới
 *   3. KHÔNG commit js/secrets.js lên GitHub! (đã có trong .gitignore)
 *
 * TRÊN VERCEL PRODUCTION:
 *   Không cần file này. Nhập key trực tiếp qua UI tab "Cài đặt" trong app.
 *   Key được lưu an toàn vào localStorage của trình duyệt.
 * ============================================================================= */

window.VF_ENV = {
    /* ───── TokenForge (gateway đa-model) ─────
     * Đăng ký tại: https://tokenforge.ai.studio
     * Hỗ trợ: GPT-4o, Claude, Gemini, Llama... qua 1 API key */
    TOKENFORGE_API_KEY:  'tf-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    TOKENFORGE_BASE_URL: 'https://tokenforge.ai.studio/v1',   // Giữ nguyên
    TOKENFORGE_MODEL:    'gpt-4o-mini',                        // hoặc claude-3-5-haiku

    /* ───── Google Gemini ─────
     * Đăng ký tại: https://aistudio.google.com/apikey
     * Free tier: 15 RPM, 1M tokens/ngày */
    GEMINI_API_KEY: 'AIza_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',

    /* ───── OpenAI ─────
     * Đăng ký tại: https://platform.openai.com/api-keys
     * Dùng cho: GPT-4o text, DALL·E 3 ảnh, Sora video, TTS audio */
    OPENAI_API_KEY: 'sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
};
