# Bước 5 — Assessment, AI và Permission Contracts

Contract version: `1.0.0`  
Task schema tham chiếu: `1.0.0`  
Trạng thái: **Hoàn thành**

## 1. Mục tiêu và kết quả

Bước 5 định nghĩa ranh giới backend mà dev cần để biến prototype thành hệ thống
có Admin, Giáo viên và Học sinh mà không đưa logic nhạy cảm vào trình duyệt.

Bộ bàn giao gồm năm JSON Schema:

- `assessment-policy.schema.json`: đáp án, rubric, retry và mastery phía server.
- `assessment-submission.schema.json`: dữ liệu học sinh được phép gửi lên.
- `assessment-outcome.schema.json`: kết quả đã làm sạch trả về client.
- `ai-policy.schema.json`: use case, input/output, guardrail, fallback và privacy.
- `permission-policy.schema.json`: RBAC và quyền runtime như microphone.

Kèm theo đó là catalog policy mẫu, submission/outcome mẫu, 10 fixture sai và
validator đối chiếu mọi `*PolicyRef` từ task JSON của Bước 4.

Các ví dụ answer key trong catalog hoàn toàn là dữ liệu tổng hợp phục vụ bàn
giao. Toàn bộ assessment/AI policy phải nằm ngoài public assets và client bundle.

## 2. Trust boundary bắt buộc

```text
Admin form ── task authoring JSON ──> Content API
                                       │
Learner UI ── safe submission ───────> Assessment API
                                       ├── private assessment policy
                                       ├── private AI policy / prompt service
                                       └── server permission decision
Learner UI <── safe outcome ──────────┘
Teacher UI <── assigned results / review queue
```

- Client không được tải answer key, accepted answers, rubric, threshold, prompt
  template, model credentials hoặc permission rules đầy đủ.
- Ẩn nút trong UI chỉ là trải nghiệm; server vẫn phải authorize mọi request.
- `assessmentPolicyRef`, `aiPolicyRef`, `permissionPolicyRef` là opaque ID.
- Mỗi submission gắn `taskContentVersion` và `policyRef` để kết quả có thể audit
  và không bị chấm bằng policy mới ngoài ý muốn.

## 3. Assessment contract

### Submission từ học sinh

Submission chỉ chứa:

- ID submission, task, content version, policy reference và session reference
  không mang thông tin định danh trực tiếp;
- response thuộc một trong sáu loại: `short-text`, `symbolic-choice`, `sequence`,
  `speech`, `writing`, `evidence`;
- client context và support event như hint/model/replay;
- timestamp.

Support event do client gửi chỉ là tín hiệu để đối chiếu. Server phải dùng event
log đã xác thực để quyết định Guided/Independent. `submissionId` phải được xử lý
idempotent để gửi lại do mất mạng không tạo attempt/điểm trùng.

### Policy riêng tư phía server

Assessment policy sở hữu:

- exact-match/normalization;
- symbolic choice key;
- sequence key;
- rubric hoặc AI policy reference;
- số attempt, retry queue, hint/model exposure;
- mastery rule và điều kiện independent-only.

Policy luôn có classification `server-confidential`, không cache hoặc trả cho
learner client. Bản policy approved phải immutable; thay đổi tạo version mới.

### Outcome trả về client

Outcome chỉ trả status, score, support mode, `answerShown`,
`independentMastery`, feedback code, item sai và next action. Nó không trả đáp án
đúng, rubric hay prompt.

Invariant bắt buộc:

- `score <= maxScore`;
- `answerShown = true` kéo theo `supportMode = guided`;
- Guided hoặc answer-shown không thể cấp `independentMastery`;
- low-confidence AI chuyển `pending-review` hoặc fallback, không tự đoán kết quả.

### Trình tự xử lý chuẩn

1. Authenticate session và authorize quyền `attempt`.
2. Resolve đúng published task revision và policy version.
3. Validate submission; từ chối field lạ và payload quá giới hạn.
4. Kiểm tra điều kiện flow phía server, ví dụ phải nghe trước khi chọn.
5. Chấm deterministic trước; chỉ gọi AI khi policy yêu cầu.
6. Tính retry/Guided/mastery từ event và policy tin cậy.
7. Lưu audit event và trả learner-safe outcome.

## 4. AI contract

AI chỉ được dùng trong bốn use case hữu hạn:

- `speech-feedback`
- `writing-feedback`
- `speaking-coach`
- `writing-coach`

Mỗi policy phải tham chiếu provider profile và prompt template đã được quản trị ở
server; không nhúng prompt hoặc credential trong task JSON/policy catalog xuất
cho client.

Contract khóa các điểm sau:

- input allowlist, giới hạn ký tự và reject field lạ;
- structured output schema, feedback code allowlist và tối đa 1–5 feedback item;
- Book-first, không tiết lộ đáp án, không open chat, không quyết định permission
  hoặc independent mastery;
- coi nội dung học sinh là dữ liệu, không phải instruction;
- timeout tối đa 30 giây, retry tối đa một lần;
- invalid output/low confidence dùng deterministic fallback hoặc teacher review;
- redact direct identifier và retention tối đa 30 ngày.

Audio thô không được gửi cho model nếu policy chỉ cho transcript. Việc dùng model
với trẻ em, consent, data residency và nhà cung cấp cụ thể phải được đội pháp
lý/bảo mật duyệt trước production; contract này không thay thế phê duyệt đó.

## 5. Permission contract

### Nguyên tắc

- `defaultEffect = deny`.
- Quyết định được đánh giá phía server và hành động bị từ chối được audit.
- Scope là `own`, `assigned`, `organization` hoặc `service`.
- Tác giả không duyệt task của chính mình.
- Thay đổi policy cần reviewer.
- Published revision là immutable.

### Ma trận quyền cơ sở

| Vai trò | Được phép chính | Không được phép |
|---|---|---|
| Content author | Tạo/sửa draft của mình, gửi review | Tự approve/publish |
| Content reviewer | Đọc và approve draft trong tổ chức | Sửa answer/policy ngoài workflow |
| Platform admin | Publish/archive bản đã duyệt, quản lý policy có review | Bỏ qua separation of duties |
| Teacher | Đọc/giao task published, xem kết quả lớp được giao | Sửa/publish task hoặc policy |
| Learner | Đọc/làm task được giao, xem kết quả của mình | Xem đáp án/policy/dữ liệu người khác |
| Assessment service | Đọc attempt và evaluate trong service scope | Quyền giao diện người dùng |
| AI service | Xử lý request AI đã kiểm soát | Tự publish, authorize hoặc cấp mastery |

Dev cần bổ sung tenant/school/class ownership vào cơ chế authorize thực tế.
Không suy scope chỉ từ ID do client gửi.

### Microphone và dữ liệu thu âm

Policy `learner-microphone-v1` yêu cầu:

- user gesture, consent và secure context;
- mặc định từ chối;
- có hành vi rõ khi permission bị từ chối;
- mặc định không lưu raw media và retention bằng 0.

Nếu sản phẩm cần lưu recording, phải tạo policy version mới, nêu mục đích, thời
hạn, quyền xóa/xuất và review pháp lý; không chỉ đổi boolean trong UI.

## 6. Audit và quan sát hệ thống

Ít nhất cần audit các sự kiện:

- task revision tạo/gửi duyệt/approve/publish/archive;
- assessment/AI/permission policy tạo, duyệt, retire;
- attempt accepted/rejected/evaluated, policy version đã dùng;
- hint, deep hint, model hoặc answer được hiển thị;
- AI fallback, invalid output, low confidence và teacher override;
- permission denied, consent granted/revoked, media created/deleted.

Audit log không lưu secret/prompt/answer thừa và không được dùng như kho audio.
Mọi export kết quả cần permission riêng và logging.

## 7. API handoff tối thiểu cho dev

Tên endpoint có thể thay đổi, nhưng semantics nên giữ:

| Operation | Request | Response |
|---|---|---|
| Tạo/sửa task draft | Task authoring schema | Revision + validation errors |
| Submit assessment | Assessment submission | Assessment outcome |
| Lấy task học sinh | Published learner-safe task DTO | Không có policy bí mật |
| Teacher review | Attempt/result reference + decision | Versioned reviewed outcome |
| Policy management | Private policy schema | Versioned policy metadata |
| Capability check | Actor/session + capability | Allow/deny + reason code |

Error trả về client dùng code ổn định như `NOT_AUTHORIZED`, `POLICY_RETIRED`,
`TASK_VERSION_MISMATCH`, `INVALID_SUBMISSION`, `REVIEW_REQUIRED`,
`SERVICE_UNAVAILABLE`; không trả stack trace hay chi tiết policy.

## 8. Xác minh

Từ thư mục `Propotype-React` chạy:

```bash
node DEVELOPER-HANDOVER/policies/validate-policy-contracts.mjs
```

Validator kiểm tra:

- mọi internal `$ref` của năm schema;
- mọi policy ID duy nhất;
- 10 assessment, 4 AI và 2 permission policy;
- 100% `*PolicyRef` trong 11 task mẫu của Bước 4 được resolve;
- invariant server-only, Book-first, Guided/Independent và RBAC;
- hai submission, bốn outcome an toàn;
- 10 fixture sai bị từ chối đúng rule.

Khi triển khai, API phải chạy thêm JSON Schema validator Draft 2020-12 tiêu
chuẩn. Validator bàn giao này tập trung vào cross-file reference và invariant
nghiệp vụ/bảo mật, không thay thế validation tại API gateway.

## 9. Tiêu chí hoàn thành Bước 5

- [x] Assessment policy tách khỏi submission và client-safe outcome.
- [x] Answer/rubric/mastery rule được đánh dấu server-confidential.
- [x] AI có input/output allowlist, guardrail, fallback, privacy và audit.
- [x] Permission mặc định deny, server-evaluated và có separation of duties.
- [x] Admin, Teacher, Learner và service roles có baseline quyền rõ ràng.
- [x] Microphone có consent, gesture, secure-context và retention contract.
- [x] Policy reference của toàn bộ 11 task mẫu đều resolve.
- [x] Có schema, ví dụ, fixture âm và validator chạy thành công.
- [x] Không thay đổi runtime React hoặc baseline đã khóa.

