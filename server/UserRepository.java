package server;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/** Simple DAO for user related operations using the SQLite database. */
public class UserRepository {
    private final Connection conn = Database.getConnection();

    public boolean usernameExists(String username) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT 1 FROM users WHERE username = ?")) {
            ps.setString(1, username);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    public boolean phoneExists(String phone) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT 1 FROM users WHERE phone = ?")) {
            ps.setString(1, phone);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    public void insertUser(String username, String phone, String passwordHash, String salt) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO users (username, phone, password_hash, salt) VALUES (?,?,?,?)")) {
            ps.setString(1, username);
            ps.setString(2, phone);
            ps.setString(3, passwordHash);
            ps.setString(4, salt);
            ps.executeUpdate();
        }
    }

    public List<UserStore.UserSearchResult> search(String query) throws SQLException {
        String q = "%" + query.toLowerCase() + "%";
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT username, phone FROM users WHERE LOWER(username) LIKE ? OR phone LIKE ? LIMIT 30")) {
            ps.setString(1, q);
            ps.setString(2, q);
            try (ResultSet rs = ps.executeQuery()) {
                List<UserStore.UserSearchResult> list = new ArrayList<>();
                while (rs.next()) {
                    list.add(new UserStore.UserSearchResult(rs.getString("username"), rs.getString("phone")));
                }
                return list;
            }
        }
    }

    public String getPasswordHash(String username) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT password_hash FROM users WHERE username = ?")) {
            ps.setString(1, username);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getString(1) : null;
            }
        }
    }

    public String getSalt(String username) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT salt FROM users WHERE username = ?")) {
            ps.setString(1, username);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getString(1) : null;
            }
        }
    }

    public UserStore.UserSearchResult findByPhone(String phone) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT username, phone FROM users WHERE phone = ?")) {
            ps.setString(1, phone);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return new UserStore.UserSearchResult(rs.getString("username"), rs.getString("phone"));
                }
                return null;
            }
        }
    }
}

