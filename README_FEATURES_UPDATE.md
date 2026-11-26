# SecureTcpChat – cập nhật chức năng

## Chức năng được bổ sung trong bản này

- Tùy chỉnh giao diện sáng/tối/theo hệ thống; đổi nền chat, cỡ chữ và độ rộng bong bóng tin nhắn. Tùy chọn được lưu riêng trên trình duyệt.
- Phím tắt: `Ctrl+K` tìm cuộc trò chuyện, `Ctrl+Shift+D` đổi chế độ sáng/tối, `Alt+Shift+A` mở cài đặt giao diện và `Esc` đóng cài đặt.
- Cảm xúc tin nhắn (❤️ 😂 👍 😮), mỗi người dùng chỉ có một cảm xúc trên một tin nhắn và có thể gỡ cảm xúc của mình.
- Xóa tin nhắn ở phía mình hoặc thu hồi cho tất cả. Backend kiểm tra người gửi; chỉ người gửi mới thực hiện được hai thao tác này.
- Xóa cuộc trò chuyện theo từng tài khoản; lịch sử của người còn lại không bị xóa.
- Ảnh hiển thị trực tiếp, bỏ tên tệp và khung bong bóng; trình xem ảnh có nút tải xuống ở góc trên phải.
- Audio dùng native HTML audio controls; endpoint tải tệp hỗ trợ HTTP Range và tra lại metadata từ SQLite/thư mục uploads sau khi khởi động lại server.
- Trang cá nhân: đổi ảnh đại diện, sửa tiểu sử, đăng bài viết dạng văn bản và xem bài viết của người khác.
- Chặn/gỡ chặn; backend ngăn gửi tin nhắn và lời mời kết bạn khi một trong hai bên đã chặn.
- Khu vực **Đoạn chat** gộp danh sách bạn bè, nhóm và các cuộc trò chuyện riêng; có các tab Tất cả, Nhóm, Chưa đọc.
- Danh sách đoạn chat sắp xếp theo tin mới nhất; số tin chưa đọc được lưu theo từng người dùng.
- Menu `!`: xem trang cá nhân, chặn/gỡ chặn, tắt/bật thông báo, hủy kết bạn, tìm trong đoạn chat, xóa đoạn chat.
- Menu nhóm: xem thành viên, thêm thành viên (chỉ trưởng nhóm), chuyển quyền trưởng nhóm, rời nhóm và giải tán nhóm. Backend bắt buộc trưởng nhóm chuyển quyền trước khi rời.

## Chạy dự án

Yêu cầu Java 17 trở lên và Maven.

Tại thư mục `SecureTcpChat`:

```bash
mvn clean package
mvn spring-boot:run
```

Cơ sở dữ liệu SQLite được tự động bổ sung các bảng mới khi ứng dụng khởi động; dữ liệu cũ trong `data/zchat.db` không bị xóa.

## Lưu ý kiểm thử

- Chức năng bài viết hiện hỗ trợ nội dung văn bản; chưa có giao diện đính kèm ảnh vào bài viết.
- Cảm xúc nhanh hiện có bốn lựa chọn; người dùng có thể gỡ cảm xúc của chính mình.
- Thông báo trình duyệt chỉ xuất hiện nếu người dùng đã cấp quyền Notifications cho website. Tắt thông báo của một đoạn chat được lưu riêng theo tài khoản.
- Việc kiểm tra cú pháp Java đã thực hiện cho `DatabaseManager`, `Group`, `MessageType`, `ChatMessage`; JavaScript đã qua `node --check`. Môi trường đóng gói hiện không có Maven nên chưa chạy được `mvn clean package` tại đây. Hãy chạy lệnh build ở trên trước khi triển khai.

## Bản chỉnh sửa bổ sung (2026-11-19)
- Khôi phục lối mở danh sách lời mời kết bạn: bấm trực tiếp vào huy hiệu số lời mời; danh sách được dựng lại khi tải từ máy chủ hoặc nhận lời mời mới.
- Trang cá nhân người khác hiển thị đúng trạng thái quan hệ và nút Kết bạn / Hủy lời mời / Chấp nhận / Hủy kết bạn, đồng thời giữ nút nhắn tin và chặn.
- Bổ sung ảnh bìa trang cá nhân; dùng lại luồng tải ảnh cá nhân hiện có.
- Cảm xúc tin nhắn hiển thị theo emoji + số lượt; bấm vào cụm cảm xúc mới xem danh sách người thả và emoji.
- Bổ sung thao tác trả lời và chuyển tiếp tin nhắn; bố trí khung trả lời ở phía trên ô nhập.
- Cải thiện gom avatar theo chuỗi tin nhắn cùng người gửi, mốc thời gian căn giữa khi bắt đầu đoạn mới/gián đoạn từ một giờ, và định dạng ngày giờ khi gián đoạn dài.
- Với người chưa kết bạn: hiển thị nhãn “Người lạ”, banner “Kết bạn nhé !” và nút kết bạn; ẩn gửi tệp/ghi âm và chặn upload file ở client.
- Bảng emoji được giữ ở phía trên vùng nhập tin nhắn.

Lưu ý: các hạng mục bài viết có nhiều ảnh/video, bình luận, cảm xúc bài viết, ẩn/xóa bài hiện chưa được triển khai đầy đủ trong bản này; bài viết hiện vẫn chủ yếu là nội dung văn bản. Chức năng trả lời/chuyển tiếp hiện đóng gói nội dung trích dẫn vào tin nhắn văn bản, chưa có metadata hội thoại chuyên biệt.


## Bản cập nhật giao diện tin nhắn (19-11-2026)
- Gom toàn bộ emoji cảm xúc vào một khung gọn, căn phải bên dưới tin nhắn và không tham gia luồng bố cục; bấm vào khung để mở danh sách người dùng, avatar và emoji họ đã thả.
- Tin nhắn đã thu hồi hiển thị dòng chữ mờ; người gửi có thể xóa riêng thông báo thu hồi ở phía mình.
- Audio có viền bo tròn bao quanh trình phát.
- Trả lời tin nhắn được lưu bằng metadata riêng và hiển thị thành thẻ trích dẫn phía trên nội dung, không ghép vào nội dung tin nhắn. Metadata trả lời được lưu trong SQLite và khôi phục khi tải lịch sử.
- Chuyển tiếp mở hộp chọn nhiều cuộc trò chuyện cá nhân/nhóm, có ô tìm kiếm; người nhận thấy thông báo dạng “tên người dùng đã chuyển tiếp một tin nhắn” kèm nội dung được chuyển tiếp.
- Đã kiểm tra cú pháp JavaScript và cấu trúc HTML; chưa chạy Maven build trong môi trường này.
