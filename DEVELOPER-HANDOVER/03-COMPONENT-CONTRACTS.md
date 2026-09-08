# Bước 3 — Component Contract chuẩn hóa

Phiên bản contract: `component-contracts-2.0.0`  
Kiến trúc tham chiếu: `architecture-3`  
Baseline tham chiếu: `react-foundation-2026-09-07-r3`

## 1. Kết quả và phạm vi

Bước 3 chuẩn hóa toàn bộ **42 component React** hiện có trong
`src/components`. Mỗi component đã có định danh, vai trò, mức độ cho phép Admin
cấu hình, props bắt buộc/tùy chọn, sự kiện, trạng thái và các ràng buộc sử dụng
trong file máy đọc được:

- `components/component-registry.json`
- `components/validate-component-registry.mjs`

Contract này là nền móng bàn giao cho dev. Nó không thay thế TypeScript props và
chưa phải task JSON schema của Bước 4.

## 2. Ba ranh giới không được trộn lẫn

### React API nội bộ

TypeScript props dùng để ghép component trong source. API này có thể chứa
`ReactNode`, callback, ref, `className` và thuộc tính DOM. Chỉ developer được sử
dụng các trường đó.

### Authoring API cho Admin

Admin chỉ làm việc với form sinh từ schema: chuỗi, media đã duyệt, danh sách có
giới hạn, enum, số trong khoảng và các block/archetype đã đăng ký. Admin không
được nhập JSX, HTML, JavaScript, CSS, callback, tên class, URL tùy ý hoặc prompt
hệ thống của AI.

### Trusted assessment API

Đáp án, accepted answers, rubric, score rule, mastery threshold, forced answer,
AI system/evaluation prompt, credentials và quyết định phân quyền không được gửi
trong payload authoring hoặc bundle dành cho học sinh. Component chỉ nhận kết
quả đã tính như `correct`, `score`, `mastered`, `guided` để hiển thị.

> Lưu ý chuyển đổi production: prototype hiện vẫn có một số answer key phía
> client để mô phỏng. Đây không phải contract production và phải được chuyển
> sang assessment service ở Bước 5/triển khai backend.

## 3. Phân tầng component

| Tầng | Trách nhiệm | Ví dụ | Admin |
|---|---|---|---|
| System shell | Trang, header, footer, router, keypad | `InteractiveTaskFrame`, `AppShell`, `CodeKeypadModal` | Không cấu hình trực tiếp |
| Presentation primitive | Hình thức chung, typography, status | `TutorBubble`, `StudentBubble`, `ActionButton`, `StatusTag` | Không chọn CSS/variant tùy ý |
| Interaction block | Nhận state, phát sự kiện người học | `ChoiceGroup`, `RecordingCard`, `SequenceOrderInput` | Cấu hình có giới hạn |
| Archetype orchestrator | Điều phối flow của một họ task | `GuidedChoiceTask`, `ListeningChoiceTask`, `RepairRecordingFlow` | Form theo archetype |

Component không tự quyết định mục tiêu sư phạm, đáp án, điểm, mastery, quyền truy
cập hoặc prompt AI. Những quyết định này thuộc task schema, assessment contract
và permission contract.

## 4. Contract chung bắt buộc

### State và sự kiện

- Input dùng lại phải là controlled component khi có state nghiệp vụ.
- Component phát intent như `onChoose`, `onCheck`, `onRetry`, `onConfirm`; runtime
  archetype quyết định state transition tiếp theo.
- Không nhánh theo task code trong component chung.
- Không dùng text hiển thị làm khóa nghiệp vụ; dùng ID ổn định.
- Timer, speech, recording simulation, listener và focus restoration phải cleanup
  khi unmount hoặc hủy.

### Accessibility và kiểm thử

- Mọi control có accessible name và thao tác được bằng bàn phím.
- Nhóm lựa chọn dùng semantics `radiogroup`/`radio`; tiến độ dùng progress
  semantics; lỗi quan trọng dùng alert/live-region phù hợp.
- Không chỉ dùng màu để biểu thị trạng thái.
- Test ưu tiên role + accessible name. Chỉ thêm `data-*` ổn định khi một danh
  sách lặp lại không thể định danh bằng semantics.

### Giao diện

- Font, màu, bubble, button, input, card, modal và avatar lấy từ Foundation chung.
- Task CSS chỉ xử lý layout đặc thù và phải scope bằng `.task-<mã>`.
- Admin không được nhập style inline, CSS class hay design token.
- `TutorAvatar` là nguồn avatar Tutor tập trung; task không truyền URL riêng.
- `TutorHeader` không hiển thị nút Back của ứng dụng. Người dùng vẫn có thể dùng
  lịch sử điều hướng của trình duyệt; task không tự gọi `navigate(-1)`.

### Nguyên tắc Book-first

- App hỗ trợ sách, không thay thế sách.
- Với câu hỏi lựa chọn dựa trên sách, giao diện chỉ hiển thị nhãn `A/B/C/...` và
  hướng dẫn/gợi ý; không chép nội dung đáp án từ sách sang app.
- Feedback và hint không được vô tình tiết lộ đáp án.
- Chỉ hiển thị model/answer khi learning design đã duyệt; thao tác đó phải chuyển
  trạng thái sang **Guided** và không được tính **Independent mastery**.

## 5. Mức mở cho Admin

| Mức | Ý nghĩa | Số component |
|---|---|---:|
| `system-only` | Hệ thống tự ghép; Admin không tạo trực tiếp | 19 |
| `content-only` | Chỉ sửa nội dung đã duyệt và bị giới hạn | 4 |
| `bounded-config` | Chọn enum/nhập dữ liệu theo validator | 16 |
| `archetype-form` | Cấu hình một archetype hoàn chỉnh | 2 |
| `developer-only` | Phải mở rộng contract bằng code/review | 1 |

Số liệu trên là policy của registry phiên bản này; Bước 4 sẽ ánh xạ các mức đó
thành field cụ thể trong task schema.

## 6. Contract của các block nghiệp vụ chính

| Component | Nhận vào | Phát ra | Điều không được làm |
|---|---|---|---|
| `ChoiceGroup` | options, selected value, wrong state | `change(value)` | Tự kiểm tra đáp án |
| `AnswerChoiceMatrix` | rows, map giá trị | `change(rowId, value)` | Chứa answer key |
| `RetryPanel` | attempt, prompt, hint, fields, feedback | field change, check | Tự quyết forced answer |
| `RecordingCard` | stage, transcript, giới hạn hiển thị | record/stop/retry/confirm | Tự cấp quyền mic hoặc chấm phát âm |
| `TranscriptConfirmation` | transcript | retry/confirm | Xem xác nhận ASR là câu trả lời đúng |
| `PlaybackSequence` | danh sách audio/text và timing preset | play/item complete/complete | Nhận credentials TTS |
| `SequenceOrderInput` | slots, choices, state chọn | select/choose/clear | Biết thứ tự đúng |
| `ProgressSteps` | step definitions + runtime status | Không | Suy ra điểm/mastery |
| `ScoreGrid` | kết quả tin cậy | Không | Tính score từ answer key |
| `MasteryGate` | `mastered` đã tính | Không | Tự phong mastery |
| `GuidedIndependentStatus` | mode đã tính, answerShown | Không | Cho Admin/người học tự đặt mode |
| `GuidedChoiceTask` | config archetype và runtime adapter | choose/check/retry/show answer | Đưa key production vào browser |
| `ListeningChoiceTask` | config choice + playback | play và assessment intent | Chấm trước khi điều kiện nghe hoàn tất |
| `RepairRecordingFlow` | transcript + assessment outcome | repair/model shown/complete | Coi `correct` là nội dung Admin nhập |

Chi tiết đủ 42 component nằm trong registry JSON. Registry là nguồn chuẩn để
dev tạo validator, Storybook stories, test matrix hoặc form metadata về sau.

Xác minh registry từ thư mục gốc của project:

```bash
node DEVELOPER-HANDOVER/components/validate-component-registry.mjs
```

## 7. Các điểm kỹ thuật cần dev xử lý tiếp

1. Nhiều prop interface đang khai báo cục bộ và chưa export. Khi xây package UI,
   nên export type công khai từ một barrel ổn định, không để Admin phụ thuộc vào
   TypeScript component props.
2. `ReactNode`, callbacks, refs và DOM attributes không serialize được. Bước 4
   phải ánh xạ chúng thành block ID, content field và action ID hữu hạn.
3. Recording và browser speech hiện là adapter mô phỏng/tham chiếu. Production
   cần adapter microphone, ASR, audio/TTS cùng contract permission/error/timeout.
4. `GuidedChoiceTask` và các cấu hình prototype còn chứa key phía client. Backend
   production phải trả outcome thay vì trả key.
5. `TaskCard`/`TaskPanel`, `ResultSummary`/summary panel và
   `TaskFooter`/`StatusFooter` có vùng chức năng gần nhau nhưng contract khác.
   Không gộp chỉ để giảm số component; chỉ hợp nhất khi semantics và test giống
   nhau qua nhiều archetype.
6. `StatusFooter` có default ID, vì vậy contract quy định singleton trong frame;
   surface đặc biệt có nhiều footer phải truyền ID duy nhất.

## 8. Quy tắc phát triển kho component

- Ưu tiên mở rộng component chung khi cùng semantics xuất hiện ở ít nhất hai task
  hoặc là yêu cầu nền tảng rõ ràng.
- Không thêm prop theo mã task hoặc prop mơ hồ như `specialMode`.
- Tính năng mới phải xác định state, event, accessibility, Book-first, Admin
  exposure, server-only boundary và test trước khi thêm vào registry.
- Thay đổi phá vỡ API phải tăng major version của component contract và có migration
  note; thay đổi tương thích tăng minor; sửa mô tả tăng patch.
- Component ngoại lệ chỉ được giữ khi archetype/block chuẩn không biểu đạt đúng
  hành vi; ngoại lệ phải có owner và điều kiện đưa vào kho chung.
- Runtime source chỉ được sửa sau khi baseline change policy được áp dụng.

## 9. Tiêu chí hoàn thành Bước 3

- [x] Kiểm kê đủ 42/42 component trong `src/components`.
- [x] Mỗi component có source, group, kind và mức Admin exposure.
- [x] Mỗi component có props, events, states và quy tắc sử dụng.
- [x] Đã tách React API, Admin authoring và trusted assessment API.
- [x] Đã ghi nhận Book-first, Guided/Independent và server-only boundary.
- [x] Registry JSON hợp lệ, không trùng ID/source và khớp filesystem.
- [x] Không sửa runtime React; baseline đã khóa vẫn phải xác minh 197/197.

## 10. Đầu vào cho Bước 4

Bước 4 sẽ dùng `task-archetype-map.json` cùng `component-registry.json` để tạo:

- task schema có version;
- block union hữu hạn;
- field-level authoring rules;
- JSON mẫu cho từng archetype;
- validator và fixtures hợp lệ/không hợp lệ;
- quy tắc migration schema.
