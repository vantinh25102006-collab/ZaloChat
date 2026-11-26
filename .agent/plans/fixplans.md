- **Biểu tượng Chìa khóa vàng Trưởng nhóm trên Avatar:**
  - Khi Trưởng nhóm nhắn tin trong nhóm, hiển thị huy hiệu **chìa khóa vàng** ở góc dưới bên phải của Avatar cạnh tin nhắn.
  - Trong hộp thoại **Danh sách thành viên nhóm (`showGroupMembers`)**, hiển thị huy hiệu **chìa khóa vàng** ở góc dưới Avatar của Trưởng nhóm.
- **Định dạng thông báo tin nhắn mới của Nhóm ở danh sách Đoạn chat & Gộp mục "Ảnh và video":**
  - Khi có người nhắn tin trong nhóm, dòng tóm tắt ở danh sách đoạn chat hiển thị theo định dạng:
    - Văn bản: `[người gửi]: chào anh em tôi...`
    - File tài liệu: `[người gửi]: đã gửi 1 file.`
    - Hình ảnh: `[người gửi]: đã gửi 1 ảnh.` (hoặc `đã gửi N ảnh.` nếu gửi nhiều ảnh liên tiếp)
    - Video: `[người gửi]: đã gửi 1 video.`
    - Âm thanh / Ghi âm: `[người gửi]: đã gửi 1 tệp âm thanh.`
  - Đổi tên tab **"Ảnh"** ở bảng thông tin cuộc trò chuyện bên phải thành **"Ảnh và video"**, đồng thời đưa toàn bộ các video được gửi vào mục này (tách khỏi mục File).
- **Điều hướng Trái / Phải khi xem Ảnh và Video trong trình xem phóng to (`#image-viewer`):**
  - Hiển thị 2 nút mũi tên **Trái (`‹`)** và **Phải (`›`)** ở hai bên màn hình trình xem ảnh/video (kèm hỗ trợ phím mũi tên `←` / `→` trên bàn phím và hiển thị thứ tự `1/N`) để chuyển mượt qua lại giữa ảnh hoặc video trước đó / kế tiếp trong kho **Ảnh và video** của cuộc trò chuyện.
  - Khi đã di chuyển đến ảnh/video đầu tiên hoặc cuối cùng ở hướng nào thì nút mũi tên ở hướng đó sẽ bị làm mờ và vô hiệu hóa (`disabled`), không cho bấm tiếp.
- **Chuyển cơ chế nhắn tin 1-1 sang Peer-to-Peer (P2P) và Nhóm (Group) sang UDP Multicast (`joinGroup` / `leaveGroup`):**
  - **Group Chat dùng UDP Multicast (`java.net.MulticastSocket`):**
    - Mỗi nhóm có một địa chỉ IP Multicast lớp D riêng (`239.255.x.y:6789`).
    - Khi tạo nhóm, thêm thành viên hoặc đăng nhập: gọi `multicastSocket.joinGroup(groupSocketAddress, networkInterface)` để tham gia nhóm Multicast.
    - Khi rời nhóm (`group_leave`), bị xóa khỏi nhóm (`group_remove_member`) hoặc giải tán nhóm: gọi `multicastSocket.leaveGroup(groupSocketAddress, networkInterface)` để thoát nhóm Multicast.
    - Khi gửi tin nhắn nhóm: truyền gói tin qua `DatagramPacket` tới địa chỉ Multicast của nhóm (`multicastSocket.send(packet)`), các node thành viên đã `joinGroup` nhận qua `multicastSocket.receive(packet)`.
  - **Chat 1-1 dùng Peer-to-Peer (P2P Socket & WebRTC DataChannel):**
    - Mỗi người dùng khi online khởi tạo một P2P Peer Node lắng nghe trên cổng TCP P2P riêng (`ServerSocket(0)`) và kết nối trực tiếp Peer-to-Peer (`Socket`) từ Peer người gửi sang Peer người nhận khi nhắn tin 1-1, đồng thời hỗ trợ WebRTC `RTCDataChannel` trực tiếp giữa hai trình duyệt.



















