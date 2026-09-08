# Giới hạn đã biết

1. Recording và STT là mô phỏng; hệ thống không truy cập microphone, không lưu audio và không nhận dạng giọng nói thật.
2. Speech synthesis dùng Web Speech API, vì vậy giọng đọc và mức hỗ trợ phụ thuộc trình duyệt/hệ điều hành.
3. Avatar Tutor tải từ Dropbox và cần kết nối mạng. Lỗi tải ảnh không được làm hỏng luồng task.
4. Không có backend, tài khoản, database hoặc đồng bộ tiến độ giữa task/thiết bị.
5. State task nằm trong bộ nhớ React và mất khi refresh hoặc đóng trang.
6. Production build đang dùng base path `/`; triển khai trong subfolder cần một thay đổi cấu hình và lượt regression riêng.
7. Static host cần hỗ trợ directory index cho `/tasks/<mã>` và nên dùng `404.html` cho URL không tồn tại.
8. Parity hình ảnh dựa trên metrics Foundation, nội dung, overflow, runtime và ảnh bằng chứng; không dùng pixel-perfect diff giữa DOM HTML cũ và JSX React.
9. Registry hiện có 32 task đã chuyển đổi thuộc WS1–WS6; WS7 trở đi chưa nằm trong registry.
10. Website chưa được triển khai công khai trong đợt bàn giao này.
