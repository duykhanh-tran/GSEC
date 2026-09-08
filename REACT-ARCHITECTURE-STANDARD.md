# Tiêu chuẩn kiến trúc React — AI Tutor GSEC 6

Phiên bản: `architecture-3`  
Ngày khóa: `07/09/2026`  
Phạm vi: 32 task `60111`–`60166` và các worksheet mở rộng sau khi được duyệt

Tài liệu này là contract bắt buộc từ Giai đoạn 5.5. Nếu mã và tài liệu khác nhau,
không chuyển task tiếp theo cho đến khi sửa mã hoặc duyệt phiên bản contract mới.

Contract bàn giao chi tiết của đủ 42 component được khóa tại
`DEVELOPER-HANDOVER/03-COMPONENT-CONTRACTS.md` và
`DEVELOPER-HANDOVER/components/component-registry.json`. Khi chuẩn bị hệ thống
Admin/Teacher/Student, hai tài liệu đó là nguồn chuẩn cho ranh giới authoring và
server-only; phần mô tả dưới đây tiếp tục là chuẩn kiến trúc runtime prototype.

Task authoring DTO và block union dành cho hệ thống Admin được định nghĩa tại
`DEVELOPER-HANDOVER/04-TASK-SCHEMA-AND-EXAMPLES.md` và
`DEVELOPER-HANDOVER/task-schema/task-authoring.schema.json`. Không serialize trực
tiếp `TaskFlowBlock` chứa `ReactNode`/callback của runtime thành dữ liệu Admin.

Ranh giới Assessment/AI/Permission phía server và learner-safe submission/outcome
được định nghĩa tại
`DEVELOPER-HANDOVER/05-ASSESSMENT-AI-PERMISSION-CONTRACTS.md`. Runtime prototype
không được xem là nơi thực thi bảo mật, chấm điểm production hoặc quản trị prompt.

## 1. Stack đã khóa

- React 19 + TypeScript strict + Vite.
- React Router là tầng điều hướng duy nhất.
- State cục bộ dùng `useState` hoặc `useReducer`; không thêm global-state library.
- CSS Foundation dùng token; CSS task được scope bằng `.task-<mã>`.
- Vitest/Testing Library cho unit/component và Playwright cho E2E.
- Không thêm framework, backend, microphone/STT thật hoặc persistence nếu chưa được duyệt.

## 2. Ranh giới các tầng

| Tầng | Sở hữu | Không được sở hữu |
|---|---|---|
| `app/` | Registry, route, metadata, task không tồn tại | Đáp án hoặc phase của task |
| `styles/` | Token và style component chung | Ngoại lệ riêng của một task |
| `components/` | UI dùng lại, không có logic sư phạm | Đáp án, scoring, hint riêng |
| `hooks/` | Side effect có cleanup | Nội dung học tập |
| `task-engine/schema.ts` | Kiểu archetype, block và authoring contract | Nội dung riêng của một task |
| `task-engine/catalog.ts` | Phân loại đủ 32 task | State runtime hoặc JSX task |
| `task-engine/TaskRenderer.tsx` | Ghép frame và flow block | Nhánh theo mã task |
| `task-engine/TaskFlowRenderer.tsx` | Render block theo `type` | `if (task.code === ...)` |
| `tasks/<mã>/data.ts` | Nội dung, key, Demo, hint, rubric | DOM hoặc side effect |
| `tasks/<mã>/reducer.ts` | State transition phức tạp | Timer, speech, scroll |
| `tasks/<mã>/Task*.tsx` | Tạo runtime block từ data/state/event | Registry/keypad hoặc UI chung riêng |
| `tasks/<mã>/task.css` | Layout/trạng thái riêng đã scope | Avatar, bubble, font/theme chung |

## 3. Component contract bắt buộc

### Khung trang

- Task tương tác dùng `InteractiveTaskFrame`.
- Frame là nơi duy nhất ghép `AppShell`, `TutorHeader`, router và
  `CodeKeypadModal` cho task.
- `TutorHeader` không có nút Back; không task nào tự thêm điều hướng Back vào
  header. Lịch sử Back/Forward của trình duyệt vẫn được giữ nguyên.
- Task truyền `task`, class `.task-<mã>`, footer và nội dung chat; không tự tạo
  keypad/header thứ hai.

### Footer

Hai contract được giữ riêng, không gộp thành prop variant:

- `TaskFooter`: phần trăm tiến độ + progressbar semantics.
- `StatusFooter`: title + status + action cuối.

Lý do: hai footer biểu diễn hai mô hình thông tin khác nhau. Việc gộp sẽ tạo
props loại trừ lẫn nhau và làm yếu accessibility contract.

### Chat và nội dung

- `ChatRow`, `TutorBubble`, `StudentBubble`, `TutorAvatar` là bắt buộc.
- `TaskPanel` dùng cho card có header/body chuẩn và summary.
- `ActionButton` dùng cho hành động primary/secondary/success thông thường.
- `StatusTag` dùng cho trạng thái success/error/warning.
- Control mang semantics riêng như lựa chọn đáp án, checklist hoặc record trigger
  có thể dùng button riêng nhưng vẫn phải có accessible name và disabled native.

### Block tương tác chuẩn

- Answer: `ChoiceGroup`, `AnswerChoiceMatrix`.
- Retry: `RetryPanel`; queue đơn giản dùng `useRetryQueue`, queue nghiệp vụ phức
  tạp vẫn dùng reducer của task.
- Listening: `ListenButton`, `PlaybackSequence`.
- Recording: `RecordingCard`, `Waveform`, `RecordingTimer`,
  `TranscriptConfirmation`.
- Progress: `ProgressSteps`, `ScoreGrid`, `MasteryGate`,
  `GuidedIndependentStatus`.
- Effect: `Celebration` tự cleanup timer.

Các block không biết đáp án, hint, chuẩn mastery hoặc nội dung học tập. Task truyền
dữ liệu và callback vào block. Thành phần chỉ xuất hiện ở một task dùng block
`custom`; chỉ nâng thành block chuẩn khi ít nhất hai trường hợp thật có cùng
semantics và contract.

## 3.1. Task renderer contract

- Mọi task đã migrate đi qua `TaskRenderer`; chỉ `TaskRenderer` được ghép
  `InteractiveTaskFrame`.
- Flow được mô tả bằng `TaskFlowBlock[]`; renderer chuyển theo `block.type`, không
  chuyển theo mã task.
- `custom` là escape hatch có kiểm soát cho UI đặc thù, không được dùng để sao
  chép lại component chuẩn.
- `TASK_AUTHORING_SCHEMAS` phải chứa đúng một bản phân loại cho mỗi mã trong
  registry và ít nhất một archetype.
- Archetype mô tả năng lực; không quyết định nội dung, đáp án hoặc thứ tự phase.

## 3.2. Book-first / Worksheet-first contract

- `BOOK-FIRST-CONTENT-STANDARD.md` là contract nội dung bắt buộc cho mọi task.
- Sách/worksheet là nguồn bài học chính; app không được tái tạo nội dung phương
  án, đáp án, bảng hoặc ngữ cảnh đủ để thay thế sách.
- Với task lựa chọn dựa trên worksheet, app có thể hiển thị câu hỏi khi cần,
  nhưng các control và phương án chỉ được hiển thị dưới dạng ký hiệu như
  `A / B / C` hoặc `T / F`, kèm hint không thay thế sách.
- Mặc định `bookCue` chỉ tham chiếu số câu. `retryContent` có thể chứa question
  stem nhưng không được chứa option text hoặc answer content.
- Show answer sau learning gate chỉ hiển thị ký hiệu đáp án và phải ghi nhận
  `Guided`; không tính là independent mastery.
- Ngoại lệ app-native, learner transcript, accessibility hoặc model phải được
  đặc tả rõ theo mục Ngoại lệ của contract Book-first.

## 4. State contract

### Dùng `useState`

Dùng khi state độc lập hoặc luồng tuyến tính nhỏ: toggle, cờ cảnh báo, completion
gate, transcript hiện tại. Ví dụ chuẩn: `60154` và phase bậc cao của `60155`.

### Dùng `useReducer`

Bắt buộc khi có queue, retry nhiều cấp, nhiều transition phụ thuộc nhau, forced
answer hoặc cần audit lịch sử. Ví dụ chuẩn: `60131`.

Reducer phải:

1. Có state/action typed và initial state xuất được để test.
2. Thuần, không timer, DOM, random, speech hoặc navigation.
3. Không suy ra correctness từ class CSS hoặc nội dung DOM.
4. Giữ phase/queue/attempt dưới dạng dữ liệu rõ ràng.
5. Không sửa object/array state tại chỗ.

## 5. Side-effect contract

- `useAutoScroll`: ref cục bộ, một timeout tại một thời điểm, hủy khi dependency
  đổi hoặc unmount.
- `useTaskTimers`: đăng ký mọi timeout của chuỗi nghiệp vụ và hủy khi unmount.
- `useRecordingSimulation`: quản lý interval/timer recording, reset và cleanup;
  không xin quyền microphone.
- `useSpeechSynthesis`: cancel lượt cũ, `en-US`, rate `0.92`, fallback im lặng khi
  trình duyệt không hỗ trợ và cancel khi unmount.
- Side effect không được đặt trong reducer hoặc module scope.
- StrictMode không được tạo hai timer, hai message hoặc hai lần hoàn tất.

## 6. Data và JSX contract

- Nội dung học tập phải là typed data hoặc JSX; React chịu trách nhiệm escape.
- Cấm `innerHTML`, `insertAdjacentHTML`, `document.write` và
  `dangerouslySetInnerHTML`.
- Cấm `document.querySelector` để điều khiển React UI.
- Giữ `data-stage`, `data-question`, `data-attempt`, `data-tag` và selector ổn
  định đang được E2E sử dụng.
- ID liên kết dùng `useId`; không sao chép ID giữa task.

## 7. CSS contract

- Task CSS bắt đầu bằng `.task-<mã>` và mọi selector riêng nằm dưới scope đó.
- Task không ghi đè `.ui-avatar`, `.chat-row`, `.chat-bubble`,
  `.chat-bubble--tutor`, `.chat-bubble--student` hoặc font hệ thống.
- Animation riêng phải có tên chứa mã task.
- Màu/radius/font dùng token nếu Foundation đã có token tương ứng.
- Hai viewport bắt buộc: `390×844` và `1024×900`; không được tràn ngang.

## 8. Cổng chuyển từng task ở Giai đoạn 6

Theo đúng thứ tự:

1. Đọc đủ HTML/CSS/JS, báo cáo và test baseline.
2. Lập state/event/guard/side-effect map.
3. Tách typed data; chọn `useState` hoặc reducer theo contract.
4. Tạo `TaskFlowBlock[]`, dùng component/hook đã khóa; chỉ thêm abstraction khi
   có hai trường hợp thật.
5. Chạy unit/data/reducer test và E2E riêng.
6. Chạy hồi quy Foundation và mọi task React đã đạt.
7. Kiểm tra hai viewport, console/page error, URL/keypad và source hash.
8. Ghi báo cáo task; chỉ sau khi đạt mới bắt đầu task tiếp theo.

## 9. Test contract

Các lệnh bắt buộc:

```text
npm run lint
npm run test
npm run build
npm run test:e2e
npm run test:e2e:preview
npm run verify:baselines
```

`architecture-contract.test.ts` bảo vệ API DOM bị cấm, scope CSS Foundation,
renderer chung và việc task không tự tạo frame. `hooks.test.tsx` bảo vệ cleanup
timer/recording/scroll. `task-engine-catalog.test.ts` bảo vệ phân loại đủ 32 task.

## 10. Quản lý thay đổi

Thay đổi contract này cần:

1. Một trường hợp thực tế hoặc lỗi chứng minh nhu cầu.
2. Test bảo vệ trước/sau thay đổi.
3. Hồi quy toàn bộ task đã đạt.
4. Cập nhật phiên bản tài liệu và báo cáo.
5. Người dùng duyệt nếu thay đổi nội dung, hành vi, thiết kế, stack hoặc phạm vi.

Contract `architecture-3` bổ sung Book-first sau khi xác nhận vi phạm thực tế ở
`60122` và `60132`. Mọi task đã migrate và task thêm mới đều phải qua kiểm tra
nội dung Book-first trước khi được nghiệm thu hoàn toàn.
