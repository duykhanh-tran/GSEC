# AI Tutor GSEC 6 — React

Đây là dự án React độc lập dùng để chuyển đổi hệ thống HTML trong thư mục
`../Propotype`. Thư mục HTML gốc chỉ được dùng làm baseline và không được liên
kết runtime hoặc chỉnh sửa trong quá trình chuyển đổi.

## Công nghệ nền tảng

- React và TypeScript strict
- Vite
- React Router
- Vitest và React Testing Library
- Playwright

## Lệnh phát triển

```bash
npm install
npm run dev -- --port 4174
npm run test
npm run build
npm run preview -- --port 4175
npm run test:e2e:static
npm run test:e2e:parity
```

Foundation React đã hoàn thành ở Giai đoạn 3. Ba pilot `60131`, `60154`, `60155`
được dùng để khóa kiến trúc; hiện có đủ 32 task React thuộc WS1–WS6.

- Contract hiện hành: `REACT-ARCHITECTURE-STANDARD.md` (`architecture-3`).
- Quy định nội dung Book-first: `BOOK-FIRST-CONTENT-STANDARD.md`.
- Phân loại task: `TASK-ARCHETYPE-CATALOG.md`.
- Schema authoring: `TASK-AUTHORING-SCHEMA.md`.
- Báo cáo Giai đoạn 6: `STAGE-6-REPORT.md`.
- Báo cáo Giai đoạn 7: `STAGE-7-REPORT.md`.
- Báo cáo Giai đoạn 8: `STAGE-8-REPORT.md`.
- Bộ bàn giao cuối: `FINAL-HANDOVER.md`.
- Hướng dẫn vận hành: `OPERATIONS-RUNBOOK.md`.
- Hướng dẫn rollback: `ROLLBACK-GUIDE.md`.
- Ma trận nghiệm thu: `TASK-ACCEPTANCE-MATRIX.md`.
- Giới hạn đã biết: `KNOWN-LIMITATIONS.md`.
- Baseline bàn giao hiện hành: `DEVELOPER-HANDOVER/README.md`.

Lệnh `npm run build` tự sinh 32 entry point tĩnh trong `dist/tasks/` và
`dist/404.html`. Lệnh `npm run test:e2e:static` kiểm tra các URL này bằng máy
chủ tĩnh không có SPA fallback.

Lệnh `npm run test:e2e:parity` khởi động đồng thời baseline HTML và React build,
đối chiếu bộ baseline WS1–WS5 ở mobile/desktop và lưu bằng chứng trong
`reports/stage-8-visual/`; WS6 có báo cáo migration riêng trong `reports/`.
