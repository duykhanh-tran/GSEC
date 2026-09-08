# Bước 6 — Developer Handover Package

Package version: `developer-handover-1.2.0`  
Ngày khóa: `07/09/2026`  
Phạm vi: 32 task `60111`–`60166`, 11 archetype, 42 component  
Trạng thái: **Hoàn thành**

## 1. Mục đích bàn giao

Gói này giúp đội dev xây hệ thống Admin, Giáo viên và Học sinh mà không phải
phân tích lại prototype từ đầu. Nó cung cấp:

- baseline React có checksum;
- catalog archetype và traceability 32 task;
- contract 42 component;
- task authoring JSON Schema và 11 mẫu;
- Assessment, AI, Permission schemas;
- policy/submission/outcome mẫu;
- fixture âm, validator và acceptance checklist.

Đây là **nền tảng thiết kế và contract**, không phải backend, CMS Admin hay hệ
thống phân quyền production đã được xây sẵn.

## 2. Thứ tự nguồn chuẩn

Khi hai nguồn có khác biệt, áp dụng thứ tự sau:

1. Security/permission/Book-first contract ở Bước 5.
2. Task authoring schema và JSON Schema ở Bước 4.
3. Component contract ở Bước 3.
4. Archetype catalog ở Bước 2.
5. Baseline và change policy ở Bước 1.
6. Prototype React để tham chiếu hành vi/giao diện.
7. HTML gốc chỉ dùng đối chiếu lịch sử, không phát triển tiếp.

Không suy answer key, prompt hoặc quyền production từ mã client prototype.

## 3. Bản đồ gói bàn giao

| Khu vực | Nguồn chính | Mục đích |
|---|---|---|
| Baseline | `01-REACT-BASELINE-INVENTORY.md`, `baseline/` | Chứng minh trạng thái source được bàn giao |
| Archetype | `02-TASK-ARCHETYPE-CATALOG.md`, `archetypes/` | Chọn template trước khi tạo task |
| Component | `03-COMPONENT-CONTRACTS.md`, `components/` | UI/state/event/Admin exposure |
| Task data | `04-TASK-SCHEMA-AND-EXAMPLES.md`, `task-schema/` | Form Admin và JSON task |
| Backend boundary | `05-ASSESSMENT-AI-PERMISSION-CONTRACTS.md`, `policies/` | Chấm điểm, AI, RBAC và consent |
| Triển khai | `IMPLEMENTATION-ROADMAP.md` | Thứ tự dev nên thực hiện |
| Kiểm thử | `TEST-AND-ACCEPTANCE.md` | Quality gates và Definition of Done |
| Khoảng trống | `KNOWN-GAPS-AND-DECISIONS.md` | Việc dev/product/legal còn phải quyết định |
| Integrity | `manifest/`, `verify-handover-package.mjs` | Kiểm tra gói không bị thiếu/thay đổi |

## 4. Traceability từ 32 task đến JSON mẫu

| Archetype | Task hiện có | JSON mẫu |
|---|---|---|
| `structured-answer-retry` | 60111, 60121, 60131 | `example-structured-answer-retry` |
| `guided-choice` | 60113, 60114, 60122, 60132, 60133, 60134, 60141, 60142, 60151, 60152, 60153 | `example-guided-choice` |
| `listen-classify-pronounce` | 60112, 60123 | `example-listen-classify-pronounce` |
| `recording-feedback` | 60116, 60124, 60125, 60135, 60143, 60163 | `example-recording-feedback` |
| `writing-capture-repair` | 60115 | `example-writing-capture-repair` |
| `mastery-review` | 60126 | `example-mastery-review` |
| `readiness-checklist` | 60154, 60165 | `example-readiness-checklist` |
| `speaking-coach` | 60144, 60155 | `example-speaking-coach` |
| `listening-choice-assessment` | 60161, 60162 | `example-listening-choice-assessment` |
| `sequence-ordering-repair` | 60164 | `example-sequence-ordering-repair` |
| `writing-coach` | 60166 | `example-writing-coach` |

Mapping variant/capability đầy đủ nằm trong
`archetypes/task-archetype-map.json`. Không tạo task thứ 33 bằng cách copy TSX;
chọn archetype và sinh JSON theo schema trước.

## 5. Cách dev bắt đầu

1. Sao chép gói và chạy `node DEVELOPER-HANDOVER/verify-handover-package.mjs`.
2. Đọc tài liệu Bước 5 trước khi thiết kế API hoặc database.
3. Chọn JSON Schema validator Draft 2020-12 cho cả API và Admin form.
4. Xây policy/version storage tách khỏi learner-safe task storage.
5. Làm vertical slice đầu tiên bằng `guided-choice` vì form-ready và không cần
   microphone/AI.
6. Chỉ sau khi vertical slice qua acceptance mới mở rộng sang recording, writing
   hoặc guarded-template.

Vertical slice đầu tiên phải chứng minh trọn đường:

```text
Author draft → validate → review → publish → teacher assign
→ learner attempt → server evaluate → safe outcome → teacher result
```

## 6. Các quy tắc không được phá vỡ

- Book-first: lựa chọn từ sách chỉ hiển thị ký hiệu, không chép nội dung đáp án.
- Admin không nhập JSX/HTML/CSS/JS/callback/raw prompt.
- Answer key/rubric/prompt/mastery rule/permission decision chỉ ở server.
- Xem model/answer luôn là Guided và không cấp independent mastery.
- Permission mặc định deny và kiểm tra phía server.
- Published task/policy revision immutable; chỉnh sửa tạo version mới.
- Recording cần consent, user gesture, secure context và retention policy.
- AI dùng input/output allowlist, schema validation và deterministic/teacher
  fallback; không dùng như open chat.

## 7. Definition of Ready để dev nhận việc

- [x] Baseline React được khóa và kiểm tra bằng checksum.
- [x] 32/32 task có primary archetype.
- [x] 42/42 component có contract.
- [x] 11/11 archetype có task JSON mẫu.
- [x] Các policy reference trong mẫu đều resolve.
- [x] Có schemas cho task, assessment submission/outcome, AI và permission.
- [x] Có fixture âm cho lỗi authoring và bảo mật.
- [x] Có lộ trình, test strategy, acceptance và known gaps.
- [x] Có manifest checksum và lệnh verify toàn gói.

## 8. Những gì không nằm trong phạm vi bàn giao

- Backend, database schema vật lý, deployment topology và cloud account.
- Authentication provider, tenant model và school/class roster integration.
- Giao diện Admin/Teacher production.
- Microphone, upload, ASR/TTS production và media lifecycle.
- Provider/model cụ thể, prompt thật, credentials và chi phí AI.
- Legal/privacy approval cho dữ liệu học sinh/trẻ em.
- Migration 32 task prototype sang database production.

Các mục trên là việc đội dev/product/security/legal triển khai dựa trên contract,
không phải thiếu sót cần đưa ngược vào client prototype.

## 9. Tiêu chí hoàn thành Bước 6

- [x] Có một điểm bắt đầu và thứ tự nguồn chuẩn rõ ràng.
- [x] Traceability đủ 32 task → 11 archetype → 11 JSON mẫu.
- [x] Có lộ trình triển khai theo vertical slice, không big-bang.
- [x] Có test/acceptance gate cho Admin, Teacher, Learner và backend.
- [x] Có danh sách known gaps/decisions và owner đề xuất.
- [x] Có manifest checksum cho toàn bộ gói.
- [x] Một lệnh kiểm định được Bước 1–5, manifest và baseline.
