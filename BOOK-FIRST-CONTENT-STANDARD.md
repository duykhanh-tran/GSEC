# Tiêu chuẩn nội dung Book-first / Worksheet-first

Phiên bản: `book-first-1`  
Ngày khóa: `07/09/2026`  
Phạm vi: mọi task hiện tại và tương lai của AI Tutor GSEC 6

## 1. Nguyên tắc bắt buộc

Sách hoặc worksheet là nguồn nội dung học tập chính. App chỉ thu câu trả lời,
phản hồi, gợi ý và hướng người học quay lại đúng vị trí trong sách. App không
được tái tạo đủ nội dung để người học có thể bỏ sách và hoàn thành bài chỉ bằng
giao diện app.

Quy định này áp dụng cho màn hình nhập đáp án, kết quả, retry, hint, deep hint,
show answer/model và summary.

## 2. Nội dung app được phép hiển thị

- Số câu hoặc vị trí tham chiếu, ví dụ `Question 2`, `Item 4`, `Blank 3`.
- Nội dung câu hỏi có thể được hiển thị khi cần cho luồng hỗ trợ. Đây là mức tối
  đa; mặc định vẫn ưu tiên yêu cầu người học đọc câu hỏi trong sách.
- Chỉ ký hiệu trả lời mà worksheet yêu cầu nhập, ví dụ `A / B / C`, `T / F` hoặc
  một giá trị ngắn đã được contract của task cho phép.
- Chỉ dẫn quay lại sách, ví dụ: “Mở worksheet và đọc lại Question 2.”
- Gợi ý về kỹ năng, quy tắc hoặc dấu hiệu cần chú ý, miễn là không chép lại các
  phương án hoặc làm lộ đáp án bằng cách diễn đạt tương đương.
- Trạng thái `Correct`, `Try again`, `Independent`, `Guided` và mã evidence.
- Nội dung mà đặc tả xác định app là kênh cung cấp chính, chẳng hạn audio trong
  một task listening.

## 3. Nội dung bị cấm đối với task dựa trên sách

- Hiển thị lại nội dung các lựa chọn A/B/C hoặc True/False statement.
- Ghép nội dung các phương án, hình, bảng hoặc ngữ cảnh đáp án thành một bản thay
  thế cho bài trong worksheet.
- Đưa nội dung phương án/đáp án vào `retryContent`, `bookCue`, hint hoặc model.
- Hiện câu trả lời bằng nội dung đầy đủ nếu chỉ cần một ký hiệu đáp án.
- Dùng hint chứa nguyên văn phương án đúng hoặc loại trừ đủ mạnh để không cần
  nhìn lại sách.

## 4. Contract cho Choice và Retry

Với task nhập `A / B / C` hoặc `T / F` từ worksheet:

1. Các control nhập và retry chỉ render ký hiệu đáp án; không gắn nội dung phương
   án vào cạnh `A / B / C` hoặc `T / F`.
2. Retry phải nêu số câu và hướng người học mở lại sách/worksheet.
3. Có thể hiển thị question stem nếu cần, nhưng không được hiển thị nội dung các
   phương án. Mặc định chỉ dùng tham chiếu vị trí trong `bookCue`.
4. `retryContent` chỉ được chứa question stem hoặc nội dung hỗ trợ hợp lệ; tuyệt
   đối không được tái hiện option text hoặc answer content.
5. Hint cấp 1 hướng sự chú ý về dấu hiệu; hint cấp 2 giải thích quy tắc hoặc cách
   kiểm tra nhưng vẫn yêu cầu đối chiếu sách.
6. Sau giới hạn lần thử, nếu đặc tả cho phép show answer thì chỉ hiện ký hiệu
   đáp án, đồng thời đánh dấu câu đó là `Guided`.
7. Summary không được biến thành answer sheet chứa nội dung đầy đủ của bài.

Ví dụ đúng:

> Open your worksheet and reread Question 2. Focus on the time expression, then
> choose A, B or C again.

Các control bên dưới chỉ là `A`, `B`, `C`.

## 5. Ngoại lệ

Chỉ được hiển thị nội dung đầy đủ khi một trong các điều kiện sau được đặc tả và
phê duyệt rõ:

- Nội dung vốn do app cung cấp, không tồn tại như bài cần làm trong sách.
- Nội dung là sản phẩm của chính học sinh cần xác nhận, như transcript STT.
- Cần thiết cho hỗ trợ tiếp cận đã được duyệt.
- Model chỉ xuất hiện sau đúng learning gate của task; việc dùng model phải được
  ghi là `Guided` và không được âm thầm tính là independent mastery.

Không được tự suy diễn ngoại lệ từ sự tiện lợi của giao diện.

## 6. Yêu cầu triển khai và nghiệm thu

- Mỗi task phải xác định nguồn nội dung là `worksheet`, `app` hoặc `learner` khi
  lập state/content map.
- Review data phải kiểm tra `bookCue`, `retryContent`, hint, model và summary.
- E2E của task worksheet-driven phải xác nhận các lựa chọn không chứa option
  text/answer content và vẫn hiển thị đúng tham chiếu về sách hoặc question stem
  đã được cho phép.
- Nếu phát hiện vi phạm, task chuyển sang trạng thái “Cần sửa Book-first” và
  không được xem là nghiệm thu hoàn toàn.
- `60122` và `60132` là hai vi phạm đã xác nhận đầu tiên và đã được sửa theo
  contract này. Các task còn lại phải được rà soát theo cùng tiêu chuẩn, không
  giới hạn ở hai mã trên.

## 7. Thứ tự ưu tiên

Tài liệu này là contract nội dung bắt buộc và được tham chiếu bởi
`REACT-ARCHITECTURE-STANDARD.md` cùng `TASK-AUTHORING-SCHEMA.md`. Khi HTML cũ
hiển thị nhiều nội dung hơn quy định Book-first, bản React phải tuân thủ contract
này thay vì sao chép hành vi chưa phù hợp của HTML.
