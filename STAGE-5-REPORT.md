# Báo cáo Giai đoạn 5 — Khóa kiến trúc React

Ngày nghiệm thu kỹ thuật: `06/09/2026`  
Contract: `architecture-1`  
Kết quả: **Đạt**

## Quyết định đã khóa

- `InteractiveTaskFrame` là khung bắt buộc cho task tương tác.
- Giữ `TaskFooter` và `StatusFooter` thành hai contract riêng.
- `TaskPanel`, `ActionButton`, `StatusTag` là primitive chung cho card, action và
  trạng thái; ba pilot đã chuyển sang dùng các primitive này.
- Local state dùng cho luồng nhỏ; reducer typed dùng cho queue/retry nhiều phase.
- Side effect chỉ đi qua hook có cleanup.
- Chưa tách Recording/Transcript/Score/Retry thành component chung cho đến khi có
  trường hợp sử dụng thực tế thứ hai.
- Không thêm dependency hoặc global state library.

## Thay đổi bảo vệ kiến trúc

- Bổ sung cleanup timeout cho `useAutoScroll`.
- Dọn timeout đã chạy trong `useRecordingSimulation`.
- TTS fallback an toàn khi thiếu Web Speech constructor.
- Bổ sung test contract chống DOM mutation, ghi đè CSS Foundation và task tự tạo
  header/keypad.
- Bổ sung test lifecycle cho timeout, recording và scroll.
- Chuẩn hóa runner E2E để kiểm tra được cả dev và production preview.

## Kết quả kiểm thử

| Cổng | Kết quả |
|---|---|
| Lint | Đạt, không cảnh báo |
| Unit/component/contract | 10 file, 21/21 test đạt |
| TypeScript + production build | Đạt |
| E2E development | 9/9 test đạt |
| E2E production preview | 9/9 test đạt |
| Source WS | 26/26 hash và kích thước khớp |
| Baseline `Propotype/` | 144/144 hash và kích thước khớp |

## Kết luận

Component/hook/state contract đã được khóa ở `architecture-1`. Không chuyển thêm
task trong Giai đoạn 5. Hệ thống dừng trước Giai đoạn 6 để người dùng kiểm tra và
cho phép tiếp tục.
