# Bước 1 — Kiểm kê và khóa nền tảng React

Ngày khóa: `07/09/2026`  
Baseline ID ban đầu: `react-foundation-2026-09-07`  
Baseline hiện hành: `react-foundation-2026-09-07-r3`  
Kiến trúc hiện hành: `architecture-3`  
Trạng thái: **Đạt điều kiện chuyển sang Bước 2**

## 1. Phạm vi được khóa

Baseline bảo vệ source/runtime, test và cấu hình build của `Propotype-React`:

- `src/**/*`
- `tests/**/*`
- `scripts/**/*`
- `public/**/*`
- `package.json`, `package-lock.json`
- cấu hình TypeScript, Vite, Vitest, Playwright và lint
- `index.html`

Không đưa các sản phẩm có thể sinh lại hoặc tài liệu đang tiếp tục hoàn thiện
vào checksum: `node_modules`, `dist`, `test-results`, `reports`, `checkpoints`,
`deliverables` và `DEVELOPER-HANDOVER`.

Manifest hiện hành chứa **199 file**. Checksum tổng:

```text
DE01D5EDABC528764F3F7C4094730DC4F8824204718B3424B40D26F110148518
```

## 2. Kiểm kê runtime

| Hạng mục | Số lượng |
|---|---:|
| Task đã đăng ký | 32 |
| File source trong các task (`.ts`, `.tsx`, `.css`) | 75 |
| React component (`.tsx`) | 42 |
| Hook dùng chung | 7 |
| File task-engine | 4 |
| Unit/component test file | 14 |
| E2E spec file | 14 |
| Static task entry point sau build | 32 |

Phân bố task:

| Worksheet | Task |
|---|---|
| WS1 | `60111–60116` |
| WS2 | `60121–60126` |
| WS3 | `60131–60135` |
| WS4 | `60141–60144` |
| WS5 | `60151–60155` |
| WS6 | `60161–60166` |

## 3. Kho component hiện tại

| Nhóm | Component |
|---|---|
| answers | `AnswerChoiceMatrix`, `ChoiceGroup` |
| assessment | `GuidedChoiceTask`, `ListeningChoiceTask` |
| chat | `ChatRow`, `StudentBubble`, `TutorAvatar`, `TutorBubble` |
| checklist | `ReadinessChecklist`, `WritingVerificationChecklist` |
| effects | `Celebration` |
| keypad | `CodeKeypad`, `CodeKeypadModal`, `InlineCodeKeypad` |
| listening | `ListenButton`, `ListeningPlaybackCard`, `PlaybackSequence` |
| ordering | `SequenceOrderInput`, `SequenceRepairPanel` |
| progress | `GuidedIndependentStatus`, `MasteryGate`, `ProgressSteps`, `ScoreGrid` |
| recording | `RecordingCard`, `RecordingTimer`, `RepairRecordingFlow`, `TranscriptConfirmation`, `Waveform` |
| retry | `RetryPanel` |
| shell | `AppShell`, `InteractiveTaskFrame`, `StatusFooter`, `TaskFooter`, `TutorHeader` |
| task | `ActionButton`, `FeedbackBox`, `ResultSummary`, `StatusTag`, `TaskCard`, `TaskPanel` |
| writing | `DraftComparison`, `LanguageHelpPanel` |

Các hook đã khóa: `useAutoScroll`, `useCelebrationSound`,
`useRecordingSimulation`, `useRetryQueue`, `useSpeechSynthesis`, `useStopwatch`,
`useTaskTimers`.

Task engine gồm `catalog.ts`, `schema.ts`, `TaskFlowRenderer.tsx` và
`TaskRenderer.tsx`. Registry typed hiện ánh xạ đủ 32 mã task và hỗ trợ route
chuẩn, query route cùng URL legacy.

## 4. Cổng kiểm thử tại thời điểm khóa

| Cổng | Kết quả |
|---|---:|
| Unit/component | 43/43 đạt |
| TypeScript strict | Đạt |
| Lint | Đạt |
| Production build | Đạt |
| E2E runtime | 40/40 ca áp dụng đạt; 4 ca chuyên biệt được tách runner |
| Static URL compatibility | 3/3 đạt |
| HTML/React parity WS1–WS5 | 1/1 đạt, 52 task/viewport và 54 ảnh |
| Baseline nguồn WS1–WS5 | 26/26 hash đạt |
| Baseline HTML `Propotype` | 144/144 hash đạt |
| Baseline nguồn WS6 | 6/6 hash đạt |
| Baseline React hiện hành | 199/199 file đạt |

Parity HTML/React chỉ áp dụng cho 26 task WS1–WS5 vì `../Propotype` là baseline
HTML hợp nhất của năm worksheet này. WS6 dùng nguồn riêng `../WS 6_HTML`, được
bảo vệ bằng hash, E2E nghiệp vụ và ma trận nghiệm thu. Runner parity đã được giới
hạn đúng phạm vi để không tìm nhầm các route WS6 trong baseline WS1–WS5.

## 5. Tài liệu có thẩm quyền tại baseline

- `REACT-ARCHITECTURE-STANDARD.md` — kiến trúc `architecture-3`.
- `BOOK-FIRST-CONTENT-STANDARD.md` — contract nội dung bắt buộc.
- `FOUNDATION-STANDARD.md` — token và component nền tảng.
- `TASK-ACCEPTANCE-MATRIX.md` — 32/32 task ở trạng thái đạt.
- `TASK-AUTHORING-SCHEMA.md` — schema hiện có, sẽ được đánh giá lại ở Bước 4.
- Tài liệu bước 1 trong `DEVELOPER-HANDOVER/`.

`FINAL-HANDOVER.md` ngày 06/09/2026 chỉ là tài liệu lịch sử của mốc 26 task,
`architecture-2`; không phải baseline hiện hành.

## 6. Giới hạn đã ghi nhận

- Đây là prototype/runtime tham chiếu, chưa có backend production.
- Chưa có xác thực, phân quyền hoặc lưu dữ liệu người học.
- Recording và transcript hiện chủ yếu là mô phỏng nghiệp vụ.
- TTS phụ thuộc khả năng speech synthesis của trình duyệt.
- AI scoring production, prompt contract và teacher review chưa được triển khai.
- Workspace chưa dùng Git; checksum manifest là cơ chế khóa và phát hiện thay đổi
  ở thời điểm hiện tại.

Các giới hạn này là chủ đích của phạm vi bàn giao nền tảng, không phải yêu cầu
phải xây thay đội phát triển.

## 7. Điều kiện nghiệm thu Bước 1

- [x] Đủ 32 task được kiểm kê và đăng ký.
- [x] Component, hook và task-engine được kiểm kê.
- [x] Source HTML cũ vẫn chỉ dùng làm baseline.
- [x] Unit, typecheck, lint và build đạt.
- [x] E2E runtime và static compatibility đạt.
- [x] Có manifest SHA-256 tái kiểm tra được.
- [x] Có quy tắc kiểm soát thay đổi sau khi khóa.
- [x] Tài liệu lịch sử và tài liệu hiện hành được phân biệt rõ.

Bước 1 không phân loại lại archetype, không tái thiết kế schema và không xây các
cổng Admin/Giáo viên/Học sinh. Những nội dung đó thuộc các bước tiếp theo.
