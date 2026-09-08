# Developer Handover Package

Mục tiêu của thư mục này là bàn giao một nền tảng React đã được kiểm kê, khóa
baseline và mô tả bằng contract để đội phát triển có thể xây các cổng Admin,
Giáo viên và Học sinh mà không phải phân tích lại prototype từ đầu.

## Lộ trình sáu bước

1. **Hoàn thành:** kiểm kê và khóa nền tảng React hiện tại.
2. **Hoàn thành:** phân loại task thành archetype.
3. **Hoàn thành:** chuẩn hóa component contract.
4. **Hoàn thành:** hoàn thiện task schema và JSON mẫu.
5. **Hoàn thành:** viết assessment, AI và permission contract.
6. **Hoàn thành:** đóng gói tài liệu, task mẫu và test.

## Tài liệu của bước 1

- `01-REACT-BASELINE-INVENTORY.md`: phạm vi, số liệu và trạng thái kiểm thử.
- `BASELINE-CHANGE-POLICY.md`: quy tắc thay đổi sau khi khóa.
- `baseline/react-foundation-2026-09-07-r3.json`: baseline hiện hành, checksum
  từng file và checksum
  tổng của source/runtime/test.
- `baseline/react-foundation-2026-09-07.json`: baseline ban đầu để đối chiếu.

## Tài liệu của bước 2

- `02-TASK-ARCHETYPE-CATALOG.md`: 11 archetype chính, ma trận 32 task, mức
  authoring và ngoại lệ.
- `archetypes/task-archetype-map.json`: bản ánh xạ máy đọc được để dùng cho
  component contract và task schema ở các bước sau.

## Tài liệu của bước 3

- `03-COMPONENT-CONTRACTS.md`: ranh giới React/Admin/server, contract chung,
  Book-first, mức authoring và quy tắc phát triển kho component.
- `components/component-registry.json`: registry máy đọc được của đủ 42 component,
  dùng làm đầu vào cho task schema và validator ở bước 4.
- `components/validate-component-registry.mjs`: kiểm tra coverage, ID/source trùng,
  enum authoring và sự khớp giữa registry với filesystem.

## Tài liệu của bước 4

- `04-TASK-SCHEMA-AND-EXAMPLES.md`: cấu trúc task, block union, guardrail,
  workflow authoring và quy tắc version/migration.
- `task-schema/task-authoring.schema.json`: JSON Schema Draft 2020-12 cho payload
  Admin an toàn.
- `task-schema/examples/archetype-examples.json`: 11 mẫu, đủ 11 archetype.
- `task-schema/fixtures/invalid-authoring-fixtures.json`: bảy fixture phải bị từ
  chối.
- `task-schema/validate-task-authoring.mjs`: validator coverage, reference và
  policy độc lập dependency.

## Tài liệu của bước 5

- `05-ASSESSMENT-AI-PERMISSION-CONTRACTS.md`: trust boundary, assessment flow,
  AI guardrail, RBAC, microphone và API handoff.
- `policies/schemas/`: năm JSON Schema cho policy, submission và outcome.
- `policies/examples/policy-catalog.json`: 10 assessment, 4 AI và 2 permission
  policy mẫu; tất cả dữ liệu đáp án là synthetic/server-only.
- `policies/examples/assessment-submissions.json`: submission an toàn từ client.
- `policies/examples/assessment-outcomes.json`: outcome đã loại dữ liệu bí mật.
- `policies/fixtures/invalid-policy-fixtures.json`: 10 fixture phải bị từ chối.
- `policies/validate-policy-contracts.mjs`: kiểm tra reference và invariant bảo
  mật/nghiệp vụ xuyên suốt Bước 4–5.

## Bước 6 — Bắt đầu tại đây

- `06-DEVELOPER-HANDOVER-PACKAGE.md`: mục đích, thứ tự nguồn chuẩn, traceability
  32 task và hướng dẫn tiếp nhận.
- `IMPLEMENTATION-ROADMAP.md`: lộ trình D1–D9 theo vertical slice.
- `TEST-AND-ACCEPTANCE.md`: test strategy và Definition of Done cho Admin,
  Teacher, Learner, Assessment/AI và Permission/Media.
- `KNOWN-GAPS-AND-DECISIONS.md`: các quyết định Product/Dev/Security/Legal chưa
  thuộc phạm vi prototype.
- `manifest/handover-package-1.2.0.json`: checksum gói bàn giao hiện hành.
- `CHANGELOG.md`: lịch sử revision sau khi khóa package.
- `verify-handover-package.mjs`: một lệnh kiểm định contract, fixture, manifest
  và baseline.

## Xác minh toàn bộ gói

```bash
node DEVELOPER-HANDOVER/verify-handover-package.mjs
```

## Xác minh baseline

```bash
npm run baseline:verify
```

Không chạy `npm run baseline:generate` chỉ để làm mất cảnh báo checksum. Chỉ tạo
baseline mới sau khi thay đổi đã được review, kiểm thử và ghi nhận thành một
phiên bản bàn giao mới.
