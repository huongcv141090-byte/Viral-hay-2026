# ⚡ ViralForge 2026 — Puter AI Edition

**Video Production OS** cho kênh faceless: **IDEA → SCRIPT → IMAGE → VOICE → VIDEO → VIRAL → REVENUE**.

Dự án đấu nối toàn bộ [Puter AI](https://docs.puter.com/AI/) (qua `https://js.puter.com/v2/`) với concept pipeline của [viral-2026.vercel.app](https://viral-2026.vercel.app/), và nâng cấp lên **các model mới nhất** cho ảnh / video / giọng đọc.

> 🔑 **Không cần API key nào.** Puter chạy theo mô hình **User Pays**: mỗi request tính vào AI credits của tài khoản Puter của *người dùng cuối*, ứng dụng chỉ nhúng 1 thẻ `<script>`.
>
> 💎 **Tài khoản Pro (BYOK)** — muốn chất lượng tối đa theo gói của mình? Nhập API key **Google Gemini** và/hoặc **OpenAI** ở tab *Cài đặt* để gọi **trực tiếp** Veo 3.1, Sora 2, Nano Banana, GPT Image, Gemini/OpenAI TTS song song với Puter (xem phần [Tài khoản Pro](#-tài-khoản-pro--byok-mang-key-của-bạn)).

---

## 🚀 Chạy ngay

```bash
cd viralforge-2026
# cách 1 — Python
python -m http.server 8080
# cách 2 — Node
npx serve .
```

Mở [http://localhost:8080](http://localhost:8080) → bấm **"⭕ Khách"** (góc trên phải) để đăng nhập Puter miễn phí → dùng pipeline.

**Chế độ thử nghiệm** (mặc định BẬT): mọi lệnh AI trả về media mẫu của Puter, **không tốn credits** — dùng để làm quen UI. Tắt công tắc 🧪 ở topbar để tạo nội dung thật (bắt đầu tính credits).

## 🧵 Pipeline 8 bước

| Bước | Chức năng | API Puter |
|---|---|---|
| 01 · Ý tưởng | Brief → 5 ý tưởng viral | `puter.ai.chat()` |
| 02 · Cải tiến | Đào sâu ý tưởng đã chọn (3-act story) | `puter.ai.chat()` |
| 03 · Blueprint | Kịch bản từng scene: lời thoại + prompt ảnh EN + góc máy; nhập kịch bản từ ảnh bằng OCR | `puter.ai.chat()`, `puter.ai.img2txt()` |
| 04 · Hình ảnh | Ảnh 9:16 cho từng scene, chọn model + chất lượng | `puter.ai.txt2img()` |
| 05 · Giọng đọc | TTS từng scene (đồng bộ thời lượng), Voice Changer, Phiên âm | `puter.ai.txt2speech()`, `speech2speech()`, `speech2txt()` |
| 06 · Video | A: clip AI image-to-video từng scene · B: dựng video hoàn chỉnh 9:16 trong trình duyệt (Ken Burns + phụ đề động + ghép giọng, **không cần FFmpeg**) | `puter.ai.txt2vid()` + Canvas `MediaRecorder` |
| 07 · Viral | Caption + hashtag + giờ đăng vàng cho từng nền tảng | `puter.ai.chat()` |
| 08 · Thu nhập | Tracker views/likes/follow/USD theo nền tảng (localStorage) | — |

Lưu trữ: dự án tự lưu `localStorage` trên từng máy + **☁️ Vercel Blob** (`Cài đặt → ☁️ Lưu/Tải lên Vercel Blob` — gói 1 payload gồm dự án + doanh thu + thư viện, lưu vào store `viral-hay-2026-blob` qua `/api/store`), ảnh/video có thể lưu thẳng **Puter Drive** (tuỳ chọn). Xuất/nhập JSON để sao lưu thủ công.

## 💎 Tài khoản Pro (BYOK) — mang key của bạn

Tab **Cài đặt → 💎 Tài khoản Pro**: nhập key và chọn *bộ máy* riêng cho từng loại tác vụ (kịch bản / ảnh / video / giọng). Ứng dụng là một **router**: chọn `auto` → Puter (mặc định, user-pays); chọn `Gemini/OpenAI trực tiếp` → gọi thẳng API chính thức bằng key của bạn:

| Tác vụ | Gemini trực tiếp (REST `generativelanguage.googleapis.com/v1beta`) | OpenAI trực tiếp (REST `api.openai.com/v1`) |
|---|---|---|
| Kịch bản | `models/{id}:generateContent` (mặc định `gemini-2.5-flash`, nhập id tuỳ ý) | `POST /chat/completions` |
| Ảnh | `generateContent` + `responseModalities: IMAGE` — Nano Banana: `gemini-3-pro-image-preview`, `gemini-3.1-flash-image-preview` (đủ 9:16, 1K/2K/4K) | `POST /images/generations` — `gpt-image-1` / `gpt-image-2` |
| Video | **Veo 3.1**: `models/veo-3.1-*-generate-preview:predictLongRunning` → poll operation → tải MP4 (có image-to-video qua `inlineData`) | **Sora 2**: `POST /videos` → poll `GET /videos/{id}` → tải `/videos/{id}/content` (t2v) |
| Giọng đọc | `generateContent` + `speechConfig` (30 giọng, trả PCM tự bọc WAV) | `POST /audio/speech` (`gpt-4o-mini-tts` + instructions) |

- Key lưu **chỉ trong localStorage** của trình duyệt, gửi thẳng tới nhà cung cấp — không qua trung gian. Nút **"Kiểm tra key"** xác thực ngay (đếm model khả dụng).
- **Tự động fallback**: Pro lỗi (hết quota, key sai, model limit 0) → app tự chuyển sang Puter và báo bằng toast, không bỏ lỡ kết quả (tắt được trong thẻ Pro).
- Bật **🧪 Chế độ thử nghiệm** thì luôn đi Puter (media mẫu miễn phí) bất kể engine đã chọn — tag bộ máy cạnh mỗi nút bấm sẽ cho biết đang dùng gì.
- ⚠️ **Chi phí:** ChatGPT Plus / Google AI Pro (gói web) **không bao gồm** quota API — Google/OpenAI không có OAuth cấp quyền sinh ảnh/video/giọng cho app thứ ba theo gói web, nên **API key là cầu nối chính thức duy nhất**. Free tier key Gemini dùng được: `gemini-2.5-flash`, `gemini-2.5-flash-image`, `gemini-2.5-flash-preview-tts`; còn `veo-*`, `gemini-3-pro-image`, `sora-2` cần billing/credit (lỗi `Quota exceeded … limit: 0` = model không có free tier). Video Pro render chậm 1–4 phút/clip.
- Lấy key: [aistudio.google.com/apikey](https://aistudio.google.com/apikey) · [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

## 🔷 TokenForge (gateway ai.studio) — chat GLM & Claude

Cài đặt → 💎 Pro → mục **🔷 TokenForge**: gateway API tương thích OpenAI (`https://tokenforge.ai.studio/v1`). Dùng cho **Kịch bản (chat)** — ý tưởng, blueprint, caption — với model như `glm-5.3`, `claude-opus-5` (danh sách động, bấm **"Tải danh sách model"**).

- Key đặt trong `js/secrets.js` ("biến môi trường" của app tĩnh, đã gitignore) **hoặc** dán trực tiếp vào ô key — app tự đọc `window.VF_ENV.TOKENFORGE_API_KEY` khi ô còn trống.
- CORS của gateway mở sẵn cho mọi origin → gọi thẳng từ trình duyệt được.
- Service báo "maintenance mode" → lỗi được ánh xạ thành thông báo tiếng Việt và **tự fallback sang Puter** (nếu bật auto-fallback) cho tới khi hết bảo trì.
- Xác thực: `GET /v1/models` (đếm model) · `POST /v1/chat/completions` (`{model, messages, stream:false}`).

## 🖥️ VoiceStudio (máy bạn) — giọng đọc đa ngôn ngữ & clone giọng

Bước 05 có panel **🖥️ VoiceStudio**: đấu nối [VoiceStudio](https://github.com/debpalash/VoiceStudio) (16 engine TTS · 11 ASR · 646 ngôn ngữ, chạy local trên GPU/CPU của bạn) qua **API tương thích OpenAI** tại `http://127.0.0.1:3900`. Miễn phí, không tốn credits Puter/Pro.

- **Bật**: điền địa chỉ backend (mặc định `http://127.0.0.1:3900`) → **Kiểm tra kết nối** (đọc `/health` + `/v1/audio/voices`, tự điền engine & giọng, gồm cả **giọng bạn đã clone** trong VoiceStudio) → tick **"🎙️ Dùng VoiceStudio cho giọng đọc"**.
- **Đấu nối kỹ thuật**: `GET /health`, `GET /v1/audio/voices` (`{voices:[{voice_id,name,type,language}], engines}`), `POST /v1/audio/speech` với `model`=engine id (`omnivoice`/`voxcpm2`/`cosyvoice`/`kittentts`…), `voice`=voice_id profile đã clone, `language`=ISO 639-1 (app tự chuyển `vi-VN`→`vi`), `instruct`, `speed`. Xuất WAV, ghép thẳng vào compositor.
- **CORS 1 lần duy nhất** (bắt buộc): backend của VoiceStudio mặc định chỉ cho UI của nó (cổng 3901) — thêm origin của app:
  `OMNIVOICE_ALLOWED_ORIGINS=http://127.0.0.1:8899,http://localhost:8899` (biến môi trường; Docker: `-e OMNIVOICE_ALLOWED_ORIGINS=…`).
- VoiceStudio **không chạy** → app tự fallback về Puter và báo toast, không chặt pipeline.
- Xác thực tuỳ chọn: đặt `OMNIVOICE_API_KEY` ở VoiceStudio rồi dán cùng giá trị vào ô API key của panel.

## 🧠 Model mới nhất đã đấu nối (xác minh từ docs.puter.com/AI)

**Chat** — `gpt-5.6-luna` · `gpt-5.5` · `gpt-5-nano` · `claude-opus-4-8` · `claude-sonnet-5` · `claude-sonnet-4-6` · `gemini-3.1-flash` · `gemini-3.1-flash-lite` (thêm 500+ model trong **Model Hub** với giá real-time qua `puter.ai.listModels()`)

**Ảnh (`txt2img`)**

| Model | Nhà cung cấp | Điểm mạnh |
|---|---|---|
| `gpt-image-2.5-sunburst` / `-flare` | OpenAI | Mới nhất, quality tới `max`, chữ trong ảnh chuẩn |
| `gemini-3.1-flash-image-preview` (Nano Banana 2) | Google | Edit hội thoại tốt nhất, tới 4K |
| `gemini-3-pro-image-preview` | Google | Studio 4K |
| `grok-imagine-image-quality` | xAI | 2K, ghép tới 3 ảnh tham chiếu |
| `black-forest-labs/flux-2-dev`, `flux-schnell` | Replicate | Open-weight, nhanh/rẻ |
| `gpt-image-2` / `1.5` / `1` / `1-mini` | OpenAI | Ổn định, rẻ |

**Video (`txt2vid`)**

| Model | Nhà cung cấp | Thời lượng | Điểm mạnh |
|---|---|---|---|
| `veo-3.1` / `fast` / `lite` | Google | 4/6/8s | Cinematic nhất, luôn có âm thanh, tới 4K |
| `seedance-2-5` | BytePlus | 4–30s | Dài nhất, 30 ảnh tham chiếu, 1080p |
| `seedance-2-0` (+fast/mini) | BytePlus | 4–15s | Có 4K, rẻ |
| `wan-ai/wan2.7-t2v/i2v` | Together | 2–15s | 30fps, tự sinh soundtrack |
| `kwaivgi/kling-2.1-master/pro/standard` | Together | 5s | Chuyển động thực đỉnh cao |
| `minimax/hailuo-02` · `pixverse-v5` · `google/veo-2.0` | Together | — | Tuỳ chọn giá trọn clip |

**Giọng đọc (`txt2speech`)** — ElevenLabs `eleven_v3` (mới nhất) · Gemini `gemini-3.1-flash-tts-preview` · OpenAI `gpt-4o-mini-tts` · Grok TTS (thẻ `[pause]`, `<whisper>`) · Speechify `simba-3.2` · **AWS Polly `vi-VN` giọng Khoa (neural) cho tiếng Việt**

**Khác** — Voice Changer `eleven_multilingual_sts_v2`; Phiên âm `gpt-4o-transcribe-diarize` (tách người nói) / `whisper-1`; OCR `aws-textract` / Mistral.

## 📂 Cấu trúc

```
viralforge-2026/
├── index.html        # UI pipeline (tiếng Việt)
├── css/styles.css
├── js/
│   ├── secrets.js    # "Biến môi trường" key (gitignore — không commit)
│   ├── models.js     # Catalog model mới nhất + metadata tuỳ chọn
│   ├── voicestudio.js # Đấu nối VoiceStudio local (giọng đa ngôn ngữ + clone)
│   ├── pro.js        # TÀI KHOẢN PRO (BYOK): client trực tiếp Gemini + OpenAI
│   ├── ai.js         # Router Puter ↔ Pro ↔ VoiceStudio + auth + kv + fs + map lỗi
│   ├── render.js     # Compositor: canvas + MediaRecorder (9:16, không FFmpeg)
│   ├── store.js      # localStorage + xuất/nhập JSON
│   └── app.js        # Điều phối pipeline + Model Hub/Thư viện/Thu nhập
└── README.md
```

## ☁️ Deploy

Repo: `github.com/huongcv141090-byte/Viral-hay-2026` · Vercel account: `mrbit15`.

- **Vercel (khuyên dùng — 2 phút)**: [vercel.com/mrbit15](https://vercel.com/mrbit15) → **Add New… → Project** → import `huongcv141090-byte/Viral-hay-2026` → Framework Preset = **Other** → Deploy. `vercel.json` đã sẵn sàng (static, zero-config). Sau deploy: mở site → Cài đặt → dán key (TokenForge/Gemini…) — key lưu trong localStorage trình duyệt, **không nằm trong repo**.
- **Vercel CLI**: `npm i -g vercel && vercel login && vercel --prod` trong thư mục dự án.
- **Puter Hosting**: kéo-thả thư mục vào puter.com → Website.
- ⚠️ `js/secrets.js` (chứa key thật) **không được push** lên GitHub (.gitignore) — chỉ đặt key qua UI sau khi deploy, hoặc dùng biến môi trường build-time nếu bạn tự chịu trách nhiệm bảo mật.

## 📖 Ghi chú kỹ thuật

- Video AI **chậm**: chục giây → vài phút/clip; Puter chờ tối đa 10 phút (`upstream_timeout`). Mỗi clip thành công tính credits theo model/thời lượng/độ phân giải; lỗi không tính tiền.
- Provider URL của clip AI là **tạm thời** — tải xuống hoặc lưu qua Puter Drive (`puter_output_path`).
- Compositor render **real-time** (video dài 45s ≈ render 45s): canvas 720×1280 + `captureStream(30)` + `AudioContext → MediaStreamDestination` + `MediaRecorder` (webm vp9/opus; Safari mp4).
- Lỗi thường gặp đã map sang tiếng Việt: `moderation_flagged` (đổi prompt), `insufficient_funds` (nạp credits / chọn model rẻ), `access_denied` (quyền ghi Drive).
- Tài liệu API đầy đủ: [docs.puter.com/AI](https://docs.puter.com/AI/) — mã nguồn Puter đầy đủ trong `../puter-main/`.

## 🔧 Xử lý sự cố

| Hiện tượng | Nguyên nhân & cách xử lý |
|---|---|
| Ảnh có chữ "SUCCESS!", giọng/clip lặp lại giống nhau | Đó là **media MẪU** — 🧪 Chế độ thử nghiệm đang bật. Tắt công tắc 🧪 ở topbar → đăng nhập Puter (hoặc key 💎 Pro) → bấm sinh lại. Banner vàng đầu trang luôn nhắc điều này. |
| "Dựng video hoàn chỉnh" ra **0.0 MB** (đã vá) | Trước đây: clip/ảnh từ nguồn ngoài không có CORS làm **canvas bị taint** → `captureStream` ngừng cấp frame. Giờ compositor tự: fetch media về blob URL cùng nguồn → thử `crossOrigin` → kiểm tra taint từng media → scene không ghi được sẽ thay bằng placeholder (số thứ tự) thay vì phá cả bản ghi; blob 0 byte bị chặn và báo lỗi rõ ràng. |
| Không tạo được nội dung thật sau khi tắt 🧪 | Chưa đăng nhập Puter — bấm chip "Khách" góc phải rồi thử lại; hoặc cấu hình key 💎 Pro ở Cài đặt. |

## ⚠️ Miễn trừ

Kết quả AI và mô hình thu nhập chỉ mang tính **tham khảo**, không phải tư vấn tài chính. Không cam kết views/doanh thu.
