# Báo cáo nghiệm thu Giai đoạn 7

Ngày nghiệm thu kỹ thuật: `06/09/2026`  
Kết quả: **ĐẠT**

## Phạm vi hoàn thành

Giai đoạn 7 hoàn thiện khả năng truy cập, tải lại và điều hướng URL cho đủ 26 task trên cả Vite development, production preview và máy chủ tĩnh không có SPA fallback.

Build hiện tự động sinh:

- `dist/tasks/<mã>/index.html` cho đủ 26 task;
- `dist/404.html` để direct URL không hợp lệ vẫn hiển thị trang React có đường quay lại;
- đoạn chuẩn hóa URL để `/tasks/<mã>/`, `/tasks/<mã>/index.html` trở về `/tasks/<mã>` mà không tải lại vòng lặp.

## Hợp đồng URL đã xác nhận

| Trường hợp | Kết quả |
|---|---|
| `/` | Hiển thị keypad 5 số |
| `/tasks/<mã>` | 26/26 trả HTTP 200 và mở đúng task |
| `/tasks/<mã>/index.html` | 26/26 trả HTTP 200 và chuẩn hóa về URL React |
| `/?page=<mã>` | 26/26 mở đúng task |
| Refresh direct route | Giữ đúng task |
| Back/Forward | Giữ đúng lịch sử điều hướng |
| `/?page=99999` | Hiển thị cảnh báo đúng mã |
| `/tasks/99999` | HTTP 404, hiển thị trang lỗi React có đường quay lại |
| URL bất kỳ | HTTP 404; không có SPA fallback ngầm |

## Kết quả kiểm thử

- Static compatibility E2E: **3/3 đạt**.
- Full E2E development: **34 đạt, 3 static-only skipped**.
- Full E2E production preview: **34 đạt, 3 static-only skipped**.
- Unit/component: **35/35 đạt**.
- Lint: đạt.
- Production build: đạt; sinh đủ 26 static task entry point và `404.html`.
- Hash nguồn WS: **26/26 khớp**.
- Hash baseline `Propotype`: **144/144 khớp**.

Ba bài static-only chỉ chạy qua `npm run test:e2e:static`; chúng được bỏ qua có chủ đích trong development và Vite preview để không đánh đồng hành vi fallback của Vite với máy chủ tĩnh nghiêm ngặt.

## An toàn baseline

Không sửa các thư mục `WS 1_HTML`–`WS 5_HTML` hoặc `Propotype`. Thay đổi chỉ nằm trong `Propotype-React` và tài liệu đặc tả ở root.

## Kết luận

Giai đoạn 7 đáp ứng cổng URL compatibility. Hệ thống đủ điều kiện chờ người dùng cho phép Giai đoạn 8 — full regression và parity toàn hệ thống.
