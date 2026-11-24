# Danh sách các mục cần sửa (Fix Plan)

- **Xóa file vật lý khi thu hồi tin nhắn:** Khi người dùng thu hồi tin nhắn có đính kèm file (ảnh, audio, video, tài liệu) trên web, hệ thống phải tự động xóa luôn file vật lý tương ứng trong thư mục `uploads/` (và xóa khỏi bộ nhớ tạm `fileRegistry`), trừ trường hợp `fileId` đó vẫn đang được tham chiếu bởi một tin nhắn khác chưa thu hồi.
- **Tự động dọn dẹp file Avatar / Ảnh bìa cũ khi đổi hoặc xóa:** Khi người dùng thay đổi hoặc xóa ảnh đại diện (avatar) hay ảnh bìa (cover), hệ thống cần tự động xóa file ảnh cũ tương ứng trong thư mục `uploads/avatars/` trên ổ cứng để tránh tồn đọng file rác, đồng thời hỗ trợ xóa avatar/ảnh bìa về trạng thái mặc định.
- **Sửa lỗi không upload được Ảnh bìa (Cover):** Bổ sung tham số `uploader` (`fd.append('uploader', state.username)`) vào hàm `uploadProfileCover` trong `static/app.js`, đồng thời cập nhật API `/api/files/avatar` trong `webapp/FileController.java` (hoặc phân biệt theo loại `target = avatar | cover`) để khi tải ảnh bìa lên chỉ cập nhật `cover_path` mà không ghi đè mất `avatar_path` của người dùng.
- **Tách hành vi 2 nút trên thẻ File đính kèm:** Trên thẻ hiển thị file được gửi trong khung chat (hai nút ở góc phải của thẻ file):
  - **Nút bên trái (`↗` / Lưu như...):** Mở hộp thoại chọn thư mục/đường dẫn lưu file trên máy của người dùng (sử dụng File System Access API `window.showSaveFilePicker` trên trình duyệt hỗ trợ để người dùng chỉ định nơi lưu và tên file).
  - **Nút bên phải (`⬇` / Tải xuống):** Tải thẳng file về thư mục `Downloads` mặc định của trình duyệt.
- **Thay thế toàn bộ Emoji/Sticker giao diện bằng bộ Icon SVG Vector chuyên nghiệp, đồng bộ:** Rà soát và đổi tất cả các biểu tượng đang dùng emoji/ký tự chữ thô trong `static/app.js` và `static/index.html` sang icon SVG đường nét mảnh (chuẩn Lucide / Zalo PC):
  - **Hộp thoại "Tùy chọn đoạn chat" (`openConversationOptions`):** Xem trang cá nhân (`👤`), Chặn/Gỡ chặn (`🚫`/`🔓`), Hủy kết bạn (`👥`), Xem thành viên nhóm (`👥`), Thêm thành viên (`➕`), Chuyển quyền trưởng nhóm (`♛`), Rời nhóm (`↪`), Giải tán nhóm (`🗑️`), Bật/Tắt thông báo (`🔔`/`🔕`), Tìm kiếm cuộc trò chuyện (`🔎`), Xóa cuộc trò chuyện ở phía tôi (`🗑️`).
  - **Thanh tiêu đề & Bảng thông tin bên phải (`index.html` & `renderRightPanel`):** Nút mở tùy chọn đoạn chat (`!` trên header → icon 3 chấm/sidebar info chuẩn), các tab `📁 File`, `🖼️ Ảnh`, `🔗 Link`, biểu tượng file âm thanh (`🎵`) và các nút tải xuống (`⬇`) trong danh sách file chia sẻ, trình phát audio (`audio-dl`) và trình xem ảnh (`image-viewer-download`).
  - **Thông báo Toast (`showToast`):** Thay các emoji `ℹ️`, `✅`, `❌` bằng icon SVG trạng thái tương ứng.
- **Điều hướng Lên/Xuống và Highlight kết quả khi Tìm kiếm trong cuộc trò chuyện (`performMsgSearch`):**
  - Hiển thị số thứ tự kết quả đang chọn trên tổng số kết quả tìm thấy (ví dụ: `1/5 kết quả`).
  - Bổ sung 2 nút mũi tên **Lên (`▲`) / Xuống (`▼`)** trên thanh tìm kiếm (`#msg-search-bar`) cùng phím tắt `Enter` / `Shift+Enter` để di chuyển qua lại giữa các kết quả.
  - Khi chuyển tới kết quả nào, tự động cuộn mượt (`scrollIntoView({ behavior: 'smooth', block: 'center' })`) đến đúng tin nhắn chứa kết quả đó và làm nổi bật (highlight đậm/khác màu + hiệu ứng viền bong bóng tin nhắn) kết quả đang được trỏ tới so với các kết quả còn lại.
- **Hiển thị đầy đủ Tác giả (Người gửi) và Thời gian gửi ở mục Gửi File:**
  - Trong **Bảng thông tin cuộc trò chuyện bên phải (`renderRightPanel` - tab File & Âm thanh)** và **Thẻ file chia sẻ**: hiển thị rõ tên người gửi (`m.from || m.username`), dung lượng file và thời gian gửi (`formatTime(m.timestamp)` / ngày giờ đầy đủ) cho từng file và audio được chia sẻ.
- **Giới hạn tìm kiếm ở danh sách Đoạn chat (không tìm người chưa kết bạn):**
  - Ở ô tìm kiếm của danh sách Đoạn chat (`#search-input` bên cột trái): chỉ lọc các cuộc trò chuyện hiện có, bạn bè đã kết bạn hoặc nhóm đã tham gia; loại bỏ việc gọi `search_users` để hiển thị người lạ chưa kết bạn trong danh sách đoạn chat.
  - Người dùng chưa kết bạn chỉ có thể được tìm kiếm thông qua hộp thoại **"Thêm bạn bè"** (`openAddFriendModal` / tìm qua số điện thoại).
- **Hiển thị huy hiệu (Badge) số lượng tin nhắn chưa đọc ở mục "Chưa đọc":**
  - Khi có tin nhắn chưa đọc, hiển thị badge đếm số lượng (tương tự huy hiệu đỏ ở mục Lời mời kết bạn `<span class="tab-badge">...</span>`) ngay trên tab **"Chưa đọc"** (`#tab-unread`) và trên nút biểu tượng Đoạn chat ở thanh điều hướng bên trái (`#nav-chats`).
  - Tự động cập nhật số lượng khi có tin nhắn mới đến và ẩn badge khi người dùng đã mở xem hết các cuộc trò chuyện chưa đọc.
- **Chuyển đổi trạng thái nút "Kết bạn" ↔ "Hủy lời mời" ngay lập tức (Real-time UI update):**
  - Khi người dùng bấm **"Kết bạn"** (ở cả hộp thoại Tìm kiếm bạn bè, Trang cá nhân hay Banner người lạ trong khung chat), nút phải chuyển ngay lập tức sang **"Hủy lời mời"** (và ngược lại khi bấm **"Hủy lời mời"** thì chuyển ngay về **"Kết bạn"**) mà không cần đóng hộp thoại/thoát ra vào lại.
  - Đồng bộ `requestId` trả về từ sự kiện `friend_request` (`status: 'sent'`) và `friend_cancel` vào `state.viewedProfile` để người dùng có thể bấm "Hủy lời mời" ngay sau khi vừa bấm "Kết bạn".
- **Hiển thị thời gian Offline / Truy cập lần cuối (`lastSeen`):**
  - Lưu lại mốc thời gian hoạt động/đăng xuất gần nhất (`last_seen`) của từng người dùng trong Database và `ChatPresenceRegistry`, gửi kèm thông tin này qua WebSocket (`user_list`, `friend_list`, `user_profile`).
  - Trên giao diện Web (tiêu đề khung chat `#chat-header-status`, danh sách bạn bè, thẻ thông tin cá nhân): khi người dùng Offline, thay vì chỉ hiện chữ `"○ Offline"`, hiển thị chi tiết thời gian truy cập như: *"Truy cập vừa xong"*, *"Truy cập 1 phút trước"*, *"Truy cập 2 giờ trước"*, *"Truy cập hôm qua"*, hoặc *"Truy cập ngày 10/11/2026"* (và tự động làm mới bộ đếm thời gian mỗi phút).
- **Menu tương tác khi bấm vào Avatar người gửi trong Nhóm & Quyền hạn Trưởng nhóm:**
  - **Menu popup (combobox/dropdown) khi bấm vào Avatar cạnh tin nhắn trong nhóm:** Hiển thị danh sách thao tác nhanh gồm: **Nhắn tin riêng**, **Xem trang cá nhân**, và nếu người bấm là **Trưởng nhóm** (click vào avatar thành viên khác) sẽ hiện thêm tùy chọn **Xóa khỏi nhóm** (hỗ trợ API WebSocket `group_remove_member` / kick thành viên ở backend).
  - **Trưởng nhóm được phép thu hồi tin nhắn 2 phía của bất kỳ thành viên nào:** Hiển thị nút **"Thu hồi hai phía"** cho Trưởng nhóm trên mọi tin nhắn trong nhóm và cập nhật `ChatWebSocketHandler` / `DatabaseManager` để cho phép Trưởng nhóm thu hồi tin nhắn của thành viên khác trong nhóm.
  - **Giao diện chọn thành viên khi Chuyển quyền trưởng nhóm:** Khi bấm vào **"Chuyển quyền trưởng nhóm"**, mở hộp thoại hiển thị danh sách các thành viên hiện có trong nhóm (kèm avatar/tên) để người dùng tích chọn 1 thành viên, sau đó hiển thị hộp thoại xác nhận thêm 1 lần nữa trước khi chính thức nhượng quyền.
- **Giao diện chọn nhiều Bạn bè khi Thêm thành viên vào nhóm & Mở quyền cho mọi thành viên nhóm:**
  - Cho phép **tất cả thành viên trong nhóm** (không chỉ riêng Trưởng nhóm) đều có thể sử dụng chức năng **"Thêm thành viên"** (cập nhật cả giao diện menu tùy chọn nhóm lẫn kiểm tra quyền ở `handleGroupAddMember` trong `ChatWebSocketHandler.java`).
  - Khi bấm **"Thêm thành viên"**, mở hộp thoại hiển thị danh sách **những người đã kết bạn** (chưa ở trong nhóm) kèm ô tìm kiếm và checkbox để chọn **một hoặc nhiều người cùng lúc** rồi thêm vào nhóm.
- **Nâng cấp Xem thành viên nhóm, Thông báo rời nhóm và Đổi tên / Ảnh đại diện nhóm:**
  - **Hộp thoại Xem thành viên nhóm (`showGroupMembers`):** Thay thế hộp `alert()` bằng một Modal giao diện đẹp hiển thị danh sách thành viên hiện có trong nhóm (kèm ảnh đại diện, tên, huy hiệu *"Trưởng nhóm"*, trạng thái hoạt động, nút xem trang cá nhân / nhắn tin, và nút xóa khỏi nhóm nếu người xem là Trưởng nhóm).
  - **Thông báo giữa đoạn chat khi có người rời nhóm:** Khi một thành viên thoát khỏi nhóm, hệ thống tạo và gửi thông báo hiển thị ở chính giữa khung chat của nhóm với nội dung `"[tên người dùng] đã rời nhóm"` (lưu vào lịch sử đoạn chat nhóm để mọi thành viên đều thấy).
  - **Tính năng Đổi tên nhóm và Đổi ảnh đại diện nhóm:** Bổ sung tùy chọn đổi tên nhóm và upload ảnh đại diện cho nhóm (lưu `avatar_path` của nhóm trong bảng `groups`, tự động dọn ảnh đại diện nhóm cũ khi thay ảnh mới, và đồng bộ hiển thị avatar + tên nhóm mới theo thời gian thực trên danh sách đoạn chat cũng như tiêu đề khung chat của tất cả thành viên).
- **Hiển thị dòng chữ nền khi đoạn chat chưa có tin nhắn:**
  - Khi người dùng mở một cuộc trò chuyện (cá nhân hoặc nhóm) mà trong đó chưa có tin nhắn nào (`conv.messages.length === 0`), hiển thị ở chính giữa background của vùng tin nhắn (`#messages-container`) dòng chữ mờ cỡ lớn **"Hãy bắt đầu cuộc trò chuyện"**.
- **Thông báo hệ thống ở chính giữa đoạn chat cho mọi hoạt động của Nhóm:**
  - Khi trong nhóm có các sự kiện thay đổi, hệ thống tự động tạo, lưu vào lịch sử SQLite và phát thông báo căn giữa khung chat nhóm cho tất cả thành viên:
    - **Thêm thành viên:** `"[người thêm] đã thêm [tên thành viên] vào nhóm"`
    - **Rời nhóm:** `"[tên người dùng] đã rời nhóm"`
    - **Bị xóa khỏi nhóm:** `"[trưởng nhóm] đã xóa [tên thành viên] khỏi nhóm"`
    - **Đổi tên nhóm:** `"[người đổi] đã đổi tên nhóm thành \"[tên mới]\""`
    - **Đổi ảnh đại diện nhóm / Chuyển quyền trưởng nhóm:** Hiển thị thông báo tương ứng ở giữa đoạn chat.














