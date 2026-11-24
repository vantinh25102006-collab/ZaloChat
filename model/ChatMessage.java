package model;

import java.time.Instant;
import java.util.List;

/**
 * DTO JSON dùng chung giữa Server, Web Client và Console Client.
 * Không ghi password vào log.
 */
public class ChatMessage {
    private MessageType type;
    private String username;      // người gửi
    private String password;      // chỉ dùng lúc login, xóa ngay sau đó
    private String content;
    private boolean success;
    private int clientId;
    private String timestamp;

    // ── Các field mới cho WebSocket protocol ──────────────────────────
    private String to;            // username đích (private message)
    private String groupId;       // id nhóm
    private String groupName;     // tên nhóm
    private List<String> members; // danh sách thành viên (khi tạo nhóm)
    private List<String> users;   // danh sách user online (user_list)
    private List<java.util.Map<String, String>> searchResults;
    private List<Object> groups;  // danh sách nhóm (group_list)
    private List<Object> messages;// lịch sử tin nhắn (history)
    private String fileId;        // UUID của file đã upload
    private String filename;      // tên gốc của file
    private String fileSize;      // kích thước file (human-readable)
    private String mimeType;      // MIME type của file
    private String conversationId;// "dm:username" hoặc "group:groupId"
    private String messageId;     // ID duy nhất của tin nhắn
    private String replyToId;
    private String replyToUsername;
    private String replyToContent;

    // ── Friend system fields ───────────────────────────────────────────
    private String phone;         // SĐT người dùng (search/profile)
    private String displayName;   // Tên hiển thị
    private String avatarColor;   // Màu avatar
    private String status;        // Trạng thái quan hệ: friend/stranger/pending_sent/pending_received
    private List<java.util.Map<String, String>> friendList; // danh sách bạn bè
    private List<java.util.Map<String, String>> pendingRequests; // lời mời chờ
    private String requestId;     // ID của friend request
    private String lastSeen;      // thời gian truy cập gần nhất (ISO-8601)
    private java.util.Map<String, String> lastSeenMap; // username -> lastSeen ISO-8601
    private String avatarPath;    // đường dẫn avatar (user hoặc group)

    public ChatMessage() { }

    // ── Factory methods cho TCP protocol (giữ nguyên) ──────────────────

    public static ChatMessage login(String username, String password) {
        ChatMessage m = new ChatMessage();
        m.type = MessageType.LOGIN;
        m.username = username;
        m.password = password;
        return m;
    }

    public static ChatMessage loginResult(boolean success, int clientId, String content) {
        ChatMessage m = new ChatMessage();
        m.type = MessageType.LOGIN_RESULT;
        m.success = success;
        m.clientId = clientId;
        m.content = content;
        m.timestamp = Instant.now().toString();
        return m;
    }

    public static ChatMessage message(MessageType type, String username, int clientId, String content) {
        ChatMessage m = new ChatMessage();
        m.type = type;
        m.username = username;
        m.clientId = clientId;
        m.content = content;
        m.timestamp = Instant.now().toString();
        return m;
    }

    // ── Factory methods mới cho WebSocket protocol ─────────────────────

    public static ChatMessage privateMessage(String from, String to, String content) {
        ChatMessage m = new ChatMessage();
        m.type = MessageType.PRIVATE_MESSAGE;
        m.username = from;
        m.to = to;
        m.content = content;
        m.timestamp = Instant.now().toString();
        m.conversationId = "dm:" + (from.compareTo(to) < 0 ? from + ":" + to : to + ":" + from);
        m.messageId = java.util.UUID.randomUUID().toString();
        return m;
    }

    public static ChatMessage groupMessage(String from, String groupId, String groupName, String content) {
        ChatMessage m = new ChatMessage();
        m.type = MessageType.GROUP_MESSAGE;
        m.username = from;
        m.groupId = groupId;
        m.groupName = groupName;
        m.content = content;
        m.timestamp = Instant.now().toString();
        m.conversationId = "group:" + groupId;
        m.messageId = java.util.UUID.randomUUID().toString();
        return m;
    }

    public static ChatMessage fileShare(String from, String to, String groupId,
                                        String fileId, String filename, String fileSize, String mimeType) {
        ChatMessage m = new ChatMessage();
        m.type = MessageType.FILE_SHARE;
        m.username = from;
        m.to = to;
        m.groupId = groupId;
        m.fileId = fileId;
        m.filename = filename;
        m.fileSize = fileSize;
        m.mimeType = mimeType;
        m.timestamp = Instant.now().toString();
        m.messageId = java.util.UUID.randomUUID().toString();
        if (groupId != null && !groupId.isBlank()) {
            m.conversationId = "group:" + groupId;
        } else if (to != null && !to.isBlank()) {
            m.conversationId = "dm:" + (from.compareTo(to) < 0 ? from + ":" + to : to + ":" + from);
        } else {
            m.conversationId = "global";
        }
        return m;
    }

    public static ChatMessage error(String content) {
        ChatMessage m = new ChatMessage();
        m.type = MessageType.ERROR;
        m.username = "SERVER";
        m.content = content;
        m.timestamp = Instant.now().toString();
        return m;
    }

    // ── Getters & Setters ───────────────────────────────────────────────

    public MessageType getType() { return type; }
    public void setType(MessageType type) { this.type = type; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    public int getClientId() { return clientId; }
    public void setClientId(int clientId) { this.clientId = clientId; }
    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
    public String getTo() { return to; }
    public void setTo(String to) { this.to = to; }
    public String getGroupId() { return groupId; }
    public void setGroupId(String groupId) { this.groupId = groupId; }
    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }
    public List<String> getMembers() { return members; }
    public void setMembers(List<String> members) { this.members = members; }
    public List<String> getUsers() { return users; }
    public void setUsers(List<String> users) { this.users = users; }
    public void setSearchResults(List<java.util.Map<String, String>> results) { this.searchResults = results; }
    public List<Object> getGroups() { return groups; }
    public void setGroups(List<Object> groups) { this.groups = groups; }
    public List<Object> getMessages() { return messages; }
    public void setMessages(List<Object> messages) { this.messages = messages; }
    public String getFileId() { return fileId; }
    public void setFileId(String fileId) { this.fileId = fileId; }
    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }
    public String getFileSize() { return fileSize; }
    public void setFileSize(String fileSize) { this.fileSize = fileSize; }
    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }
    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }
    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }
    public String getReplyToId() { return replyToId; }
    public void setReplyToId(String value) { this.replyToId = value; }
    public String getReplyToUsername() { return replyToUsername; }
    public void setReplyToUsername(String value) { this.replyToUsername = value; }
    public String getReplyToContent() { return replyToContent; }
    public void setReplyToContent(String value) { this.replyToContent = value; }

    // ── Friend system getters/setters ──────────────────────────────────
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getAvatarColor() { return avatarColor; }
    public void setAvatarColor(String avatarColor) { this.avatarColor = avatarColor; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public List<java.util.Map<String, String>> getFriendList() { return friendList; }
    public void setFriendList(List<java.util.Map<String, String>> friendList) { this.friendList = friendList; }
    public List<java.util.Map<String, String>> getPendingRequests() { return pendingRequests; }
    public void setPendingRequests(List<java.util.Map<String, String>> pendingRequests) { this.pendingRequests = pendingRequests; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public String getLastSeen() { return lastSeen; }
    public void setLastSeen(String lastSeen) { this.lastSeen = lastSeen; }
    public java.util.Map<String, String> getLastSeenMap() { return lastSeenMap; }
    public void setLastSeenMap(java.util.Map<String, String> lastSeenMap) { this.lastSeenMap = lastSeenMap; }
    public String getAvatarPath() { return avatarPath; }
    public void setAvatarPath(String avatarPath) { this.avatarPath = avatarPath; }
}
