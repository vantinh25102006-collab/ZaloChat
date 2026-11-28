---
name: zchat-build-and-sync
description: >-
  Quy trình kiểm tra cú pháp JavaScript, đồng bộ tài nguyên tĩnh (static/ sang
  target/classes/static/) và biên dịch nóng các lớp Java của dự án ZaloChat.
  Sử dụng skill này sau khi chỉnh sửa code Frontend (app.js, index.html) hoặc Backend (.java).
---

# Quy trình Build & Đồng bộ Nhanh ZaloChat

Sử dụng quy trình này để áp dụng và kiểm tra các thay đổi trên dự án ZaloChat một cách an toàn trên Windows PowerShell.

## 1. Khi chỉnh sửa Frontend (`static/app.js` hoặc `static/index.html`)

1. **Cập nhật Cache-Buster**:
   Trong `static/index.html`, tăng hậu tố phiên bản tại thẻ `<script src="app.js?v=...">` để trình duyệt tải bản mới ngay khi nhấn F5.
2. **Kiểm tra cú pháp và đồng bộ sang `target/classes/static/`**:
   Chạy script trợ giúp [sync-and-check.ps1](./scripts/sync-and-check.ps1) hoặc chạy trực tiếp lệnh sau:
   ```powershell
   node --check "d:\Myfolder\Mypratice\LTUDM\ZaloChat\static\app.js"; Copy-Item -Force "d:\Myfolder\Mypratice\LTUDM\ZaloChat\static\app.js" "d:\Myfolder\Mypratice\LTUDM\ZaloChat\target\classes\static\app.js"; Copy-Item -Force "d:\Myfolder\Mypratice\LTUDM\ZaloChat\static\index.html" "d:\Myfolder\Mypratice\LTUDM\ZaloChat\target\classes\static\index.html"
   ```

## 2. Khi chỉnh sửa Backend (`.java`)

1. **Biên dịch lớp không phụ thuộc thư viện ngoài** (như `EmbeddedFtpServer.java`, `Group.java`, `ChatMessage.java`):
   ```powershell
   javac -encoding UTF-8 -cp target/classes -d target/classes <đường_dẫn_file_java>
   ```
2. **Biên dịch toàn bộ dự án bằng Maven**:
   ```powershell
   mvn test-compile
   ```
3. **Khởi chạy lại Server Web (khi có thay đổi ở tầng Java Backend)**:
   ```powershell
   mvn spring-boot:run
   ```

