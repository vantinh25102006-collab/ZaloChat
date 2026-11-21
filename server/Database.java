package server;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Simple singleton wrapper for SQLite connection. Creates the database file at data/chat.db and ensures the required tables exist.
 */
public class Database {
    private static final String DB_URL = "jdbc:sqlite:data/chat.db";
    private static Connection conn;

    static {
        try {
            // Load the driver class explicitly (optional with modern JDBC but keeps compatibility)
            Class.forName("org.sqlite.JDBC");
            conn = DriverManager.getConnection(DB_URL);
            init();
        } catch (ClassNotFoundException | SQLException e) {
            throw new RuntimeException("Failed to initialize SQLite database", e);
        }
    }

    private static void init() throws SQLException {
        try (Statement s = conn.createStatement()) {
            // Users table – stores username, phone, password hash and salt for future migration.
            s.executeUpdate("CREATE TABLE IF NOT EXISTS users (" +
                    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                    "username TEXT UNIQUE NOT NULL, " +
                    "phone TEXT UNIQUE, " +
                    "password_hash TEXT NOT NULL, " +
                    "salt TEXT NOT NULL" +
                    ")");
            // Friends table – status: pending, accepted.
            s.executeUpdate("CREATE TABLE IF NOT EXISTS friends (" +
                    "user_id INTEGER NOT NULL, " +
                    "friend_id INTEGER NOT NULL, " +
                    "status TEXT NOT NULL, " +
                    "UNIQUE(user_id, friend_id)" +
                    ")");
            // Groups and membership.
            s.executeUpdate("CREATE TABLE IF NOT EXISTS groups (" +
                    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                    "name TEXT NOT NULL, " +
                    "owner_id INTEGER NOT NULL" +
                    ")");
            s.executeUpdate("CREATE TABLE IF NOT EXISTS group_members (" +
                    "group_id INTEGER NOT NULL, " +
                    "user_id INTEGER NOT NULL" +
                    ")");
            // Chat messages – chatId can be a group id or a composite of two usernames for private chat.
            s.executeUpdate("CREATE TABLE IF NOT EXISTS messages (" +
                    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                    "chat_id TEXT NOT NULL, " +
                    "sender_id INTEGER NOT NULL, " +
                    "type TEXT NOT NULL, " +
                    "content TEXT, " +
                    "timestamp DATETIME DEFAULT CURRENT_TIMESTAMP" +
                    ")");
            // Media metadata – links to files stored on disk.
            s.executeUpdate("CREATE TABLE IF NOT EXISTS media (" +
                    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                    "message_id INTEGER NOT NULL, " +
                    "path TEXT NOT NULL, " +
                    "mime TEXT NOT NULL" +
                    ")");
            // Links – extracted URLs.
            s.executeUpdate("CREATE TABLE IF NOT EXISTS links (" +
                    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                    "message_id INTEGER NOT NULL, " +
                    "url TEXT NOT NULL" +
                    ")");
            // Durable chat domain data (username-based so it works with the existing account store).
            s.executeUpdate("CREATE TABLE IF NOT EXISTS chat_history (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)");
            s.executeUpdate("CREATE INDEX IF NOT EXISTS idx_chat_history_conversation ON chat_history(conversation_id, id)");
            s.executeUpdate("CREATE TABLE IF NOT EXISTS friend_requests (sender TEXT NOT NULL, receiver TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(sender, receiver))");
            s.executeUpdate("CREATE TABLE IF NOT EXISTS user_friends (user_a TEXT NOT NULL, user_b TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_a, user_b))");
            s.executeUpdate("CREATE TABLE IF NOT EXISTS chat_groups (group_id TEXT PRIMARY KEY, name TEXT NOT NULL, owner TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
            s.executeUpdate("CREATE TABLE IF NOT EXISTS chat_group_members (group_id TEXT NOT NULL, username TEXT NOT NULL, PRIMARY KEY(group_id, username))");
            s.executeUpdate("CREATE TABLE IF NOT EXISTS shared_files (file_id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, filename TEXT NOT NULL, stored_path TEXT NOT NULL, mime_type TEXT, file_size TEXT, uploader TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
        }
    }

    public static Connection getConnection() {
        return conn;
    }
}

