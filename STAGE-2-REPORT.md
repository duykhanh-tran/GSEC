# Báo cáo Giai đoạn 2 — Khởi tạo React

Ngày thực hiện: `05/09/2026`  
Kết quả: **Đạt**

## 1. Phạm vi đã thực hiện

- Tạo dự án độc lập tại `Propotype-React/`.
- Giữ `Propotype/` và `WS 1_HTML`–`WS 5_HTML` ở chế độ chỉ đọc.
- Khởi tạo React, Vite và TypeScript strict.
- Tích hợp React Router với route nền `/`, `/tasks/:code` và route không tồn tại.
- Cài sẵn Vitest, React Testing Library và Playwright theo stack đã khóa.
- Loại bỏ giao diện và asset mẫu của Vite.
- Tạo trang trạng thái kỹ thuật tối thiểu; chưa chuyển component nền tảng hoặc task.

## 2. Phiên bản nền tảng được khóa trong lockfile

| Thành phần | Phiên bản đã cài |
|---|---:|
| React | `19.2.8` |
| React DOM | `19.2.8` |
| React Router DOM | `7.18.3` |
| Vite | `8.2.2` |
| TypeScript | `6.0.2` |
| Vitest | `5.0.0` |
| React Testing Library | `16.3.3` |
| Playwright Test | `1.63.0` |

Các phiên bản chính xác và cây phụ thuộc nằm trong `package-lock.json`.

## 3. Kết quả kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| `npm run lint` | Đạt, không cảnh báo |
| `npm run test` | 1 file test đạt, 1 test đạt |
| `npm run build` | Đạt |
| TypeScript strict | Đã bật và build đạt |
| Dev server `127.0.0.1:4174` | `/` và `/tasks/60154` trả HTTP 200 |
| Production preview `127.0.0.1:4175` | `/` và `/tasks/60154` trả HTTP 200 |
| Nguồn WS | 26/26 hash và kích thước khớp |
| Baseline `Propotype/` | 144/144 file hash và kích thước khớp |
| Lỗ hổng do npm audit báo cáo | 0 |

Dev server và production preview đã được dừng sau khi xác minh.

## 4. Cấu trúc quan trọng đã tạo

- `src/main.tsx`: điểm khởi động React trong `StrictMode`.
- `src/app/App.tsx`: gắn router vào ứng dụng.
- `src/app/router.tsx`: cấu hình route nền.
- `src/app/pages/`: các trang placeholder của riêng Giai đoạn 2.
- `src/styles/global.css`: stylesheet tối thiểu cho trang trạng thái.
- `src/test/setup.ts`: thiết lập React Testing Library.
- `tests/unit/scaffold.test.tsx`: smoke test cho scaffold.
- `vitest.config.ts`: cấu hình unit/component test.

## 5. Những nội dung cố ý chưa thực hiện

- Chưa tạo registry 26 task.
- Chưa chuyển bất kỳ nội dung hoặc logic task `601xx` nào.
- Chưa chuyển design token/component chuẩn từ HTML.
- Chưa triển khai keypad/popup 5 số.
- Chưa tạo URL legacy tĩnh.
- Chưa chạy parity hình ảnh React/HTML.
- Chưa triển khai hoặc xuất bản hệ thống.

Các nội dung foundation đầu tiên thuộc Giai đoạn 3 theo
`REACT-MIGRATION-SPEC.md`.

## 6. Kết luận

Cổng nghiệm thu Giai đoạn 2 trong đặc tả là “Dev và production build đạt”. Cả
hai môi trường đã chạy thành công, bộ công nghệ đã khóa có mặt trong dự án, và
baseline HTML vẫn nguyên vẹn. Giai đoạn 2 được đánh dấu **Đạt**.
