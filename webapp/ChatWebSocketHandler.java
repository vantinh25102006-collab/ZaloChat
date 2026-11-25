package webapp;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import model.ChatMessage;
import model.Group;
import model.MessageType;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import server.DatabaseManager;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

/**
 * Xử lý toàn bộ logic chat qua WebSocket:
 *  - Đăng nhập, đăng ký
 *  - Tin nhắn global (broadcast)
 *  - Tin nhắn riêng (private message)
 *  - Tạo nhóm, nhắn tin nhóm
 *  - Thông báo file được chia sẻ
 *  - Lịch sử tin nhắn từ SQLite
 *  - Friend request system (gửi, chấp nhận, từ chối, hủy, hủy kết bạn)
 *  - Tìm user qua SĐT, xem profile
 */
@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private final Gson gson = new Gson();

    // username → WebSocketSession
    private final ConcurrentHashMap<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Object> userLocks = new ConcurrentHashMap<>();

    private Object lockFor(String username) {
        return userLocks.computeIfAbsent(username, k -> new Object());
    }

    // groupId → Group (in-memory cache, backed by DB)
    private final ConcurrentHashMap<String, Group> groups = new ConcurrentHashMap<>();

    // conversationId → list of messages (in-memory cache, giới hạn 200 tin)
    private final ConcurrentHashMap<String, LinkedList<ChatMessage>> history = new ConcurrentHashMap<>();

    // Dùng chung tài khoản, trạng thái online và event bus với TCP Server.
    private final server.UserStore userStore;
    private final webapp.runtime.ChatPresenceRegistry presence;
    private final webapp.runtime.ChatMessageBus messageBus;
    private final DatabaseManager db;

    public ChatWebSocketHandler(server.UserStore userStore,
                                webapp.runtime.ChatPresenceRegistry presence,
                                webapp.runtime.ChatMessageBus messageBus) {
        this.userStore = userStore;
        this.presence = presence;
        this.messageBus = messageBus;
        this.db = DatabaseManager.getInstance();
        this.messageBus.subscribe(this::onSharedMessage);
        loadGroupsFromDb();
    }

    private void onSharedMessage(ChatMessage message) {
        if (message.getType() == MessageType.MESSAGE) addHistory("global", message);
        broadcastToWebClients(message);
    }

    private void loadGroupsFromDb() {
        // Groups are restored from DB on startup
        // We'll lazy-load them when users request group list
    }

    private static final int MAX_HISTORY = 200;

    // ── Vòng đời kết nối ──────────────────────────────────────────────

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        System.out.println("[WS] New connection: " + session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String username = getUsername(session);
        if (username == null) return;
        boolean removed = false;
        synchronized (lockFor(username)) {
            if (sessions.remove(username, session)) {
                presence.logout(username);
                removed = true;
            }
        }
        if (removed) {
            broadcastSystem(username + " đã đăng xuất.");
            broadcastUserList();
            System.out.println("[WS] Disconnected: " + username);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        JsonObject json;
        try {
            json = JsonParser.parseString(payload).getAsJsonObject();
        } catch (Exception e) {
            sendError(session, "JSON không hợp lệ");
            return;
        }

        String typeStr = json.has("type") ? json.get("type").getAsString() : "";
        MessageType type;
        try {
            type = gson.fromJson(json.get("type"), MessageType.class);
        } catch (Exception e) {
            sendError(session, "type không hợp lệ: " + typeStr);
            return;
        }

        switch (type) {
            case LOGIN               -> handleLogin(session, json);
            case RESUME_SESSION      -> handleResumeSession(session, json);
            case REGISTER            -> handleRegister(session, json);
            case SEARCH_USERS        -> handleUserSearch(session, json);
            case SEARCH_BY_PHONE     -> handleSearchByPhone(session, json);
            case MESSAGE             -> handleGlobalMessage(session, json);
            case PRIVATE_MESSAGE     -> handlePrivateMessage(session, json);
            case CREATE_GROUP        -> handleCreateGroup(session, json);
            case GROUP_MESSAGE       -> handleGroupMessage(session, json);
            case FILE_SHARE          -> handleFileShare(session, json);
            case HISTORY             -> handleHistoryRequest(session, json);
            case TYPING              -> handleTyping(session, json);
            case DISCONNECT          -> handleDisconnect(session, json);
            case FRIEND_REQUEST      -> handleFriendRequest(session, json);
            case FRIEND_ACCEPT       -> handleFriendAccept(session, json);
            case FRIEND_REJECT       -> handleFriendReject(session, json);
            case FRIEND_CANCEL       -> handleFriendCancel(session, json);
            case UNFRIEND            -> handleUnfriend(session, json);
            case FRIEND_LIST         -> handleFriendList(session);
            case USER_PROFILE        -> handleUserProfile(session, json);
            case REACT_MESSAGE       -> handleReactMessage(session, json);
            case REVOKE_MESSAGE      -> handleRevokeMessage(session, json);
            case DELETE_MESSAGE_FOR_ME -> handleDeleteMessageForMe(session, json);
            case PIN_MESSAGE         -> handlePinMessage(session, json);
            case UNPIN_MESSAGE       -> handleUnpinMessage(session, json);
            case TOGGLE_STAR_MESSAGE -> handleToggleStarMessage(session, json);
            case DELETE_CONVERSATION -> handleDeleteConversation(session, json);
            case MARK_READ           -> handleMarkRead(session, json);
            case MUTE_CONVERSATION   -> handleMuteConversation(session, json);
            case BLOCK_USER          -> handleBlockUser(session, json, true);
            case UNBLOCK_USER        -> handleBlockUser(session, json, false);
            case PROFILE_UPDATE      -> handleProfileUpdate(session, json);
            case CREATE_POST         -> handleCreatePost(session, json);
            case GET_POSTS           -> handleGetPosts(session, json);
            case GROUP_ADD_MEMBER    -> handleGroupAddMember(session, json);
            case GROUP_REMOVE_MEMBER -> handleGroupRemoveMember(session, json);
            case GROUP_UPDATE_INFO   -> handleGroupUpdateInfo(session, json);
            case GROUP_TRANSFER_OWNER -> handleGroupTransferOwner(session, json);
            case GROUP_LEAVE         -> handleGroupLeave(session, json);
            case GROUP_DELETE        -> handleGroupDelete(session, json);
            default                  -> sendError(session, "Loại thông điệp không được hỗ trợ: " + typeStr);
        }
    }

    // ── Auth Handlers ─────────────────────────────────────────────────

    private void handleRegister(WebSocketSession session, JsonObject json) throws IOException {
        String username = getString(json, "username");
        String phone = getString(json, "phone");
        String password = getString(json, "password");
        server.UserStore.RegistrationResult result = userStore.register(username, phone, password);
        ChatMessage response = ChatMessage.loginResult(result.success(), 0, result.message());
        response.setType(MessageType.REGISTER_RESULT);
        send(session, response);
    }

    private void handleLogin(WebSocketSession session, JsonObject json) throws IOException {
        String username = getString(json, "username");
        String password = getString(json, "password");

        if (username == null || password == null) {
            send(session, ChatMessage.loginResult(false, 0, "Thiếu username hoặc password."));
            return;
        }
        if (!username.matches("[A-Za-z0-9_]{3,24}")) {
            send(session, ChatMessage.loginResult(false, 0, "Username phải 3–24 ký tự, chỉ chứa chữ, số, gạch dưới."));
            return;
        }
        if (!userStore.authenticate(username, password)) {
            send(session, ChatMessage.loginResult(false, 0, "Username hoặc password không đúng."));
            return;
        }
        synchronized (lockFor(username)) {
            if (!presence.login(username)) {
                send(session, ChatMessage.loginResult(false, 0, "Tài khoản đang được đăng nhập ở nơi khác."));
                return;
            }
            if (sessions.putIfAbsent(username, session) != null) {
                presence.logout(username);
                send(session, ChatMessage.loginResult(false, 0, "Tài khoản đang được đăng nhập ở nơi khác."));
                return;
            }
        }

        String token = db.createWebSession(username);
        completeWebLogin(session, username, token, "Đăng nhập thành công. Chào " + username + "!", true);
        System.out.println("[WS] Login: " + username);
    }

    private void handleResumeSession(WebSocketSession session, JsonObject json) throws IOException {
        String token = getString(json, "sessionToken");
        String username = db.validateAndTouchWebSession(token);
        if (username == null || !userStore.exists(username)) {
            send(session, ChatMessage.loginResult(false, 0, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."));
            return;
        }

        WebSocketSession replacedOld = null;
        synchronized (lockFor(username)) {
            WebSocketSession existingWs = sessions.get(username);
            if (existingWs != null && existingWs != session) {
                // Tách session cũ trước khi đóng để tránh afterConnectionClosed bắn nhầm sự kiện đăng xuất khi F5 nhanh
                existingWs.getAttributes().remove("username");
                sessions.put(username, session);
                presence.login(username);
                replacedOld = existingWs;
            } else {
                if (!presence.login(username)) {
                    send(session, ChatMessage.loginResult(false, 0, "Tài khoản đang được đăng nhập ở nơi khác."));
                    return;
                }
                if (existingWs == null) {
                    sessions.put(username, session);
                }
            }
        }
        if (replacedOld != null) {
            try {
                if (replacedOld.isOpen()) replacedOld.close(CloseStatus.NORMAL.withReason("Session resumed"));
            } catch (Exception ignored) { }
        }

        completeWebLogin(session, username, token, "Đã khôi phục phiên đăng nhập (" + username + ")", false);
        System.out.println("[WS] Resume session: " + username);
    }

    private void completeWebLogin(WebSocketSession session, String username, String token, String message, boolean broadcastJoin) throws IOException {
        session.getAttributes().put("username", username);
        if (token != null) session.getAttributes().put("sessionToken", token);

        ChatMessage result = ChatMessage.loginResult(true, 0, message);
        result.setUsername(username);
        result.setSessionToken(token);
        send(session, result);

        sendUserList(session);
        sendGroupListFromDb(session, username);
        sendFriendListToSession(session, username);
        sendPendingRequestsToSession(session, username);
        sendConversationList(session, username);
        sendBlockedUsers(session, username);

        if (broadcastJoin) broadcastSystem(username + " đã tham gia.");
        broadcastUserList();
    }

    private void handleDisconnect(WebSocketSession session, JsonObject json) throws IOException {
        String token = (String) session.getAttributes().remove("sessionToken");
        String explicitToken = getString(json, "sessionToken");
        if (token != null) db.revokeWebSession(token);
        if (explicitToken != null && !explicitToken.equals(token)) db.revokeWebSession(explicitToken);

        String username = getUsername(session);
        boolean removed = false;
        if (username != null) {
            synchronized (lockFor(username)) {
                if (sessions.remove(username, session)) {
                    presence.logout(username);
                    removed = true;
                }
            }
        }
        if (removed) {
            broadcastSystem(username + " đã đăng xuất.");
            broadcastUserList();
            System.out.println("[WS] Logout: " + username);
        }
        session.getAttributes().remove("username");
        if (session.isOpen()) session.close(CloseStatus.NORMAL.withReason("User logout"));
    }

    // ── Search Handlers ───────────────────────────────────────────────

    private void handleUserSearch(WebSocketSession session, JsonObject json) throws IOException {
        if (requireAuth(session) == null) return;
        String query = getString(json, "query");
        ChatMessage response = new ChatMessage();
        response.setType(MessageType.SEARCH_RESULTS);
        response.setSearchResults(userStore.search(query).stream()
                .map(u -> Map.of("username", u.username(), "phone", u.phone()))
                .collect(Collectors.toList()));
        response.setTimestamp(java.time.Instant.now().toString());
        send(session, response);
    }

    private void handleSearchByPhone(WebSocketSession session, JsonObject json) throws IOException {
        String me = requireAuth(session);
        if (me == null) return;
        String phone = getString(json, "phone");
        if (phone == null || phone.isBlank()) { sendError(session, "Thiếu số điện thoại."); return; }

        List<server.UserStore.UserSearchResult> results = userStore.searchByPhone(phone);
        ChatMessage response = new ChatMessage();
        response.setType(MessageType.SEARCH_RESULTS);

        List<Map<String, String>> list = new ArrayList<>();
        for (server.UserStore.UserSearchResult u : results) {
            if (u.username().equals(me)) continue;
            String relationship = db.getRelationship(me, u.username());
            String requestId = null;
            if ("pending_sent".equals(relationship)) {
                requestId = db.getPendingRequestId(me, u.username());
            } else if ("pending_received".equals(relationship)) {
                requestId = db.getPendingRequestId(u.username(), me);
            }
            Map<String, String> m = new LinkedHashMap<>();
            m.put("username", u.username());
            m.put("phone", u.phone());
            m.put("relationship", relationship);
            if (requestId != null) m.put("requestId", requestId);
            list.add(m);
        }
        response.setSearchResults(list);
        response.setTimestamp(java.time.Instant.now().toString());
        send(session, response);
    }

    // ── Message Handlers ──────────────────────────────────────────────

    private void handleGlobalMessage(WebSocketSession session, JsonObject json) throws IOException {
        String username = requireAuth(session);
        if (username == null) return;
        String content = getString(json, "content");
        if (content == null || content.isBlank()) return;
        content = content.strip();
        if (content.length() > 3000) { sendError(session, "Tin nhắn quá dài (tối đa 3000 ký tự)."); return; }

        ChatMessage msg = ChatMessage.message(MessageType.MESSAGE, username, 0, content);
        msg.setConversationId("global");
        msg.setMessageId(java.util.UUID.randomUUID().toString());

        // Save to DB
        db.saveMessage(msg.getMessageId(), "global", username, null, "message", content, null, null, null, null);

        messageBus.publish(msg);
    }

    private void handlePrivateMessage(WebSocketSession session, JsonObject json) throws IOException {
        String from = requireAuth(session);
        if (from == null) return;
        String to = getString(json, "to");
        String content = getString(json, "content");
        if (to == null || content == null || content.isBlank()) { sendError(session, "Thiếu 'to' hoặc 'content'."); return; }
        if (to.equals(from)) { sendError(session, "Không thể nhắn tin cho chính mình."); return; }
        if (db.isBlockedEitherWay(from, to)) { sendError(session, "Không thể gửi tin nhắn vì một trong hai người đã chặn người còn lại."); return; }
        content = content.strip();

        ChatMessage msg = ChatMessage.privateMessage(from, to, content);

        // Save to DB
        db.saveMessage(msg.getMessageId(), msg.getConversationId(), from, to, "private_message", content, null, null, null, null);
        attachReplyMetadata(msg, json);

        addHistory(msg.getConversationId(), msg);

        WebSocketSession toSession = sessions.get(to);
        if (toSession != null && toSession.isOpen()) send(toSession, msg);
        send(session, msg);
    }

    private void attachReplyMetadata(ChatMessage msg, JsonObject json) {
        String replyId=getString(json,"replyToId");
        if(replyId==null||replyId.isBlank())return;
        String replyUser=getString(json,"replyToUsername"), replyContent=getString(json,"replyToContent");
        msg.setReplyToId(replyId);msg.setReplyToUsername(replyUser);msg.setReplyToContent(replyContent);
        db.setMessageReply(msg.getMessageId(),replyId,replyUser,replyContent);
    }

    private void handleCreateGroup(WebSocketSession session, JsonObject json) throws IOException {
        String creator = requireAuth(session);
        if (creator == null) return;
        String groupName = getString(json, "groupName");
        if (groupName == null || groupName.isBlank()) { sendError(session, "Tên nhóm không được để trống."); return; }
        groupName = groupName.strip();

        List<String> members = new ArrayList<>();
        if (json.has("members") && json.get("members").isJsonArray()) {
            json.getAsJsonArray("members").forEach(e -> members.add(e.getAsString()));
        }
        if (!members.contains(creator)) members.add(0, creator);

        String groupId = java.util.UUID.randomUUID().toString().substring(0, 8);
        Group group = new Group(groupId, groupName, creator, members);
        groups.put(groupId, group);

        // Save to DB and create folder
        db.saveGroup(groupId, groupName, creator, members);

        ChatMessage notify = new ChatMessage();
        notify.setType(MessageType.GROUP_CREATED);
        notify.setUsername(creator);
        notify.setGroupId(groupId);
        notify.setGroupName(groupName);
        notify.setMembers(members);
        notify.setTimestamp(java.time.Instant.now().toString());
        notify.setContent("Nhóm '" + groupName + "' được tạo bởi " + creator);

        for (String member : members) {
            WebSocketSession ms = sessions.get(member);
            if (ms != null && ms.isOpen()) send(ms, notify);
        }
        System.out.println("[WS] Group created: " + groupName + " (" + groupId + ") by " + creator);
    }

    private void handleGroupMessage(WebSocketSession session, JsonObject json) throws IOException {
        String from = requireAuth(session);
        if (from == null) return;
        String groupId = getString(json, "groupId");
        String content = getString(json, "content");
        if (groupId == null || content == null || content.isBlank()) { sendError(session, "Thiếu groupId hoặc content."); return; }
        content = content.strip();

        Group group = groups.get(groupId);
        if (group == null) { sendError(session, "Nhóm không tồn tại."); return; }
        if (!group.hasMember(from)) { sendError(session, "Bạn không phải thành viên nhóm này."); return; }

        ChatMessage msg = ChatMessage.groupMessage(from, groupId, group.getName(), content);

        // Save to DB
        db.saveMessage(msg.getMessageId(), "group:" + groupId, from, null, "group_message", content, null, null, null, null);
        attachReplyMetadata(msg, json);

        addHistory("group:" + groupId, msg);

        for (String member : group.getMembers()) {
            WebSocketSession ms = sessions.get(member);
            if (ms != null && ms.isOpen()) send(ms, msg);
        }
    }

    private void handleFileShare(WebSocketSession session, JsonObject json) throws IOException {
        String from = requireAuth(session);
        if (from == null) return;
        String to = getString(json, "to");
        String groupId = getString(json, "groupId");
        String fileId = getString(json, "fileId");
        String filename = getString(json, "filename");
        String fileSize = getString(json, "fileSize");
        String mimeType = getString(json, "mimeType");

        if (fileId == null || filename == null) { sendError(session, "Thiếu fileId hoặc filename."); return; }

        ChatMessage msg = ChatMessage.fileShare(from, to, groupId, fileId, filename, fileSize, mimeType);

        if (groupId != null && !groupId.isBlank()) {
            Group group = groups.get(groupId);
            if (group == null) { sendError(session, "Nhóm không tồn tại."); return; }
            db.saveMessage(msg.getMessageId(), "group:" + groupId, from, null, "file_share", null, fileId, filename, fileSize, mimeType);
            addHistory("group:" + groupId, msg);
            for (String member : group.getMembers()) {
                WebSocketSession ms = sessions.get(member);
                if (ms != null && ms.isOpen()) send(ms, msg);
            }
        } else if (to != null && !to.isBlank()) {
            db.saveMessage(msg.getMessageId(), msg.getConversationId(), from, to, "file_share", null, fileId, filename, fileSize, mimeType);
            addHistory(msg.getConversationId(), msg);
            WebSocketSession toSession = sessions.get(to);
            if (toSession != null && toSession.isOpen()) send(toSession, msg);
            send(session, msg);
        } else {
            db.saveMessage(msg.getMessageId(), "global", from, null, "file_share", null, fileId, filename, fileSize, mimeType);
            addHistory("global", msg);
            broadcast(msg);
        }
    }

    private void handleHistoryRequest(WebSocketSession session, JsonObject json) throws IOException {
        String username = requireAuth(session);
        if (username == null) return;
        String convId = getString(json, "conversationId");
        if (convId == null) { sendError(session, "Thiếu conversationId."); return; }

        // Kiểm tra quyền truy cập
        if (convId.startsWith("dm:")) {
            String[] parts = convId.replace("dm:", "").split(":");
            boolean allowed = Arrays.asList(parts).contains(username);
            if (!allowed) { sendError(session, "Bạn không có quyền xem cuộc trò chuyện này."); return; }
        } else if (convId.startsWith("group:")) {
            String gid = convId.replace("group:", "");
            Group g = groups.get(gid);
            if (g == null || !g.hasMember(username)) { sendError(session, "Bạn không phải thành viên nhóm này."); return; }
        }

        // Load from DB first
        List<Map<String, Object>> dbMessages = db.getMessagesForUser(convId, 300, username);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("type", "history");
        response.put("conversationId", convId);
        response.put("messages", new ArrayList<>(dbMessages));
        response.put("pinnedMessage", db.getPinnedMessage(convId, username));
        response.put("timestamp", java.time.Instant.now().toString());
        sendPayload(session, response);
    }

    private void handleTyping(WebSocketSession session, JsonObject json) throws IOException {
        String from = requireAuth(session);
        if (from == null) return;
        String to = getString(json, "to");
        String groupId = getString(json, "groupId");

        ChatMessage typing = new ChatMessage();
        typing.setType(MessageType.TYPING);
        typing.setUsername(from);
        typing.setTo(to);
        typing.setGroupId(groupId);

        if (groupId != null) {
            Group g = groups.get(groupId);
            if (g != null) {
                for (String m : g.getMembers()) {
                    if (!m.equals(from)) {
                        WebSocketSession ms = sessions.get(m);
                        if (ms != null && ms.isOpen()) send(ms, typing);
                    }
                }
            }
        } else if (to != null) {
            WebSocketSession ts = sessions.get(to);
            if (ts != null && ts.isOpen()) send(ts, typing);
        }
    }

    // ── Friend Request Handlers ───────────────────────────────────────

    private void handleFriendRequest(WebSocketSession session, JsonObject json) throws IOException {
        String sender = requireAuth(session);
        if (sender == null) return;
        String receiver = getString(json, "to");
        if (receiver == null || receiver.equals(sender)) { sendError(session, "Người nhận không hợp lệ."); return; }

        // Kiểm tra tài khoản receiver tồn tại
        if (userStore.search(receiver).stream().noneMatch(u -> u.username().equals(receiver))) {
            sendError(session, "Người dùng không tồn tại."); return;
        }
        // Kiểm tra đã là bạn
        if (db.isBlockedEitherWay(sender, receiver)) { sendError(session, "Không thể gửi lời mời do một trong hai người đã chặn người còn lại."); return; }
        if (db.areFriends(sender, receiver)) { sendError(session, "Hai bạn đã là bạn bè rồi."); return; }

        String requestId = db.sendFriendRequest(sender, receiver);
        if (requestId == null) { sendError(session, "Không thể gửi lời mời."); return; }

        // Thông báo cho sender
        ChatMessage ack = new ChatMessage();
        ack.setType(MessageType.FRIEND_REQUEST);
        ack.setUsername(sender);
        ack.setTo(receiver);
        ack.setRequestId(requestId);
        ack.setStatus("sent");
        ack.setTimestamp(java.time.Instant.now().toString());
        send(session, ack);

        // Thông báo cho receiver nếu online
        WebSocketSession receiverSession = sessions.get(receiver);
        if (receiverSession != null && receiverSession.isOpen()) {
            ChatMessage notify = new ChatMessage();
            notify.setType(MessageType.FRIEND_REQUEST);
            notify.setUsername(sender);
            notify.setTo(receiver);
            notify.setRequestId(requestId);
            notify.setStatus("received");
            notify.setTimestamp(java.time.Instant.now().toString());
            send(receiverSession, notify);
        }
        System.out.println("[WS] Friend request: " + sender + " -> " + receiver);
    }

    private void handleFriendAccept(WebSocketSession session, JsonObject json) throws IOException {
        String receiver = requireAuth(session);
        if (receiver == null) return;
        String requestId = getString(json, "requestId");
        String sender = getString(json, "from");
        if (requestId == null) { sendError(session, "Thiếu requestId."); return; }

        boolean ok = db.acceptFriendRequest(requestId, receiver);
        if (!ok) { sendError(session, "Không tìm thấy lời mời hoặc đã xử lý."); return; }

        // Thông báo cho cả hai
        ChatMessage notify = new ChatMessage();
        notify.setType(MessageType.FRIEND_ACCEPT);
        notify.setTimestamp(java.time.Instant.now().toString());

        // Cho người chấp nhận
        notify.setUsername(sender);
        notify.setTo(receiver);
        notify.setStatus("accepted");
        send(session, notify);

        // Cho người gửi
        if (sender != null) {
            WebSocketSession senderSession = sessions.get(sender);
            if (senderSession != null && senderSession.isOpen()) {
                ChatMessage notify2 = new ChatMessage();
                notify2.setType(MessageType.FRIEND_ACCEPT);
                notify2.setUsername(receiver);
                notify2.setTo(sender);
                notify2.setStatus("accepted");
                notify2.setTimestamp(java.time.Instant.now().toString());
                send(senderSession, notify2);
            }
        }

        // Gửi lại danh sách bạn bè cập nhật
        sendFriendListToSession(session, receiver);
        System.out.println("[WS] Friend accepted: " + sender + " <-> " + receiver);
    }

    private void handleFriendReject(WebSocketSession session, JsonObject json) throws IOException {
        String receiver = requireAuth(session);
        if (receiver == null) return;
        String requestId = getString(json, "requestId");
        String sender = getString(json, "from");
        if (requestId == null) { sendError(session, "Thiếu requestId."); return; }

        db.rejectFriendRequest(requestId, receiver);

        ChatMessage notify = new ChatMessage();
        notify.setType(MessageType.FRIEND_REJECT);
        notify.setUsername(sender);
        notify.setTo(receiver);
        notify.setStatus("rejected");
        notify.setTimestamp(java.time.Instant.now().toString());
        send(session, notify);

        // Thông báo cho sender nếu online
        if (sender != null) {
            WebSocketSession senderSession = sessions.get(sender);
            if (senderSession != null && senderSession.isOpen()) {
                ChatMessage notify2 = new ChatMessage();
                notify2.setType(MessageType.FRIEND_REJECT);
                notify2.setUsername(receiver);
                notify2.setTo(sender);
                notify2.setStatus("rejected");
                notify2.setTimestamp(java.time.Instant.now().toString());
                send(senderSession, notify2);
            }
        }
    }

    private void handleFriendCancel(WebSocketSession session, JsonObject json) throws IOException {
        String sender = requireAuth(session);
        if (sender == null) return;
        String requestId = getString(json, "requestId");
        String to = getString(json, "to");
        if ((requestId == null || requestId.isBlank()) && to != null && !to.isBlank()) {
            requestId = db.getPendingRequestId(sender, to);
        }
        if (requestId == null || requestId.isBlank()) { sendError(session, "Thiếu requestId."); return; }

        db.cancelFriendRequest(requestId, sender);

        ChatMessage ack = new ChatMessage();
        ack.setType(MessageType.FRIEND_CANCEL);
        ack.setRequestId(requestId);
        ack.setTo(to);
        ack.setStatus("cancelled");
        ack.setTimestamp(java.time.Instant.now().toString());
        send(session, ack);

        if (to != null && !to.isBlank()) {
            WebSocketSession receiverSession = sessions.get(to);
            if (receiverSession != null && receiverSession.isOpen()) {
                sendPendingRequestsToSession(receiverSession, to);
            }
        }
    }

    private void handleUnfriend(WebSocketSession session, JsonObject json) throws IOException {
        String me = requireAuth(session);
        if (me == null) return;
        String other = getString(json, "username");
        if (other == null) { sendError(session, "Thiếu username."); return; }

        db.removeFriend(me, other);

        ChatMessage ack = new ChatMessage();
        ack.setType(MessageType.UNFRIEND);
        ack.setUsername(other);
        ack.setStatus("unfriended");
        ack.setTimestamp(java.time.Instant.now().toString());
        send(session, ack);

        // Thông báo cho người kia
        WebSocketSession otherSession = sessions.get(other);
        if (otherSession != null && otherSession.isOpen()) {
            ChatMessage notify = new ChatMessage();
            notify.setType(MessageType.UNFRIEND);
            notify.setUsername(me);
            notify.setStatus("unfriended");
            notify.setTimestamp(java.time.Instant.now().toString());
            send(otherSession, notify);
        }
    }

    private void handleFriendList(WebSocketSession session) throws IOException {
        String username = requireAuth(session);
        if (username == null) return;
        sendFriendListToSession(session, username);
        sendPendingRequestsToSession(session, username);
    }

    private void handleUserProfile(WebSocketSession session, JsonObject json) throws IOException {
        String me = requireAuth(session);
        if (me == null) return;
        String targetUsername = getString(json, "username");
        if (targetUsername == null) { sendError(session, "Thiếu username."); return; }

        List<server.UserStore.UserSearchResult> results = userStore.search(targetUsername);
        server.UserStore.UserSearchResult target = results.stream()
                .filter(u -> u.username().equals(targetUsername))
                .findFirst().orElse(null);

        if (target == null) { sendError(session, "Người dùng không tồn tại."); return; }

        String relationship = db.getRelationship(me, targetUsername);
        String requestId = null;
        if ("pending_sent".equals(relationship)) {
            requestId = db.getPendingRequestId(me, targetUsername);
        } else if ("pending_received".equals(relationship)) {
            requestId = db.getPendingRequestId(targetUsername, me);
        }

        boolean online = presence.onlineUsers().contains(targetUsername);

        ChatMessage response = new ChatMessage();
        response.setType(MessageType.USER_PROFILE);
        response.setUsername(targetUsername);
        response.setPhone(target.phone());
        response.setStatus(relationship);
        if (requestId != null) response.setRequestId(requestId);
        response.setContent(online ? "online" : "offline");
        response.setLastSeen(presence.getLastSeen(targetUsername));
        Map<String, Object> prof = db.getProfile(targetUsername);
        if (prof.get("avatarPath") instanceof String av) response.setAvatarPath(av);
        response.setTimestamp(java.time.Instant.now().toString());
        send(session, response);
    }


    // ── Reactions, revoke, per-user conversation controls ─────────────
    private void handleReactMessage(WebSocketSession session, JsonObject json) throws IOException {
        String me=requireAuth(session); if(me==null)return;
        String id=getString(json,"messageId"), emoji=getString(json,"emoji"), conv=getString(json,"conversationId");
        if(id==null||conv==null){sendError(session,"Thiếu messageId/conversationId.");return;}
        if(!canAccessConversation(me,conv)||!db.messageBelongsToConversation(id,conv)){sendError(session,"Bạn không có quyền thao tác cuộc trò chuyện này.");return;}
        boolean removed=emoji==null||emoji.isBlank();
        boolean ok=removed?db.removeReaction(id,me):db.setReaction(id,me,emoji);
        if(!ok&&!removed){sendError(session,"Không thể lưu cảm xúc.");return;}
        Map<String,Object> payload=new LinkedHashMap<>();payload.put("type","message_reaction");
        payload.put("messageId",id);payload.put("conversationId",conv);payload.put("username",me);
        payload.put("emoji",removed?null:emoji);payload.put("reactions",db.getReactions(id));
        broadcastConversation(conv,payload);
    }

    private void handleRevokeMessage(WebSocketSession session, JsonObject json) throws IOException {
        String me=requireAuth(session);if(me==null)return;
        String id=getString(json,"messageId"),conv=getString(json,"conversationId");
        if(id==null||conv==null){sendError(session,"Thiếu messageId/conversationId.");return;}
        if(!canAccessConversation(me,conv)||!db.messageBelongsToConversation(id,conv)){sendError(session,"Bạn không có quyền thu hồi tin nhắn này.");return;}
        boolean isGroupOwner = false;
        if (conv.startsWith("group:")) {
            Group g = groups.get(conv.substring(6));
            isGroupOwner = (g != null && me.equals(g.getCreatedBy()));
        }
        DatabaseManager.RevokeResult res = db.revokeMessage(id, me, isGroupOwner);
        if(!res.revoked()){sendError(session,"Chỉ người gửi hoặc trưởng nhóm mới có thể thu hồi tin nhắn này.");return;}
        if(res.orphanFileId() != null) {
            FileController.deleteStoredFile(res.orphanFileId());
        }
        Map<String,Object> payload=new LinkedHashMap<>();payload.put("type","message_revoked");
        payload.put("messageId",id);payload.put("conversationId",conv);payload.put("username",me);
        broadcastConversation(conv,payload);
    }

    private void handleDeleteMessageForMe(WebSocketSession session,JsonObject json)throws IOException{
        String me=requireAuth(session);if(me==null)return;
        String id=getString(json,"messageId"),conv=getString(json,"conversationId");
        if(id==null||conv==null||!canAccessConversation(me,conv)||!db.messageBelongsToConversation(id,conv)){sendError(session,"Tin nhắn không hợp lệ.");return;}
        if(!db.hideMessageForUser(id,me)){sendError(session,"Không thể xóa tin nhắn này ở phía bạn.");return;}
        sendPayload(session,Map.of("type","message_hidden","messageId",id,"conversationId",conv));
    }

    private void handlePinMessage(WebSocketSession session, JsonObject json) throws IOException {
        String me = requireAuth(session); if (me == null) return;
        String id = getString(json, "messageId"), conv = getString(json, "conversationId");
        if (id == null || conv == null || !canAccessConversation(me, conv) || !db.messageBelongsToConversation(id, conv)) {
            sendError(session, "Không thể ghim tin nhắn này."); return;
        }
        if (!db.pinMessage(conv, id, me)) { sendError(session, "Tin nhắn đã thu hồi hoặc không thể ghim."); return; }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "message_pinned");
        payload.put("conversationId", conv);
        payload.put("pinnedMessage", db.getPinnedMessage(conv, me));
        broadcastConversation(conv, payload);
    }

    private void handleUnpinMessage(WebSocketSession session, JsonObject json) throws IOException {
        String me = requireAuth(session); if (me == null) return;
        String conv = getString(json, "conversationId");
        if (conv == null || !canAccessConversation(me, conv)) {
            sendError(session, "Cuộc trò chuyện không hợp lệ."); return;
        }
        db.unpinMessage(conv);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "message_pinned");
        payload.put("conversationId", conv);
        payload.put("pinnedMessage", null);
        broadcastConversation(conv, payload);
    }

    private void handleToggleStarMessage(WebSocketSession session, JsonObject json) throws IOException {
        String me = requireAuth(session); if (me == null) return;
        String id = getString(json, "messageId"), conv = getString(json, "conversationId");
        if (id == null || conv == null || !canAccessConversation(me, conv) || !db.messageBelongsToConversation(id, conv)) {
            sendError(session, "Tin nhắn không hợp lệ."); return;
        }
        boolean starred = db.toggleStarMessage(me, id, conv);
        sendPayload(session, Map.of("type", "message_starred", "conversationId", conv, "messageId", id, "starred", starred));
    }

    private void handleDeleteConversation(WebSocketSession session,JsonObject json)throws IOException{
        String me=requireAuth(session);if(me==null)return;String conv=getString(json,"conversationId");
        if(conv==null||!canAccessConversation(me,conv)){sendError(session,"Cuộc trò chuyện không hợp lệ.");return;}
        db.deleteConversationForUser(me,conv);
        sendPayload(session,Map.of("type","conversation_deleted","conversationId",conv));
    }
    private void handleMarkRead(WebSocketSession session,JsonObject json)throws IOException{
        String me=requireAuth(session);if(me==null)return;String conv=getString(json,"conversationId");
        if(conv!=null&&canAccessConversation(me,conv))db.markConversationRead(me,conv);
    }
    private void handleMuteConversation(WebSocketSession session,JsonObject json)throws IOException{
        String me=requireAuth(session);if(me==null)return;String conv=getString(json,"conversationId");
        boolean muted=json.has("muted")&&json.get("muted").getAsBoolean();
        if(conv==null||!canAccessConversation(me,conv)){sendError(session,"Cuộc trò chuyện không hợp lệ.");return;}
        db.setConversationMuted(me,conv,muted);
        sendPayload(session,Map.of("type","mute_conversation","conversationId",conv,"muted",muted));
    }
    private void handleBlockUser(WebSocketSession session,JsonObject json,boolean block)throws IOException{
        String me=requireAuth(session);if(me==null)return;String other=getString(json,"username");
        if(other==null||other.equals(me)){sendError(session,"Người dùng không hợp lệ.");return;}
        if(block)db.blockUser(me,other);else db.unblockUser(me,other);
        sendPayload(session,Map.of("type",block?"user_blocked":"user_unblocked","username",other));
    }
    private void handleProfileUpdate(WebSocketSession session,JsonObject json)throws IOException{
        String me=requireAuth(session);if(me==null)return;
        List<String> oldFiles = db.updateProfile(me,getString(json,"avatarPath"),getString(json,"coverPath"),getString(json,"bio"));
        for (String oldFile : oldFiles) {
            FileController.deleteStoredFile(oldFile);
        }
        Map<String,Object> p=db.getProfile(me);p.put("type","profile_updated");sendPayload(session,p);
    }
    private void handleCreatePost(WebSocketSession session,JsonObject json)throws IOException{
        String me=requireAuth(session);if(me==null)return;String content=getString(json,"content");
        if(content==null||content.isBlank()){sendError(session,"Bài viết không được để trống.");return;}
        String id=db.createPost(me,content,getString(json,"imageFileId"));
        if(id==null){sendError(session,"Không thể đăng bài viết.");return;}
        sendPayload(session,Map.of("type","post_created","postId",id,"username",me,"content",content,"timestamp",java.time.Instant.now().toString()));
    }
    private void handleGetPosts(WebSocketSession session,JsonObject json)throws IOException{
        String me=requireAuth(session);if(me==null)return;String target=getString(json,"username");if(target==null)target=me;
        Map<String,Object> payload=new LinkedHashMap<>();payload.put("type","posts_result");payload.put("username",target);
        payload.put("profile",db.getProfile(target));payload.put("posts",db.getPosts(target));sendPayload(session,payload);
    }

    private void sendGroupSystemNotification(Group g, String content) throws IOException {
        if (g == null || content == null || content.isBlank()) return;
        String convId = "group:" + g.getId();
        String msgId = UUID.randomUUID().toString();
        String now = java.time.Instant.now().toString();
        db.saveMessage(msgId, convId, "SYSTEM", null, "system", content, null, null, null, null);
        ChatMessage sysMsg = ChatMessage.groupMessage("SYSTEM", g.getId(), g.getName(), content);
        sysMsg.setType(MessageType.GROUP_MESSAGE);
        sysMsg.setMessageId(msgId);
        sysMsg.setTimestamp(now);
        sysMsg.setStatus("system");
        addHistory(convId, sysMsg);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "group_message");
        payload.put("messageType", "system");
        payload.put("groupId", g.getId());
        payload.put("groupName", g.getName());
        payload.put("conversationId", convId);
        payload.put("messageId", msgId);
        payload.put("username", "SYSTEM");
        payload.put("content", content);
        payload.put("timestamp", now);
        for (String member : g.getMembers()) {
            WebSocketSession ms = sessions.get(member);
            if (ms != null && ms.isOpen()) sendPayload(ms, payload);
        }
    }

    private void handleGroupAddMember(WebSocketSession session,JsonObject json)throws IOException{
        String me=requireAuth(session);if(me==null)return;
        String gid=getString(json,"groupId");
        if(gid==null){sendError(session,"Thiếu groupId.");return;}
        Group g=groups.get(gid);
        if(g==null||!g.hasMember(me)){sendError(session,"Bạn không phải thành viên của nhóm này.");return;}

        List<String> toAdd = new ArrayList<>();
        if (json.has("usernames") && json.get("usernames").isJsonArray()) {
            json.getAsJsonArray("usernames").forEach(e -> {
                if (!e.isJsonNull()) toAdd.add(e.getAsString().strip());
            });
        } else {
            String single = getString(json, "username");
            if (single != null && !single.isBlank()) toAdd.add(single.strip());
        }
        if (toAdd.isEmpty()) { sendError(session, "Hãy chọn ít nhất một thành viên để thêm."); return; }

        List<String> added = new ArrayList<>();
        for (String user : toAdd) {
            if (user.isBlank() || g.hasMember(user)) continue;
            if (userStore.search(user).stream().noneMatch(u -> u.username().equals(user))) continue;
            g.addMember(user);
            db.addGroupMember(gid, user);
            added.add(user);
        }
        if (added.isEmpty()) { sendError(session, "Không có thành viên hợp lệ nào được thêm."); return; }
        broadcastGroupUpdate(g);
        sendGroupSystemNotification(g, me + " đã thêm " + String.join(", ", added) + " vào nhóm");
    }

    private void handleGroupRemoveMember(WebSocketSession session, JsonObject json) throws IOException {
        String me = requireAuth(session); if (me == null) return;
        String gid = getString(json, "groupId"), target = getString(json, "username");
        if (gid == null || target == null) { sendError(session, "Thiếu groupId hoặc username."); return; }
        Group g = groups.get(gid);
        if (g == null || !g.getCreatedBy().equals(me)) { sendError(session, "Chỉ trưởng nhóm mới có quyền xóa thành viên."); return; }
        if (target.equals(me) || !g.hasMember(target)) { sendError(session, "Thành viên không hợp lệ."); return; }
        g.removeMember(target);
        db.removeGroupMember(gid, target);
        WebSocketSession targetSession = sessions.get(target);
        if (targetSession != null && targetSession.isOpen()) {
            sendPayload(targetSession, Map.of("type", "group_left", "groupId", gid, "kickedBy", me));
        }
        broadcastGroupUpdate(g);
        sendGroupSystemNotification(g, me + " đã xóa " + target + " khỏi nhóm");
    }

    private void handleGroupUpdateInfo(WebSocketSession session, JsonObject json) throws IOException {
        String me = requireAuth(session); if (me == null) return;
        String gid = getString(json, "groupId");
        if (gid == null) { sendError(session, "Thiếu groupId."); return; }
        Group g = groups.get(gid);
        if (g == null || !g.hasMember(me)) { sendError(session, "Bạn không thuộc nhóm này."); return; }

        String newName = getString(json, "name");
        String newAvatar = getString(json, "avatarPath");
        boolean nameChanged = newName != null && !newName.isBlank() && !newName.strip().equals(g.getName());
        boolean avatarChanged = newAvatar != null && !newAvatar.equals(g.getAvatarPath());

        String oldAvatar = db.updateGroupInfo(gid, nameChanged ? newName.strip() : null, avatarChanged ? newAvatar : null);
        if (oldAvatar != null) {
            FileController.deleteStoredFile(oldAvatar);
        }
        if (nameChanged) g.setName(newName.strip());
        if (avatarChanged) g.setAvatarPath("__CLEAR__".equals(newAvatar) ? null : newAvatar);

        broadcastGroupUpdate(g);
        if (nameChanged) {
            sendGroupSystemNotification(g, me + " đã đổi tên nhóm thành \"" + g.getName() + "\"");
        }
        if (avatarChanged) {
            sendGroupSystemNotification(g, me + " đã cập nhật ảnh đại diện nhóm");
        }
    }

    private void handleGroupTransferOwner(WebSocketSession session,JsonObject json)throws IOException{
        String me=requireAuth(session);if(me==null)return;String gid=getString(json,"groupId"),next=getString(json,"username");
        boolean leaveAfter = json.has("leaveAfter") && !json.get("leaveAfter").isJsonNull() && json.get("leaveAfter").getAsBoolean();
        if(gid==null){sendError(session,"Thiếu groupId.");return;}
        Group g=groups.get(gid);if(g==null||!g.getCreatedBy().equals(me)){sendError(session,"Chỉ nhóm trưởng mới được chuyển quyền.");return;}
        if(next==null||!g.hasMember(next)||next.equals(me)){sendError(session,"Thành viên nhận quyền không hợp lệ.");return;}
        if(!db.transferGroupOwner(gid,me,next)){sendError(session,"Không thể chuyển quyền nhóm.");return;}
        g.setCreatedBy(next);
        if(leaveAfter){
            g.removeMember(me);
            db.removeGroupMember(gid,me);
            sendPayload(session,Map.of("type","group_left","groupId",gid));
        }
        broadcastGroupUpdate(g);
        sendGroupSystemNotification(g, me + " đã nhượng quyền trưởng nhóm cho " + next);
        if(leaveAfter){
            sendGroupSystemNotification(g, me + " đã rời nhóm");
        }
    }
    private void handleGroupLeave(WebSocketSession session,JsonObject json)throws IOException{
        String me=requireAuth(session);if(me==null)return;String gid=getString(json,"groupId");
        if(gid==null){sendError(session,"Thiếu groupId.");return;} Group g=groups.get(gid);
        if(g==null||!g.hasMember(me)){sendError(session,"Bạn không thuộc nhóm này.");return;}
        if(g.getCreatedBy().equals(me)){sendError(session,"Nhóm trưởng phải chuyển quyền quản trị cho thành viên khác trước khi rời nhóm.");return;}
        g.removeMember(me);db.removeGroupMember(gid,me);broadcastGroupUpdate(g);
        sendPayload(session,Map.of("type","group_left","groupId",gid));
        sendGroupSystemNotification(g, me + " đã rời nhóm");
    }
    private void handleGroupDelete(WebSocketSession session,JsonObject json)throws IOException{
        String me=requireAuth(session);if(me==null)return;String gid=getString(json,"groupId");
        if(gid==null){sendError(session,"Thiếu groupId.");return;} Group g=groups.get(gid);
        if(g==null||!g.getCreatedBy().equals(me)){sendError(session,"Chỉ nhóm trưởng mới được giải tán nhóm.");return;}
        if(!db.deleteGroup(gid,me)){sendError(session,"Không thể giải tán nhóm.");return;}
        groups.remove(gid);Map<String,Object> p=Map.of("type","group_deleted","groupId",gid);
        for(String member:g.getMembers()){WebSocketSession s=sessions.get(member);if(s!=null&&s.isOpen())sendPayload(s,p);}
    }
    private boolean canAccessConversation(String user,String conv){
        if(conv.startsWith("dm:"))return Arrays.asList(conv.substring(3).split(":")).contains(user);
        if(conv.startsWith("group:")){Group g=groups.get(conv.substring(6));return g!=null&&g.hasMember(user);}
        return "global".equals(conv);
    }
    private void broadcastConversation(String conv,Map<String,Object> payload)throws IOException{
        if(conv.startsWith("group:")){Group g=groups.get(conv.substring(6));if(g!=null)for(String u:g.getMembers()){WebSocketSession s=sessions.get(u);if(s!=null&&s.isOpen())sendPayload(s,payload);}}
        else if(conv.startsWith("dm:")){for(String u:conv.substring(3).split(":")){WebSocketSession s=sessions.get(u);if(s!=null&&s.isOpen())sendPayload(s,payload);}}
        else for(WebSocketSession s:sessions.values())if(s.isOpen())sendPayload(s,payload);
    }
    private void broadcastGroupUpdate(Group g)throws IOException{
        Map<String,Object> p=new LinkedHashMap<>(g.toMap());p.put("type","group_updated");
        for(String u:g.getMembers()){WebSocketSession s=sessions.get(u);if(s!=null&&s.isOpen())sendPayload(s,p);}
    }
    private synchronized void sendPayload(WebSocketSession session,Object payload)throws IOException{
        if(session!=null&&session.isOpen())session.sendMessage(new TextMessage(gson.toJson(payload)));
    }

    // ── Utilities ─────────────────────────────────────────────────────

    private void sendFriendListToSession(WebSocketSession session, String username) throws IOException {
        List<Map<String, String>> friends = db.getFriends(username);
        // Add online status and lastSeen
        for (Map<String, String> f : friends) {
            String friend = f.get("username");
            ((java.util.LinkedHashMap<String,String>)f).put("online",
                presence.onlineUsers().contains(friend) ? "true" : "false");
            String seen = presence.getLastSeen(friend);
            if (seen != null) ((java.util.LinkedHashMap<String,String>)f).put("lastSeen", seen);
        }
        ChatMessage msg = new ChatMessage();
        msg.setType(MessageType.FRIEND_LIST);
        msg.setFriendList(friends);
        msg.setTimestamp(java.time.Instant.now().toString());
        send(session, msg);
    }

    private void sendBlockedUsers(WebSocketSession session,String username)throws IOException{
        sendPayload(session,Map.of("type","blocked_users","users",db.getBlockedUsers(username)));
    }

    private void sendConversationList(WebSocketSession session,String username)throws IOException{
        List<Map<String,Object>> items=db.getConversationSummaries(username);
        Map<String,Object> payload=new LinkedHashMap<>();payload.put("type","conversation_list");payload.put("conversations",items);
        sendPayload(session,payload);
    }

    private void sendPendingRequestsToSession(WebSocketSession session, String username) throws IOException {
        List<Map<String, String>> pending = db.getPendingRequestsReceived(username);
        ChatMessage msg = new ChatMessage();
        msg.setType(MessageType.FRIEND_REQUESTS_LIST);
        msg.setPendingRequests(pending);
        msg.setTimestamp(java.time.Instant.now().toString());
        send(session, msg);
    }

    private String requireAuth(WebSocketSession session) throws IOException {
        String u = getUsername(session);
        if (u == null) sendError(session, "Chưa đăng nhập.");
        return u;
    }

    private String getUsername(WebSocketSession session) {
        Object u = session.getAttributes().get("username");
        return u instanceof String s ? s : null;
    }

    private String getString(JsonObject json, String key) {
        return json.has(key) && !json.get(key).isJsonNull() ? json.get(key).getAsString() : null;
    }

    private synchronized void send(WebSocketSession session, ChatMessage msg) throws IOException {
        if (session != null && session.isOpen()) {
            session.sendMessage(new TextMessage(gson.toJson(msg)));
        }
    }

    private void broadcast(ChatMessage msg) {
        String json = gson.toJson(msg);
        for (WebSocketSession s : sessions.values()) {
            if (s.isOpen()) {
                try { s.sendMessage(new TextMessage(json)); }
                catch (IOException e) { /* log */ }
            }
        }
    }

    private void broadcastSystem(String content) {
        messageBus.publish(ChatMessage.message(MessageType.SYSTEM, "SERVER", 0, content));
    }

    private void broadcastToWebClients(ChatMessage msg) {
        String json = gson.toJson(msg);
        for (WebSocketSession s : sessions.values()) {
            if (s.isOpen()) {
                try { s.sendMessage(new TextMessage(json)); }
                catch (IOException e) { System.err.println("WebSocket send failed: " + e.getMessage()); }
            }
        }
    }

    private void broadcastUserList() {
        ChatMessage msg = new ChatMessage();
        msg.setType(MessageType.USER_LIST);
        msg.setUsers(new ArrayList<>(presence.onlineUsers()));
        msg.setLastSeenMap(presence.getLastSeenSnapshot());
        msg.setTimestamp(java.time.Instant.now().toString());
        broadcast(msg);
    }

    private void sendUserList(WebSocketSession session) throws IOException {
        ChatMessage msg = new ChatMessage();
        msg.setType(MessageType.USER_LIST);
        msg.setUsers(new ArrayList<>(presence.onlineUsers()));
        msg.setLastSeenMap(presence.getLastSeenSnapshot());
        msg.setTimestamp(java.time.Instant.now().toString());
        send(session, msg);
    }

    private void sendGroupListFromDb(WebSocketSession session, String username) throws IOException {
        // Load groups from DB and register in memory
        List<Map<String, Object>> dbGroups = db.getGroupsForUser(username);
        for (Map<String, Object> g : dbGroups) {
            String gid = (String) g.get("id");
            String av = (String) g.get("avatarPath");
            if (!groups.containsKey(gid)) {
                @SuppressWarnings("unchecked")
                List<String> members = (List<String>) g.get("members");
                Group group = new Group(gid, (String)g.get("name"), (String)g.get("createdBy"), members, av);
                groups.put(gid, group);
            } else if (av != null) {
                groups.get(gid).setAvatarPath(av);
            }
        }

        List<Object> userGroups = groups.values().stream()
                .filter(g -> g.hasMember(username))
                .map(Group::toMap)
                .collect(Collectors.toList());
        ChatMessage msg = new ChatMessage();
        msg.setType(MessageType.GROUP_LIST);
        msg.setGroups(userGroups);
        msg.setTimestamp(java.time.Instant.now().toString());
        send(session, msg);
    }

    private void sendError(WebSocketSession session, String content) throws IOException {
        send(session, ChatMessage.error(content));
    }

    private void addHistory(String convId, ChatMessage msg) {
        LinkedList<ChatMessage> list = history.computeIfAbsent(convId, k -> new LinkedList<>());
        synchronized (list) {
            list.addLast(msg);
            if (list.size() > MAX_HISTORY) list.removeFirst();
        }
    }

    /** Cho phép FileController lấy danh sách session để gửi thông báo file. */
    public ConcurrentHashMap<String, WebSocketSession> getSessions() { return sessions; }
    public ConcurrentHashMap<String, Group> getGroups() { return groups; }
    public void recordHistory(String convId, ChatMessage msg) { addHistory(convId, msg); }
}
