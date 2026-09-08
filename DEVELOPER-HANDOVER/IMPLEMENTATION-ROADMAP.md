# Lộ trình triển khai đề xuất cho đội dev

## Nguyên tắc triển khai

Không xây ba portal và 32 task cùng lúc. Dùng vertical slice để chứng minh từng
contract qua đầy đủ authoring, review, publish, assignment, attempt, assessment
và reporting trước khi mở rộng.

## Giai đoạn D1 — Contract foundation

- Đưa các JSON Schema vào package nội bộ có version.
- Chạy Draft 2020-12 validation tại API và Admin form.
- Sinh TypeScript types từ schema hoặc duy trì compile-time equivalence test.
- Thiết lập migration runner, policy registry và schema compatibility CI.
- Từ chối unknown field ở mọi API boundary.

Exit gate: 11 task mẫu hợp lệ; toàn bộ fixture âm bị từ chối ở CI.

## Giai đoạn D2 — Identity, tenant và audit

- Chọn identity provider và mô hình organization/school/class.
- Áp dụng role/scope từ permission contract, mặc định deny.
- Xây immutable audit log cho content, policy, attempt, AI và consent event.
- Tách direct identifier khỏi learner response/media reference.

Exit gate: kiểm thử chống truy cập chéo learner/class/organization và chống
content author tự duyệt task của mình.

## Giai đoạn D3 — Admin MVP với archetype form-ready

Ưu tiên:

1. `guided-choice`
2. `readiness-checklist`
3. `listening-choice-assessment`

- Form sinh từ schema, không có raw JSON ở luồng biên tập thông thường.
- Preview dùng component renderer thật nhưng không tải private policy.
- Workflow draft → review → approved → published, published immutable.
- Book-first lint chặn nội dung option thay vì ký hiệu.

Exit gate: content author tạo task mới mà không sửa code; reviewer duyệt; Admin
publish; learner-safe API không có answer key.

## Giai đoạn D4 — Learner runtime và assessment deterministic

- Adapter `TaskRenderer` nhận learner-safe DTO.
- Implement exact-match, symbolic choice, matrix và sequence phía server.
- Idempotent submission và version-pinned evaluation.
- Outcome chỉ theo `assessment-outcome.schema.json`.
- Guided/Independent được tính từ server event history.

Exit gate: vertical slice `guided-choice` chạy end-to-end và không có secret
trong network response/client bundle.

## Giai đoạn D5 — Teacher portal tối thiểu

- Danh sách task published và assignment theo class.
- Xem result/evidence của learner trong scope được giao.
- Review queue cho pending/low-confidence; quyết định override có audit/version.
- Không cho teacher sửa/publish task hoặc policy.

Exit gate: kiểm thử scope class, result ownership và audit teacher review.

## Giai đoạn D6 — Recording và media

- Permission/consent flow, secure upload token và media lifecycle.
- Recorder/ASR/TTS adapters thay simulation trong prototype.
- Không lưu audio mặc định; retention/delete/export theo policy.
- Fallback khi microphone/ASR không khả dụng.

Exit gate: permission denial, revoke, upload failure, timeout và cleanup đều được
kiểm thử; không có orphan media.

## Giai đoạn D7 — AI bounded services

- Provider/prompt registry phía server; credentials ngoài source.
- Input allowlist, prompt-injection boundary và structured-output validation.
- Timeout/retry/fallback/teacher-review đúng AI policy.
- Monitoring chất lượng theo feedback code, không log prompt/PII thừa.

Exit gate: invalid output, low confidence, timeout và injection fixtures không
thể tạo điểm/mastery hoặc tiết lộ đáp án.

## Giai đoạn D8 — Guarded archetypes và migration 32 task

- Chuyển theo từng archetype, bắt đầu task tham chiếu rồi mới batch cùng họ.
- So sánh parity với prototype ở hành vi cốt lõi và Book-first.
- `writing-capture-repair` 60115 vẫn là developer-extension cho đến khi abstraction
  được duyệt.
- Gắn policy/version rồi chạy contract, accessibility và E2E test.

Exit gate: 32/32 task có production JSON revision, không còn task-specific route
logic ngoài ngoại lệ đã phê duyệt.

## Giai đoạn D9 — Hardening và release

- Security/privacy/legal review, threat model và incident runbook.
- Load, rate-limit, cost guardrail, backup/restore và disaster recovery.
- Accessibility audit, browser/device matrix và observability/SLO.
- Staged rollout, feature flag, rollback và migration rehearsal.

Exit gate: production readiness review có sign-off của Product, Engineering,
Security/Privacy và Content.

