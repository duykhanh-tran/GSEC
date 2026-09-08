# Báo cáo nghiệm thu Giai đoạn 8

Ngày nghiệm thu kỹ thuật: `06/09/2026`  
Kết quả: **ĐẠT**

## Phạm vi

Giai đoạn 8 thực hiện full regression và parity cho toàn bộ 26 task React so với hệ HTML đóng băng. Việc kiểm tra bao phủ Foundation, nội dung ban đầu, luồng nghiệp vụ, route, static build, hai viewport và toàn vẹn nguồn.

## Sai lệch được phát hiện và xử lý

Parity audit phát hiện ba nhóm sai lệch mà regression theo selector trước đó chưa bắt được:

- `60115`: phụ đề và nội dung hướng dẫn/capture ban đầu chưa khớp HTML.
- `60125`: phụ đề và lời dẫn ban đầu chưa khớp HTML.
- `60126`: lời dẫn, giải thích priority review và nhãn footer chưa khớp HTML.

Các nội dung trên đã được sửa theo giao diện HTML thực tế. Sau sửa, E2E nghiệp vụ của WS1 và WS2 tiếp tục đạt.

## Kết quả parity HTML/React

| Hạng mục | Kết quả |
|---|---:|
| Task | 26/26 |
| Tổ hợp task/viewport | 52/52 |
| Viewport | `390×844`, `1024×900` |
| Ảnh React nghiệm thu | 54/54 |
| Sai lệch parity cuối | 0 |
| Runtime/console error | 0 |
| Horizontal overflow | 0 |
| Token recall thấp nhất | 72,73% |
| Token recall trung bình | 91,52% |

Token recall đo mức độ giữ lại tập từ khóa trong nội dung ban đầu của HTML. Đây là kiểm tra ngữ nghĩa bổ sung; nó không thay thế E2E nghiệp vụ. Khác biệt JSX/DOM hoặc wording bổ sung hợp lệ vẫn được phép khi không làm mất nội dung, hành vi và Foundation đã khóa.

Metrics chi tiết và 54 ảnh nằm tại `reports/stage-8-visual/`.

## Full regression

| Cổng | Kết quả |
|---|---:|
| Lint | Đạt |
| Unit/component | 35/35 đạt |
| Production build | Đạt, 125 modules, 26 static entry point |
| E2E development | 34 đạt, 4 runner-specific skipped |
| E2E production preview | 34 đạt, 4 runner-specific skipped |
| Static URL compatibility | 3/3 đạt |
| HTML/React parity | 1/1 đạt |
| Hash nguồn WS | 26/26 khớp |
| Hash baseline `Propotype` | 144/144 khớp |

Bốn bài bị skip trong suite development/preview gồm ba bài static-only và một bài parity cần hai server. Chúng đều được chạy và đạt bằng runner chuyên biệt tương ứng, không phải bài chưa kiểm tra.

## An toàn và giới hạn

- Không sửa `WS 1_HTML`–`WS 5_HTML`, `Propotype` hoặc bộ baseline Giai đoạn 1.
- Avatar vẫn phụ thuộc Dropbox; kiểm thử dùng ảnh phản hồi cố định để loại nhiễu mạng.
- Speech synthesis phụ thuộc trình duyệt.
- Recording/STT tiếp tục là mô phỏng đúng phạm vi đã duyệt.
- Ảnh nghiệm thu dùng để rà soát và truy vết; cổng tự động dựa trên metrics Foundation, nội dung, overflow, runtime và E2E, không áp dụng pixel-perfect diff mù quáng giữa hai kiến trúc DOM khác nhau.

## Kết luận

Giai đoạn 8 đáp ứng cổng full regression và parity toàn hệ thống. React đủ điều kiện chờ người dùng cho phép Giai đoạn 9 — lập gói bàn giao cuối, hướng dẫn vận hành và rollback.
