# SecureTcpChat – Java TCP Chat với SSL/TLS

Dự án thực hành theo cấu trúc Server / Client / Model / Certificates. Java 17+, Maven, Gson.

## 1. Cấu trúc

```text
SecureTcpChat/
├── pom.xml
├── server/
│   ├── Program.java
│   ├── ChatServer.java
│   ├── ClientSession.java
│   ├── UserStore.java
│   └── certificates/       # server.p12 + server.crt (tạo bằng script)
├── client/
│   ├── Program.java
│   ├── ChatClient.java
│   └── certificates/       # chỉ có server.crt
├── model/
│   ├── ChatMessage.java
│   └── MessageType.java
└── scripts/generate-certificate.ps1
```

## 2. Yêu cầu

- JDK 17 trở lên (`java -version`, `javac -version`).
- Maven (`mvn -version`).
- PowerShell trên Windows; `keytool` phải có trong PATH (đi kèm JDK).

## 3. Tạo chứng chỉ TLS (Windows PowerShell)

Mở PowerShell tại thư mục gốc `SecureTcpChat`.

Máy chạy Server và Client trên cùng máy:

```powershell
.\scripts\generate-certificate.ps1
```

Nếu Client chạy trên máy khác trong LAN, lấy IPv4 LAN của máy Server bằng `ipconfig`, ví dụ `192.168.1.10`, sau đó tạo chứng chỉ có IP trong SAN:

```powershell
.\scripts\generate-certificate.ps1 -LanIp "192.168.1.10"
```

Script hỏi mật khẩu keystore (tối thiểu 12 ký tự). Ghi nhớ mật khẩu này. Kết quả:

- `server/certificates/server.p12`: Private Key + Certificate, chỉ đặt ở Server.
- `server/certificates/server.crt`: Public Certificate.
- `client/certificates/server.crt`: bản sao Public Certificate để Client tin cậy Server.

Không sao chép `server.p12` sang Client. Không commit file `.p12` lên Git.

### Đặt mật khẩu keystore trong PowerShell

Trong cùng cửa sổ PowerShell dùng để chạy Server:

```powershell
$env:CHAT_KEYSTORE_PASSWORD = "MatKhauBanDaNhap"
```

Không cần đặt biến này ở Client.

### Kiểm tra chứng chỉ

```powershell
keytool -list -v -keystore server/certificates/server.p12 -storetype PKCS12
keytool -printcert -file server/certificates/server.crt
```

Lệnh đầu sẽ hỏi mật khẩu. Kiểm tra SAN có `DNSName: localhost`, `IPAddress: 127.0.0.1`, và IP LAN nếu đã thêm. Chứng chỉ demo tự ký (self-signed); Client tin cậy đúng certificate bằng truststore cục bộ.

## 4. Biên dịch

Tại thư mục gốc:

```powershell
mvn clean compile
```

Maven tải Gson ở lần build đầu tiên. Thành công khi thấy `BUILD SUCCESS`.

## 5. Chạy Server

Terminal 1, tại thư mục gốc:

```powershell
$env:CHAT_KEYSTORE_PASSWORD = "MatKhauBanDaNhap"
mvn exec:java "-Dexec.mainClass=server.Program"
```

Server lắng nghe TCP/TLS cổng `5000`.

## 6. Chạy Client

Terminal 2:

```powershell
mvn exec:java "-Dexec.mainClass=client.Program"
```

Mặc định Client kết nối `localhost:5000`.

Client trên máy khác trong LAN (đã tạo certificate với `-LanIp`):

```powershell
mvn exec:java "-Dexec.mainClass=client.Program" "-Dexec.args=192.168.1.10 5000"
```

Thay `192.168.1.10` bằng IP LAN thật của máy Server. Mở TCP port 5000 trên Windows Firewall nếu cần.

## 7. Tài khoản kiểm thử

| Username | Password |
|---|---|
| an | 123456 |
| binh | 123456 |
| tinh | 123456 |

Đây là tài khoản demo trong `UserStore`. Mật khẩu được băm PBKDF2-HMAC-SHA256 với salt ngẫu nhiên khi Server khởi tạo; không lưu mật khẩu rõ. Hãy thay bằng cơ sở dữ liệu và mật khẩu riêng trước khi triển khai thật.

Mở thêm Terminal 3, 4 và chạy Client để kiểm tra nhiều người cùng chat. Username đã đăng nhập sẽ bị từ chối nếu đăng nhập lần hai.

## 8. Giao thức JSON

Mỗi thông điệp là một JSON UTF-8 trên một dòng, kết thúc bằng newline `\n`, giới hạn frame 4 KB.

Đăng nhập Client → Server:

```json
{"type":"login","username":"an","password":"123456"}
```

Kết quả Server → Client:

```json
{"type":"login_result","success":true,"clientId":1,"content":"Đăng nhập thành công."}
```

Chat Client → Server:

```json
{"type":"message","content":"Xin chào mọi người!"}
```

Broadcast Server → các Client đã đăng nhập:

```json
{"type":"message","username":"an","clientId":1,"content":"Xin chào mọi người!"}
```

Các `type`: `login`, `login_result`, `message`, `system`, `disconnect`.

## 9. Bảo mật và giới hạn

- TLS 1.3/1.2; Client kiểm tra certificate chain (truststore) và hostname/IP qua SAN. Không dùng TrustAll.
- Đây là TLS một chiều: Client xác thực Server; chưa bật yêu cầu Client Certificate (mTLS).
- `server.p12` chứa Private Key và chỉ được lưu trên Server. `server.crt` là Public Certificate, có thể phân phối cho Client.
- Password chỉ đi qua TLS và được kiểm tra với PBKDF2 hash; không ghi password vào log. Demo user vẫn là dữ liệu cố định trong mã nguồn, không phải hệ thống tài khoản production.
- Mỗi Client có worker riêng; danh sách dùng `ConcurrentHashMap`; mỗi phiên có send lock để tránh byte của nhiều message xen kẽ.
- Frame parser giới hạn 4 KB và đọc đến newline; TCP là byte stream nên không dựa vào ranh giới packet.
- Chứng chỉ tự ký chỉ phù hợp học tập/lab. Môi trường thật nên dùng CA tin cậy, quản lý secret an toàn, rate limit đăng nhập, lưu tài khoản trong DB, và cân nhắc mTLS.

## 10. Xử lý lỗi thường gặp

**`Keystore was tampered with, or password was incorrect`**: biến `CHAT_KEYSTORE_PASSWORD` không trùng mật khẩu lúc tạo `server.p12`.

**`No subject alternative names matching ...`**: Client đang kết nối bằng host/IP không có trong SAN. Tạo lại chứng chỉ với `-LanIp` đúng và chạy lại script để copy certificate mới sang Client.

**`PKIX path building failed` / `unable to find valid certification path`**: Client đang dùng certificate cũ hoặc file `client/certificates/server.crt` không khớp certificate Server. Chạy lại script và đảm bảo đã copy certificate mới.

**`Connection refused`**: Server chưa chạy, sai IP/cổng hoặc firewall chặn TCP 5000.

**`Address already in use`**: cổng 5000 đang được chương trình khác sử dụng; dừng tiến trình đó hoặc chạy Server với cổng khác (ví dụ `mvn exec:java "-Dexec.mainClass=server.Program" "-Dexec.args=5001"`, đồng thời đổi cổng Client tương ứng).


Các chức năng mới của bản cập nhật hiện tại và hướng dẫn chạy: xem `README_FEATURES_UPDATE.md`.
