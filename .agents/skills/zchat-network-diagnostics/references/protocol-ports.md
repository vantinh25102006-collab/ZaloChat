# Sơ đồ Cổng & Vị trí Code các Giao thức Mạng trong ZaloChat

| Giao thức / Chức năng | Cổng / Địa chỉ | Lớp Java / Tệp xử lý chính | Phương thức tiêu biểu |
| :--- | :--- | :--- | :--- |
| **HTTPS & WSS (TLS 1.2/1.3)** | TCP `8080` | `webapp/WebProgram.java`, `application.properties` | Cấu hình SSL Keystore `server/certificates/server.p12` |
| **Chat 1-1 (P2P Direct Socket)** | TCP động (`127.0.0.1:<p2pPort>`) | `webapp/runtime/P2PAndMulticastManager.java` | `registerUserNode()`, `sendP2PDirectMessage()`, `runP2pAcceptLoop()` |
| **Chat 1-1 (WebRTC Browser P2P)** | `RTCDataChannel` (`zchat-p2p`) | `static/app.js`, `webapp/ChatWebSocketHandler.java` | `ensureP2PDataChannel()`, `onP2PSignal()`, `handleP2PSignal()` |
| **Chat Nhóm (UDP Multicast)** | UDP `239.255.X.Y:6789` | `webapp/runtime/P2PAndMulticastManager.java`, `model/Group.java` | `getMulticastIp()`, `joinMulticastGroup()`, `leaveMulticastGroup()`, `sendMulticastGroupMessage()` |
| **FTP Server & Client (RFC 959)** | TCP `2121` (Passive port động) | `webapp/runtime/EmbeddedFtpServer.java`, `webapp/FileController.java` | `uploadViaFtp()` (`STOR`), `downloadViaFtp()` (`RETR`), `deleteViaFtp()` (`DELE`) |
| **Cơ sở dữ liệu cục bộ** | File `zchat.db` (SQLite WAL) | `server/DatabaseManager.java` | Lưu lịch sử tin nhắn, người dùng, bạn bè, nhóm và phiên đăng nhập |

