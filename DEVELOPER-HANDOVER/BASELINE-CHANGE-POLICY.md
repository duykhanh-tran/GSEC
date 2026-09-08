# Quy tắc thay đổi React baseline

Baseline hiện hành: `react-foundation-2026-09-07-r3`.

Baseline trước đó `react-foundation-2026-09-07` được giữ lại để đối chiếu. Revision
`r2` loại bỏ điều hướng Back khỏi header chung theo yêu cầu sản phẩm; lịch sử
Back/Forward của trình duyệt không thay đổi.

Revision `r3` bổ sung chuông chúc mừng ba nốt cho Task 60111. Âm thanh dùng Web
Audio, chỉ phát một lần khi task chuyển sang hoàn thành và tự giải phóng tài
nguyên; task vẫn hoạt động nếu trình duyệt không hỗ trợ âm thanh.

## 1. Ý nghĩa của việc khóa

Khóa không có nghĩa là cấm sửa lỗi hoặc tối ưu. Khóa có nghĩa là mọi thay đổi
ảnh hưởng đến runtime, task, component, test hoặc cấu hình phải được nhận biết,
review và kiểm thử; không được âm thầm thay đổi hành vi đã bàn giao.

## 2. Quy trình thay đổi

1. Chạy `npm run baseline:verify` trước khi sửa để xác nhận điểm xuất phát.
2. Nêu rõ lý do và phạm vi thay đổi.
3. Sửa ở lớp chung khi hành vi có thể tái sử dụng; tránh vá riêng task nếu không
   phải ngoại lệ thực sự.
4. Cập nhật hoặc bổ sung test bảo vệ hành vi mới.
5. Chạy unit, typecheck, lint, build và E2E phù hợp với phạm vi.
6. Cập nhật tài liệu contract/acceptance nếu hành vi hoặc schema thay đổi.
7. Chỉ tạo baseline ID mới sau khi thay đổi đã được nghiệm thu.

## 3. Không được làm

- Không sửa source HTML gốc để làm cho React test đạt.
- Không chạy `baseline:generate` để che một thay đổi chưa được review.
- Không sửa task published theo cách khiến kết quả cũ mất ý nghĩa phiên bản.
- Không đưa option text hoặc đáp án đầy đủ trở lại task Book-first.
- Không tính nội dung đã xem model/show-answer là Independent mastery.
- Không thay component contract mà không đánh giá các task đang sử dụng.

## 4. Tạo baseline kế tiếp

Baseline mới phải có ID mới, changelog ngắn, kết quả kiểm thử và checksum riêng.
Không ghi đè manifest cũ khi bộ bàn giao đã được chuyển cho dev.
