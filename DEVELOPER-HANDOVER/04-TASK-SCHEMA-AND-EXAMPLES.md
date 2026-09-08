# Bước 4 — Task schema và JSON mẫu

Schema version: `1.0.0`  
Archetype catalog: `handover-archetypes-1`  
Component contract: `component-contracts-2.0.0`  
Trạng thái: **Hoàn thành**

## 1. Kết quả

Bước 4 chuyển catalog 11 archetype và contract 42 component thành một authoring
contract có thể dùng để xây form Admin. Bộ bàn giao gồm:

- `task-schema/task-authoring.schema.json`: JSON Schema Draft 2020-12 cho một
  task authoring document.
- `task-schema/examples/archetype-examples.json`: 11 task mẫu hợp lệ, mỗi
  archetype đúng một mẫu.
- `task-schema/fixtures/invalid-authoring-fixtures.json`: bảy phép biến đổi tạo
  payload không hợp lệ để kiểm tra guardrail.
- `task-schema/validate-task-authoring.mjs`: validator không cần dependency ngoài,
  kiểm tra coverage archetype, block reference và các policy an toàn quan trọng.

Đây là contract bàn giao, chưa thay thế dữ liệu prototype đang chạy và không sửa
`src/task-engine/schema.ts`. File TypeScript hiện tại là runtime composition API;
JSON Schema mới là Admin authoring DTO.

## 2. Cấu trúc một task

| Field | Mục đích | Ai sở hữu |
|---|---|---|
| `schemaVersion` | Chọn đúng contract để validate/migrate | Hệ thống |
| `id`, `code` | ID ổn định và mã điều hướng năm chữ số | Hệ thống/Admin được cấp quyền |
| `locale`, `status` | Ngôn ngữ và vòng đời nội dung | Workflow biên tập |
| `archetype`, `variant` | Chọn state flow chuẩn và biến thể hữu hạn | Admin qua form |
| `bookReference` | Nối hoạt động về worksheet/page/exercise | Content team |
| `presentation` | Tiêu đề, lời Tutor mở đầu/kết thúc | Content team |
| `capabilities` | Năng lực đã đăng ký, dùng để kiểm tra compatibility | Archetype form |
| `blocks` | Nội dung của các block authorable hữu hạn | Content team |
| `configuration` | Nối block vào slot bắt buộc của archetype | Wizard/runtime |
| `services` | Chỉ chứa opaque policy/media reference | Dev/authorized operator |
| `metadata` | Version nội dung, owner, thời điểm, tag | Workflow |

Không field nào trong tài liệu Admin được phép chứa JSX, HTML, callback, CSS,
class name, answer key, rubric, scoring rule, AI system prompt hoặc quyết định
phân quyền.

## 3. Block union hữu hạn

Schema cho phép 17 loại block:

| Nhóm | Block type |
|---|---|
| Nội dung | `tutor-message`, `book-reference` |
| Câu trả lời | `short-text-input`, `choice-group`, `answer-matrix` |
| Coaching | `retry-panel` |
| Nghe | `listening-playback`, `playback-sequence` |
| Nói | `recording` |
| Checklist | `readiness-checklist`, `writing-verification` |
| Sắp xếp | `sequence-order` |
| Viết | `draft-input`, `revision-input`, `draft-comparison`, `language-help` |
| Tiến độ | `progress-steps` |

Không có `custom`, `raw-html` hoặc `component-name` trong authoring schema.
Admin chọn block theo archetype; runtime ánh xạ block type sang component đã đăng
ký. Muốn thêm block mới, dev phải mở rộng component contract và tăng phiên bản
schema trước.

## 4. Ràng buộc riêng của 11 archetype

| Archetype | Slot cấu hình bắt buộc | Guardrail chính |
|---|---|---|
| `structured-answer-retry` | response blocks, retry block | Hoàn thành bằng evidence summary |
| `guided-choice` | choice blocks, retry, Guided tracking | Chỉ ký hiệu A/B/C; xem đáp án phải Guided |
| `listen-classify-pronounce` | playback, classification, recording | Đúng thứ tự nghe → chọn → nói |
| `recording-feedback` | recording blocks, repair | Transcript confirmation bắt buộc |
| `writing-capture-repair` | input blocks, preview, repair | Vẫn là developer-extension ở phiên bản 1 |
| `mastery-review` | evidence blocks, review blocks | Mastery nhận từ trusted service |
| `readiness-checklist` | readiness checklist | Chỉ mở khi mọi mục đã xác nhận |
| `speaking-coach` | rounds, recording, completion result | Kết quả từ trusted service |
| `listening-choice-assessment` | playback, choices, retry | Phải nghe trước khi chọn |
| `sequence-ordering-repair` | sequence, repair | Model exposure luôn chuyển Guided |
| `writing-coach` | draft, verification, revision, comparison | Mastery nhận từ trusted service |

Validator còn kiểm tra loại block được phép cho từng slot; một ID tồn tại nhưng
trỏ nhầm loại block vẫn bị từ chối.

## 5. Book-first được thực thi ở schema

- `bookReference` là bắt buộc ở mọi task.
- `choice-group` và `answer-matrix` chỉ nhận lựa chọn ký hiệu
  `A/B/C/D/E/F/T`; không có field chứa nội dung đáp án.
- Hint có giới hạn số lượng/độ dài và bị policy validator kiểm tra key nhạy cảm.
- Audio dùng `audioAssetId`, không nhận URL hoặc credential tùy ý.
- Model/answer không được nhúng trong payload. Khi được phép hiển thị, nội dung
  phải đến từ trusted assessment service và runtime ghi nhận Guided.

## 6. Ranh giới với Bước 5

Schema này chỉ khai báo các reference:

- `assessmentPolicyRef`
- `aiPolicyRef`
- `permissionPolicyRef`
- `mediaCollectionRef`

Nội dung policy, answer key, rubric, threshold, prompt, model provider,
credential, retention và permission decision không thuộc task JSON. Bước 5 sẽ
định nghĩa contract cho các service đó.

Task có block `recording` phải có `permissionPolicyRef`. Task cần kết quả mastery
chỉ ghi `trusted-service`; không ghi threshold hoặc thuật toán chấm trong JSON.

## 7. Vòng đời authoring đề xuất

1. Admin chọn archetype và variant từ catalog.
2. Form chỉ hiện block/field được schema cho phép.
3. Payload được validate bằng JSON Schema và policy validator.
4. Content reviewer kiểm tra Book-first, lời hướng dẫn và hint.
5. Authorized operator gắn policy/media reference đã tồn tại.
6. Task chuyển `draft` → `in-review` → `approved` → `published`.
7. Bản `published` là immutable; chỉnh sửa tạo `contentVersion` mới.

Không cho phép chuyển thẳng từ `draft` sang `published` ở workflow production.
Ràng buộc trạng thái này thuộc permission/workflow contract của Bước 5.

## 8. Version và migration

- `schemaVersion` dùng semantic versioning.
- Patch: sửa mô tả/validator không thay đổi payload hợp lệ.
- Minor: thêm field hoặc enum tương thích ngược; field mới phải optional hoặc có
  default migration rõ ràng.
- Major: xóa/đổi tên field, đổi semantics, thay state flow hoặc làm payload cũ
  không còn hợp lệ.
- `contentVersion` tăng mỗi lần nội dung task được duyệt lại; độc lập với
  `schemaVersion`.
- Mỗi major/minor schema phải có migration thuần dữ liệu, fixture trước/sau và
  khả năng dry-run. Không migrate trực tiếp bản published mà không tạo revision.
- Runtime nên hỗ trợ phiên bản hiện tại và một phiên bản trước trong thời gian
  chuyển tiếp; phiên bản cũ hơn phải migrate trước khi publish lại.

## 9. Cách xác minh

Từ thư mục `Propotype-React` chạy:

```bash
node DEVELOPER-HANDOVER/task-schema/validate-task-authoring.mjs
```

Kết quả khóa của Bước 4:

- 11/11 archetype có mẫu hợp lệ.
- 7/7 fixture sai bị từ chối đúng policy dự kiến.
- ID block không trùng và mọi block reference đều resolve đúng loại.
- Không có server-only field trong các mẫu.
- Baseline React vẫn 197/197 file.

Khi dev xây backend/Admin, JSON Schema nên được chạy bằng validator Draft
2020-12 tiêu chuẩn tại cả client form và API. Policy validator phải tiếp tục chạy
ở server vì client validation không phải ranh giới bảo mật.

## 10. Tiêu chí hoàn thành Bước 4

- [x] Schema chung có version và cấm field ngoài contract.
- [x] Có discriminated configuration cho đủ 11 archetype.
- [x] Có block union hữu hạn, không cho raw/custom composition.
- [x] Có 11 JSON mẫu không chứa đáp án bí mật.
- [x] Có fixture âm cho các lỗi bảo mật/nghiệp vụ chính.
- [x] Có validator kiểm tra coverage, reference, Book-first và server boundary.
- [x] Có quy tắc version, migration và publishing handoff.
- [x] Không thay đổi runtime hoặc baseline đã khóa.
