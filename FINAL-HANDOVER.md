# Bàn giao cuối hệ thống AI Tutor React

> **Tài liệu lịch sử:** đây là mốc bàn giao WS1–WS5 ngày 06/09/2026 với 26
> task và `architecture-2`. Baseline hiện hành gồm 32 task, dùng
> `architecture-3` và được ghi tại `DEVELOPER-HANDOVER/README.md`.

Ngày bàn giao kỹ thuật: `06/09/2026`  
Phiên bản kiến trúc: `architecture-2`  
Trạng thái: **Đủ điều kiện để người dùng nghiệm thu**

## 1. Phạm vi bàn giao

- 26 task React thuộc WS1–WS5, mã `60111`–`60155`.
- Registry typed và `TaskRenderer` hướng cấu hình.
- Kho component/hook dùng chung cho chat, keypad, choice, retry, listening, recording simulation, transcript, progress, score, mastery và celebration.
- URL chuẩn, query URL, URL legacy và static entry point cho đủ 26 task.
- Unit/component test, E2E nghiệp vụ, static compatibility và parity HTML/React.
- Production build trong `dist/`.
- Báo cáo, metrics và 54 ảnh parity ở hai viewport.

## 2. Kết quả nghiệm thu kỹ thuật

| Cổng | Kết quả |
|---|---:|
| Registry React | 26/26 task |
| Unit/component | 35/35 đạt |
| Full E2E development | 34 đạt |
| Full E2E production preview | 34 đạt |
| Static compatibility | 3/3 đạt |
| HTML/React parity | 1/1 đạt |
| Task/viewport parity | 52/52 |
| Ảnh nghiệm thu | 54/54 |
| Runtime/console error | 0 |
| Horizontal overflow | 0 |
| Hash nguồn WS | 26/26 khớp |
| Hash baseline `Propotype` | 144/144 khớp |

Các bài runner-specific bị skip trong suite chung đều đã được chạy và đạt bằng runner static/parity tương ứng.

## 3. Tài liệu bàn giao

- `OPERATIONS-RUNBOOK.md`: cài đặt, chạy, build, kiểm thử và yêu cầu static host.
- `ROLLBACK-GUIDE.md`: quay lại hệ HTML mà không xóa hoặc ghi đè nguồn.
- `TASK-ACCEPTANCE-MATRIX.md`: trạng thái từng task.
- `KNOWN-LIMITATIONS.md`: giới hạn kỹ thuật còn tồn tại.
- `REACT-ARCHITECTURE-STANDARD.md`: contract component/schema.
- `STAGE-8-REPORT.md`: kết quả full regression và parity.
- `../REACT-MIGRATION-SPEC.md`: đặc tả có thẩm quyền, phiên bản `approved-9`.

## 4. Gói cuối

Gói cuối và checksum nằm trong `deliverables/`. Gói chứa source, production build, test, scripts, báo cáo và tài liệu; không chứa `node_modules`, `test-results`, checkpoint ZIP cũ hoặc chính thư mục deliverables.

## 5. Trạng thái triển khai

Hệ thống mới chỉ được bàn giao và nghiệm thu kỹ thuật cục bộ. Chưa đăng tải công khai, chưa thay thế URL đang sử dụng và chưa xóa hệ HTML. Triển khai production là một nhiệm vụ riêng cần người dùng chỉ định môi trường/host.
