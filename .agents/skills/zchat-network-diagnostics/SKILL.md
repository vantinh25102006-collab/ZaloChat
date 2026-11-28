---
name: zchat-network-diagnostics
description: >-
  Quy trình kiểm tra, chẩn đoán và thuyết trình các giao thức mạng trong dự án ZaloChat
  (HTTPS/WSS cổng 8080, P2P Direct TCP Socket cho chat 1-1, UDP Multicast cổng 6789 cho chat nhóm,
  và FTP Server cổng 2121 cho truyền tải file). Sử dụng skill này khi người dùng hỏi về trạng thái
  mạng, cách demo đồ án, hoặc kiểm tra lỗi kết nối cổng.
---

# Chẩn đoán & Demo Giao thức Mạng ZaloChat

Xem bảng tổng hợp cổng và vị trí mã nguồn chi tiết tại [protocol-ports.md](./references/protocol-ports.md).

## 1. Kiểm tra nhanh các cổng đang lắng nghe trên máy
Chạy lệnh PowerShell sau để kiểm tra các cổng của hệ thống (`8080` HTTPS/WSS, `2121` FTP, `6789` UDP Multicast):
```powershell
netstat -ano | findstr ":8080 :2121 :6789"
```

## 2. Kiểm tra FTP Server (Cổng `2121`)
1. Mở trình duyệt truy cập: `https://localhost:8080/api/files/ftp-status`
2. Hoặc thử kết nối bằng FTP CLI trên Windows:
   ```cmd
   ftp localhost 2121
   ```
   - Tài khoản mặc định: `zchat` / `zchat2121`

## 3. Quan sát Log Demo khi báo cáo đồ án
Khi chạy Server trên Terminal, mỗi thao tác trên giao diện Web sẽ in log chứng minh giao thức tương ứng:
- **Đăng nhập**: `[P2P-NODE] User '...' khởi tạo P2P Peer tại 127.0.0.1:<port> và MulticastSocket(:6789)`
- **Nhắn tin 1-1**: `[P2P-DIRECT] Peer '<sender>' (port ...) ==> P2P Socket ==> Peer '<receiver>' (127.0.0.1:...)`
- **Tạo / Vào nhóm**: `[UDP-MULTICAST] User '...' JOINED group '...' via MulticastSocket.joinGroup(/239.255.X.Y:6789)`
- **Nhắn tin nhóm**: `[UDP-MULTICAST] '...' gửi DatagramPacket (... bytes) tới nhóm '...' (239.255.X.Y:6789)`
- **Rời / Xóa khỏi nhóm**: `[UDP-MULTICAST] User '...' LEFT group '...' via MulticastSocket.leaveGroup(/239.255.X.Y:6789)`
- **Gửi / Tải / Xóa file**: `[FTP-Client -> 127.0.0.1:2121] STOR / RETR / DELE thành công`

