package webapp;

import com.google.gson.Gson;
import model.ChatMessage;
import model.Group;
import model.MessageType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import server.DatabaseManager;

import java.io.*;
import java.nio.file.*;
import java.util.*;

/**
 * REST controller cho upload/download file.
 * Upload: POST /api/files/upload  (multipart/form-data)
 * Download: GET /api/files/{fileId}
 * Shared files: GET /api/files/shared/{convId}
 * File được lưu trong thư mục riêng theo conversation.
 */
@RestController
@RequestMapping("/api/files")
public class FileController {

    private static final Path UPLOAD_DIR = Path.of("uploads");
    private static final long MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

    private final ChatWebSocketHandler wsHandler;
    private final Gson gson = new Gson();

    // fileId → metadata (in-memory, backed by DB for file shares)
    private static final Map<String, FileMetadata> fileRegistry = new java.util.concurrent.ConcurrentHashMap<>();

    public FileController(ChatWebSocketHandler wsHandler) {
        this.wsHandler = wsHandler;
        try { Files.createDirectories(UPLOAD_DIR); } catch (IOException ignored) { }
    }

    /** Xóa file vật lý trong thư mục uploads dựa theo fileId hoặc đường dẫn /api/files/{fileId}. */
    public static void deleteStoredFile(String fileIdOrUrl) {
        if (fileIdOrUrl == null || fileIdOrUrl.isBlank()) return;
        String id = fileIdOrUrl.strip();
        int slash = id.lastIndexOf('/');
        if (slash >= 0) id = id.substring(slash + 1);
        int q = id.indexOf('?');
        if (q >= 0) id = id.substring(0, q);
        if (id.isBlank()) return;

        FileMetadata removed = fileRegistry.remove(id);
        if (removed != null && removed.storedName() != null) {
            try { Files.deleteIfExists(Path.of(removed.storedName())); } catch (IOException ignored) { }
        }
        final String targetId = id;
        if (Files.exists(UPLOAD_DIR)) {
            try (var paths = Files.walk(UPLOAD_DIR)) {
                paths.filter(Files::isRegularFile)
                     .filter(p -> {
                         String fn = p.getFileName().toString();
                         return fn.equals(targetId) || fn.startsWith(targetId + ".");
                     })
                     .forEach(p -> {
                         try { Files.deleteIfExists(p); } catch (IOException ignored) { }
                     });
            } catch (IOException ignored) { }
        }
    }

    /** Upload file và tuỳ chọn chia sẻ ngay cho người dùng/nhóm. */
    @PostMapping("/upload")
    public ResponseEntity<?> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "uploader") String uploader,
            @RequestParam(value = "to", required = false) String to,
            @RequestParam(value = "groupId", required = false) String groupId,
            @RequestParam(value = "conversationId", required = false) String conversationId
    ) {
        var uploaderSession = wsHandler.getSessions().get(uploader);
        if (uploaderSession == null || !uploaderSession.isOpen()) {
            return ResponseEntity.status(401).body(Map.of("error", "Bạn chưa đăng nhập hoặc đã đăng xuất."));
        }
        if (groupId != null && !groupId.isBlank()) {
            Group targetGroup = wsHandler.getGroups().get(groupId);
            if (targetGroup == null || !targetGroup.hasMember(uploader)) {
                return ResponseEntity.status(403).body(Map.of("error", "Bạn không thuộc nhóm nhận file này."));
            }
        } else if (to != null && !to.isBlank()) {
            if (to.equals(uploader)) return ResponseEntity.badRequest().body(Map.of("error", "Không thể gửi file cho chính mình."));
            if (DatabaseManager.getInstance().isBlockedEitherWay(uploader, to))
                return ResponseEntity.status(403).body(Map.of("error", "Không thể gửi tệp vì một trong hai người đã chặn người còn lại."));
        }
        if (file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "File rỗng."));
        if (file.getSize() > MAX_FILE_SIZE) return ResponseEntity.badRequest().body(Map.of("error", "File vượt quá 50 MB."));

        // Xác định thư mục lưu file theo conversation
        Path targetDir;
        if (groupId != null && !groupId.isBlank()) {
            targetDir = Path.of("uploads/group_" + groupId);
        } else if (to != null && !to.isBlank()) {
            String key = uploader.compareTo(to) < 0 ? uploader + "_" + to : to + "_" + uploader;
            targetDir = Path.of("uploads/dm_" + key);
        } else {
            targetDir = UPLOAD_DIR;
        }
        try { Files.createDirectories(targetDir); } catch (IOException ignored) {}

        String originalFilename = sanitizeFilename(file.getOriginalFilename());
        String fileId = UUID.randomUUID().toString();
        String ext = getExtension(originalFilename);
        String storedName = fileId + (ext.isEmpty() ? "" : "." + ext);
        Path dest = targetDir.resolve(storedName);

        try {
            file.transferTo(dest);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Không thể lưu file: " + e.getMessage()));
        }

        String mimeType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        String fileSize = humanReadableSize(file.getSize());
        FileMetadata meta = new FileMetadata(fileId, originalFilename, dest.toString(), uploader, mimeType, fileSize, file.getSize());
        fileRegistry.put(fileId, meta);

        // Gửi thông báo qua WebSocket
        ChatMessage notify = ChatMessage.fileShare(uploader, to, groupId, fileId, originalFilename, fileSize, mimeType);
        String convId = groupId != null && !groupId.isBlank() ? "group:" + groupId
                : (to != null && !to.isBlank()
                    ? "dm:" + (uploader.compareTo(to) < 0 ? uploader + ":" + to : to + ":" + uploader)
                    : "global");
        notify.setConversationId(convId);
        notify.setMessageId(UUID.randomUUID().toString());

        // Save file share to DB
        DatabaseManager.getInstance().saveMessage(notify.getMessageId(), convId, uploader, to,
                "file_share", null, fileId, originalFilename, fileSize, mimeType);

        wsHandler.recordHistory(convId, notify);
        notifyFileShare(notify, uploader, to, groupId);

        return ResponseEntity.ok(Map.of(
                "fileId", fileId,
                "filename", originalFilename,
                "fileSize", fileSize,
                "mimeType", mimeType,
                "downloadUrl", "/api/files/" + fileId
        ));
    }

    /** Upload ảnh đại diện hoặc ảnh bìa cho tài khoản đang đăng nhập (hoặc ảnh đại diện nhóm). */
    @PostMapping("/avatar")
    public ResponseEntity<?> uploadAvatar(@RequestParam("file") MultipartFile file,
                                          @RequestParam("uploader") String uploader,
                                          @RequestParam(value = "target", required = false, defaultValue = "avatar") String target,
                                          @RequestParam(value = "groupId", required = false) String groupId) {
        var active = wsHandler.getSessions().get(uploader);
        if (active == null || !active.isOpen())
            return ResponseEntity.status(401).body(Map.of("error", "Bạn chưa đăng nhập."));
        if (file == null || file.isEmpty() || file.getSize() > 5 * 1024 * 1024)
            return ResponseEntity.badRequest().body(Map.of("error", "Ảnh không hợp lệ hoặc vượt quá 5 MB."));
        String mime = file.getContentType() == null ? "" : file.getContentType();
        if (!mime.startsWith("image/"))
            return ResponseEntity.badRequest().body(Map.of("error", "Chỉ chấp nhận tệp ảnh."));
        if ("group".equalsIgnoreCase(target) && (groupId == null || groupId.isBlank()
                || wsHandler.getGroups().get(groupId) == null
                || !wsHandler.getGroups().get(groupId).hasMember(uploader))) {
            return ResponseEntity.status(403).body(Map.of("error", "Bạn không có quyền đổi ảnh đại diện nhóm này."));
        }
        try {
            Path dir = UPLOAD_DIR.resolve("avatars");
            Files.createDirectories(dir);
            String id = UUID.randomUUID().toString();
            String ext = getExtension(sanitizeFilename(file.getOriginalFilename()));
            Path dest = dir.resolve(id + (ext.isEmpty() ? "" : "." + ext));
            file.transferTo(dest);
            String url = "/api/files/" + id;
            fileRegistry.put(id, new FileMetadata(id, target + (ext.isEmpty() ? "" : "." + ext),
                    dest.toString(), uploader, mime, humanReadableSize(file.getSize()), file.getSize()));

            if ("cover".equalsIgnoreCase(target)) {
                List<String> oldFiles = DatabaseManager.getInstance().updateProfile(uploader, null, url, null);
                oldFiles.forEach(FileController::deleteStoredFile);
                return ResponseEntity.ok(Map.of("avatarUrl", url, "coverUrl", url, "target", "cover"));
            } else if ("group".equalsIgnoreCase(target)) {
                return ResponseEntity.ok(Map.of("avatarUrl", url, "groupId", groupId, "target", "group"));
            } else {
                List<String> oldFiles = DatabaseManager.getInstance().updateProfile(uploader, url, null, null);
                oldFiles.forEach(FileController::deleteStoredFile);
                return ResponseEntity.ok(Map.of("avatarUrl", url, "target", "avatar"));
            }
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Không thể lưu ảnh."));
        }
    }

    /** Download file theo fileId. */
    @GetMapping("/{fileId}")
    public ResponseEntity<?> download(@PathVariable String fileId,
                                      @RequestHeader(value = "Range", required = false) String range) {
        FileMetadata meta = resolveMetadata(fileId);
        if (meta == null) return ResponseEntity.notFound().build();

        Path filePath = Path.of(meta.storedName());
        if (!Files.exists(filePath)) return ResponseEntity.notFound().build();

        try {
            long total = Files.size(filePath);
            String disposition = (meta.mimeType() != null && (meta.mimeType().startsWith("image/") || meta.mimeType().startsWith("audio/") || meta.mimeType().startsWith("video/")))
                    ? "inline; filename=\"" + meta.filename() + "\""
                    : "attachment; filename=\"" + meta.filename() + "\"";
            if (range != null && range.startsWith("bytes=")) {
                try {
                    String[] bounds = range.substring(6).split("-", 2);
                    long start;
                    long end;
                    if (bounds[0].isBlank()) {
                        long suffix = Long.parseLong(bounds[1]);
                        start = Math.max(0, total - suffix);
                        end = total - 1;
                    } else {
                        start = Long.parseLong(bounds[0]);
                        end = bounds.length > 1 && !bounds[1].isBlank() ? Long.parseLong(bounds[1]) : total - 1;
                    }
                    if (start < 0 || start >= total || end < start) {
                        HttpHeaders invalid = new HttpHeaders();
                        invalid.add(HttpHeaders.CONTENT_RANGE, "bytes */" + total);
                        return new ResponseEntity<>(null, invalid, HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
                    }
                    end = Math.min(end, total - 1);
                    int length = (int)(end - start + 1);
                byte[] data;
                try (RandomAccessFile raf = new RandomAccessFile(filePath.toFile(), "r")) {
                    raf.seek(start); data = new byte[length]; raf.readFully(data);
                }
                HttpHeaders headers = new HttpHeaders();
                headers.add(HttpHeaders.CONTENT_TYPE, meta.mimeType());
                headers.add(HttpHeaders.CONTENT_DISPOSITION, disposition);
                headers.add(HttpHeaders.ACCEPT_RANGES, "bytes");
                headers.add(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + total);
                headers.setContentLength(length);
                    return new ResponseEntity<>(data, headers, HttpStatus.PARTIAL_CONTENT);
                } catch (NumberFormatException | ArrayIndexOutOfBoundsException ex) {
                    HttpHeaders invalid = new HttpHeaders();
                    invalid.add(HttpHeaders.CONTENT_RANGE, "bytes */" + total);
                    return new ResponseEntity<>(null, invalid, HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
                }
            }
            byte[] data = Files.readAllBytes(filePath);
            return ResponseEntity.ok()
                    .header("Content-Type", meta.mimeType())
                    .header("Content-Disposition", disposition)
                    .header("Content-Length", String.valueOf(data.length))
                    .header("Accept-Ranges", "bytes")
                    .body(data);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Không thể đọc file."));
        }
    }

    /** Lấy metadata của file. */
    @GetMapping("/{fileId}/info")
    public ResponseEntity<?> info(@PathVariable String fileId) {
        FileMetadata meta = resolveMetadata(fileId);
        if (meta == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of(
                "fileId", meta.fileId(),
                "filename", meta.filename(),
                "fileSize", meta.fileSize(),
                "mimeType", meta.mimeType(),
                "uploader", meta.uploader(),
                "downloadUrl", "/api/files/" + fileId
        ));
    }

    private FileMetadata resolveMetadata(String fileId) {
        FileMetadata cached=fileRegistry.get(fileId);
        if(cached!=null)return cached;
        try {
            if(!Files.exists(UPLOAD_DIR))return null;
            Path path;
            try(var paths=Files.walk(UPLOAD_DIR)){
                path=paths.filter(Files::isRegularFile)
                    .filter(p->p.getFileName().toString().startsWith(fileId))
                    .findFirst().orElse(null);
            }
            if(path==null)return null;
            Map<String,String> saved=DatabaseManager.getInstance().getFileMetadata(fileId);
            String filename=saved!=null?saved.get("filename"):path.getFileName().toString();
            String mime=saved!=null?saved.get("mimeType"):Files.probeContentType(path);
            if(mime==null)mime=guessMime(path.getFileName().toString());
            String size=saved!=null?saved.get("fileSize"):humanReadableSize(Files.size(path));
            String uploader=saved!=null?saved.get("uploader"):"";
            FileMetadata meta=new FileMetadata(fileId,filename,path.toString(),uploader,mime,size,Files.size(path));
            fileRegistry.put(fileId,meta);return meta;
        }catch(IOException e){return null;}
    }

    private String guessMime(String name) {
        String n=name.toLowerCase(Locale.ROOT);
        if(n.endsWith(".webm"))return "audio/webm";
        if(n.endsWith(".m4a")||n.endsWith(".mp4"))return "audio/mp4";
        if(n.endsWith(".mp3"))return "audio/mpeg";
        if(n.endsWith(".ogg")||n.endsWith(".oga"))return "audio/ogg";
        if(n.endsWith(".wav"))return "audio/wav";
        if(n.endsWith(".png"))return "image/png";
        if(n.endsWith(".jpg")||n.endsWith(".jpeg"))return "image/jpeg";
        if(n.endsWith(".gif"))return "image/gif";
        if(n.endsWith(".webp"))return "image/webp";
        return "application/octet-stream";
    }

    // ── Utilities ─────────────────────────────────────────────────────

    private void notifyFileShare(ChatMessage msg, String from, String to, String groupId) {
        Map<String, WebSocketSession> sessions = wsHandler.getSessions();
        try {
            String json = gson.toJson(msg);
            if (groupId != null && !groupId.isBlank()) {
                Group group = wsHandler.getGroups().get(groupId);
                if (group != null) {
                    for (String member : group.getMembers()) {
                        WebSocketSession ms = sessions.get(member);
                        if (ms != null && ms.isOpen()) ms.sendMessage(new TextMessage(json));
                    }
                }
            } else if (to != null && !to.isBlank()) {
                WebSocketSession ts = sessions.get(to);
                if (ts != null && ts.isOpen()) ts.sendMessage(new TextMessage(json));
                WebSocketSession fs = sessions.get(from);
                if (fs != null && fs.isOpen()) fs.sendMessage(new TextMessage(json));
            } else {
                for (WebSocketSession s : sessions.values()) {
                    if (s.isOpen()) s.sendMessage(new TextMessage(json));
                }
            }
        } catch (IOException e) {
            System.err.println("[FileController] Lỗi gửi thông báo file: " + e.getMessage());
        }
    }

    private String sanitizeFilename(String name) {
        if (name == null) return "file";
        return name.replaceAll("[^\\w\\-.()]", "_").replaceAll("\\.{2,}", ".");
    }

    private String getExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 && dot < filename.length() - 1 ? filename.substring(dot + 1).toLowerCase() : "";
    }

    private String humanReadableSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        double kb = bytes / 1024.0;
        if (kb < 1024) return String.format("%.1f KB", kb);
        double mb = kb / 1024.0;
        if (mb < 1024) return String.format("%.1f MB", mb);
        return String.format("%.1f GB", mb / 1024.0);
    }

    private record FileMetadata(String fileId, String filename, String storedName,
                                String uploader, String mimeType, String fileSize, long sizeBytes) {}
}
