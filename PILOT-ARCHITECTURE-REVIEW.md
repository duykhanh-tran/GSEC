# Đánh giá kiến trúc sau ba pilot

Trạng thái: **Sẵn sàng để xem xét ở Giai đoạn 5; chưa khóa kiến trúc**

## Phần đã chứng minh dùng chung

- `InteractiveTaskFrame`: shell, metadata, Back, modal keypad, route và title.
- `StatusFooter`: mẫu footer title/status/action của các task tương tác.
- `useAutoScroll`: cuộn theo thay đổi hội thoại mà không query DOM toàn cục.
- `useTaskTimers`: timeout có cleanup cho chuỗi retry/feedback.
- `useRecordingSimulation`: interval + hai timeout, reset và cleanup StrictMode.
- `useSpeechSynthesis`: TTS tiếng Anh và cancel khi unmount.

## Ranh giới task đã chứng minh

- Nội dung, đáp án và câu transfer nằm trong `data.ts` của task.
- Task đơn giản (`60154`) dùng local state; không ép dùng reducer.
- Task nhiều phase (`60131`) dùng reducer và queue typed.
- Task ghi âm (`60155`) dùng phase state cùng hook side-effect; UI và rubric vẫn ở task.
- CSS riêng luôn nằm dưới `.task-<mã>`; không ghi đè avatar hoặc bubble Foundation.

## Điểm cần quyết định ở Giai đoạn 5

1. Có giữ hai footer (`TaskFooter` tiến độ và `StatusFooter` trạng thái) như hai contract chính thức hay hợp nhất bằng variant.
2. Có tách `RecordingCard`, transcript, rubric row thành component nghiệp vụ chung ngay, hay chờ pilot task ghi âm tiếp theo (`60144`/`60143`). Khuyến nghị: chờ trường hợp thứ hai.
3. Chuẩn reducer tối thiểu cho queue retry và phase naming trước khi chuyển 23 task còn lại.
4. Chuẩn kiểm thử parity: data contract unit + E2E luồng quyết định + responsive/console regression.

Không phát hiện lý do phải quay lại Foundation hoặc thay đổi hành vi baseline.
