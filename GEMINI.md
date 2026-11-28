# Quy tắc Dự án ZaloChat (Lập trình Ứng dụng Mạng)

Tài liệu này định nghĩa các quy tắc cốt lõi mà AI Agent phải tuân thủ khi làm việc trên dự án **ZaloChat (SecureTcpChat)**.

## 1. Ngôn ngữ & Phong cách Giao tiếp
- Luôn trả lời người dùng bằng **tiếng Việt**, ngắn gọn, rõ ràng và có cấu trúc Markdown trực quan.
- Mọi đường dẫn tới tệp hoặc dòng code trong câu trả lời phải dùng liên kết nhấn được dạng `[Tên_tệp](file:///d:/Myfolder/Mypratice/LTUDM/ZaloChat/...)`.

## 2. Kiến trúc Mạng Bắt buộc (Core Network Protocols)
Dự án phục vụ môn học **Lập trình ứng dụng mạng**, vì vậy mọi thay đổi **tuyệt đối không được làm mất** các cơ chế mạng sau:
1. **Bảo mật TLS/SSL (`HTTPS` & `WSS`)**:
   - Web Server chạy HTTPS/WSS tại cổng `8080` sử dụng keystore `server/certificates/server.p12` (cấu hình trong `application.properties` và `webapp/WebProgram.java`).
2. **Nhắn tin 1-vs-1 (Peer-to-Peer / P2P)**:
   - Backend: Mỗi người dùng khi đăng nhập khởi tạo một `ServerSocket` P2P riêng biệt trong `webapp/runtime/P2PAndMulticastManager.java`. Khi nhắn tin 1-1, Peer người gửi kết nối `Socket` TCP trực tiếp sang cổng P2P của Peer người nhận (`sendP2PDirectMessage`).
   - Frontend: Hỗ trợ kênh `RTCPeerConnection` / `RTCDataChannel` trong `static/app.js` và cơ chế Store-and-Forward qua SQLite khi người nhận ngoại tuyến.
3. **Nhắn tin Nhóm (UDP Multicast)**:
   - Mỗi nhóm (`model/Group.java`) có một địa chỉ IP Multicast lớp D riêng (`239.255.X.Y:6789`) tính từ `groupId` (`getMulticastIp()`).
   - Tạo nhóm / đăng nhập / vào nhóm: bắt buộc gọi `MulticastSocket.joinGroup(...)`.
   - Rời nhóm / bị mời ra khỏi nhóm / đăng xuất: bắt buộc gọi `MulticastSocket.leaveGroup(...)`.
   - Gửi tin nhắn nhóm: đóng gói `DatagramPacket` và phát qua `MulticastSocket.send(...)` (`sendMulticastGroupMessage`).
4. **Truyền tải & Lưu trữ Tệp qua FTP Server (Cổng `2121`)**:
   - `webapp/runtime/EmbeddedFtpServer.java` chạy máy chủ FTP chuẩn RFC 959 tại cổng `2121` (thư mục gốc `uploads/`).
   - `webapp/FileController.java` thực hiện `STOR` (upload), `RETR` (download) và `DELE` (xóa vật lý khi thu hồi tin nhắn hoặc thay ảnh đại diện/ảnh bìa cũ) qua FTP cổng `2121`.

## 3. Quy tắc Giao diện & Đồng bộ Frontend
- Giữ nguyên giao diện phong cách **Zalo PC** trong `static/index.html` và `static/app.js` (bao gồm bộ công cụ xem trước file Word/Excel/PowerPoint/PDF/Code trực tiếp trên nền tảng và điều hướng ảnh/video trái-phải).
- **Quy tắc đồng bộ bắt buộc**: Mỗi khi chỉnh sửa `static/app.js` hoặc `static/index.html`:
  1. Kiểm tra cú pháp bằng `node --check "d:\Myfolder\Mypratice\LTUDM\ZaloChat\static\app.js"`.
  2. Cập nhật tham số cache-buster `app.js?v=...` trong `static/index.html`.
  3. Sao chép cả hai tệp sang `target/classes/static/` để Server đang chạy nhận ngay thay đổi mà không cần khởi động lại.

