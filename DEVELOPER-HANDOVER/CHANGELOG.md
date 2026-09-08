# Developer Handover Changelog

## `developer-handover-1.2.0` — 07/09/2026

- Bổ sung `useCelebrationSound`, chuông ba nốt dùng Web Audio và có cleanup.
- Task 60111 phát chuông đúng một lần khi chuyển sang trạng thái hoàn thành.
- Âm thanh là progressive enhancement: không làm gián đoạn task khi API âm
  thanh không khả dụng.
- Thêm unit test cho trigger một lần và vòng đời AudioContext.
- Tạo baseline `react-foundation-2026-09-07-r3`; giữ các revision trước để đối
  chiếu.

## `developer-handover-1.1.0` — 07/09/2026

- Loại bỏ nút Back khỏi `TutorHeader` dùng chung, áp dụng cho đủ 32 task.
- Loại bỏ callback `onBack` và mọi lệnh `navigate(-1)` trong task frame/header.
- Giữ nguyên lịch sử Back/Forward của trình duyệt và điều hướng bằng keypad.
- Thêm unit/E2E guard ngăn nút Back của ứng dụng xuất hiện trở lại.
- Nâng component contract lên `component-contracts-2.0.0` do thay đổi public props.
- Tạo baseline `react-foundation-2026-09-07-r2`; giữ baseline ban đầu để đối chiếu.

## `developer-handover-1.0.0` — 07/09/2026

- Khóa gói bàn giao sáu bước ban đầu cho 32 task, 11 archetype và 42 component.
