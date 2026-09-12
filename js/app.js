/* =============================================================================
 * ViralForge 2026 — Puter AI Edition
 * js/app.js — Điều phối pipeline: Brief → Ý tưởng → Blueprint → Ảnh → Giọng
 *             → Video → Viral, cùng Model Hub / Thư viện / Thu nhập / Cài đặt.
 * ============================================================================= */

(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const el = (tag, cls, html) => {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html !== undefined) n.innerHTML = html;
        return n;
    };
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const APP = {
        project: null,
        settings: { testMode: true, saveToPuter: false },
        user: null,
        busy: false,
    };

    /* ===================================================================== */
    /* Tiện ích UI                                                           */
    /* ===================================================================== */
    let toastTimer = null;
    function toast(msg, kind = '') {
        const t = $('toast');
        t.textContent = msg;
        t.className = `toast ${kind}`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.add('hidden'), kind === 'err' ? 7000 : 4000);
    }

    function setStatus(id, msg, kind = '') {
        const n = $(id);
        if (!n) return;
        n.textContent = msg || '';
        n.className = `status ${kind}`;
    }

    function setBusy(btnId, busy) {
        const b = $(btnId);
        if (!b) return;
        b.disabled = busy;
        b.classList.toggle('busy', busy);
    }

    function setProgress(id, p) {
        const w = $(id);
        if (!w) return;
        w.classList.remove('hidden');
        w.firstElementChild.style.width = `${Math.round(p * 100)}%`;
        if (p >= 1) setTimeout(() => w.classList.add('hidden'), 1200);
    }

    function save() {
        VFStore.saveProject(APP.project);
        updateStorageHint();
    }

    function updateStorageHint() {
        const kb = Math.round(VFStore.usageBytes() / 1024);
        const n = $('storage-hint');
        if (n) n.textContent = `Dự án + doanh thu đang dùng ~${kb} KB localStorage trên máy này.`;
    }

    function renderTestBanner() {
        const b = $('test-banner');
        if (b) b.classList.toggle('hidden', !APP.settings.testMode);
    }

    /* Hậu tố trạng thái khi kết quả là media mẫu của chế độ thử nghiệm */
    function testNote() {
        return APP.settings.testMode ? ' — 🧪 media MẪU, tắt Chế độ thử nghiệm để tạo THẬT' : '';
    }

    function errText(err) {
        return (err && (err.friendly || err.message)) || String(err);
    }

    function badgeOf(b) {
        if (!b) return '';
        return ` <span class="badge">${esc(b)}</span>`;
    }

    function copyText(text, btn) {
        (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
            .then(() => {
                if (btn) { const o = btn.textContent; btn.textContent = '✅ Đã copy'; setTimeout(() => (btn.textContent = o), 1500); }
            })
            .catch(() => toast('Trình duyệt chặn clipboard — hãy copy thủ công.', 'err'));
    }

    /* ===================================================================== */
    /* Điều hướng view                                                       */
    /* ===================================================================== */
    document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b === btn));
            document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${btn.dataset.view}`));
            if (btn.dataset.view === 'library') renderLibrary();
            if (btn.dataset.view === 'revenue') renderRevenue();
            if (btn.dataset.view === 'settings') renderSettingsAuth();
        });
    });

    /* ===================================================================== */
    /* Điền các dropdown model                                               */
    /* ===================================================================== */
    function fillSelect(sel, items, valueKey = 'id', labelFn = null) {
        sel.innerHTML = '';
        items.forEach((it) => {
            const o = document.createElement('option');
            if (typeof it === 'object') {
                o.value = it[valueKey];
                o.textContent = labelFn ? labelFn(it) : it.label || it[valueKey];
            } else {
                o.value = it;
                o.textContent = String(it);
            }
            sel.appendChild(o);
        });
    }

    function populateChatModels() {
        fillSelect($('bf-chat-model'), VFModels.CHAT_MODELS, 'id', (m) => `${m.label}${m.badge ? ` · ${m.badge}` : ''}`);
    }

    function populateLanguages() {
        const langs = VFModels.TTS_LANGUAGES.map((l) => ({ id: l.code, label: l.label }));
        fillSelect($('bf-lang'), langs);
        fillSelect($('tts-lang'), langs);
        $('bf-lang').value = 'vi-VN';
        $('tts-lang').value = 'vi-VN';
    }

    function populateImageModels() {
        fillSelect($('img-model'), VFModels.IMAGE_MODELS);
        onImageModelChange();
    }

    function onImageModelChange() {
        const meta = VFModels.imageOptionsFor($('img-model').value);
        const qSel = $('img-quality');
        fillSelect(qSel, meta.qualities);
        qSel.value = meta.qualityDefault;
        const unit = meta.qualityKey === 'output_megapixels' ? 'MP' : meta.qualityKey === 'generation_mode' ? 'chế độ' : '';
        $('img-model-hint').textContent = `${meta.label} — ${meta.note}${unit ? ` (đơn vị: ${unit})` : ''}`;
    }

    function populateVideoModels() {
        fillSelect($('vid-model'), VFModels.VIDEO_MODELS);
        onVideoModelChange();
    }

    function onVideoModelChange() {
        const meta = VFModels.videoOptionsFor($('vid-model').value);

        /* seconds */
        const sSel = $('vid-seconds');
        let seconds;
        if (Array.isArray(meta.seconds)) seconds = meta.seconds;
        else {
            const step = [4, 5, 6, 8, 10, 12, 15, 20, 25, 30];
            seconds = step.filter((s) => s >= meta.seconds.min && s <= meta.seconds.max);
            if (!seconds.includes(meta.seconds.def)) seconds.unshift(meta.seconds.def);
        }
        fillSelect(sSel, seconds.map(String));
        sSel.value = String(Array.isArray(meta.seconds) ? meta.seconds[0] : meta.seconds.def);

        /* sizes */
        const zSel = $('vid-size');
        zSel.innerHTML = '';
        meta.sizes.forEach((s) => {
            const o = document.createElement('option');
            o.value = s;
            let label = s;
            const m = s.match(/^(\d+)x(\d+)$/);
            if (m) {
                const w = +m[1], h = +m[2];
                label = `${s} (${w > h ? 'ngang' : w < h ? 'dọc 9:16' : 'vuông'})`;
            }
            o.textContent = label;
            zSel.appendChild(o);
        });
        zSel.value = meta.sizeDefault;

        /* audio */
        const aChk = $('vid-audio');
        if (meta.audio === 'always') { aChk.checked = true; aChk.disabled = true; }
        else if (meta.audio === 'none') { aChk.checked = false; aChk.disabled = true; }
        else { aChk.disabled = false; aChk.checked = true; }

        $('vid-model-hint').textContent = `${meta.label} — ${meta.note}`;
        $('vid-cost-hint').textContent = APP.settings.testMode
            ? '🧪 Đang bật Chế độ thử nghiệm — sẽ nhận clip MẪU, không tốn credits.'
            : '⚠️ Tắt Chế độ thử nghiệm: mỗi clip thành công TRỪ credits theo model/thời lượng/độ phân giải. Clip AI mất từ chục giây đến vài phút.';
    }

    function populateTtsProviders() {
        fillSelect($('tts-provider'), VFModels.TTS_PROVIDERS, 'id', (p) => `${p.label}${p.badge ? ` · ${p.badge}` : ''}`);
        onTtsProviderChange();
    }

    function onTtsProviderChange() {
        const p = VFModels.ttsProviderFor($('tts-provider').value);
        fillSelect($('tts-model'), p.models.map((m) => ({ id: m.id, label: `${m.label}${m.badge ? ` · ${m.badge}` : ''}` })));
        fillSelect($('tts-voice'), p.voices.map((v) => {
            const id = String(v).split(/\s|\(/)[0];
            return { id, label: v };
        }));
        $('tts-voice').value = p.voiceDefault;
        $('tts-engine-wrap').style.display = p.id === 'aws-polly' ? '' : 'none';
        $('tts-hint').textContent = `${p.label} — ${p.note}`;
    }

    function populateCombos() {
        const sel = $('combo-select');
        sel.innerHTML = '';
        Object.entries(VFModels.BEST_COMBOS).forEach(([k, c]) => {
            const o = document.createElement('option');
            o.value = k;
            o.textContent = c.label;
            sel.appendChild(o);
        });
        $('combo-hint').textContent = 'Combo điền nhanh model chat/ảnh/video/giọng theo mục đích.';
    }

    /* ===================================================================== */
    /* STEP 01 — Ý tưởng                                                     */
    /* ===================================================================== */
    function readBrief() {
        const b = APP.project.brief;
        b.topic = $('bf-topic').value.trim();
        b.niche = $('bf-niche').value.trim();
        b.audience = $('bf-audience').value.trim();
        b.duration = Number($('bf-duration').value);
        b.platform = $('bf-platform').value;
        b.style = $('bf-style').value;
        b.goal = $('bf-goal').value;
        b.chatModel = $('bf-chat-model').value;
        b.voiceLang = $('bf-lang').value;
        save();
        return b;
    }

    function ideaSystemPrompt() {
        return 'Bạn là strategist viral video cho kênh faceless (TikTok/Shorts/Reels). Trả về DUY NHẤT một JSON hợp lệ, không markdown, theo schema: {"ideas":[{"title":"","hook":"","angle":"","why_viral":""}]}. Viết tiếng Việt, hook dưới 12 từ, why_viral nêu tâm lý kích thích chia sẻ.';
    }

    async function generateIdeas() {
        const b = readBrief();
        if (!b.topic) { toast('Nhập chủ đề trước đã!', 'err'); return; }
        setBusy('btn-ideas', true);
        setStatus('ideas-status', `Đang brainstorm với ${b.chatModel}…`);
        try {
            const data = await VFAI.chatJson(
                [
                    { role: 'system', content: ideaSystemPrompt() },
                    { role: 'user', content: `Chủ đề: ${b.topic}\nNiche: ${b.niche || '(tự chọn tốt nhất)'}\nKhán giả: ${b.audience || 'giới trẻ VN'}\nNền tảng: ${b.platform}\nPhong cách: ${b.style}\nMục tiêu: ${b.goal}\nThời lượng: ${b.duration}s\n→ Đề xuất 5 ý tưởng.` },
                ],
                { model: b.chatModel, temperature: 0.9, onFallback: (m) => toast(m, 'err') }
            );
            APP.project.ideas = Array.isArray(data.ideas) ? data.ideas.slice(0, 5) : [];
            save();
            renderIdeas();
            setStatus('ideas-status', `✅ ${APP.project.ideas.length} ý tưởng`, 'ok');
        } catch (err) {
            setStatus('ideas-status', `❌ ${errText(err)}`, 'err');
            toast(errText(err), 'err');
        } finally {
            setBusy('btn-ideas', false);
        }
    }

    function renderIdeas() {
        const box = $('ideas-list');
        box.innerHTML = '';
        APP.project.ideas.forEach((idea, i) => {
            const card = el('div', 'mini-card');
            card.innerHTML = `
                <h4>${esc(idea.title || `Ý tưởng ${i + 1}`)}</h4>
                <div><b>Hook:</b> ${esc(idea.hook || '')}</div>
                <div class="muted"><b>Góc khai thác:</b> ${esc(idea.angle || '')}</div>
                <div class="muted"><b>Vì sao viral:</b> ${esc(idea.why_viral || '')}</div>`;
            const btn = el('button', 'btn ghost', 'Chọn ý tưởng này →');
            btn.addEventListener('click', () => {
                APP.project.refined = { ...(APP.project.refined || {}), idea };
                save();
                $('refined-out').innerHTML = `<b>Đã chọn:</b> ${esc(idea.title)}\nHook: ${esc(idea.hook || '')}\nGóc: ${esc(idea.angle || '')}`;
                $('refined-out').classList.remove('muted');
                toast('Đã chọn ý tưởng — bấm "Cải tiến" để làm sâu hơn.');
                document.getElementById('step-02').scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
            card.appendChild(btn);
            box.appendChild(card);
        });
    }

    /* ===================================================================== */
    /* STEP 02 — Cải tiến                                                    */
    /* ===================================================================== */
    async function refineIdea() {
        const idea = APP.project.refined && APP.project.refined.idea;
        if (!idea) { toast('Chưa chọn ý tưởng nào ở bước 01.', 'err'); return; }
        const b = APP.project.brief;
        setBusy('btn-refine', true);
        setStatus('refine-status', 'Đang đào sâu ý tưởng…');
        try {
            const text = await VFAI.chat(
                [
                    { role: 'system', content: 'Bạn là biên kịch video viral. Trả lời ngắn gọn, đắt giá, tiếng Việt, theo cấu trúc: Tiêu đề đắt → Moá câu chuyện (3 act) → Cảm xúc mục tiêu → 3 cái bẫy cần tránh.' },
                    { role: 'user', content: `Ý tưởng: ${idea.title}\nHook: ${idea.hook}\nGóc: ${idea.angle}\nPhong cách: ${b.style}\nThời lượng: ${b.duration}s` },
                ],
                { model: b.chatModel }
            );
            APP.project.refined.text = text;
            save();
            const out = $('refined-out');
            out.textContent = text;
            out.classList.remove('muted');
            setStatus('refine-status', '✅ Đã cải tiến', 'ok');
        } catch (err) {
            setStatus('refine-status', `❌ ${errText(err)}`, 'err');
            toast(errText(err), 'err');
        } finally {
            setBusy('btn-refine', false);
        }
    }

    /* ===================================================================== */
    /* STEP 03 — Blueprint                                                   */
    /* ===================================================================== */
    function sceneCountFor(duration) {
        return { 30: 4, 45: 5, 60: 7, 90: 9 }[Number(duration)] || 5;
    }

    function blueprintSystemPrompt(nScenes) {
        return `Bạn là đạo diễn + biên kịch video faceless tiếng Việt. Trả về DUY NHẤT JSON hợp lệ: {"title":"","hook":"","cta":"","scenes":[{"text":"","image_prompt":"","camera":""} x ${nScenes}],"hashtags":["#..."]}. "text" là LỜI THOẠI tiếng Việt được đọc bởi TTS (tự nhiên, có nhịp). "image_prompt" là prompt ẢNH TIẾNG ANH chi tiết cho ảnh dọc 9:16 (mô tả cảnh, ánh sáng, ống kính, phong cách điện ảnh — KHÔNG chữ trong ảnh). "camera" là chuyển động máy quay ngắn (VD: slow push-in). Tổng thời lượng đọc các scene xấp xỉ {DUR} giây.`;
    }

    async function generateBlueprint() {
        const b = readBrief();
        const idea = APP.project.refined && APP.project.refined.idea;
        if (!b.topic && !idea) { toast('Cần chủ đề hoặc ý tưởng đã chọn.', 'err'); return; }
        const n = sceneCountFor(b.duration);
        setBusy('btn-blueprint', true);
        setStatus('blueprint-status', `Đang viết blueprint ${n} scene…`);
        try {
            const sys = blueprintSystemPrompt(n).replace('{DUR}', b.duration);
            const data = await VFAI.chatJson(
                [
                    { role: 'system', content: sys },
                    { role: 'user', content: `Ý tưởng: ${idea ? `${idea.title} — ${idea.hook}` : b.topic}\nNiche: ${b.niche}\nKhán giả: ${b.audience}\nNền tảng: ${b.platform}\nPhong cách: ${b.style}\nMục tiêu: ${b.goal}\nTổng thời lượng: ${b.duration} giây, chia đều ${n} scene.` },
                ],
                { model: b.chatModel, temperature: 0.8, onFallback: (m) => toast(m, 'err') }
            );
            const scenes = (data.scenes || []).map((s, i) => ({
                id: `s${i + 1}`,
                text: s.text || '',
                imagePrompt: s.image_prompt || s.imagePrompt || '',
                camera: s.camera || 'slow push-in',
                seconds: Math.round(b.duration / Math.max(1, (data.scenes || []).length)),
                imageDataUrl: null, imageModel: null,
                clipUrl: null, clipModel: null,
                audioUrl: null,
            }));
            APP.project.blueprint = {
                title: data.title || idea?.title || b.topic,
                hook: data.hook || '',
                cta: data.cta || '',
                hashtags: data.hashtags || [],
                scenes,
            };
            save();
            renderScenes();
            setStatus('blueprint-status', `✅ Blueprint ${scenes.length} scene`, 'ok');
        } catch (err) {
            setStatus('blueprint-status', `❌ ${errText(err)}`, 'err');
            toast(errText(err), 'err');
        } finally {
            setBusy('btn-blueprint', false);
        }
    }

    function renderScenes() {
        const bp = APP.project.blueprint;
        const box = $('scenes-editor');
        box.innerHTML = '';
        if (!bp) {
            $('blueprint-meta').textContent = 'Chưa có blueprint. Bấm "Tạo Viral Blueprint".';
            return;
        }
        $('blueprint-meta').innerHTML = `<b>🎬 ${esc(bp.title)}</b> — hook: ${esc(bp.hook)} — CTA: ${esc(bp.cta)}\nHashtags: ${esc((bp.hashtags || []).join(' '))}`;
        bp.scenes.forEach((s, i) => {
            const row = el('div', 'scene-row');
            row.innerHTML = `<div class="scene-idx">${i + 1}</div>`;
            const lb = el('label', null, `Lời thoại (TTS đọc)<textarea data-f="text" data-i="${i}">${esc(s.text)}</textarea>`);
            const lp = el('label', null, `Prompt ảnh (EN)<textarea data-f="imagePrompt" data-i="${i}">${esc(s.imagePrompt)}</textarea>`);
            const lc = el('label', null, `Camera<input data-f="camera" data-i="${i}" value="${esc(s.camera)}" /><br/>Giây<input type="number" min="1" max="30" step="1" data-f="seconds" data-i="${i}" value="${s.seconds || 5}" />`);
            row.append(lb, lp, lc);
            box.appendChild(row);
        });
        box.querySelectorAll('textarea, input').forEach((inp) => {
            inp.addEventListener('change', () => {
                const { f, i } = inp.dataset;
                APP.project.blueprint.scenes[Number(i)][f] = f === 'seconds' ? Number(inp.value) : inp.value;
                save();
            });
        });
    }

    /* OCR — nhập kịch bản từ ảnh */
    async function ocrImport(file) {
        if (!file) return;
        setStatus('blueprint-status', 'Đang OCR ảnh…');
        try {
            const dataUrl = await new Promise((res, rej) => {
                const r = new FileReader();
                r.onload = () => res(r.result);
                r.onerror = rej;
                r.readAsDataURL(file);
            });
            const text = await VFAI.img2txt(dataUrl, { provider: $('ocr-provider').value });
            const meta = $('blueprint-meta');
            meta.textContent = text || '(Không đọc được chữ)';
            meta.classList.remove('muted');
            const first = String(text).split('\n').find((l) => l.trim()) || '';
            if (first && !$('bf-topic').value) {
                $('bf-topic').value = first.slice(0, 120);
                save();
            }
            setStatus('blueprint-status', '✅ OCR xong — văn bản hiện ở khung trên', 'ok');
            toast('OCR xong! Dùng nội dung làm chủ đề hoặc dán vào scene.');
        } catch (err) {
            setStatus('blueprint-status', `❌ ${errText(err)}`, 'err');
        }
    }

    /* ===================================================================== */
    /* STEP 04 — Ảnh từng scene                                              */
    /* ===================================================================== */
    function ratioObj() {
        const v = $('img-ratio').value; // '9:16'
        const [w, h] = v.split(':').map(Number);
        return { w, h };
    }

    function fixedSizeFor(mode, ratio) {
        if (mode !== 'fixed') return null;
        if (ratio.w > ratio.h) return { w: 1536, h: 1024 };
        if (ratio.w < ratio.h) return { w: 1024, h: 1536 };
        return { w: 1024, h: 1024 };
    }

    async function generateImages() {
        const bp = APP.project.blueprint;
        if (!bp || !bp.scenes.length) { toast('Chưa có blueprint — hãy tạo ở bước 03.', 'err'); return; }
        const meta = VFModels.imageOptionsFor($('img-model').value);
        const ratio = ratioObj();
        const fixed = fixedSizeFor(meta.ratioMode, ratio);
        const useRatio = fixed || ratio;
        const quality = $('img-quality').value;
        const testMode = APP.settings.testMode;
        const savePuter = $('img-save-puter').checked && APP.user;

        setBusy('btn-images', true);
        const total = bp.scenes.length;
        let okCount = 0;
        let failCount = 0;
        for (let i = 0; i < total; i++) {
            setStatus('images-status', `Đang sinh ảnh scene ${i + 1}/${total} bằng ${meta.label}…`);
            setProgress('images-progress', i / total);
            try {
                const prompt = `${bp.scenes[i].imagePrompt}. Vertical composition, cinematic lighting, ultra detailed, no text, no watermark.`;
                const res = await VFAI.txt2img(prompt, {
                    model: meta.id,
                    provider: meta.provider,
                    quality,
                    qualityKey: meta.qualityKey,
                    ratio: useRatio,
                    testMode,
                    onFallback: (m) => toast(m, 'err'),
                });
                bp.scenes[i].imageDataUrl = res.url;
                bp.scenes[i].imageModel = meta.label;
                okCount++;
                if (savePuter) {
                    await VFAI.fsWriteBlob(`viralforge/images/scene-${i + 1}.png`, res.url);
                }
            } catch (err) {
                failCount++;
                setStatus('images-status', `❌ Scene ${i + 1}: ${errText(err)}`, 'err');
                toast(`Scene ${i + 1}: ${errText(err)}`, 'err');
            }
            save();
            renderThumbs('images-grid', i);
        }
        setProgress('images-progress', 1);
        setStatus('images-status',
            okCount === total
                ? `✅ Xong ${okCount}/${total} ảnh${savePuter ? ' (đã lưu Puter Drive ~/viralforge/images)' : ''}${testNote()}`
                : `⚠️ Xong ${okCount}/${total} ảnh — ❌ ${failCount} lỗi (toast đã ghi lý do; ảnh lỗi giữ nguyên kết quả cũ)`,
            failCount ? '' : 'ok');
        setBusy('btn-images', false);
    }

    function renderThumbs(gridId, onlyIndex = null) {
        const bp = APP.project.blueprint;
        const grid = $(gridId);
        if (!bp) { grid.innerHTML = ''; return; }
        const kind = gridId === 'images-grid' ? 'image' : 'clip';
        const sampleBadge = APP.settings.testMode ? ' <span class="badge soft">🧪 MẪU</span>' : '';
        const build = (i) => {
            const s = bp.scenes[i];
            let node;
            if (kind === 'image') {
                node = s.imageDataUrl
                    ? el('div', 'thumb', `<img src="${s.imageDataUrl}" alt="scene ${i + 1}"><div class="cap"><span>#${i + 1} · ${esc(s.imageModel || '')}</span>${sampleBadge}</div>`)
                    : el('div', 'thumb skeleton', `Scene ${i + 1}<br>chưa có ảnh`);
            } else {
                node = s.clipUrl
                    ? el('div', 'thumb', `<video src="${s.clipUrl}" controls muted playsinline></video><div class="cap"><span>#${i + 1} · ${esc(s.clipModel || '')}</span>${sampleBadge}</div>`)
                    : el('div', 'thumb skeleton', `Scene ${i + 1}<br>chưa có clip AI`);
            }
            return node;
        };
        if (onlyIndex != null) {
            const old = grid.querySelector(`[data-i="${onlyIndex}"]`);
            const fresh = build(onlyIndex);
            fresh.dataset.i = onlyIndex;
            if (old) grid.replaceChild(fresh, old);
            else { fresh.dataset.i = onlyIndex; grid.appendChild(fresh); }
        } else {
            grid.innerHTML = '';
            bp.scenes.forEach((_, i) => {
                const n = build(i);
                n.dataset.i = i;
                grid.appendChild(n);
            });
        }
    }

    /* ===================================================================== */
    /* STEP 05 — Giọng đọc                                                   */
    /* ===================================================================== */
    async function generateVoice() {
        const bp = APP.project.blueprint;
        if (!bp || !bp.scenes.length) { toast('Chưa có blueprint — hãy tạo ở bước 03.', 'err'); return; }
        const provider = $('tts-provider').value;
        const p = VFModels.ttsProviderFor(provider);
        const opts = {
            provider,
            model: $('tts-model').value,
            voice: $('tts-voice-custom').value.trim() || $('tts-voice').value,
            language: $('tts-lang').value,
            engine: provider === 'aws-polly' ? $('tts-engine').value : undefined,
            instructions: $('tts-instructions').value.trim() || undefined,
            testMode: APP.settings.testMode,
        };
        APP.project.voice = { ...opts, voiceCustom: $('tts-voice-custom').value.trim() };

        setBusy('btn-voice', true);
        const total = bp.scenes.length;
        let okCount = 0;
        let failCount = 0;
        for (let i = 0; i < total; i++) {
            setStatus('voice-status', `Đang đọc scene ${i + 1}/${total} bằng ${p.label}…`);
            setProgress('voice-progress', i / total);
            try {
                const res = await VFAI.txt2speech(bp.scenes[i].text, {
                    ...opts,
                    onFallback: (m) => toast(m, 'err'),
                });
                bp.scenes[i].audioUrl = res.url;
                bp.scenes[i].audioBlob = res.blob || null;
                okCount++;
            } catch (err) {
                failCount++;
                setStatus('voice-status', `❌ Scene ${i + 1}: ${errText(err)}`, 'err');
                toast(`Scene ${i + 1}: ${errText(err)}`, 'err');
            }
            save();
            renderVoiceList();
        }
        setProgress('voice-progress', 1);
        setStatus('voice-status',
            okCount === total
                ? `✅ Đã đọc xong ${okCount}/${total} scene — sẵn sàng dựng video${testNote()}`
                : `⚠️ Xong ${okCount}/${total} scene — ❌ ${failCount} lỗi (scene lỗi không có audio, dựng video vẫn chạy được)`,
            failCount ? '' : 'ok');
        setBusy('btn-voice', false);
    }

    function renderVoiceList() {
        const bp = APP.project.blueprint;
        const box = $('voice-list');
        box.innerHTML = '';
        if (!bp) return;
        bp.scenes.forEach((s, i) => {
            const row = el('div', 'voice-row');
            row.innerHTML = `<b>#${i + 1}</b><span class="vn">${esc(s.text)}</span>`;
            if (s.audioUrl) {
                const audio = document.createElement('audio');
                audio.controls = true;
                audio.src = s.audioUrl;
                row.appendChild(audio);
            } else {
                row.appendChild(el('span', 'muted', 'chưa có audio'));
            }
            box.appendChild(row);
        });
    }

    /* --- Voice changer (speech2speech) --- */
    async function voiceChanger(file) {
        if (!file) { toast('Chọn file ghi âm trước.', 'err'); return; }
        setBusy('btn-vc', true);
        try {
            const res = await VFAI.speech2speech(file, {
                voice: $('vc-voice').value,
                testMode: APP.settings.testMode,
            });
            const a = $('vc-audio');
            a.src = res.url;
            a.classList.remove('hidden');
            a.play().catch(() => {});
            toast('Đã đổi giọng xong!', 'ok');
        } catch (err) {
            toast(errText(err), 'err');
        } finally {
            setBusy('btn-vc', false);
        }
    }

    /* --- Phiên âm (speech2txt) --- */
    async function transcribe(file) {
        if (!file) { toast('Chọn file audio trước.', 'err'); return; }
        setBusy('btn-stt', true);
        setStatus('stt-out', 'Đang phiên âm…');
        try {
            const model = $('stt-model').value;
            const res = await VFAI.speech2txt(file, {
                model,
                responseFormat: model === 'whisper-1' ? 'verbose_json' : undefined,
                chunkingStrategy: model.includes('diarize') ? 'auto' : undefined,
                testMode: APP.settings.testMode,
            });
            const text = typeof res === 'string' ? res : res.text || JSON.stringify(res, null, 2);
            $('stt-out').textContent = text;
            setStatus('stt-out', '');
        } catch (err) {
            setStatus('stt-out', `❌ ${errText(err)}`);
            toast(errText(err), 'err');
        } finally {
            setBusy('btn-stt', false);
        }
    }

    /* ===================================================================== */
    /* STEP 06 — Video                                                       */
    /* ===================================================================== */
    function videoOptions() {
        const meta = VFModels.videoOptionsFor($('vid-model').value);
        return {
            meta,
            model: $('vid-model').value,
            seconds: Number($('vid-seconds').value),
            size: $('vid-size').value,
            generateAudio: $('vid-audio').checked,
            testMode: APP.settings.testMode,
        };
    }

    async function generateClips() {
        const bp = APP.project.blueprint;
        if (!bp || !bp.scenes.length) { toast('Chưa có blueprint — hãy tạo ở bước 03.', 'err'); return; }
        const o = videoOptions();
        setBusy('btn-clips', true);
        const total = bp.scenes.length;
        let okCount = 0;
        let failCount = 0;
        for (let i = 0; i < total; i++) {
            const s = bp.scenes[i];
            setStatus('clips-status', `Scene ${i + 1}/${total}: model ${o.meta.label} — có thể mất vài phút…`);
            setProgress('clips-progress', i / total);
            try {
                const prompt = `${s.imagePrompt}. Camera: ${s.camera}. Cinematic, smooth motion, no captions.`;
                const res = await VFAI.txt2vid(prompt, {
                    model: o.model,
                    seconds: o.seconds,
                    size: o.size,
                    inputReference: s.imageDataUrl || undefined,
                    generateAudio: o.meta.audio === 'optional' ? o.generateAudio : undefined,
                    testMode: o.testMode,
                    onTick: (msg) => setStatus('clips-status', `Scene ${i + 1}/${total} · ${msg}`),
                    onFallback: (m) => toast(m, 'err'),
                });
                s.clipUrl = res.url;
                s.clipModel = o.meta.label;
                okCount++;
            } catch (err) {
                failCount++;
                setStatus('clips-status', `❌ Scene ${i + 1}: ${errText(err)}`, 'err');
                toast(`Scene ${i + 1}: ${errText(err)}`, 'err');
                if ((err.code || err.errorCode) === 'insufficient_funds') break;
            }
            save();
            renderThumbs('clips-grid', i);
        }
        setProgress('clips-progress', 1);
        setStatus('clips-status',
            okCount === total
                ? `✅ Xong clip — bấm "Dựng video hoàn chỉnh" ở bước B${testNote()}`
                : `⚠️ Xong ${okCount}/${total} clip — ❌ ${failCount} lỗi (scene không có clip sẽ dựng bằng hiệu ứng Ken Burns từ ảnh)`,
            failCount ? '' : 'ok');
        setBusy('btn-clips', false);
    }

    async function renderFinal() {
        const bp = APP.project.blueprint;
        if (!bp || !bp.scenes.length) { toast('Chưa có blueprint để dựng video.', 'err'); return; }
        const usable = bp.scenes.filter((s) => s.text || s.imageDataUrl || s.clipUrl);
        if (!usable.length) { toast('Chưa có scene nào có nội dung.', 'err'); return; }

        setBusy('btn-render', true);
        setStatus('render-status', 'Đang khởi động compositor… (giữ tab này mở — render theo thời gian thực)');
        try {
            const result = await VFRender.compose(usable, {
                width: 720,
                height: 1280,
                fps: 30,
                accent: '#ff2d6f',
                onProgress: (p, label) => {
                    setProgress('render-progress', p);
                    setStatus('render-status', `${label} — giữ tab mở tới khi xong!`);
                },
                onScene: (i, total) => setStatus('render-status', `Đang dựng scene ${i + 1}/${total}…`),
            });
            APP.project.render = {
                url: result.url, mime: result.mime,
                size: result.blob.size, duration: result.duration,
                createdAt: new Date().toISOString(),
            };
            save();
            renderFinalOut();
            setStatus('render-status', `✅ Hoàn tất — ${Math.round(result.duration)}s · ${(result.blob.size / 1048576).toFixed(1)} MB`, 'ok');
            toast('Dựng video xong! Bấm tải xuống hoặc lưu lên Puter Drive.', 'ok');
        } catch (err) {
            setStatus('render-status', `❌ ${errText(err)}`, 'err');
            toast(errText(err), 'err');
        } finally {
            setBusy('btn-render', false);
        }
    }

    function renderFinalOut() {
        const r = APP.project.render;
        const box = $('render-out');
        box.innerHTML = '';
        if (!r) {
            box.innerHTML = '<div class="out muted">Chưa dựng video. Chạy bước A (tuỳ chọn) rồi bấm "Dựng video hoàn chỉnh".</div>';
            return;
        }
        const row = el('div', 'row');
        const video = document.createElement('video');
        video.src = r.url;
        video.controls = true;
        video.playsInline = true;
        row.appendChild(video);

        const col = el('div');
        col.appendChild(el('div', null, `<b>${esc(bpTitle())}</b><br><span class="muted">${Math.round(r.duration)}s · ${(r.size / 1048576).toFixed(1)} MB · ${esc(r.mime)}</span>`));
        const dl = el('a', 'btn primary', '⬇️ Tải video');
        dl.href = r.url;
        dl.download = `viralforge-${Date.now()}.${r.mime.includes('mp4') ? 'mp4' : 'webm'}`;
        const saveBtn = el('button', 'btn ghost', '☁️ Lưu lên Puter Drive');
        saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            const resp = await fetch(r.url);
            const blob = await resp.blob();
            const path = await VFAI.fsWriteBlob(`viralforge/videos/video-${Date.now()}.${r.mime.includes('mp4') ? 'mp4' : 'webm'}`, blob);
            toast(path ? `Đã lưu: ${path}` : 'Lưu lên Puter Drive thất bại (cần đăng nhập).', path ? 'ok' : 'err');
            saveBtn.disabled = false;
        });
        col.appendChild(el('div', null, ''));
        col.lastChild.append(dl, saveBtn);
        row.appendChild(col);
        box.appendChild(row);
    }

    function bpTitle() {
        return (APP.project.blueprint && APP.project.blueprint.title) || 'Video của bạn';
    }

    /* ===================================================================== */
    /* STEP 07 — Viral kit                                                   */
    /* ===================================================================== */
    async function generateViral() {
        const bp = APP.project.blueprint;
        if (!bp) { toast('Cần blueprint (bước 03) trước.', 'err'); return; }
        const b = APP.project.brief;
        setBusy('btn-viral', true);
        setStatus('viral-status', 'Đang soạn gói phân phối…');
        try {
            const data = await VFAI.chatJson(
                [
                    { role: 'system', content: 'Bạn là social media strategist. Trả về DUY NHẤT JSON: {"platforms":{"tiktok":{"caption":"","hashtags":[],"best_time":"","tip":""},"youtube_shorts":{...},"facebook_reels":{...},"instagram_reels":{...},"x":{...}}}. Caption tiếng Việt tự nhiên (x có thể EN), hashtags 5-8 cái, best_time là giờ đăng (GMT+7), tip ngắn.' },
                    { role: 'user', content: `Video: ${bp.title}\nHook: ${bp.hook}\nNội dung scene đầu: ${bp.scenes[0]?.text || ''}\nNền tảng mục tiêu: ${b.platform}\nKhán giả: ${b.audience}\nMục tiêu: ${b.goal}` },
                ],
                { model: APP.project.brief.chatModel, onFallback: (m) => toast(m, 'err') }
            );
            APP.project.viralKit = data.platforms || {};
            save();
            renderViral();
            setStatus('viral-status', '✅ Đã tạo gói phân phối', 'ok');
        } catch (err) {
            setStatus('viral-status', `❌ ${errText(err)}`, 'err');
            toast(errText(err), 'err');
        } finally {
            setBusy('btn-viral', false);
        }
    }

    function renderViral() {
        const kit = APP.project.viralKit;
        const box = $('viral-out');
        box.innerHTML = '';
        if (!kit) return;
        const names = {
            tiktok: 'TikTok', youtube_shorts: 'YouTube Shorts', facebook_reels: 'Facebook Reels',
            instagram_reels: 'Instagram Reels', x: 'X (Twitter)',
        };
        Object.entries(kit).forEach(([key, v]) => {
            const hashtags = Array.isArray(v.hashtags) ? v.hashtags.join(' ') : '';
            const caption = `${v.caption || ''}\n\n${hashtags}`;
            const card = el('div', 'mini-card');
            card.innerHTML = `
                <h4>${esc(names[key] || key)}</h4>
                <div>${esc(v.caption || '')}</div>
                <div class="muted">${esc(hashtags)}</div>
                <div class="muted">⏰ ${esc(v.best_time || '')} — 💡 ${esc(v.tip || '')}</div>`;
            const btn = el('button', 'btn ghost', '📋 Copy caption');
            btn.addEventListener('click', () => copyText(caption, btn));
            card.appendChild(btn);
            box.appendChild(card);
        });
    }

    /* ===================================================================== */
    /* MODEL HUB                                                             */
    /* ===================================================================== */
    function renderCatalog() {
        const box = $('models-catalog');
        box.innerHTML = '';

        const section = (title, api, items, fmt) => {
            const card = el('div', 'cat-card');
            card.innerHTML = `<h3>${title}</h3><div class="vendor">${api}</div><ul>${items.map(fmt).join('')}</ul>`;
            box.appendChild(card);
        };

        section('🧠 Chat — puter.ai.chat()', 'Sinh ý tưởng, kịch bản, caption',
            VFModels.CHAT_MODELS,
            (m) => `<li><b>${esc(m.label)}</b>${badgeOf(m.badge)} <span class="muted">— ${esc(m.note)}</span></li>`);

        section('🖼️ Ảnh — puter.ai.txt2img()', 'provider: openai-image-generation · gemini · xai · replicate-image-generation',
            VFModels.IMAGE_MODELS,
            (m) => `<li><b>${esc(m.label)}</b>${badgeOf(m.badge)} <span class="muted">— ${esc(m.note)}</span></li>`);

        section('🎬 Video — puter.ai.txt2vid()', 'provider: gemini-video-generation · byteplus-video-generation · together-video-generation',
            VFModels.VIDEO_MODELS,
            (m) => `<li><b>${esc(m.label)}</b>${badgeOf(m.badge)} <span class="muted">— ${esc(m.note)}</span></li>`);

        section('🎙️ Giọng đọc — puter.ai.txt2speech()', 'provider: elevenlabs · gemini · openai · xai · speechify · aws-polly',
            VFModels.TTS_PROVIDERS,
            (p) => `<li><b>${esc(p.label)}</b>${badgeOf(p.badge)} <span class="muted">— ${esc(p.note)}</span></li>`);

        section('🔁 Voice changer — puter.ai.speech2speech()', 'ElevenLabs STS',
            VFModels.STS_MODELS, (m) => `<li><b>${esc(m.label)}</b> <span class="muted">— ${esc(m.note)}</span></li>`);

        section('📝 Phiên âm — puter.ai.speech2txt()', 'provider: openai · xai',
            VFModels.STT_MODELS,
            (m) => `<li><b>${esc(m.label)}</b>${badgeOf(m.badge)} <span class="muted">— ${esc(m.note)}</span></li>`);

        section('🔍 OCR — puter.ai.img2txt()', 'provider: aws-textract · mistral',
            VFModels.OCR_PROVIDERS, (m) => `<li><b>${esc(m.label)}</b> <span class="muted">— ${esc(m.note)}</span></li>`);
    }

    async function loadAllModels() {
        setBusy('btn-load-all-models', true);
        setStatus('all-models-status', 'Đang tải từ Puter…');
        try {
            const models = await VFAI.listChatModels();
            const tbody = $('all-models-table').querySelector('tbody');
            tbody.innerHTML = '';
            const filter = $('all-models-filter').value.trim().toLowerCase();
            let shown = 0;
            models.forEach((m) => {
                if (filter && !`${m.id} ${m.provider || ''}`.toLowerCase().includes(filter)) return;
                shown++;
                const cost = m.cost || {};
                const perM = cost.tokens ? Math.round((cost.tokens || 0) / 1000) / 1000 : 1; // ~1M
                const usd = (cents) => (typeof cents === 'number' ? `$${(cents / 100).toFixed(2)}` : '—');
                const tr = document.createElement('tr');
                tr.innerHTML = `<td><b>${esc(m.id)}</b></td><td>${esc(m.provider || '')}</td><td>${m.context ? Number(m.context).toLocaleString('vi-VN') : '—'}</td>
                    <td>${usd(cost.input)} / ${usd(cost.output)}</td>`;
                tbody.appendChild(tr);
            });
            setStatus('all-models-status', `✅ ${shown}/${models.length} model`, 'ok');
        } catch (err) {
            setStatus('all-models-status', `❌ ${errText(err)}`, 'err');
            toast(`${errText(err)} — cần đăng nhập Puter để lấy danh sách.`, 'err');
        } finally {
            setBusy('btn-load-all-models', false);
        }
    }

    /* ===================================================================== */
    /* LIBRARY                                                               */
    /* ===================================================================== */
    function renderLibrary() {
        const box = $('library-list');
        const lib = VFStore.loadLibrary();
        box.innerHTML = '';
        if (!lib.length) {
            box.innerHTML = '<div class="out muted">Thư viện trống. Tạo blueprint rồi bấm "Lưu dự án hiện tại vào thư viện".</div>';
            return;
        }
        lib.forEach((item) => {
            const card = el('div', 'mini-card');
            card.innerHTML = `
                <h4>${esc(item.title || 'Không tên')}</h4>
                <div class="muted">${esc(new Date(item.createdAt).toLocaleString('vi-VN'))} · ${(item.scenes || 0)} scene</div>
                <div>${esc((item.hook || '').slice(0, 120))}</div>`;
            const row = el('div', 'row');
            const load = el('button', 'btn ghost', '📂 Mở');
            load.addEventListener('click', () => {
                APP.project.blueprint = item.blueprint;
                APP.project.brief = { ...APP.project.brief, ...(item.brief || {}) };
                APP.project.scenes = item.blueprint.scenes;
                save();
                fillFormFromProject();
                renderScenes(); renderThumbs('images-grid'); renderThumbs('clips-grid'); renderVoiceList();
                toast('Đã mở blueprint từ thư viện.', 'ok');
                document.querySelector('[data-view="pipeline"]').click();
            });
            const del = el('button', 'btn danger', '🗑️');
            del.addEventListener('click', () => { VFStore.removeFromLibrary(item.id); renderLibrary(); });
            row.append(load, del);
            card.appendChild(row);
            box.appendChild(card);
        });
    }

    function saveToLibrary() {
        const bp = APP.project.blueprint;
        if (!bp) { toast('Chưa có blueprint để lưu.', 'err'); return; }
        VFStore.addToLibrary({
            id: `bp_${Date.now()}`,
            title: bp.title,
            hook: bp.hook,
            createdAt: new Date().toISOString(),
            scenes: bp.scenes.length,
            blueprint: JSON.parse(JSON.stringify(bp, (k, v) => (typeof v === 'string' && (v.startsWith('blob:') || (v.startsWith('data:') && v.length > 200000)) ? null : v))),
            brief: APP.project.brief,
        });
        setStatus('lib-status', '✅ Đã lưu vào thư viện', 'ok');
        renderLibrary();
    }

    /* ===================================================================== */
    /* REVENUE                                                               */
    /* ===================================================================== */
    let revenueRows = [];

    function renderRevenue() {
        const tbody = $('rv-table').querySelector('tbody');
        tbody.innerHTML = '';
        revenueRows.slice().reverse().forEach((r) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${esc(r.date)}</td><td>${esc(r.platform)}</td><td>${esc(r.source)}</td>
                <td>${Number(r.views).toLocaleString('vi-VN')}</td><td>${Number(r.likes).toLocaleString('vi-VN')}</td>
                <td>${Number(r.followers).toLocaleString('vi-VN')}</td><td>$${Number(r.usd).toFixed(2)}</td>
                <td><button class="del" title="Xoá">✕</button></td>`;
            tr.querySelector('.del').addEventListener('click', () => {
                revenueRows = revenueRows.filter((x) => x.id !== r.id);
                VFStore.saveRevenue(revenueRows);
                renderRevenue();
            });
            tbody.appendChild(tr);
        });
        const t = revenueRows.reduce((a, r) => ({
            views: a.views + Number(r.views || 0),
            likes: a.likes + Number(r.likes || 0),
            followers: a.followers + Number(r.followers || 0),
            usd: a.usd + Number(r.usd || 0),
        }), { views: 0, likes: 0, followers: 0, usd: 0 });
        $('rv-totals').innerHTML = `
            <div class="tot">Tổng views<b>${t.views.toLocaleString('vi-VN')}</b></div>
            <div class="tot">Tổng likes<b>${t.likes.toLocaleString('vi-VN')}</b></div>
            <div class="tot">Tổng follow<b>${t.followers.toLocaleString('vi-VN')}</b></div>
            <div class="tot">Tổng doanh thu<b>$${t.usd.toFixed(2)}</b></div>`;
    }

    function saveRevenueRow() {
        revenueRows.push({
            id: `rv_${Date.now()}`,
            date: new Date().toLocaleDateString('vi-VN'),
            platform: $('rv-platform').value,
            source: $('rv-source').value,
            views: Number($('rv-views').value) || 0,
            likes: Number($('rv-likes').value) || 0,
            followers: Number($('rv-followers').value) || 0,
            usd: Number($('rv-usd').value) || 0,
        });
        VFStore.saveRevenue(revenueRows);
        renderRevenue();
        setStatus('rv-status', '✅ Đã lưu', 'ok');
    }

    /* ===================================================================== */
    /* SETTINGS + AUTH                                                       */
    /* ===================================================================== */
    async function refreshAuth() {
        const signed = typeof puter !== 'undefined' ? await VFAI.isSignedIn() : false;
        APP.user = signed ? await VFAI.getUser() : null;
        const chip = $('auth-chip');
        if (APP.user) {
            chip.textContent = `✅ ${APP.user.username || APP.user.email || 'Puter user'}`;
            chip.classList.add('signed');
        } else {
            chip.textContent = '⭕ Khách — bấm để kết nối';
            chip.classList.remove('signed');
        }
        renderSettingsAuth();
    }

    function renderSettingsAuth() {
        const n = $('settings-auth');
        if (!n) return;
        n.classList.remove('muted');
        n.innerHTML = APP.user
            ? `Đăng nhập với: <b>${esc(APP.user.username || '')}</b> ${esc(APP.user.email || '')}`
            : 'Chưa đăng nhập. Bấm "Kết nối Puter" — cửa sổ đăng nhập Puter sẽ mở (miễn phí).';
    }

    async function signInClick() {
        try {
            await VFAI.signIn();
            await refreshAuth();
            toast('Đã kết nối Puter! Giờ có thể tắt Chế độ thử nghiệm để tạo nội dung thật.', 'ok');
        } catch (err) {
            toast(`Đăng nhập bị huỷ hoặc lỗi: ${errText(err)}`, 'err');
        }
    }

    /* ===================================================================== */
    /* TÀI KHOẢN PRO (BYOK) — key Gemini/OpenAI, router engine từng tác vụ   */
    /* ===================================================================== */
    const ENGINE_LABELS = {
        chat: { auto: '🧵 Puter', gemini: '💎 Gemini trực tiếp', openai: '💎 ChatGPT trực tiếp', tokenforge: '🔷 TokenForge (GLM…)' },
        image: { auto: '🖼️ Puter', gemini: '💎 Nano Banana trực tiếp', openai: '💎 GPT Image trực tiếp' },
        video: { auto: '🎬 Puter', gemini: '💎 Veo trực tiếp', openai: '💎 Sora trực tiếp' },
        voice: { auto: '🎙️ Puter', gemini: '💎 Gemini TTS trực tiếp', openai: '💎 OpenAI TTS trực tiếp', voicestudio: '🎙️ VoiceStudio (máy bạn)' },    };

    function refreshProState() {
        if (typeof VFPro === 'undefined') return;
        const status = VFPro.proStatus();
        const chip = $('pro-chip');
        const hasAny = status.gemini || status.openai;
        chip.classList.toggle('hidden', !hasAny);
        if (hasAny) {
            const parts = [];
            if (status.gemini) parts.push('Gemini');
            if (status.openai) parts.push('OpenAI');
            chip.textContent = `💎 Pro: ${parts.join(' + ')}`;
        }
        /* tag bộ máy ở từng bước — testMode bật thì luôn Puter (media mẫu);
           'auto' giờ TỰ ưu tiên key của user (TokenForge → Gemini → OpenAI) */
        ['chat', 'image', 'video', 'voice'].forEach((kind) => {
            const tag = $(`engine-${kind}`);
            if (!tag) return;
            let engine = VFPro.engineFor(kind);
            if (engine === 'auto') engine = VFPro.resolveAuto(kind);
            const usingDirect = !APP.settings.testMode && engine !== 'puter' && VFPro.isDirect(kind, engine) === true;
            tag.textContent = ENGINE_LABELS[kind][usingDirect ? engine : 'auto']
                + (APP.settings.testMode ? ' · 🧪 mẫu' : '');
            tag.classList.toggle('pro', usingDirect);
        });
        /* thiếu key khi chọn engine trực tiếp → nhắc ngay trong thẻ Pro */
        ['chat', 'image', 'video', 'voice'].forEach((kind) => {
            const engine = VFPro.engineFor(kind);
            const direct = VFPro.isDirect(kind);
            if (engine !== 'auto' && direct === 'missing-key') {
                setStatus('pro-test-status', `⚠️ Đã chọn engine trực tiếp cho "${ENGINE_LABELS[kind].auto}" nhưng chưa nhập key / chưa bật engine tương ứng (VoiceStudio bật trong bước 05).`, 'err');
            }
        });
    }

    function initProUI() {
        if (typeof VFPro === 'undefined') return;
        const c = VFPro.getConfig();
        $('pro-gemini-key').value = c.geminiKey;
        $('pro-openai-key').value = c.openaiKey;
        $('pro-engine-chat').value = c.engines.chat;
        $('pro-engine-image').value = c.engines.image;
        $('pro-engine-video').value = c.engines.video;
        $('pro-engine-voice').value = c.engines.voice;

        /* datalist gợi ý model theo engine đang chọn ở ô bên trái */
        const KIND_INPUTS = {
            chat: ['pro-engine-chat', 'pro-model-chat'],
            image: ['pro-engine-image', 'pro-model-image'],
            video: ['pro-engine-video', 'pro-model-video'],
            voice: ['pro-engine-voice', 'pro-model-voice'],
        };
        const MODEL_KEYS = {
            chat: { gemini: 'geminiChat', openai: 'openaiChat', tokenforge: 'tfChat' },
            image: { gemini: 'geminiImage', openai: 'openaiImage' },
            video: { gemini: 'geminiVideo', openai: 'openaiVideo' },
            voice: { gemini: 'geminiVoice', openai: 'openaiVoice' },
        };
        const fillDl = () => {
            Object.entries(KIND_INPUTS).forEach(([kind, [selId, inputId]]) => {
                const dlId = inputId.replace('pro-model-', 'dl-').replace('chat', 'chat');
                const engine = $(selId).value;
                const keys = MODEL_KEYS[kind];
                const list = keys[engine]
                    ? VFPro.DIRECT_MODELS[keys[engine]]
                    : Object.values(keys).flatMap((k) => VFPro.DIRECT_MODELS[k] || []);
                $(dlId === 'dl-tf' ? 'dl-tf' : dlId).innerHTML = list.map((m) => `<option value="${esc(m)}"></option>`).join('');
            });
        };
        fillDl();
        /* dl của ô model chat dùng chung cho tokenforge */
        const syncTfDl = () => {
            const engine = $('pro-engine-chat').value;
            const list = engine === 'tokenforge'
                ? VFPro.DIRECT_MODELS.tfChat
                : [...VFPro.DIRECT_MODELS.geminiChat, ...VFPro.DIRECT_MODELS.openaiChat, ...VFPro.DIRECT_MODELS.tfChat];
            $('dl-chat').innerHTML = list.map((m) => `<option value="${esc(m)}"></option>`).join('');
        };
        syncTfDl();
        const setModelInput = () => {
            Object.entries(KIND_INPUTS).forEach(([kind, [selId, inputId]]) => {
                const engine = $(selId).value;
                const key = MODEL_KEYS[kind][engine] || null;
                $(inputId).value = key ? (c.models[key] || '') : '';
                $(inputId).disabled = !key;
                $(inputId).placeholder = key ? '' : 'chọn engine để đặt model';
            });
        };
        setModelInput();
        ['pro-engine-chat', 'pro-engine-image', 'pro-engine-video', 'pro-engine-voice'].forEach((id) => {
            $(id).addEventListener('change', () => {
                const kind = id.replace('pro-engine-', '');
                VFPro.updateConfig({ engines: { [kind]: $(id).value } });
                fillDl(); syncTfDl(); setModelInput(); refreshProState();
            });
        });
        const readModels = () => {
            const patch = {};
            Object.entries(KIND_INPUTS).forEach(([kind, [selId, inputId]]) => {
                const engine = $(selId).value;
                const key = MODEL_KEYS[kind][engine];
                if (engine === 'auto' || !key || !$(inputId).value.trim()) return;
                patch[key] = $(inputId).value.trim();
            });
            if (Object.keys(patch).length) VFPro.updateConfig({ models: patch });
        };
        ['pro-model-chat', 'pro-model-image', 'pro-model-video', 'pro-model-voice'].forEach((id) => {
            $(id).addEventListener('change', () => { readModels(); refreshProState(); });
        });
        /* TokenForge */
        $('pro-tf-key').value = c.tfKey || '';
        $('pro-tf-url').value = c.tfBaseUrl || 'https://tokenforge.ai.studio/v1';
        $('pro-tf-key').addEventListener('change', () => {
            VFPro.updateConfig({ tfKey: $('pro-tf-key').value });
            refreshProState();
        });
        $('pro-tf-url').addEventListener('change', () => {
            VFPro.updateConfig({ tfBaseUrl: $('pro-tf-url').value });
        });
        $('btn-tf-models').addEventListener('click', async () => {
            setBusy('btn-tf-models', true);
            setStatus('pro-test-status', 'Đang tải model TokenForge…');
            try {
                const models = await VFPro.listTokenforgeModels();
                $('dl-tf').innerHTML = models.map((m) => `<option value="${esc(m)}"></option>`).join('');
                $('dl-chat').innerHTML = models.map((m) => `<option value="${esc(m)}"></option>`).join('');
                setStatus('pro-test-status', `✅ TokenForge: ${models.length} model — ${models.slice(0, 6).join(', ')}${models.length > 6 ? '…' : ''}`, 'ok');
            } catch (err) {
                setStatus('pro-test-status', `❌ ${errText(err)}`, 'err');
            } finally {
                setBusy('btn-tf-models', false);
            }
        });
        $('btn-test-tf').addEventListener('click', async () => {
            readModels();
            VFPro.updateConfig({ tfKey: $('pro-tf-key').value, tfBaseUrl: $('pro-tf-url').value });
            setBusy('btn-test-tf', true);
            setStatus('pro-test-status', 'Đang kiểm tra TokenForge…');
            const r = await VFPro.tokenforgeTest();
            setStatus('pro-test-status', r.ok ? `✅ TokenForge OK — ${r.info}` : `❌ ${r.info}`, r.ok ? 'ok' : 'err');
            setBusy('btn-test-tf', false);
        });
        $('pro-gemini-key').addEventListener('change', () => {
            VFPro.updateConfig({ geminiKey: $('pro-gemini-key').value });
            refreshProState();
        });
        $('pro-openai-key').addEventListener('change', () => {
            VFPro.updateConfig({ openaiKey: $('pro-openai-key').value });
            refreshProState();
        });
        $('pro-chip').addEventListener('click', () => document.querySelector('[data-view="settings"]').click());
        $('pro-autofallback').checked = c.autoFallback !== false;
        $('pro-autofallback').addEventListener('change', (e) => {
            VFPro.updateConfig({ autoFallback: e.target.checked });
            toast(e.target.checked
                ? '↩️ Sẽ tự chuyển sang Puter khi Pro gặp lỗi (quota/key/model).'
                : '⛔ Đã tắt tự chuyển Puter — lỗi Pro sẽ được báo thẳng.', e.target.checked ? '' : 'err');
        });
        $('btn-test-gemini').addEventListener('click', async () => {
            setBusy('btn-test-gemini', true);
            setStatus('pro-test-status', 'Đang kiểm tra Gemini key…');
            const r = await VFPro.testKey('gemini');
            setStatus('pro-test-status', r.ok ? `✅ Gemini OK — ${r.info}` : `❌ ${r.info}`, r.ok ? 'ok' : 'err');
            setBusy('btn-test-gemini', false);
        });
        $('btn-test-openai').addEventListener('click', async () => {
            setBusy('btn-test-openai', true);
            setStatus('pro-test-status', 'Đang kiểm tra OpenAI key…');
            const r = await VFPro.testKey('openai');
            setStatus('pro-test-status', r.ok ? `✅ OpenAI OK — ${r.info}` : `❌ ${r.info}`, r.ok ? 'ok' : 'err');
            setBusy('btn-test-openai', false);
        });
        refreshProState();
    }

    /* ===================================================================== */
    /* VOICESTUDIO — engine giọng cục bộ trên máy user (646 ngôn ngữ, clone) */
    /* ===================================================================== */
    function initVS() {
        if (typeof VFVS === 'undefined') return;
        const c = VFVS.getConfig();
        $('vs-url').value = c.url;
        $('vs-key').value = c.apiKey;
        $('vs-engine').value = c.engine;
        $('vs-speed').value = c.speed;
        $('vs-instruct').value = c.instruct || '';
        $('vs-enabled').checked = !!c.enabled;

        const persist = () => {
            VFVS.updateConfig({
                url: $('vs-url').value,
                apiKey: $('vs-key').value,
                engine: $('vs-engine').value,
                speed: Number($('vs-speed').value) || 1,
                instruct: $('vs-instruct').value.trim(),
                enabled: $('vs-enabled').checked,
            });
            refreshProState();
        };
        ['vs-url', 'vs-key', 'vs-engine', 'vs-speed', 'vs-instruct'].forEach((id) => {
            $(id).addEventListener('change', persist);
        });
        $('vs-enabled').addEventListener('change', () => {
            persist();
            const on = $('vs-enabled').checked;
            /* QUAN TRỌNG: ghi engine vào router giọng đọc (VFPro engines) */
            if (typeof VFPro !== 'undefined') {
                VFPro.updateConfig({ engines: { voice: on ? 'voicestudio' : 'auto' } });
            }
            const vsVoice = $('vs-voice').value || 'default';
            if (on) {
                /* chọn giọng của VoiceStudio vào trường cấu hình */
                VFVS.updateConfig({ voice: vsVoice });
                toast(`🎙️ Đã chuyển giọng đọc sang VoiceStudio (${VFVS.getConfig().engine} · ${vsVoice}).`, 'ok');
            } else {
                toast('Đã quay về bộ máy giọng Puter/Pro.');
            }
            refreshProState();
        });
        $('vs-voice').addEventListener('change', () => {
            VFVS.updateConfig({ voice: $('vs-voice').value });
        });

        $('btn-vs-test').addEventListener('click', async () => {
            persist();
            setBusy('btn-vs-test', true);
            setStatus('vs-status', 'Đang kết nối VoiceStudio…');
            try {
                await VFVS.health();
                const { voices, engines } = await VFVS.listVoices(true);
                /* điền engine thực tế có trên backend */
                const engSel = $('vs-engine');
                const current = engSel.value;
                engSel.innerHTML = '';
                const known = [
                    ['omnivoice', 'omnivoice (OmniVoice GGUF)'],
                    ['voxcpm2', 'voxcpm2 (voice-design)'],
                    ['cosyvoice', 'cosyvoice'],
                    ['kittentts', 'kittentts (nhẹ, nhanh)'],
                    ['moss-tts-nano', 'moss-tts-nano'],
                    ['moss-tts-v15', 'moss-tts-v1.5'],
                    ['dots_tts', 'dots-tts'],
                    ['indextts', 'indextts (clone)'],
                    ['supertonic3', 'supertonic3'],
                    ['confucius4', 'confucius4'],
                ];
                const ids = engines.map((e) => (typeof e === 'string' ? e : e.id || e.engine_id || '')).filter(Boolean);
                const list = ids.length ? ids : known.map(([k]) => k);
                list.forEach((id) => {
                    const o = document.createElement('option');
                    o.value = id;
                    const found = known.find(([k]) => k === id);
                    o.textContent = found ? found[1] : id;
                    engSel.appendChild(o);
                });
                engSel.value = list.includes(current) ? current : list[0];
                VFVS.updateConfig({ engine: engSel.value });

                /* điền giọng: profile đã clone + alias + default */
                const vSel = $('vs-voice');
                vSel.innerHTML = '';
                const addVoice = (id, label) => {
                    if ([...vSel.options].some((o) => o.value === id)) return; // tránh trùng default
                    const o = document.createElement('option');
                    o.value = id;
                    o.textContent = label;
                    vSel.appendChild(o);
                };
                addVoice('default', 'default (giọng mặc định engine)');
                voices.forEach((v) => {
                    const suffix = v.type === 'profile' ? (v.language ? ` · ${v.language}` : ' · profile') : '';
                    addVoice(v.voice_id, `${v.name || v.voice_id}${suffix}`);
                });
                vSel.value = VFVS.getConfig().voice || 'default';
                if (!vSel.value) vSel.value = 'default';

                setStatus('vs-status', `✅ Kết nối OK — ${voices.length} giọng, ${engSel.options.length} engine. Đã sẵn sàng; bật ô "Dùng VoiceStudio" để sử dụng.`, 'ok');
            } catch (err) {
                setStatus('vs-status', `❌ ${err.friendly || err.message}`, 'err');
            } finally {
                setBusy('btn-vs-test', false);
            }
        });
    }

    /* ===================================================================== */
    /* Khởi tạo                                                              */
    /* ===================================================================== */
    function fillFormFromProject() {
        const p = APP.project;
        const b = p.brief;
        $('bf-topic').value = b.topic || '';
        $('bf-niche').value = b.niche || '';
        $('bf-audience').value = b.audience || '';
        $('bf-duration').value = String(b.duration || 45);
        $('bf-platform').value = b.platform || 'tiktok_youtube';
        $('bf-style').value = b.style || 'storytelling';
        $('bf-goal').value = b.goal || 'views';
        if (b.chatModel) $('bf-chat-model').value = b.chatModel;
        $('bf-lang').value = b.voiceLang || 'vi-VN';
        if (p.voice) {
            $('tts-provider').value = p.voice.provider || 'aws-polly';
            onTtsProviderChange();
            /* chỉ gán khi option tồn tại — tránh select rơi về rỗng */
            const setIfHas = (sel, val) => { if (val && [...sel.options].some((o) => o.value === val)) sel.value = val; };
            setIfHas($('tts-model'), p.voice.model);
            setIfHas($('tts-voice'), p.voice.voice);
            if (p.voice.voiceCustom) $('tts-voice-custom').value = p.voice.voiceCustom;
            setIfHas($('tts-lang'), p.voice.language);
            setIfHas($('tts-engine'), p.voice.engine);
            if (p.voice.instructions) $('tts-instructions').value = p.voice.instructions;
        }
        renderIdeas();
        if (p.refined && p.refined.text) {
            $('refined-out').textContent = p.refined.text;
            $('refined-out').classList.remove('muted');
        }
        renderScenes();
        renderThumbs('images-grid');
        renderThumbs('clips-grid');
        renderVoiceList();
        renderFinalOut();
        renderViral();
    }

    function bind() {
        /* brief + combos */
        $('btn-ideas').addEventListener('click', generateIdeas);
        $('btn-refine').addEventListener('click', refineIdea);
        $('btn-apply-combo').addEventListener('click', () => {
            const combo = VFModels.BEST_COMBOS[$('combo-select').value];
            if (!combo) return;
            $('bf-chat-model').value = combo.chat;
            $('img-model').value = combo.image;
            onImageModelChange();
            $('vid-model').value = combo.video;
            onVideoModelChange();
            $('tts-provider').value = combo.tts.provider;
            onTtsProviderChange();
            if (combo.tts.model) $('tts-model').value = combo.tts.model;
            if (combo.tts.voice) $('tts-voice').value = combo.tts.voice;
            if (combo.tts.provider === 'aws-polly') { $('tts-lang').value = 'vi-VN'; $('bf-lang').value = 'vi-VN'; $('tts-engine').value = 'neural'; }
            toast(`Đã áp dụng ${combo.label}`, 'ok');
        });

        /* blueprint + ocr */
        $('btn-blueprint').addEventListener('click', generateBlueprint);
        $('ocr-file').addEventListener('change', (e) => ocrImport(e.target.files[0]));

        /* images */
        $('img-model').addEventListener('change', onImageModelChange);
        $('btn-images').addEventListener('click', generateImages);

        /* voice */
        $('tts-provider').addEventListener('change', onTtsProviderChange);
        $('btn-voice').addEventListener('click', generateVoice);
        $('vc-file').addEventListener('change', (e) => voiceChanger(e.target.files[0]));
        $('btn-vc').addEventListener('click', () => voiceChanger($('vc-file').files[0]));
        $('btn-stt').addEventListener('click', () => transcribe($('stt-file').files[0]));

        /* video */
        $('vid-model').addEventListener('change', onVideoModelChange);
        $('btn-clips').addEventListener('click', generateClips);
        $('btn-render').addEventListener('click', renderFinal);

        /* viral */
        $('btn-viral').addEventListener('click', generateViral);

        /* test mode */
        $('testmode-toggle').addEventListener('change', (e) => {
            APP.settings.testMode = e.target.checked;
            VFStore.saveSettings(APP.settings);
            onVideoModelChange();
            refreshProState();
            renderTestBanner();
            toast(APP.settings.testMode ? '🧪 Chế độ thử nghiệm BẬT — media mẫu, không tốn credits.' : '💸 Chế độ thử nghiệm TẮT — mọi lần sinh đều tính credits của bạn!', APP.settings.testMode ? '' : 'err');
        });

        /* auth */
        $('auth-chip').addEventListener('click', () => {
            if (APP.user) document.querySelector('[data-view="settings"]').click();
            else signInClick();
        });
        $('btn-signin').addEventListener('click', signInClick);
        $('btn-signout').addEventListener('click', async () => {
            try { await VFAI.signOut(); } catch (_) { /* ignore */ }
            await refreshAuth();
            toast('Đã đăng xuất.');
        });

        /* models */
        $('btn-load-all-models').addEventListener('click', loadAllModels);
        $('all-models-filter').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadAllModels(); });

        /* library */
        $('btn-lib-save').addEventListener('click', saveToLibrary);
        $('btn-lib-refresh').addEventListener('click', renderLibrary);

        /* revenue */
        $('btn-rv-save').addEventListener('click', saveRevenueRow);

        /* settings */
        $('btn-export').addEventListener('click', () => VFStore.exportProject(APP.project));
        $('import-file').addEventListener('change', async (e) => {
            const f = e.target.files[0];
            if (!f) return;
            try {
                APP.project = await VFStore.importProject(f);
                save();
                fillFormFromProject();
                toast('Đã nhập dự án!', 'ok');
            } catch (err) {
                toast(`File không hợp lệ: ${err.message}`, 'err');
            }
        });
        $('btn-save-kv').addEventListener('click', async () => {
            const ok = await VFAI.kvSet('vf2026:project', APP.project);
            toast(ok ? 'Đã lưu dự án lên Puter KV ☁️' : 'Lưu KV thất bại — cần đăng nhập Puter.', ok ? 'ok' : 'err');
        });
        $('btn-load-kv').addEventListener('click', async () => {
            const data = await VFAI.kvGet('vf2026:project');
            if (!data) { toast('Không có dự án nào trên Puter KV.', 'err'); return; }
            APP.project = { ...VFStore.defaultProject(), ...data };
            save();
            fillFormFromProject();
            toast('Đã tải dự án từ Puter KV ☁️', 'ok');
        });
        $('btn-clear').addEventListener('click', () => {
            if (!confirm('Xoá dự án hiện tại trên máy này? (Thư viện vẫn giữ)')) return;
            VFStore.clearProject();
            APP.project = VFStore.defaultProject();
            fillFormFromProject();
            toast('Đã xoá dự án hiện tại.');
        });
    }

    function init() {
        APP.settings = VFStore.loadSettings();
        $('testmode-toggle').checked = !!APP.settings.testMode;
        APP.project = VFStore.loadProject();
        revenueRows = VFStore.loadRevenue();

        populateChatModels();
        populateLanguages();
        populateImageModels();
        populateVideoModels();
        populateTtsProviders();
        populateCombos();
        fillSelect($('vc-voice'), ['21m00Tcm4TlvDq8ikWAM (Rachel)', 'pNInz6obpgDQGcFmaJgB (Adam)', 'EXAVITQu4vr4xnSDxMaL (Sarah)', 'TX3LPaxmHKxFdv7VOQHJ (Liam)'].map((v) => ({ id: v.split(' ')[0], label: v })));
        fillSelect($('stt-model'), VFModels.STT_MODELS, 'id', (m) => `${m.label}${m.badge ? ` · ${m.badge}` : ''}`);
        renderCatalog();
        renderRevenue();
        updateStorageHint();
        initProUI();
        initVS();
        renderTestBanner();

        fillFormFromProject();
        bind();
        refreshAuth();

        if (typeof puter === 'undefined') {
            toast('⚠️ Không nạp được Puter.js từ js.puter.com — kiểm tra mạng rồi F5.', 'err');
        }
        console.log('[ViralForge] sẵn sàng — Puter.js:', typeof puter !== 'undefined' ? 'OK' : 'THIẾU');
    }

    document.addEventListener('DOMContentLoaded', init);
})();
