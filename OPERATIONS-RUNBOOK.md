# Hướng dẫn vận hành AI Tutor React

## 1. Yêu cầu môi trường

- Node.js 22 LTS hoặc phiên bản tương thích với `package-lock.json`.
- npm.
- Google Chrome cho Playwright theo cấu hình hiện tại.
- Kết nối mạng nếu cần hiển thị avatar Tutor từ Dropbox hoặc dùng speech synthesis của trình duyệt.

Mọi lệnh dưới đây chạy trong thư mục `Propotype-React`.

## 2. Cài đặt sạch

```powershell
npm ci
```

Không cần cài dependency khi chỉ phục vụ thư mục `dist/` đã build.

## 3. Development

```powershell
npm run dev -- --host 127.0.0.1 --port 4174
```

Mở `http://127.0.0.1:4174/`. Trang đầu hiển thị keypad 5 số; route task có dạng `/tasks/60111`.

## 4. Production build

```powershell
npm run build
```

Đầu ra nằm trong `dist/`. Build tự sinh:

- 26 file `dist/tasks/<mã>/index.html`;
- `dist/404.html`;
- asset CSS/JavaScript có hash.

## 5. Xem production build

Vite preview:

```powershell
npm run preview -- --host 127.0.0.1 --port 4175
```

Máy chủ tĩnh nghiêm ngặt, không SPA fallback:

```powershell
node scripts/serve-static-build.mjs --root dist --port 4176
```

## 6. Các cổng kiểm thử

```powershell
npm run lint
npm run test
npm run build
npm run test:e2e
npm run test:e2e:preview
npm run test:e2e:static
npm run test:e2e:parity
npm run verify:baselines
```

Không chạy nhiều suite Playwright song song vì chúng dùng chung `test-results/`.

## 7. Yêu cầu khi đưa lên static host

- Public root phải trỏ tới nội dung của `dist/`.
- Ứng dụng hiện được build cho đường dẫn gốc `/`, không phải subfolder.
- Host phải phục vụ `tasks/<mã>/index.html` khi truy cập `/tasks/<mã>` hoặc `/tasks/<mã>/`.
- Cấu hình trang lỗi tới `404.html` nếu nền tảng hỗ trợ.
- Không cache lâu `index.html`, task entry hoặc `404.html`; asset có hash có thể cache dài hạn.
- Kiểm tra lại direct URL, refresh, Back/Forward và keypad sau khi triển khai.

## 8. Quy trình thay đổi task sau bàn giao

1. Xác định archetype và schema trong `TASK-ARCHETYPE-CATALOG.md` và `TASK-AUTHORING-SCHEMA.md`.
2. Ưu tiên component/hook hiện có; mở rộng component chuẩn khi hành vi có thể tái sử dụng.
3. Chỉ tạo component riêng cho ngoại lệ nghiệp vụ thật.
4. Giữ selector `data-*`, route và hợp đồng Foundation.
5. Thêm unit/E2E tương ứng.
6. Chạy toàn bộ cổng ở mục 6 trước khi build bàn giao mới.

## 9. Chẩn đoán nhanh

- Trang trắng sau deploy: kiểm tra asset `/assets/...` và việc host ở root `/`.
- Direct task 404: kiểm tra `dist/tasks/<mã>/index.html` và cấu hình directory index.
- Avatar không hiện: kiểm tra mạng/Dropbox; task vẫn phải hoạt động.
- Không phát giọng đọc: kiểm tra Web Speech API và thiết lập âm thanh trình duyệt.
- Test báo port bận: dừng server đang dùng `4173`–`4176`, rồi chạy lại một suite tại một thời điểm.
