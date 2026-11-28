# Quy tắc Kiến trúc Mạng & Giao thức (Backend Java)

## 1. Cấu trúc Package
- `model/`: Chứa `ChatMessage`, `MessageType`, `Group` (bao gồm hàm `getMulticastIp()` sinh địa chỉ lớp D `239.255.X.Y`).
- `server/`: Chứa `DatabaseManager` (SQLite `zchat.db` chế độ WAL), `UserStore`, và TCP/TLS Server truyền thống (cổng `5000`).
- `webapp/`: Chứa Spring Boot Web/WebSocket (`WebProgram`, `ChatWebSocketHandler`, `FileController`, `ChatRuntimeConfiguration`).
- `webapp/runtime/`:
  - `P2PAndMulticastManager.java`: Quản lý P2P TCP Socket cho chat 1-1 và `MulticastSocket` (cổng `6789`) cho chat nhóm.
  - `EmbeddedFtpServer.java`: Quản lý FTP Server & FTP Mini Client (cổng `2121`) theo chuẩn RFC 959.

## 2. Quy chuẩn khi sửa đổi Backend
- Khi thêm hành động xóa/thu hồi tin nhắn file hoặc cập nhật avatar/cover, luôn gọi `FileController.deleteStoredFile(...)` để xóa file vật lý qua FTP `DELE` và trên ổ đĩa `uploads/`.
- Khi biên dịch lẻ các file `.java` trên Windows bằng `javac`, nếu cần nạp toàn bộ thư viện `.jar` từ `.m2/repository`, phải ghi tham số `-cp` vào file tạm `@argfile` để tránh lỗi `The filename or extension is too long` của Windows.
- Không commit mật khẩu thật hoặc khóa bí mật mới ngoài chứng chỉ demo phục vụ môn học.

