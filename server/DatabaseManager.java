package server;

import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * SQLite database manager cho ZChat:
 * - Lưu tin nhắn (messages)
 * - Lưu bạn bè (friendships)
 * - Lưu lời mời kết bạn (friend_requests)
 * - Lưu nhóm và thành viên (groups, group_members)
 */
public class DatabaseManager {
    private static final Path DB_PATH;
    static {
        String configured = System.getProperty("chat.db.file");
        if (configured == null || configured.isBlank()) configured = System.getenv("CHAT_DB_FILE");
        DB_PATH = (configured == null || configured.isBlank())
                ? Path.of(System.getProperty("user.dir"), "data", "zchat.db").toAbsolutePath().normalize()
                : Path.of(configured).toAbsolutePath().normalize();
    }

    private static DatabaseManager INSTANCE;
    private Connection conn;

    private DatabaseManager() throws SQLException {
        try {
            Files.createDirectories(DB_PATH.getParent());
        } catch (Exception e) {
            throw new SQLException("Cannot create data directory", e);
        }
        conn = DriverManager.getConnection("jdbc:sqlite:" + DB_PATH.toString());
        // Enable WAL for better concurrency
        try (Statement st = conn.createStatement()) {
            st.execute("PRAGMA journal_mode=WAL");
            st.execute("PRAGMA foreign_keys=ON");
        }
        initSchema();
        System.out.println("[DB] SQLite database: " + DB_PATH);
    }

    public static synchronized DatabaseManager getInstance() {
        if (INSTANCE == null) {
            try {
                INSTANCE = new DatabaseManager();
            } catch (SQLException e) {
                throw new RuntimeException("Cannot open SQLite database: " + e.getMessage(), e);
            }
        }
        return INSTANCE;
    }

    // ── Schema ─────────────────────────────────────────────────────────

    private void initSchema() throws SQLException {
        try (Statement st = conn.createStatement()) {
            // Messages
            st.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id          TEXT PRIMARY KEY,
                    conv_id     TEXT NOT NULL,
                    sender      TEXT NOT NULL,
                    receiver    TEXT,
                    type        TEXT NOT NULL,
                    content     TEXT,
                    file_id     TEXT,
                    filename    TEXT,
                    file_size   TEXT,
                    mime_type   TEXT,
                    reply_to_id TEXT,
                    reply_to_username TEXT,
                    reply_to_content TEXT,
                    created_at  TEXT NOT NULL
                )
            """);
            try { st.execute("ALTER TABLE messages ADD COLUMN reply_to_id TEXT"); } catch (SQLException ignored) { }
            try { st.execute("ALTER TABLE messages ADD COLUMN reply_to_username TEXT"); } catch (SQLException ignored) { }
            try { st.execute("ALTER TABLE messages ADD COLUMN reply_to_content TEXT"); } catch (SQLException ignored) { }
            st.execute("CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conv_id, created_at)");

            // Friendships
            st.execute("""
                CREATE TABLE IF NOT EXISTS friendships (
                    user_a      TEXT NOT NULL,
                    user_b      TEXT NOT NULL,
                    created_at  TEXT NOT NULL,
                    PRIMARY KEY (user_a, user_b)
                )
            """);

            // Friend requests
            st.execute("""
                CREATE TABLE IF NOT EXISTS friend_requests (
                    id          TEXT PRIMARY KEY,
                    sender      TEXT NOT NULL,
                    receiver    TEXT NOT NULL,
                    status      TEXT NOT NULL DEFAULT 'pending',
                    created_at  TEXT NOT NULL
                )
            """);
            st.execute("CREATE INDEX IF NOT EXISTS idx_fr_receiver ON friend_requests(receiver, status)");
            st.execute("CREATE INDEX IF NOT EXISTS idx_fr_sender ON friend_requests(sender, status)");

            // Groups
            st.execute("""
                CREATE TABLE IF NOT EXISTS groups (
                    id          TEXT PRIMARY KEY,
                    name        TEXT NOT NULL,
                    created_by  TEXT NOT NULL,
                    created_at  TEXT NOT NULL,
                    folder_path TEXT
                )
            """);

            // Group members
            st.execute("""
                CREATE TABLE IF NOT EXISTS group_members (
                    group_id    TEXT NOT NULL,
                    username    TEXT NOT NULL,
                    joined_at   TEXT NOT NULL,
                    PRIMARY KEY (group_id, username),
                    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
                )
            """);
            st.execute("""
                CREATE TABLE IF NOT EXISTS message_reactions (
                    message_id TEXT NOT NULL, username TEXT NOT NULL, emoji TEXT NOT NULL,
                    created_at TEXT NOT NULL, PRIMARY KEY(message_id, username)
                )
            """);
            st.execute("""
                CREATE TABLE IF NOT EXISTS message_user_hidden (
                    message_id TEXT NOT NULL, username TEXT NOT NULL,
                    PRIMARY KEY(message_id, username)
                )
            """);
            st.execute("""
                CREATE TABLE IF NOT EXISTS conversation_user_state (
                    username TEXT NOT NULL, conv_id TEXT NOT NULL, deleted_at TEXT,
                    last_read_at TEXT, muted INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY(username, conv_id)
                )
            """);
            st.execute("""
                CREATE TABLE IF NOT EXISTS user_blocks (
                    blocker TEXT NOT NULL, blocked TEXT NOT NULL, created_at TEXT NOT NULL,
                    PRIMARY KEY(blocker, blocked)
                )
            """);
            st.execute("""
                CREATE TABLE IF NOT EXISTS user_profiles (
                    username TEXT PRIMARY KEY, avatar_path TEXT, cover_path TEXT, bio TEXT,
                    updated_at TEXT NOT NULL
                )
            """);
            try { st.execute("ALTER TABLE user_profiles ADD COLUMN cover_path TEXT"); } catch (SQLException ignored) { }
            st.execute("""
                CREATE TABLE IF NOT EXISTS user_posts (
                    id TEXT PRIMARY KEY, username TEXT NOT NULL, content TEXT NOT NULL,
                    image_file_id TEXT, created_at TEXT NOT NULL
                )
            """);
        }
    }

    // ── Messages ────────────────────────────────────────────────────────

    public synchronized void saveMessage(String id, String convId, String sender, String receiver,
                                         String type, String content, String fileId,
                                         String filename, String fileSize, String mimeType) {
        String sql = """
            INSERT OR IGNORE INTO messages
            (id, conv_id, sender, receiver, type, content, file_id, filename, file_size, mime_type, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, id != null ? id : java.util.UUID.randomUUID().toString());
            ps.setString(2, convId);
            ps.setString(3, sender);
            ps.setString(4, receiver);
            ps.setString(5, type);
            ps.setString(6, content);
            ps.setString(7, fileId);
            ps.setString(8, filename);
            ps.setString(9, fileSize);
            ps.setString(10, mimeType);
            ps.setString(11, java.time.Instant.now().toString());
            ps.executeUpdate();
        } catch (SQLException e) {
            System.err.println("[DB] saveMessage error: " + e.getMessage());
        }
    }

    public synchronized void setMessageReply(String id, String replyId, String replyUsername, String replyContent) {
        try (PreparedStatement ps = conn.prepareStatement("UPDATE messages SET reply_to_id=?, reply_to_username=?, reply_to_content=? WHERE id=?")) {
            ps.setString(1, replyId); ps.setString(2, replyUsername); ps.setString(3, replyContent); ps.setString(4, id); ps.executeUpdate();
        } catch (SQLException e) { System.err.println("[DB] setMessageReply: " + e.getMessage()); }
    }

    public synchronized List<Map<String, Object>> getMessages(String convId, int limit) {
        String sql = """
            SELECT id, conv_id, sender, receiver, type, content, file_id, filename, file_size, mime_type, created_at
            FROM messages WHERE conv_id = ?
            ORDER BY created_at ASC LIMIT ?
        """;
        List<Map<String, Object>> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, convId);
            ps.setInt(2, limit);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("messageId", rs.getString("id"));
                m.put("conversationId", rs.getString("conv_id"));
                m.put("username", rs.getString("sender"));
                m.put("to", rs.getString("receiver"));
                m.put("type", rs.getString("type"));
                m.put("content", rs.getString("content"));
                m.put("fileId", rs.getString("file_id"));
                m.put("filename", rs.getString("filename"));
                m.put("fileSize", rs.getString("file_size"));
                m.put("mimeType", rs.getString("mime_type"));
                m.put("timestamp", rs.getString("created_at"));
                result.add(m);
            }
        } catch (SQLException e) {
            System.err.println("[DB] getMessages error: " + e.getMessage());
        }
        return result;
    }

    public synchronized List<Map<String, Object>> searchMessages(String convId, String keyword) {
        String sql = """
            SELECT id, conv_id, sender, receiver, type, content, file_id, filename, file_size, mime_type, created_at
            FROM messages WHERE conv_id = ? AND content LIKE ?
            ORDER BY created_at ASC LIMIT 100
        """;
        List<Map<String, Object>> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, convId);
            ps.setString(2, "%" + keyword + "%");
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("messageId", rs.getString("id"));
                m.put("username", rs.getString("sender"));
                m.put("type", rs.getString("type"));
                m.put("content", rs.getString("content"));
                m.put("timestamp", rs.getString("created_at"));
                result.add(m);
            }
        } catch (SQLException e) {
            System.err.println("[DB] searchMessages error: " + e.getMessage());
        }
        return result;
    }

    // ── Friends ─────────────────────────────────────────────────────────

    public synchronized boolean areFriends(String a, String b) {
        String key1 = a.compareTo(b) < 0 ? a : b;
        String key2 = a.compareTo(b) < 0 ? b : a;
        String sql = "SELECT 1 FROM friendships WHERE user_a=? AND user_b=?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, key1);
            ps.setString(2, key2);
            return ps.executeQuery().next();
        } catch (SQLException e) {
            return false;
        }
    }

    public synchronized void addFriend(String a, String b) {
        String key1 = a.compareTo(b) < 0 ? a : b;
        String key2 = a.compareTo(b) < 0 ? b : a;
        String sql = "INSERT OR IGNORE INTO friendships(user_a, user_b, created_at) VALUES(?,?,?)";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, key1);
            ps.setString(2, key2);
            ps.setString(3, java.time.Instant.now().toString());
            ps.executeUpdate();
        } catch (SQLException e) {
            System.err.println("[DB] addFriend error: " + e.getMessage());
        }
    }

    public synchronized void removeFriend(String a, String b) {
        String key1 = a.compareTo(b) < 0 ? a : b;
        String key2 = a.compareTo(b) < 0 ? b : a;
        String sql = "DELETE FROM friendships WHERE user_a=? AND user_b=?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, key1);
            ps.setString(2, key2);
            ps.executeUpdate();
        } catch (SQLException e) {
            System.err.println("[DB] removeFriend error: " + e.getMessage());
        }
    }

    public synchronized List<Map<String, String>> getFriends(String username) {
        String sql = """
            SELECT CASE WHEN user_a=? THEN user_b ELSE user_a END as friend, created_at
            FROM friendships WHERE user_a=? OR user_b=?
        """;
        List<Map<String, String>> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, username);
            ps.setString(2, username);
            ps.setString(3, username);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Map<String, String> m = new LinkedHashMap<>();
                String friend=rs.getString("friend");
                m.put("username", friend);
                m.put("since", rs.getString("created_at"));
                m.put("conversationDeleted", isDmDeletedForUser(username,friend) ? "true" : "false");
                result.add(m);
            }
        } catch (SQLException e) {
            System.err.println("[DB] getFriends error: " + e.getMessage());
        }
        return result;
    }

    // ── Friend Requests ─────────────────────────────────────────────────

    public synchronized String sendFriendRequest(String sender, String receiver) {
        // Kiểm tra đã có pending request chưa
        String checkSql = "SELECT id FROM friend_requests WHERE sender=? AND receiver=? AND status='pending'";
        try (PreparedStatement ps = conn.prepareStatement(checkSql)) {
            ps.setString(1, sender);
            ps.setString(2, receiver);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) return rs.getString("id"); // đã gửi rồi
        } catch (SQLException e) {
            System.err.println("[DB] sendFriendRequest check error: " + e.getMessage());
        }

        String id = java.util.UUID.randomUUID().toString();
        String sql = "INSERT INTO friend_requests(id, sender, receiver, status, created_at) VALUES(?,?,?,'pending',?)";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, id);
            ps.setString(2, sender);
            ps.setString(3, receiver);
            ps.setString(4, java.time.Instant.now().toString());
            ps.executeUpdate();
            return id;
        } catch (SQLException e) {
            System.err.println("[DB] sendFriendRequest error: " + e.getMessage());
            return null;
        }
    }

    public synchronized boolean acceptFriendRequest(String requestId, String receiver) {
        String sql = "UPDATE friend_requests SET status='accepted' WHERE id=? AND receiver=? AND status='pending'";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, requestId);
            ps.setString(2, receiver);
            int rows = ps.executeUpdate();
            if (rows > 0) {
                // Lấy sender để tạo friendship
                String getSender = "SELECT sender FROM friend_requests WHERE id=?";
                try (PreparedStatement ps2 = conn.prepareStatement(getSender)) {
                    ps2.setString(1, requestId);
                    ResultSet rs = ps2.executeQuery();
                    if (rs.next()) {
                        addFriend(rs.getString("sender"), receiver);
                        return true;
                    }
                }
            }
        } catch (SQLException e) {
            System.err.println("[DB] acceptFriendRequest error: " + e.getMessage());
        }
        return false;
    }

    public synchronized boolean rejectFriendRequest(String requestId, String receiver) {
        String sql = "UPDATE friend_requests SET status='rejected' WHERE id=? AND receiver=? AND status='pending'";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, requestId);
            ps.setString(2, receiver);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("[DB] rejectFriendRequest error: " + e.getMessage());
            return false;
        }
    }

    public synchronized boolean cancelFriendRequest(String requestId, String sender) {
        String sql = "DELETE FROM friend_requests WHERE id=? AND sender=? AND status='pending'";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, requestId);
            ps.setString(2, sender);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("[DB] cancelFriendRequest error: " + e.getMessage());
            return false;
        }
    }

    /** Lấy lời mời chờ gửi đến username */
    public synchronized List<Map<String, String>> getPendingRequestsReceived(String username) {
        String sql = "SELECT id, sender, created_at FROM friend_requests WHERE receiver=? AND status='pending' ORDER BY created_at DESC";
        List<Map<String, String>> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, username);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Map<String, String> m = new LinkedHashMap<>();
                m.put("requestId", rs.getString("id"));
                m.put("sender", rs.getString("sender"));
                m.put("createdAt", rs.getString("created_at"));
                result.add(m);
            }
        } catch (SQLException e) {
            System.err.println("[DB] getPendingRequests error: " + e.getMessage());
        }
        return result;
    }

    /** Lấy lời mời đã gửi đi, còn pending */
    public synchronized List<Map<String, String>> getPendingRequestsSent(String username) {
        String sql = "SELECT id, receiver, created_at FROM friend_requests WHERE sender=? AND status='pending' ORDER BY created_at DESC";
        List<Map<String, String>> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, username);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Map<String, String> m = new LinkedHashMap<>();
                m.put("requestId", rs.getString("id"));
                m.put("receiver", rs.getString("receiver"));
                m.put("createdAt", rs.getString("created_at"));
                result.add(m);
            }
        } catch (SQLException e) {
            System.err.println("[DB] getPendingRequestsSent error: " + e.getMessage());
        }
        return result;
    }

    /** Kiểm tra trạng thái quan hệ giữa 2 user */
    public synchronized String getRelationship(String me, String other) {
        if (areFriends(me, other)) return "friend";
        // Kiểm tra pending sent
        String sqlSent = "SELECT id FROM friend_requests WHERE sender=? AND receiver=? AND status='pending'";
        try (PreparedStatement ps = conn.prepareStatement(sqlSent)) {
            ps.setString(1, me);
            ps.setString(2, other);
            if (ps.executeQuery().next()) return "pending_sent";
        } catch (SQLException ignored) {}
        // Kiểm tra pending received
        String sqlRcv = "SELECT id FROM friend_requests WHERE sender=? AND receiver=? AND status='pending'";
        try (PreparedStatement ps = conn.prepareStatement(sqlRcv)) {
            ps.setString(1, other);
            ps.setString(2, me);
            if (ps.executeQuery().next()) return "pending_received";
        } catch (SQLException ignored) {}
        return "stranger";
    }

    /** Lấy requestId của pending request từ sender đến receiver */
    public synchronized String getPendingRequestId(String sender, String receiver) {
        String sql = "SELECT id FROM friend_requests WHERE sender=? AND receiver=? AND status='pending'";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, sender);
            ps.setString(2, receiver);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) return rs.getString("id");
        } catch (SQLException e) {
            System.err.println("[DB] getPendingRequestId error: " + e.getMessage());
        }
        return null;
    }

    // ── Groups ──────────────────────────────────────────────────────────

    public synchronized void saveGroup(String groupId, String name, String createdBy, List<String> members) {
        String folderPath = "uploads/group_" + groupId;
        String sql = "INSERT OR IGNORE INTO groups(id, name, created_by, created_at, folder_path) VALUES(?,?,?,?,?)";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, groupId);
            ps.setString(2, name);
            ps.setString(3, createdBy);
            ps.setString(4, java.time.Instant.now().toString());
            ps.setString(5, folderPath);
            ps.executeUpdate();
            // Create folder
            try { Files.createDirectories(Path.of(folderPath)); } catch (Exception ignored) {}
        } catch (SQLException e) {
            System.err.println("[DB] saveGroup error: " + e.getMessage());
        }
        // Add members
        String memberSql = "INSERT OR IGNORE INTO group_members(group_id, username, joined_at) VALUES(?,?,?)";
        try (PreparedStatement ps = conn.prepareStatement(memberSql)) {
            for (String m : members) {
                ps.setString(1, groupId);
                ps.setString(2, m);
                ps.setString(3, java.time.Instant.now().toString());
                ps.addBatch();
            }
            ps.executeBatch();
        } catch (SQLException e) {
            System.err.println("[DB] saveGroupMembers error: " + e.getMessage());
        }
    }

    public synchronized List<Map<String, Object>> getGroupsForUser(String username) {
        String sql = """
            SELECT g.id, g.name, g.created_by, g.created_at, g.folder_path,
                   GROUP_CONCAT(gm2.username) as members
            FROM groups g
            JOIN group_members gm ON g.id = gm.group_id AND gm.username = ?
            JOIN group_members gm2 ON g.id = gm2.group_id
            GROUP BY g.id
        """;
        List<Map<String, Object>> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, username);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> g = new LinkedHashMap<>();
                g.put("id", rs.getString("id"));
                g.put("name", rs.getString("name"));
                g.put("createdBy", rs.getString("created_by"));
                String members = rs.getString("members");
                g.put("members", members != null ? List.of(members.split(",")) : List.of());
                g.put("conversationDeleted", isConversationDeletedForUser(username,"group:"+rs.getString("id")));
                result.add(g);
            }
        } catch (SQLException e) {
            System.err.println("[DB] getGroupsForUser error: " + e.getMessage());
        }
        return result;
    }

    /** Tạo thư mục cho DM conversation */
    public static String ensureDmFolder(String userA, String userB) {
        String key = userA.compareTo(userB) < 0 ? userA + "_" + userB : userB + "_" + userA;
        String folderPath = "uploads/dm_" + key;
        try { Files.createDirectories(Path.of(folderPath)); } catch (Exception ignored) {}
        return folderPath;
    }


    // ── Extended chat features ─────────────────────────────────────────
    public synchronized boolean messageBelongsToConversation(String messageId,String convId) {
        try(PreparedStatement ps=conn.prepareStatement("SELECT 1 FROM messages WHERE id=? AND conv_id=?")){
            ps.setString(1,messageId);ps.setString(2,convId);return ps.executeQuery().next();
        }catch(SQLException e){return false;}
    }

    public synchronized boolean setReaction(String messageId, String username, String emoji) {
        if (messageId == null || username == null || emoji == null || emoji.isBlank()) return false;
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO message_reactions(message_id,username,emoji,created_at) VALUES(?,?,?,?) " +
                "ON CONFLICT(message_id,username) DO UPDATE SET emoji=excluded.emoji,created_at=excluded.created_at")) {
            ps.setString(1, messageId); ps.setString(2, username); ps.setString(3, emoji);
            ps.setString(4, java.time.Instant.now().toString()); return ps.executeUpdate() > 0;
        } catch (SQLException e) { System.err.println("[DB] setReaction: " + e.getMessage()); return false; }
    }

    public synchronized boolean removeReaction(String messageId, String username) {
        try (PreparedStatement ps = conn.prepareStatement("DELETE FROM message_reactions WHERE message_id=? AND username=?")) {
            ps.setString(1, messageId); ps.setString(2, username); return ps.executeUpdate() > 0;
        } catch (SQLException e) { return false; }
    }

    public synchronized Map<String,String> getFileMetadata(String fileId) {
        try(PreparedStatement ps=conn.prepareStatement("SELECT filename,file_size,mime_type,sender FROM messages WHERE file_id=? ORDER BY created_at DESC LIMIT 1")){
            ps.setString(1,fileId);ResultSet rs=ps.executeQuery();if(rs.next()){
                Map<String,String> m=new HashMap<>();m.put("filename",rs.getString(1));m.put("fileSize",rs.getString(2));m.put("mimeType",rs.getString(3));m.put("uploader",rs.getString(4));return m;
            }
        }catch(SQLException e){System.err.println("[DB] getFileMetadata: "+e.getMessage());}
        return null;
    }

    public synchronized List<Map<String,Object>> getReactions(String messageId) {
        List<Map<String,Object>> out = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement("SELECT r.username,r.emoji,p.avatar_path FROM message_reactions r LEFT JOIN user_profiles p ON p.username=r.username WHERE r.message_id=? ORDER BY r.created_at ASC")) {
            ps.setString(1,messageId); ResultSet rs=ps.executeQuery();
            while(rs.next()){ Map<String,Object> m=new LinkedHashMap<>();m.put("username",rs.getString(1));m.put("emoji",rs.getString(2));m.put("avatar",rs.getString(3));out.add(m);}
        } catch(SQLException e){System.err.println("[DB] getReactions: "+e.getMessage());}
        return out;
    }

    public synchronized boolean hideMessageForUser(String messageId,String username) {
        try(PreparedStatement ps=conn.prepareStatement("""
            INSERT OR IGNORE INTO message_user_hidden(message_id,username)
            SELECT id,? FROM messages WHERE id=? AND sender=?
        """)){ps.setString(1,username);ps.setString(2,messageId);ps.setString(3,username);return ps.executeUpdate()>0;}
        catch(SQLException e){System.err.println("[DB] hideMessageForUser: "+e.getMessage());return false;}
    }

    public synchronized boolean revokeMessage(String messageId, String sender) {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE messages SET type='revoked',content='Tin nhắn đã được thu hồi',file_id=NULL,filename=NULL,file_size=NULL,mime_type=NULL WHERE id=? AND sender=? AND type<>'revoked'")) {
            ps.setString(1,messageId); ps.setString(2,sender);
            int changed=ps.executeUpdate();
            if(changed>0)try(PreparedStatement del=conn.prepareStatement("DELETE FROM message_reactions WHERE message_id=?")){del.setString(1,messageId);del.executeUpdate();}
            return changed>0;
        } catch(SQLException e){System.err.println("[DB] revokeMessage: "+e.getMessage());return false;}
    }

    public synchronized boolean deleteConversationForUser(String username, String convId) {
        try (PreparedStatement ps = conn.prepareStatement("""
            INSERT INTO conversation_user_state(username,conv_id,deleted_at,last_read_at,muted)
            VALUES(?,?,?,NULL,0)
            ON CONFLICT(username,conv_id) DO UPDATE SET deleted_at=excluded.deleted_at
        """)) {
            ps.setString(1,username);ps.setString(2,convId);ps.setString(3,java.time.Instant.now().toString());
            return ps.executeUpdate()>0;
        } catch(SQLException e){System.err.println("[DB] deleteConversationForUser: "+e.getMessage());return false;}
    }

    public synchronized List<Map<String,Object>> getMessagesForUser(String convId, int limit, String username) {
        String sql = """
            SELECT id, conv_id, sender, receiver, type, content, file_id, filename, file_size, mime_type, created_at, reply_to_id, reply_to_username, reply_to_content
            FROM messages m WHERE conv_id = ? AND created_at > COALESCE(
              (SELECT deleted_at FROM conversation_user_state s WHERE s.username=? AND s.conv_id=m.conv_id),''
            ) AND NOT EXISTS (SELECT 1 FROM message_user_hidden h WHERE h.message_id=m.id AND h.username=?)
            ORDER BY created_at ASC LIMIT ?
        """;
        List<Map<String,Object>> result=new ArrayList<>();
        try(PreparedStatement ps=conn.prepareStatement(sql)){
            ps.setString(1,convId);ps.setString(2,username);ps.setString(3,username);ps.setInt(4,limit);
            ResultSet rs=ps.executeQuery();
            while(rs.next()){
                Map<String,Object> m=new LinkedHashMap<>();
                m.put("messageId",rs.getString("id"));m.put("conversationId",rs.getString("conv_id"));
                m.put("username",rs.getString("sender"));m.put("to",rs.getString("receiver"));
                m.put("type",rs.getString("type"));m.put("content",rs.getString("content"));
                m.put("fileId",rs.getString("file_id"));m.put("filename",rs.getString("filename"));
                m.put("fileSize",rs.getString("file_size"));m.put("mimeType",rs.getString("mime_type"));
                m.put("timestamp",rs.getString("created_at"));m.put("replyToId",rs.getString("reply_to_id"));m.put("replyToUsername",rs.getString("reply_to_username"));m.put("replyToContent",rs.getString("reply_to_content"));m.put("reactions",getReactions(rs.getString("id")));
                result.add(m);
            }
        }catch(SQLException e){System.err.println("[DB] getMessagesForUser: "+e.getMessage());}
        return result;
    }

    public synchronized boolean isConversationDeletedForUser(String username,String convId) {
        try(PreparedStatement ps=conn.prepareStatement("SELECT deleted_at FROM conversation_user_state WHERE username=? AND conv_id=?")){
            ps.setString(1,username);ps.setString(2,convId);ResultSet rs=ps.executeQuery();
            return rs.next() && rs.getString(1)!=null && !rs.getString(1).isBlank();
        }catch(SQLException e){return false;}
    }
    public synchronized boolean isDmDeletedForUser(String username,String other) {
        String key=username.compareTo(other)<0?username+":"+other:other+":"+username;
        return isConversationDeletedForUser(username,"dm:"+key);
    }

    public synchronized List<Map<String,Object>> getConversationSummaries(String username) {
        List<Map<String,Object>> out=new ArrayList<>();
        String sql="""
            SELECT conv_id, MAX(created_at) AS last_time,
                   COALESCE((SELECT muted FROM conversation_user_state s WHERE s.username=? AND s.conv_id=messages.conv_id),0) AS muted
            FROM messages
            WHERE ((conv_id LIKE 'dm:%' AND (sender=? OR receiver=?)) OR conv_id IN
                   (SELECT 'group:' || group_id FROM group_members WHERE username=?))
              AND created_at > COALESCE((SELECT deleted_at FROM conversation_user_state s
                    WHERE s.username=? AND s.conv_id=messages.conv_id),'')
              AND NOT EXISTS (SELECT 1 FROM message_user_hidden h WHERE h.message_id=messages.id AND h.username=?)
            GROUP BY conv_id ORDER BY last_time DESC
        """;
        try(PreparedStatement ps=conn.prepareStatement(sql)){
            ps.setString(1,username);ps.setString(2,username);ps.setString(3,username);ps.setString(4,username);ps.setString(5,username);ps.setString(6,username);
            ResultSet rs=ps.executeQuery();
            while(rs.next()){
                String conv=rs.getString("conv_id"),last=rs.getString("last_time");
                Map<String,Object> item=new LinkedHashMap<>();item.put("conversationId",conv);item.put("lastTimestamp",last);item.put("muted",rs.getInt("muted") == 1);
                try(PreparedStatement lastPs=conn.prepareStatement("SELECT sender,content,type,filename FROM messages WHERE conv_id=? AND created_at=? ORDER BY rowid DESC LIMIT 1")){
                    lastPs.setString(1,conv);lastPs.setString(2,last);ResultSet lr=lastPs.executeQuery();
                    if(lr.next()){String c=lr.getString("content");String type=lr.getString("type");item.put("lastMessage",c!=null?c:("file_share".equals(type)?"📎 "+Objects.toString(lr.getString("filename"),"Tệp đính kèm"):""));item.put("lastSender",lr.getString("sender"));}
                }
                try(PreparedStatement unreadPs=conn.prepareStatement("""
                    SELECT COUNT(*) FROM messages m WHERE m.conv_id=? AND m.sender<>?
                    AND m.created_at > COALESCE((SELECT last_read_at FROM conversation_user_state s WHERE s.username=? AND s.conv_id=m.conv_id),'')
                    AND m.created_at > COALESCE((SELECT deleted_at FROM conversation_user_state s WHERE s.username=? AND s.conv_id=m.conv_id),'')
                    AND NOT EXISTS (SELECT 1 FROM message_user_hidden h WHERE h.message_id=m.id AND h.username=?)
                """)){
                    unreadPs.setString(1,conv);unreadPs.setString(2,username);unreadPs.setString(3,username);unreadPs.setString(4,username);unreadPs.setString(5,username);
                    ResultSet ur=unreadPs.executeQuery();item.put("unread",ur.next()?ur.getInt(1):0);
                }
                out.add(item);
            }
        }catch(SQLException e){System.err.println("[DB] getConversationSummaries: "+e.getMessage());}
        return out;
    }

    public synchronized boolean markConversationRead(String username,String convId) {
        try(PreparedStatement ps=conn.prepareStatement("""
            INSERT INTO conversation_user_state(username,conv_id,last_read_at,muted)
            VALUES(?,?,?,0) ON CONFLICT(username,conv_id) DO UPDATE SET last_read_at=excluded.last_read_at
        """)){ps.setString(1,username);ps.setString(2,convId);ps.setString(3,java.time.Instant.now().toString());return ps.executeUpdate()>0;}
        catch(SQLException e){return false;}
    }

    public synchronized boolean setConversationMuted(String username,String convId,boolean muted) {
        try(PreparedStatement ps=conn.prepareStatement("""
            INSERT INTO conversation_user_state(username,conv_id,muted)
            VALUES(?,?,?) ON CONFLICT(username,conv_id) DO UPDATE SET muted=excluded.muted
        """)){ps.setString(1,username);ps.setString(2,convId);ps.setInt(3,muted?1:0);return ps.executeUpdate()>0;}
        catch(SQLException e){return false;}
    }

    public synchronized boolean isBlockedEitherWay(String a,String b) {
        try(PreparedStatement ps=conn.prepareStatement("SELECT 1 FROM user_blocks WHERE (blocker=? AND blocked=?) OR (blocker=? AND blocked=?) LIMIT 1")){
            ps.setString(1,a);ps.setString(2,b);ps.setString(3,b);ps.setString(4,a);return ps.executeQuery().next();
        }catch(SQLException e){return false;}
    }
    public synchronized boolean blockUser(String blocker,String blocked) {
        try(PreparedStatement ps=conn.prepareStatement("INSERT OR IGNORE INTO user_blocks(blocker,blocked,created_at) VALUES(?,?,?)")){
            ps.setString(1,blocker);ps.setString(2,blocked);ps.setString(3,java.time.Instant.now().toString());return ps.executeUpdate()>0;
        }catch(SQLException e){return false;}
    }
    public synchronized boolean unblockUser(String blocker,String blocked) {
        try(PreparedStatement ps=conn.prepareStatement("DELETE FROM user_blocks WHERE blocker=? AND blocked=?")){
            ps.setString(1,blocker);ps.setString(2,blocked);return ps.executeUpdate()>0;
        }catch(SQLException e){return false;}
    }
    public synchronized List<String> getBlockedUsers(String blocker) {
        List<String> out=new ArrayList<>();
        try(PreparedStatement ps=conn.prepareStatement("SELECT blocked FROM user_blocks WHERE blocker=? ORDER BY created_at DESC")){
            ps.setString(1,blocker);ResultSet rs=ps.executeQuery();while(rs.next())out.add(rs.getString(1));
        }catch(SQLException e){System.err.println("[DB] getBlockedUsers: "+e.getMessage());}
        return out;
    }
    public synchronized boolean isBlockedBy(String blocker,String blocked) {
        try(PreparedStatement ps=conn.prepareStatement("SELECT 1 FROM user_blocks WHERE blocker=? AND blocked=?")){
            ps.setString(1,blocker);ps.setString(2,blocked);return ps.executeQuery().next();
        }catch(SQLException e){return false;}
    }

    public synchronized void updateProfile(String username,String avatarPath,String bio) { updateProfile(username,avatarPath,null,bio); }
    public synchronized void updateProfile(String username,String avatarPath,String coverPath,String bio) {
        try(PreparedStatement ps=conn.prepareStatement("""
            INSERT INTO user_profiles(username,avatar_path,cover_path,bio,updated_at) VALUES(?,?,?,?,?)
            ON CONFLICT(username) DO UPDATE SET avatar_path=COALESCE(excluded.avatar_path,user_profiles.avatar_path),
              cover_path=COALESCE(excluded.cover_path,user_profiles.cover_path), bio=COALESCE(excluded.bio,user_profiles.bio),updated_at=excluded.updated_at
        """)){ps.setString(1,username);ps.setString(2,avatarPath);ps.setString(3,coverPath);ps.setString(4,bio);ps.setString(5,java.time.Instant.now().toString());ps.executeUpdate();}
        catch(SQLException e){System.err.println("[DB] updateProfile: "+e.getMessage());}
    }
    public synchronized Map<String,Object> getProfile(String username) {
        Map<String,Object> m=new LinkedHashMap<>();m.put("username",username);m.put("avatarPath",null);m.put("coverPath",null);m.put("bio","");
        try(PreparedStatement ps=conn.prepareStatement("SELECT avatar_path,cover_path,bio FROM user_profiles WHERE username=?")){
            ps.setString(1,username);ResultSet rs=ps.executeQuery();if(rs.next()){m.put("avatarPath",rs.getString(1));m.put("coverPath",rs.getString(2));m.put("bio",rs.getString(3));}
        }catch(SQLException e){System.err.println("[DB] getProfile: "+e.getMessage());}return m;
    }
    public synchronized String createPost(String username,String content,String imageFileId) {
        String id=UUID.randomUUID().toString();
        try(PreparedStatement ps=conn.prepareStatement("INSERT INTO user_posts(id,username,content,image_file_id,created_at) VALUES(?,?,?,?,?)")){
            ps.setString(1,id);ps.setString(2,username);ps.setString(3,content);ps.setString(4,imageFileId);ps.setString(5,java.time.Instant.now().toString());ps.executeUpdate();return id;
        }catch(SQLException e){System.err.println("[DB] createPost: "+e.getMessage());return null;}
    }
    public synchronized List<Map<String,Object>> getPosts(String username) {
        List<Map<String,Object>> out=new ArrayList<>();
        try(PreparedStatement ps=conn.prepareStatement("SELECT id,username,content,image_file_id,created_at FROM user_posts WHERE username=? ORDER BY created_at DESC")){
            ps.setString(1,username);ResultSet rs=ps.executeQuery();while(rs.next()){
                Map<String,Object> m=new LinkedHashMap<>();m.put("postId",rs.getString(1));m.put("username",rs.getString(2));m.put("content",rs.getString(3));m.put("imageFileId",rs.getString(4));m.put("timestamp",rs.getString(5));out.add(m);
            }
        }catch(SQLException e){System.err.println("[DB] getPosts: "+e.getMessage());}return out;
    }


    public synchronized boolean transferGroupOwner(String groupId,String currentOwner,String newOwner) {
        try(PreparedStatement ps=conn.prepareStatement("UPDATE groups SET created_by=? WHERE id=? AND created_by=?")){
            ps.setString(1,newOwner);ps.setString(2,groupId);ps.setString(3,currentOwner);return ps.executeUpdate()>0;
        }catch(SQLException e){return false;}
    }
    public synchronized boolean addGroupMember(String groupId,String username) {
        try(PreparedStatement ps=conn.prepareStatement("INSERT OR IGNORE INTO group_members(group_id,username,joined_at) VALUES(?,?,?)")){
            ps.setString(1,groupId);ps.setString(2,username);ps.setString(3,java.time.Instant.now().toString());return ps.executeUpdate()>0;
        }catch(SQLException e){return false;}
    }
    public synchronized boolean removeGroupMember(String groupId,String username) {
        try(PreparedStatement ps=conn.prepareStatement("DELETE FROM group_members WHERE group_id=? AND username=?")){
            ps.setString(1,groupId);ps.setString(2,username);return ps.executeUpdate()>0;
        }catch(SQLException e){return false;}
    }
    public synchronized boolean deleteGroup(String groupId,String owner) {
        try(PreparedStatement ps=conn.prepareStatement("DELETE FROM groups WHERE id=? AND created_by=?")){
            ps.setString(1,groupId);ps.setString(2,owner);
            int changed=ps.executeUpdate();
            if(changed>0){
                String conv="group:"+groupId;
                try(PreparedStatement p1=conn.prepareStatement("DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE conv_id=?)")){p1.setString(1,conv);p1.executeUpdate();}
                try(PreparedStatement p2=conn.prepareStatement("DELETE FROM message_user_hidden WHERE message_id IN (SELECT id FROM messages WHERE conv_id=?)")){p2.setString(1,conv);p2.executeUpdate();}
                try(PreparedStatement p3=conn.prepareStatement("DELETE FROM messages WHERE conv_id=?")){p3.setString(1,conv);p3.executeUpdate();}
                try(PreparedStatement p4=conn.prepareStatement("DELETE FROM conversation_user_state WHERE conv_id=?")){p4.setString(1,conv);p4.executeUpdate();}
            }
            return changed>0;
        }catch(SQLException e){System.err.println("[DB] deleteGroup: "+e.getMessage());return false;}
    }

    public Connection getConnection() { return conn; }
}

