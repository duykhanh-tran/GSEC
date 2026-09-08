# Hướng dẫn rollback về hệ HTML

## Nguyên tắc

Rollback không yêu cầu chuyển đổi dữ liệu vì hệ React hiện không có backend hoặc lưu trữ bền vững. Không xóa `Propotype-React`; chỉ ngừng phục vụ nó và chuyển entry point về hệ HTML.

## Rollback cục bộ

1. Dừng server React đang chạy ở cổng `4174`, `4175` hoặc `4176`.
2. Xác nhận thư mục `../Propotype/` còn nguyên bằng:

```powershell
npm run verify:baselines
```

3. Từ thư mục root project, phục vụ baseline HTML:

```powershell
python -m http.server 4173 --directory Propotype
```

4. Mở `http://127.0.0.1:4173/` và kiểm tra một mã đại diện của mỗi WS.

## Rollback trên hosting

1. Giữ nguyên bản React đang chạy để có thể khôi phục nếu cần.
2. Chuyển document root hoặc release hiện hành sang bản đóng băng HTML.
3. Xác nhận `/`, keypad 5 số và các URL `/tasks/<mã>/index.html`.
4. Chỉ gỡ release React sau khi hệ HTML đã hoạt động ổn định và có bản sao lưu.

## Khôi phục baseline HTML từ gói đóng băng

Gói chuẩn:

`../React-Migration-Baseline/deliverables/Propotype-HTML-Frozen-2026-09-05.zip`

SHA-256 kỳ vọng:

`E4906759F619354909CD17E843803E38E1132F0BF3C6AB2E159EE0AD99E23020`

Luôn kiểm tra checksum trước khi giải nén. Giải nén vào một thư mục mới, kiểm tra nội dung rồi mới thay đổi cấu hình phục vụ; không giải nén đè trực tiếp lên `Propotype/`.

## Quay lại release React đã nghiệm thu

Các checkpoint Giai đoạn 6–8 vẫn nằm trong `checkpoints/`. Gói cuối nằm trong `deliverables/`. Kiểm tra SHA-256 tương ứng trước khi sử dụng bất kỳ gói nào.
