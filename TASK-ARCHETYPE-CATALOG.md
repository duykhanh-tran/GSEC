# Danh mục archetype task — GSEC 6

> **Phạm vi lịch sử/kỹ thuật:** 15 nhãn trong tài liệu này là các capability có
> thể ghép lại, không phải 15 authoring template độc lập. Catalog primary
> archetype dành cho bàn giao dev nằm tại
> `DEVELOPER-HANDOVER/02-TASK-ARCHETYPE-CATALOG.md`; bản máy đọc được nằm tại
> `DEVELOPER-HANDOVER/archetypes/task-archetype-map.json`.

Phiên bản catalog: `1`  
Contract: `architecture-3`

Catalog này phân loại năng lực của đủ 32 task. Một task có thể ghép nhiều
archetype; archetype không chứa nội dung, đáp án hoặc scoring.

## 1. Mười lăm archetype

| Archetype | Trách nhiệm |
|---|---|
| `answer-entry` | Nhập đáp án chữ hoặc điền nhiều ô |
| `choice-assessment` | A/B/C, đúng/sai hoặc ma trận lựa chọn |
| `retry-coaching` | Queue câu sai, hint nhiều cấp, forced answer/transfer |
| `listening` | TTS một câu hoặc chuỗi phát lại |
| `speech-recording` | Recording mô phỏng, waveform và timer |
| `transcript-repair` | Xác nhận transcript, thu lại, phân biệt ASR/language error |
| `writing-repair` | Soạn, preview và sửa nội dung viết |
| `readiness-checklist` | Checklist chuẩn bị trước hoạt động |
| `mastery-review` | Rubric, score, mastery gate và targeted practice |
| `role-play` | Hội thoại nhiều lượt và round |
| `reading-comprehension` | Đọc hiểu, bằng chứng và Guided/Independent |
| `listening-assessment` | Listening gate kết hợp lựa chọn và evidence |
| `sequence-ordering` | Nhập, kiểm tra và sửa thứ tự |
| `writing-readiness` | Chuẩn bị/checklist trước khi chuyển sang writing coach |
| `writing-coach` | So sánh bản viết, phản hồi, revision và mastery |

## 2. Ma trận đủ 32 task

| Task | Archetype |
|---|---|
| `60111` | answer-entry, retry-coaching |
| `60112` | listening, speech-recording, retry-coaching |
| `60113` | listening, choice-assessment, retry-coaching |
| `60114` | listening, choice-assessment, retry-coaching |
| `60115` | writing-repair, listening |
| `60116` | speech-recording, transcript-repair, retry-coaching |
| `60121` | answer-entry, retry-coaching |
| `60122` | choice-assessment, retry-coaching |
| `60123` | listening, choice-assessment, speech-recording |
| `60124` | speech-recording, transcript-repair |
| `60125` | speech-recording, transcript-repair |
| `60126` | choice-assessment, retry-coaching, mastery-review |
| `60131` | answer-entry, retry-coaching |
| `60132` | choice-assessment, retry-coaching |
| `60133` | choice-assessment, retry-coaching |
| `60134` | choice-assessment, retry-coaching |
| `60135` | speech-recording, transcript-repair, writing-repair |
| `60141` | answer-entry, retry-coaching |
| `60142` | choice-assessment, retry-coaching |
| `60143` | role-play, speech-recording, transcript-repair |
| `60144` | role-play, speech-recording, transcript-repair, mastery-review |
| `60151` | reading-comprehension, choice-assessment, retry-coaching |
| `60152` | reading-comprehension, choice-assessment, retry-coaching |
| `60153` | reading-comprehension, answer-entry, retry-coaching |
| `60154` | readiness-checklist |
| `60155` | role-play, speech-recording, transcript-repair, mastery-review |
| `60161` | listening, listening-assessment, choice-assessment, retry-coaching |
| `60162` | listening, listening-assessment, choice-assessment, retry-coaching |
| `60163` | speech-recording, transcript-repair, writing-repair |
| `60164` | sequence-ordering, retry-coaching, writing-repair |
| `60165` | writing-readiness, readiness-checklist |
| `60166` | writing-coach, speech-recording, transcript-repair, writing-repair, mastery-review |

## 3. Ngoại lệ dự kiến

- `60115`: paragraph preview/editor vẫn là composition riêng.
- `60123`: timeline phát âm là composition của `PlaybackSequence` và recording.
- `60134`: day strip Monday–Friday là block `custom` cục bộ.
- `60144`: state machine role-play thuộc reducer task, không thuộc renderer.

Nếu cùng một ngoại lệ xuất hiện ở task thứ hai với cùng semantics, phải đánh giá
nâng thành block chuẩn và bổ sung test contract trước khi tái sử dụng.
