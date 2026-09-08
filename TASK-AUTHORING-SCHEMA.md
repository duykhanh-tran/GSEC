# Schema biên soạn task React

Contract: `architecture-3`  
Schema version: `1`

## 1. Mục tiêu

Task mới chủ yếu được tạo bằng dữ liệu và flow block, không sao chép toàn bộ JSX,
CSS, timer, popup hoặc component nền. Schema tách ba loại dữ liệu:

1. Metadata/catalog: code và archetype.
2. Nội dung học tập: câu hỏi, đáp án, Demo, hint, rubric trong `data.ts`.
3. Runtime flow: các block hiện tại được tạo từ data và state rồi giao cho
   `TaskRenderer`.

## 2. Authoring schema

```ts
interface TaskAuthoringSchema {
  code: string
  archetypes: readonly TaskArchetype[]
  version: 1
}
```

`TASK_AUTHORING_SCHEMAS` phải có cùng tập mã với registry. Build/test thất bại
nếu thiếu task hoặc task không có archetype.

## 3. Runtime flow

```ts
type TaskFlowBlock =
  | { type: 'tutor-message'; id: string; content; speechText? }
  | { type: 'panel'; id: string; title; subtitle; stage?; variant?; content }
  | { type: 'custom'; id: string; content }
  | { type: 'celebration'; id: string; active; durationMs? }
```

`Task*.tsx` giữ state/reducer và tạo mảng block. `TaskFlowRenderer` chỉ switch
theo `block.type`; cấm rẽ nhánh theo `task.code`.

`custom` là cầu nối có kiểm soát cho composition chưa đủ điều kiện chuẩn hóa.
Nó không cho phép task sao chép header, keypad, bubble, retry, recording,
transcript, score, progress hoặc celebration đã có.

## 4. Block chuẩn và dữ liệu đầu vào

| Nhóm | Block/component | Dữ liệu do task cung cấp |
|---|---|---|
| Answer | `ChoiceGroup`, `AnswerChoiceMatrix` | option, value, disabled, callback |
| Retry | `RetryPanel`, `useRetryQueue` | attempt, hint, rule, field, queue event |
| Listening | `ListenButton`, `PlaybackSequence` | text/sequence, interval, callback |
| Recording | `RecordingCard`, `Waveform`, `RecordingTimer` | transcript, duration, phase callback |
| Transcript | `TranscriptConfirmation` | transcript, retry/confirm callback |
| Progress | `ProgressSteps` | step id/label/status |
| Assessment | `ScoreGrid`, `MasteryGate` | rubric/score và kết quả mastery đã tính |
| Reading | `GuidedIndependentStatus` | mode và answer-shown state |
| Effect | `Celebration` | active, duration và callback cleanup |

## 5. Ranh giới logic

- Component không đọc answer key hoặc tự tính đúng/sai.
- Renderer không biết mã task.
- Hook không chứa nội dung học tập.
- Reducer phức tạp vẫn ở `tasks/<mã>/reducer.ts`.
- Timer, speech, recording và animation phải cleanup khi unmount.
- Nội dung khác nhau không được biến thành hàng loạt boolean prop trên component.
- Một component mới chỉ được đưa vào thư viện chung khi có ít nhất hai trường hợp
  thật cùng contract hoặc là primitive bắt buộc của Foundation.

## 5.1. Ranh giới nội dung Book-first

Mọi cấu hình task phải tuân thủ `BOOK-FIRST-CONTENT-STANDARD.md`:

- Xác định nội dung đến từ `worksheet`, `app` hay `learner` trước khi tạo block.
- Với choice task dựa trên worksheet, ưu tiên để `bookCue` chỉ tham chiếu số
  câu/vị trí. `retryContent` có thể chứa question stem khi cần nhưng không được
  chứa option text hoặc answer content.
- Hint hỗ trợ cách nhìn lại sách, không thay thế sách hoặc làm lộ đáp án.
- Forced answer/show answer chỉ dùng ký hiệu đáp án và phải tạo evidence
  `Guided`.
- E2E phải bảo vệ việc retry không chứa nội dung bài tập bị cấm.

## 6. Quy trình thêm task ở Giai đoạn 6

1. Chọn archetype từ catalog.
2. Tạo typed `data.ts`.
3. Chọn state nhỏ hoặc reducer typed.
4. Tạo runtime flow từ block chuẩn.
5. Dùng `custom` chỉ cho ngoại lệ có ghi nhận.
6. Chạy test data/reducer/component/E2E và toàn bộ hồi quy.
7. Khi ngoại lệ lặp lần hai, đánh giá nâng thành block chuẩn trước task tiếp theo.
8. Chạy checklist Book-first cho entry, retry, hint, model và summary.
