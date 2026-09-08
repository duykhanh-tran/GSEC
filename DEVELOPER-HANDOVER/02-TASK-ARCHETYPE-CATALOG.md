# Bước 2 — Phân loại task thành archetype

Ngày chốt: `07/09/2026`  
Catalog ID: `handover-archetypes-1`  
Phạm vi: 32 task WS1–WS6  
Trạng thái: **Đạt điều kiện chuyển sang Bước 3**

## 1. Quy tắc phân loại

Ba khái niệm phải được tách riêng:

- **Primary archetype:** mẫu task hoàn chỉnh, sở hữu state flow, điều kiện hoàn
  thành và contract đánh giá. Mỗi task có đúng một primary archetype.
- **Variant:** biến thể có giới hạn trong cùng archetype, không thay đổi bản chất
  đường hoàn thành.
- **Capability:** năng lực có thể ghép lại như listening, recording, retry,
  Guided tracking hoặc mastery. Capability không phải một task template.

Quy tắc này tránh để Admin ghép block tùy ý thành một luồng không hợp lệ. Admin
chọn archetype trước, sau đó chỉ cấu hình các variant và capability mà archetype
cho phép.

## 2. Mười một archetype chính

| ID | Mục đích | Số task | Task mẫu | Mức authoring |
|---|---|---:|---|---|
| `structured-answer-retry` | Nhập nhiều đáp án worksheet và sửa theo queue | 3 | `60131`, `60111` | Guarded template |
| `guided-choice` | Lựa chọn ký hiệu, hint Book-first, Guided/Independent | 11 | `60152`, `60142` | Form-ready |
| `listen-classify-pronounce` | Nghe, phân loại rồi luyện phát âm | 2 | `60123`, `60112` | Guarded template |
| `recording-feedback` | Thu âm, transcript, xác nhận và sửa có kiểm soát | 6 | `60163`, `60125` | Guarded template |
| `writing-capture-repair` | Thu phần viết, tạo preview và sửa mục tiêu | 1 | `60115` | Developer extension |
| `mastery-review` | Ôn ưu tiên, kiểm tra mastery, luyện đúng mục tiêu | 1 | `60126` | Guarded template |
| `readiness-checklist` | Xác nhận chuẩn bị trong worksheet trước task sau | 2 | `60165`, `60154` | Form-ready |
| `speaking-coach` | Speaking/role-play nhiều vòng, feedback và mastery | 2 | `60155`, `60144` | Guarded template |
| `listening-choice-assessment` | Playback bắt buộc, lựa chọn ký hiệu và replay | 2 | `60162`, `60161` | Form-ready |
| `sequence-ordering-repair` | Nhập thứ tự, sửa từng vị trí và model Guided | 1 | `60164` | Guarded template |
| `writing-coach` | Draft, kiểm tra sách, feedback, revision, mastery | 1 | `60166` | Guarded template |

Tổng cộng: **11 archetype, 32/32 task được ánh xạ đúng một archetype chính**.

## 3. Ý nghĩa mức authoring

- `form-ready`: cấu trúc hiện tại đã đủ ổn định để ưu tiên chuyển thành form
  Admin sau khi schema và component contract hoàn tất.
- `guarded-template`: có thể tạo qua Admin nhưng cần wizard/ràng buộc luồng,
  không cho phép ghép block tự do.
- `developer-extension`: hiện chưa nên cho Admin tự tạo; dev cần hoàn thiện hoặc
  xác nhận abstraction trước.

Phân bố hiện tại:

| Mức | Số task |
|---|---:|
| Form-ready | 15 |
| Guarded template | 16 |
| Developer extension | 1 |

## 4. Ma trận 32 task

| WS | Task | Primary archetype | Variant |
|---:|---:|---|---|
| 1 | `60111` | `structured-answer-retry` | vocabulary-gap-entry |
| 1 | `60112` | `listen-classify-pronounce` | word-letter-matching |
| 1 | `60113` | `guided-choice` | listening-supported-multiple-choice |
| 1 | `60114` | `guided-choice` | listening-supported-true-false |
| 1 | `60115` | `writing-capture-repair` | fragment-to-paragraph |
| 1 | `60116` | `recording-feedback` | free-speaking-practice |
| 2 | `60121` | `structured-answer-retry` | collocation-matrix |
| 2 | `60122` | `guided-choice` | meaning-choice |
| 2 | `60123` | `listen-classify-pronounce` | sound-classification |
| 2 | `60124` | `recording-feedback` | sentence-fluency-sequence |
| 2 | `60125` | `recording-feedback` | asr-versus-writing-repair |
| 2 | `60126` | `mastery-review` | priority-review |
| 3 | `60131` | `structured-answer-retry` | grammar-form-entry |
| 3 | `60132` | `guided-choice` | form-and-meaning-choice |
| 3 | `60133` | `guided-choice` | frequency-position-choice |
| 3 | `60134` | `guided-choice` | frequency-meaning-choice |
| 3 | `60135` | `recording-feedback` | personal-writing-stt-check |
| 4 | `60141` | `guided-choice` | functional-phrase-labels |
| 4 | `60142` | `guided-choice` | appropriacy-choice |
| 4 | `60143` | `recording-feedback` | supported-dialogue-sequence |
| 4 | `60144` | `speaking-coach` | multi-turn-role-play |
| 5 | `60151` | `guided-choice` | reading-main-idea |
| 5 | `60152` | `guided-choice` | reading-detail |
| 5 | `60153` | `guided-choice` | conversation-cohesion-labels |
| 5 | `60154` | `readiness-checklist` | speaking-plan-readiness |
| 5 | `60155` | `speaking-coach` | extended-response-follow-up-revision |
| 6 | `60161` | `listening-choice-assessment` | true-false |
| 6 | `60162` | `listening-choice-assessment` | multiple-choice |
| 6 | `60163` | `recording-feedback` | sentence-structure-stt |
| 6 | `60164` | `sequence-ordering-repair` | paragraph-cohesion |
| 6 | `60165` | `readiness-checklist` | writing-readiness |
| 6 | `60166` | `writing-coach` | draft-feedback-verification-revision |

## 5. Capability dùng chung

Catalog khóa 13 capability ở mức khái niệm:

`text-entry`, `choice-input`, `listening`, `recording`,
`transcript-confirmation`, `retry-coaching`, `guided-tracking`, `mastery-gate`,
`ordering`, `writing-revision`, `readiness-check`, `role-play`,
`evidence-summary`.

Contract props/state cụ thể của từng capability chưa được khóa ở bước này; đó là
nội dung Bước 3.

## 6. Đánh giá mức cấu hình hiện tại

- **13 task config-wrapper:** 11 task dùng `GuidedChoiceTask` và 2 task dùng
  `ListeningChoiceTask`. Đây là nhóm gần mô hình Admin authoring nhất.
- **19 task composed TSX:** đã dùng component và `TaskRenderer` chung nhưng state
  flow vẫn được viết trong file task.

Không được hiểu `composed-tsx` là lỗi. Đây là chỉ báo để Bước 3 ưu tiên chuẩn hóa
contract và để Bước 4 quyết định phần nào có thể chuyển thành JSON.

## 7. Ngoại lệ và điểm cần giữ lại cho Bước 3

- `60115`: paragraph composer là composition cục bộ duy nhất; tạm xếp
  `developer-extension`.
- `60134`: weekday strip là presentation block riêng, nhưng không làm thay đổi
  archetype `guided-choice`.
- `60144`: role-play stage machine vẫn cục bộ; cần contract rõ trước khi cho
  Admin cấu hình.
- `60123`: pronunciation timeline là biến thể giàu hành vi của
  `listen-classify-pronounce`.
- `60166`: writing verification và AI scoring tương lai phải được giới hạn bằng
  rubric/permission contract, không cho Admin nhập prompt tự do.

Quy tắc nâng cấp: nếu một ngoại lệ xuất hiện lần thứ hai với cùng semantics, phải
đánh giá nâng thành capability hoặc variant chuẩn thay vì sao chép mã.

## 8. Thứ tự ưu tiên cho Bước 3

1. `guided-choice` và `listening-choice-assessment`: bao phủ 13 task và đã gần
   hoàn toàn cấu hình hóa.
2. `recording-feedback`: bao phủ 6 task, có rủi ro cao ở transcript/model/Guided.
3. `structured-answer-retry`: bao phủ 3 task.
4. `readiness-checklist`, `speaking-coach`, `listen-classify-pronounce`.
5. Các archetype một task: mastery, ordering, writing capture và writing coach.

## 9. Nghiệm thu Bước 2

- [x] Có định nghĩa phân biệt archetype, variant và capability.
- [x] 32/32 task có đúng một primary archetype.
- [x] Không có mã task trùng, thiếu hoặc ngoài registry.
- [x] Mỗi archetype có task mẫu tham chiếu.
- [x] Có mức authoring để giới hạn quyền Admin.
- [x] Có danh sách ngoại lệ cần xử lý ở Bước 3–4.
- [x] Có bản ánh xạ JSON máy đọc được.
- [x] Không thay đổi runtime hoặc baseline của Bước 1.

Bản dữ liệu có thẩm quyền:
`DEVELOPER-HANDOVER/archetypes/task-archetype-map.json`.

