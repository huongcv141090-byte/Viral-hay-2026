/* =============================================================================
 * ViralForge 2026 — Puter AI Edition
 * js/render.js — Compositor dựng video 9:16 NGAY TRÌNH DUYỆT (không FFmpeg)
 *
 * Kỹ thuật: <canvas>.captureStream(30) + AudioContext → MediaStreamDestination
 *           → MediaRecorder (webm vp9/vp8 + opus, Safari: mp4).
 * Hiệu ứng: Ken Burns cho ảnh tĩnh, phát frame clip AI (i2v) cho scene có video,
 *           phụ đề động chia cụm từ theo thời lượng audio từng scene.
 * ============================================================================= */

(function (global) {
    'use strict';

    /* ------------------------------------------------------------------ */
    /* Tải media "sạch" — chống canvas tainting                            */
    /*                                                                     */
    /* Vẽ ảnh/video từ nguồn KHÁC (không có CORS) lên canvas làm canvas    */
    /* "bẩn" → captureStream ngừng cấp frame → MediaRecorder ghi ra 0 byte */
    /* (đây chính là lỗi "Hoàn tất — 0.0 MB"). Giải pháp:                  */
    /*  1. fetch → blob → objectURL (cùng nguồn, luôn sạch);               */
    /*  2. thử <img>/<video crossOrigin=anonymous>;                        */
    /*  3. thử URL gốc + kiểm tra taint bằng canvas thử nghiệm;            */
    /*  → nếu mọi cách đều bẩn: đánh dấu clean=false, compositor vẽ        */
    /*    placeholder thay vì phá cả bản ghi.                              */
    /* ------------------------------------------------------------------ */
    function rawLoadImage(url, crossOrigin) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            if (crossOrigin) img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('image load failed'));
            img.src = url;
        });
    }

    function rawLoadVideo(url, crossOrigin) {
        return new Promise((resolve, reject) => {
            const v = document.createElement('video');
            if (crossOrigin) v.crossOrigin = 'anonymous';
            v.src = url;
            v.muted = true;
            v.playsInline = true;
            v.preload = 'auto';
            v.onloadeddata = () => resolve(v);
            v.onerror = () => reject(new Error('video load failed'));
        });
    }

    /* fetch → blob → objectURL; trả null nếu CORS chặn */
    async function toBlobUrl(url) {
        if (url.startsWith('data:')) return url;
        try {
            const resp = await fetch(url, { mode: 'cors' });
            if (!resp.ok) return null;
            return URL.createObjectURL(await resp.blob());
        } catch (_) {
            return null;
        }
    }

    /* Vẽ thử lên canvas 2x2 rồi đọc pixel — SecurityError nghĩa là bẩn */
    function taintOk(drawFn) {
        const c = document.createElement('canvas');
        c.width = 2;
        c.height = 2;
        const g = c.getContext('2d');
        try {
            drawFn(g);
            g.getImageData(0, 0, 1, 1);
            return true;
        } catch (_) {
            return false;
        }
    }

    async function loadCleanImage(url) {
        const blobUrl = await toBlobUrl(url);
        const attempts = [];
        if (blobUrl && blobUrl !== url) attempts.push([blobUrl, false]);
        attempts.push([url, true], [url, false]);
        for (const [src, cross] of attempts) {
            const img = await rawLoadImage(src, cross).catch(() => null);
            if (!img) continue;
            if (taintOk((g) => g.drawImage(img, 0, 0, 2, 2))) return { img, clean: true };
        }
        return { img: null, clean: false };
    }

    async function loadCleanVideo(url) {
        const blobUrl = await toBlobUrl(url);
        const attempts = [];
        if (blobUrl && blobUrl !== url) attempts.push([blobUrl, false]);
        attempts.push([url, true], [url, false]);
        for (const [src, cross] of attempts) {
            const v = await rawLoadVideo(src, cross).catch(() => null);
            if (!v) continue;
            if (taintOk((g) => g.drawImage(v, 0, 0, 2, 2))) return { video: v, clean: true };
        }
        return { video: null, clean: false };
    }

    async function loadAudioBuffer(ctx, url) {
        const src = (await toBlobUrl(url)) || url;
        const blob = await (await fetch(src)).blob();
        const arr = await blob.arrayBuffer();
        return await ctx.decodeAudioData(arr);
    }

    /* Chia chữ scene thành cụm phụ đề (~3 từ) */
    function subtitleChunks(text) {
        const words = String(text || '').trim().split(/\s+/).filter(Boolean);
        const chunks = [];
        for (let i = 0; i < words.length; i += 3) chunks.push(words.slice(i, i + 3).join(' '));
        return chunks.length ? chunks : [''];
    }

    /* Vẽ ảnh "cover" với hiệu ứng zoom/pan */
    function drawKenBurns(ctx, img, w, h, progress, dir) {
        const zoomFrom = 1.06, zoomTo = 1.22;
        const zoom = zoomFrom + (zoomTo - zoomFrom) * progress;
        const scale = Math.max(w / img.width, h / img.height) * zoom;
        const dw = img.width * scale, dh = img.height * scale;
        const panX = dir % 2 === 0 ? (dw - w) * progress : (dw - w) * (1 - progress);
        const panY = dir % 3 === 0 ? (dh - h) * progress : (dh - h) * 0.5;
        ctx.drawImage(img, -panX, -panY, dw, dh);
    }

    /* Vẽ video "cover" (không zoom để giữ motion của clip) */
    function drawCover(ctx, video, w, h) {
        if (!video.videoWidth) return;
        const scale = Math.max(w / video.videoWidth, h / video.videoHeight);
        const dw = video.videoWidth * scale, dh = video.videoHeight * scale;
        ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }

    /* Vẽ phụ đề: bọc dòng, nền pill, hiệu ứng pop */
    function drawSubtitle(ctx, text, w, h, popScale) {
        if (!text) return;
        const fontSize = Math.round(w * 0.052);
        ctx.font = `800 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const maxW = w * 0.86;
        const words = text.split(/\s+/);
        const lines = [];
        let line = '';
        for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (ctx.measureText(test).width > maxW && line) {
                lines.push(line);
                line = word;
            } else line = test;
        }
        if (line) lines.push(line);

        const lh = fontSize * 1.25;
        const baseY = h * 0.78 - (lines.length - 1) * lh * 0.5;
        const padX = fontSize * 0.55, padY = fontSize * 0.32;

        const scale = 1 + 0.06 * (popScale || 0);
        ctx.save();
        ctx.translate(w / 2, baseY);
        ctx.scale(scale, scale);
        ctx.translate(-w / 2, -baseY);

        lines.forEach((ln, i) => {
            const y = baseY + i * lh;
            const tw = ctx.measureText(ln).width;
            ctx.fillStyle = 'rgba(0,0,0,0.62)';
            const x = w / 2 - tw / 2 - padX, yy = y - lh / 2 - padY + lh * 0.1;
            const ww = tw + padX * 2, hh = lh - lh * 0.1 + padY * 2 * 0.9;
            const r = hh / 2;
            ctx.beginPath();
            ctx.moveTo(x + r, yy);
            ctx.arcTo(x + ww, yy, x + ww, yy + hh, r);
            ctx.arcTo(x + ww, yy + hh, x, yy + hh, r);
            ctx.arcTo(x, yy + hh, x, yy, r);
            ctx.arcTo(x, yy, x + ww, yy, r);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0,0,0,0.7)';
            ctx.shadowBlur = fontSize * 0.18;
            ctx.fillText(ln, w / 2, y + lh * 0.05);
            ctx.shadowBlur = 0;
        });
        ctx.restore();
    }

    function drawProgress(ctx, w, h, p, accent) {
        const barH = Math.max(4, Math.round(h * 0.006));
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(0, h - barH, w, barH);
        ctx.fillStyle = accent || '#ff2d6f';
        ctx.fillRect(0, h - barH, w * p, barH);
    }

    function pickMime() {
        const candidates = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
            'video/mp4',
        ];
        if (typeof MediaRecorder === 'undefined') return null;
        for (const c of candidates) {
            try {
                if (MediaRecorder.isTypeSupported(c)) return c;
            } catch (_) { /* continue */ }
        }
        return null;
    }

    /* ======================================================================
     * compose() — ghép các scene thành 1 video
     *
     * scenes: [{ text, imageDataUrl?, clipUrl?, audioUrl?, seconds? }]
     * opts:   { width=720, height=1280, fps=30, accent='#ff2d6f',
     *           onProgress(p, label), onScene(i, total) }
     * trả về: { blob, url, mime, duration }
     * ==================================================================== */
    async function compose(scenes, opts = {}) {
        const width = opts.width || 720;
        const height = opts.height || 1280;
        const fps = opts.fps || 30;
        const onProgress = opts.onProgress || (() => {});
        const onScene = opts.onScene || (() => {});

        const mime = pickMime();
        if (!mime) throw new Error('Trình duyệt này không hỗ trợ MediaRecorder — hãy dùng Chrome/Edge mới nhất.');

        /* ---- 1. Tải media song song (ưu tiên bản "sạch" không taint) ---- */
        onProgress(0.02, 'Đang tải ảnh, clip và âm thanh của các scene…');
        const prepared = [];
        for (let i = 0; i < scenes.length; i++) {
            const s = scenes[i];
            const item = { text: s.text || '', img: null, video: null, audio: null };
            try {
                if (s.clipUrl) {
                    const r = await loadCleanVideo(s.clipUrl);
                    if (r.clean) item.video = r.video;
                }
            } catch (_) { /* fallback ảnh */ }
            try {
                if (!item.video && s.imageDataUrl) {
                    const r = await loadCleanImage(s.imageDataUrl);
                    if (r.clean) item.img = r.img;
                }
            } catch (_) { /* bỏ qua */ }
            prepared.push(item);
            onProgress(0.02 + 0.13 * ((i + 1) / scenes.length), `Tải scene ${i + 1}/${scenes.length}…`);
        }
        /* toàn bộ scene đều không vẽ được → sẽ không có gì để ghi */
        const allBlank = prepared.every((it) => !it.video && !it.img);
        if (allBlank) {
            throw new Error('Không có ảnh/clip nào vẽ được lên canvas (media ngoài bị chặn CORS). Hãy sinh lại ảnh scene trong app hoặc dùng ảnh từ máy của bạn.');
        }

        /* ---- 2. AudioContext + timeline ---- */
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const actx = new AudioCtx();
        await actx.resume();

        let totalDuration = 0;
        for (let i = 0; i < scenes.length; i++) {
            const s = scenes[i];
            let dur = 0;
            if (s.audioUrl) {
                try { prepared[i].audio = await loadAudioBuffer(actx, s.audioUrl); } catch (_) { /* bỏ qua */ }
            }
            if (prepared[i].audio) dur = prepared[i].audio.duration;
            else if (s.seconds) dur = Number(s.seconds) || 3;
            else dur = Math.max(2.2, String(s.text || '').split(/\s+/).length / 2.6);
            prepared[i].duration = Math.max(1.2, dur);
            totalDuration += prepared[i].duration;
        }

        /* ---- 3. Kênh ghi âm ---- */
        const dest = actx.createMediaStreamDestination();
        let audioOffset = 0;
        const sources = [];
        for (const item of prepared) {
            if (item.audio) {
                const src = actx.createBufferSource();
                src.buffer = item.audio;
                src.connect(dest);
                src.connect(actx.destination); // nghe trực tiếp khi render
                sources.push({ src, when: audioOffset });
            }
            audioOffset += item.duration;
        }
        /* Chỉ gắn track audio khi CÓ nguồn phát thật: destination trơ (không
           source) khiến MediaRecorder chờ sample mãi → blob 0 byte ở môi
           trường render bị chặn. Oscillator qua gain 0 giữ luồng sample
           chảy đều để muxer luôn nhận dữ liệu. */
        const hasAudioTrack = sources.length > 0;
        if (hasAudioTrack) {
            const keepAlive = actx.createOscillator();
            const mute = actx.createGain();
            mute.gain.value = 0;
            keepAlive.connect(mute).connect(dest);
            keepAlive.start();
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const stream = canvas.captureStream(fps);
        if (hasAudioTrack) {
            const audioTrack = dest.stream.getAudioTracks()[0];
            if (audioTrack) stream.addTrack(audioTrack);
        }

        const bitrate = Math.min(12_000_000, Math.max(4_000_000, width * height * 7));
        const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
        const chunks = [];
        recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

        const done = new Promise((resolve) => {
            recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
        });

        /* ---- 4. Vòng lặp vẽ real-time ---- */
        recorder.start(500);
        const startedAt = performance.now();
        sources.forEach(({ src, when }) => src.start(actx.currentTime + when + 0.05));

        // chuẩn bị video play theo scene
        for (const item of prepared) {
            if (item.video) {
                try { item.video.currentTime = 0; item.video.pause(); } catch (_) { /* ignore */ }
            }
        }

        let sceneIndex = -1;
        let raf = 0;
        let paintTimer = 0;
        let lastPaintAt = 0;

        const frame = () => {
            /* Khử trùng lặp: rAF và interval có thể cùng bắn */
            const now = performance.now();
            if (now - lastPaintAt < 18) return;
            lastPaintAt = now;
            const t = (now - startedAt) / 1000;

            /* xác định scene hiện tại */
            let acc = 0, idx = 0;
            for (let i = 0; i < prepared.length; i++) {
                if (t < acc + prepared[i].duration || i === prepared.length - 1) { idx = i; break; }
                acc += prepared[i].duration;
            }
            if (idx !== sceneIndex) {
                sceneIndex = idx;
                onScene(idx, prepared.length);
                const prev = prepared[idx - 1];
                if (prev && prev.video) { try { prev.video.pause(); } catch (_) { /* ignore */ } }
                const cur = prepared[idx];
                if (cur.video) { try { cur.video.currentTime = 0; cur.video.play().catch(() => {}); } catch (_) { /* ignore */ } }
            }

            const item = prepared[idx];
            const p = Math.min(1, (t - acc) / item.duration);

            /* nền đen chống nhấp nháy */
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);

            if (item.video) drawCover(ctx, item.video, width, height);
            else if (item.img) drawKenBurns(ctx, item.img, width, height, p, idx);
            else {
                /* scene không vẽ được (media ngoài bị chặn) hoặc trống:
                   gradient + số scene, KHÔNG bao giờ vẽ media bẩn */
                const g = ctx.createLinearGradient(0, 0, width, height);
                g.addColorStop(0, '#16041f');
                g.addColorStop(1, '#3b0a2a');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, width, height);
                ctx.fillStyle = 'rgba(255,255,255,0.25)';
                ctx.font = `900 ${Math.round(width * 0.2)}px system-ui, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`#${idx + 1}`, width / 2, height / 2);
            }

            /* phụ đề theo cụm trong scene */
            const chunks2 = subtitleChunks(item.text);
            const chunkIdx = Math.min(chunks2.length - 1, Math.floor(p * chunks2.length));
            const pop = 1 - Math.min(1, ((p * chunks2.length) % 1) * 5);
            drawSubtitle(ctx, chunks2[chunkIdx], width, height, pop);

            drawProgress(ctx, width, height, Math.min(1, t / totalDuration), opts.accent);
            onProgress(0.16 + 0.8 * Math.min(1, t / totalDuration), `Đang dựng ${Math.round(Math.min(1, t / totalDuration) * 100)}%`);

            if (t < totalDuration + 0.25) {
                /* Vòng kép: rAF cho tab hiển thị bình thường + interval 30Hz
                   đảm bảo luôn tiến độ kể cả khi rAF bị throttle/ẩn tab */
                raf = requestAnimationFrame(frame);
            } else {
                try { recorder.stop(); } catch (_) { /* ignore */ }
                cancelAnimationFrame(raf);
                clearInterval(paintTimer);
            }
        };
        raf = requestAnimationFrame(frame);
        paintTimer = setInterval(frame, 33);

        const blob = await done;

        if (!blob || blob.size === 0) {
            throw new Error('Bản ghi trả về 0 byte — thường do media ngoài bị chặn vẽ lên canvas hoặc trình duyệt hạn chế MediaRecorder. Hãy thử Chrome/Edge mới nhất và sinh lại ảnh scene trong app.');
        }

        /* dọn dẹp */
        try { actx.close(); } catch (_) { /* ignore */ }
        prepared.forEach((it) => { if (it.video) { try { it.video.pause(); it.src = ''; } catch (_) { /* ignore */ } } });

        onProgress(1, 'Hoàn tất');
        return { blob, url: URL.createObjectURL(blob), mime, duration: totalDuration };
    }

    global.VFRender = { compose, subtitleChunks, pickMime };
})(window);
