# Tiêu chuẩn Foundation React — AI Tutor GSEC 6

Phiên bản: `react-foundation-1`  
Nguồn hình ảnh: Task HTML `60111`, tiêu chuẩn HTML `foundation-1`  
Phạm vi: toàn bộ task React `60111`–`60166` và worksheet mở rộng về sau

Kiến trúc component/hook/state được khóa riêng tại
`REACT-ARCHITECTURE-STANDARD.md` (`architecture-3`). Tài liệu này tiếp tục là
nguồn chuẩn cho hình ảnh, route và keypad; khi hai tài liệu cùng áp dụng thì phải
đáp ứng đồng thời cả hai.

Nội dung entry/retry/hint/model/summary đồng thời phải tuân thủ
`BOOK-FIRST-CONTENT-STANDARD.md`; Foundation không cấp quyền tái tạo bài tập từ
sách trong app.

## 1. Quyền sở hữu

| Hạng mục | Nguồn duy nhất |
|---|---|
| Danh sách mã và metadata task | `src/app/registry.ts` |
| Kiểu dữ liệu task | `src/app/task-types.ts` |
| Route | `src/app/router.tsx` |
| Màu, font, kích thước và radius | `src/styles/tokens.css` |
| Style component chung | `src/styles/components.css` |
| Logic nhập mã | `src/components/keypad/CodeKeypad.tsx` |
| Avatar Tutor | `src/components/chat/TutorAvatar.tsx` |
| Shell/header/footer | `src/components/shell/` |
| Bóng thoại và hàng chat | `src/components/chat/` |

Task không được sao chép hoặc định nghĩa lại các nội dung thuộc bảng trên.

## 2. Registry và route

- Registry phải có đúng 26 mã hiện hành và không trùng.
- Mỗi bản ghi gồm `code`, `worksheet`, `taskNumber`, `title`, `subtitle`,
  `component`, `legacyUrl`.
- URL React chuẩn là `/tasks/:code`.
- `/?page=:code` và `/tasks/:code/index.html` được router chuyển về URL chuẩn.
- Mã không hợp lệ phải hiển thị chính mã đó và đường quay lại trang đầu.
- Task mới chỉ được thêm qua registry; keypad không chứa danh sách mã riêng.

## 3. Token hình ảnh bắt buộc

- Font toàn hệ thống: `--font-family-ui`.
- Primary: `#8B0450`.
- Shell: tối đa `480px`.
- Avatar Tutor: `34×34px`.
- Tutor bubble: `#F1F5F9`, radius `17px 17px 17px 5px`.
- Student bubble: `#F9EDF3`, radius `17px 17px 5px 17px`.
- Bubble: `14px`, line-height `1.45`, padding `10px 12px`, max-width `82%`.

Task CSS không được ghi đè `.ui-avatar`, `.chat-row`, `.chat-bubble`,
`.chat-bubble--tutor` hoặc `.chat-bubble--student`.

## 4. Component chung

### Shell

- `AppShell`: khung tối đa 480px, vùng chat cuộn, nhận header/footer qua props.
- `TutorHeader`: Back, avatar, metadata và nút mở popup.
- `TaskFooter`: tiến độ có progressbar semantics và hành động cuối.

### Chat

- `TutorAvatar`: dùng URL Dropbox chuẩn duy nhất.
- `ChatRow`: nhận role `tutor` hoặc `student`.
- `TutorBubble` và `StudentBubble`: chỉ render JSX/text, không HTML động.

### Task UI cơ bản

- `ActionButton`: `primary` hoặc `secondary`, giữ trạng thái disabled native.
- `TaskCard`: card nội dung với heading và subtitle.
- `FeedbackBox`: `success`, `error`, `hint`; lỗi dùng `role="alert"`.
- `ResultSummary`: khung kết quả/hoàn tất dùng chung.

Các component nghiệp vụ như answer grid, recording, transcript và reducer chỉ
được tạo khi pilot chứng minh hợp đồng dùng lại.

## 5. Keypad 5 số

`InlineCodeKeypad` và `CodeKeypadModal` cùng gọi `CodeKeypad`; không có lõi
logic thứ hai.

Hợp đồng bắt buộc:

1. Đúng 5 ô, chỉ nhận `0–9`, tối đa 5 số.
2. Hỗ trợ nút màn hình, bàn phím vật lý, Enter, Backspace và Escape.
3. Tự kiểm tra sau 120ms khi đủ 5 số.
4. Mã được xác minh bằng registry.
5. Lỗi hiển thị chính mã không tồn tại bằng `role="alert"`.
6. Modal có dialog semantics, khóa scroll, focus phím 1, focus trap và trả focus.
7. Đóng/unmount phải dọn keyboard listener và timer tự submit.
8. Inline không có overlay, không khóa scroll, dùng `role="group"`.

## 6. Quy tắc React và accessibility

- Luôn giữ `StrictMode` ở development.
- Không dùng `innerHTML`, `insertAdjacentHTML`, `document.write` hoặc
  `dangerouslySetInnerHTML` cho nội dung task.
- Ưu tiên semantic HTML; icon-only button bắt buộc có accessible name.
- ID liên kết dialog dùng `useId` hoặc được truyền từ component cha.
- Mọi event listener và timer phải cleanup khi unmount.
- Tôn trọng `prefers-reduced-motion`.
- Không truyền đạt lỗi hoặc trạng thái chỉ bằng màu.

## 7. Kiểm thử bắt buộc khi thay Foundation

```text
npm run lint
npm run test
npm run build
npm run test:e2e
```

Phải xác minh thêm:

- 26 mã duy nhất trong registry.
- Click và bàn phím cho keypad hợp lệ/không hợp lệ.
- Focus, dialog semantics, scroll lock và focus return.
- URL chuẩn, query URL và legacy URL.
- Avatar/bubble đúng computed style.
- Không console error, page error hoặc tràn ngang ở mobile/desktop.
- Hash nguồn WS và baseline `Propotype` không đổi.

Nếu thay đổi Foundation làm hỏng task đã nghiệm thu, phải sửa hồi quy trước khi
chuyển task tiếp theo.
