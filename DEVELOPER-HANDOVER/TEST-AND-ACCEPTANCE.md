# Test strategy và Acceptance Checklist

## 1. Test pyramid bắt buộc

| Tầng | Mục tiêu | Gate tối thiểu |
|---|---|---|
| Contract | JSON Schema, reference, version, unknown fields | Mọi mẫu đạt, mọi fixture âm bị chặn |
| Unit | Reducer, scoring deterministic, normalization, permission decision | Branch quan trọng và invariant đạt |
| Component | State/event/accessibility của 42 component | Keyboard, focus, role/name, cleanup |
| API integration | Authz, version pin, idempotency, server-only boundary | Không secret trong response/log |
| E2E portal | Author→publish→assign→attempt→result | Ba vai trò và scope đúng |
| Security/privacy | IDOR, privilege escalation, injection, media retention | Deny-by-default và audit |
| Parity | Hành vi học tập so với prototype | Book-first và completion contract giữ nguyên |

## 2. Gate hiện có của gói bàn giao

```bash
node DEVELOPER-HANDOVER/verify-handover-package.mjs
```

Lệnh trên kiểm tra:

- 42/42 component registry;
- 11/11 archetype JSON và 7 authoring fixture âm;
- 10 assessment, 4 AI, 2 permission policy;
- 2 submission, 4 outcome và 10 policy fixture âm;
- checksum package manifest;
- baseline React 197/197 file.

## 3. Acceptance — Admin/Content

- [ ] Chỉ chọn archetype/variant/block được đăng ký.
- [ ] Không có field JSX, HTML, CSS, JS, callback, answer key hoặc raw prompt.
- [ ] Choice từ sách chỉ nhận nhãn ký hiệu.
- [ ] Form hiển thị lỗi theo field và không mất draft khi validation thất bại.
- [ ] Preview dùng learner-safe DTO.
- [ ] Content author không tự approve/publish.
- [ ] Published revision không sửa trực tiếp.
- [ ] Diff và audit hiện rõ content/schema/policy version.

## 4. Acceptance — Teacher

- [ ] Chỉ thấy lớp, assignment và learner result trong scope được giao.
- [ ] Có thể assign task published, không assign draft/retired policy.
- [ ] Review low-confidence tạo outcome version mới và audit.
- [ ] Không thể đọc answer key, raw prompt, credential hoặc permission policy bí mật.
- [ ] Export cần quyền riêng và được audit.

## 5. Acceptance — Learner

- [ ] Chỉ mở task được giao và learner-safe DTO.
- [ ] Không tìm thấy answer/rubric/prompt trong HTML, JS bundle, storage hoặc API.
- [ ] Mọi choice Book-first chỉ hiển thị ký hiệu.
- [ ] Keyboard/focus/screen-reader semantics hoạt động.
- [ ] Reload/retry mạng không tạo attempt trùng.
- [ ] Answer/model shown chuyển Guided; independent mastery luôn false.
- [ ] Microphone denial/revoke có giải thích và fallback.
- [ ] Learner không đọc result/audio của người khác bằng cách đổi ID.

## 6. Acceptance — Assessment/AI

- [ ] Submission pin đúng task content và policy version.
- [ ] Deterministic scoring chạy trước AI khi phù hợp.
- [ ] `score <= maxScore`; outcome không có confidential field.
- [ ] AI chỉ nhận field allowlist và learner content được coi là data.
- [ ] Structured output sai schema bị từ chối.
- [ ] Timeout/retry/low confidence dùng fallback hoặc teacher review.
- [ ] AI không quyết định permission/independent mastery.
- [ ] Prompt injection không thay đổi rubric, policy hoặc disclosure rule.

## 7. Acceptance — Permission/Media

- [ ] Mặc định deny; mọi API kiểm tra role + resource + action + scope.
- [ ] Kiểm thử IDOR theo own/assigned/organization/service.
- [ ] Consent, user gesture và secure context trước microphone.
- [ ] Raw recording mặc định không lưu; nếu lưu phải có policy/version mới.
- [ ] Delete/retention job không để orphan media hoặc dangling database reference.
- [ ] Denied action, consent change và media lifecycle đều audit.

## 8. Regression với prototype

- Chạy lại unit/component/E2E/parity hiện có trước mỗi baseline revision.
- So sánh completion contract, retry queue, Guided/Independent và Book-first;
  không yêu cầu DOM/CSS pixel giống hệt nếu production portal đổi layout.
- Mọi thay đổi source baseline phải theo `BASELINE-CHANGE-POLICY.md`.

## 9. Release gate

Không release nếu còn một trong các lỗi sau:

- answer key/prompt/credential xuất hiện phía client;
- bypass role/scope hoặc content author tự approve;
- answer/model shown vẫn cấp independent mastery;
- recording không có consent/retention/delete path;
- AI invalid output có thể trực tiếp chấm điểm;
- task published không pin schema/content/policy version;
- contract/negative/security test thất bại.

