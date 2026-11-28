# Quy tắc Giao diện ZaloChat Web (Frontend)

## 1. Tệp nguồn chính
- `static/index.html`: Chứa cấu trúc HTML và toàn bộ CSS giao diện Zalo PC, modal xem trước file (`#file-preview-modal-overlay`) và trình xem media toàn màn hình (`#image-viewer`).
- `static/app.js`: Chứa toàn bộ logic WebSocket (`wss://`), WebRTC P2P DataChannel, quản lý hội thoại/danh bạ/nhóm, và bộ giải mã file xem trước phía trình duyệt (Word `.docx`, Excel `.xlsx`/`.csv`, PowerPoint `.pptx`, PDF `Blob`, Code/Text, ZIP).

## 2. Quy định khi chỉnh sửa `static/app.js` và `static/index.html`
- Mọi hàm được gắn trong thuộc tính `onclick="..."` hoặc `oninput="..."` của HTML động bắt buộc phải được xuất ra `window` thông qua `Object.assign(window, { ... })` ở cuối tệp `static/app.js`.
- Tránh hiển thị các nhãn kỹ thuật thô (như `· P2P Direct` hay `· Multicast ...`) trên thanh tiêu đề cuộc trò chuyện trừ khi người dùng yêu cầu rõ.
- Trong trình xem ảnh/video toàn màn hình (`#image-viewer`), luôn giữ `user-select: none` để tránh hiện lớp phủ bôi xanh khi bấm nút chuyển ảnh nhanh và khóa (`disabled`) nút mũi tên ở ảnh đầu/cuối danh sách.
- Sau mỗi lần sửa `static/app.js` hoặc `static/index.html`, luôn chạy `node --check` và đồng bộ sang `target/classes/static/`.

