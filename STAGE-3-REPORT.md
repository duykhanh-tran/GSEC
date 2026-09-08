# Báo cáo Giai đoạn 3 — Foundation React

Ngày nghiệm thu kỹ thuật: `06/09/2026`  
Phiên bản Foundation: `react-foundation-1`  
Kết quả: **Đạt**

## 1. Phạm vi hoàn thành

- Registry typed đủ 26 task, không trùng mã.
- Router cho `/`, `/tasks/:code`, `/?page=:code` và route legacy trong runtime.
- Trang Index dùng trực tiếp keypad 5 số.
- Shell, header, footer, avatar, chat row và hai loại bóng thoại dùng chung.
- Component nền tảng cho button, task card, feedback và result summary.
- Popup và keypad inline dùng chung một lõi state/validation.
- Token React sao chép có kiểm soát từ HTML `foundation-1`.
- Accessibility nền tảng: dialog semantics, focus, focus trap, scroll lock,
  focus return, alert, progressbar và reduced motion.
- Trang placeholder Foundation cho 26 route; chưa chuyển logic học tập của task.

## 2. Kiểm thử

| Cổng | Kết quả |
|---|---|
| Lint | Đạt, không cảnh báo |
| Unit/component | 4 file, 9/9 test đạt |
| TypeScript strict + production build | Đạt |
| E2E Playwright | 3/3 test đạt |
| Console/page runtime error trong E2E | 0 |
| Viewport kiểm tra | `390×844`, `1024×900` |
| Tràn ngang | 0 |
| Production preview | `/`, route task và route legacy trả HTTP 200 |
| Nguồn WS | 26/26 hash và kích thước khớp |
| Baseline `Propotype/` | 144/144 file hash và kích thước khớp |

Ảnh Dropbox được giữ đúng URL nguồn trong component và được thay bằng response
cục bộ chỉ trong E2E để kiểm thử không phụ thuộc chất lượng mạng.

## 3. Hợp đồng Foundation đã xác nhận

- Primary `#8B0450`.
- Shell tối đa `480px`.
- Avatar Tutor `34×34px`, ảnh không thoát khung.
- Tutor bubble `#F1F5F9`, radius `17px 17px 17px 5px`.
- Student bubble `#F9EDF3`, radius `17px 17px 5px 17px`.
- Bubble `14px`, line-height `1.45`, padding `10px 12px`.
- Keypad chính xác 5 số, tự kiểm tra sau `120ms`.

Chi tiết sử dụng nằm trong `FOUNDATION-STANDARD.md`.

## 4. Phần chưa thuộc Giai đoạn 3

- Chưa chuyển logic, nội dung, đáp án hoặc state của task nào.
- Chưa khóa component/hook nghiệp vụ phát hiện từ ba pilot.
- Chưa sinh 26 file legacy tĩnh cho static server không có SPA fallback; nội
  dung này thuộc Giai đoạn 7.
- Chưa đưa hệ thống lên production.

## 5. Kết luận

Cổng Giai đoạn 3 trong đặc tả là “Shell, router, keypad, token và accessibility
đạt”. Các hạng mục trên đã được triển khai và kiểm thử độc lập. Giai đoạn 3 được
đánh dấu **Đạt**; bước tiếp theo là Giai đoạn 4 với ba pilot theo thứ tự `60154`,
`60131`, `60155`.
