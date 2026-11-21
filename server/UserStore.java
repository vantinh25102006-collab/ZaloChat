package server;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Kho tài khoản lưu bền vững trên đĩa; chỉ lưu salt + PBKDF2 hash, không lưu mật khẩu rõ. */
public class UserStore {
    private static final int ITERATIONS = 210_000;
    private static final int KEY_BITS = 256;
    private static final int SALT_BYTES = 16;
    // Resolve to an absolute path so the storage location is independent of the IDE/Maven working directory.
    // Override with -Dchat.users.file=... or CHAT_USERS_FILE=... when needed.
    private static final Path STORE_FILE = resolveStoreFile();

    private static Path resolveStoreFile() {
        String configured = System.getProperty("chat.users.file");
        if (configured == null || configured.isBlank()) configured = System.getenv("CHAT_USERS_FILE");
        Path path = (configured == null || configured.isBlank())
                ? Path.of(System.getProperty("user.dir"), "data", "users.json")
                : Path.of(configured);
        return path.toAbsolutePath().normalize();
    }
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private final SecureRandom random = new SecureRandom();
    private final Map<String, PasswordEntry> users = new ConcurrentHashMap<>();
    private final Map<String, String> phonesByUsername = new ConcurrentHashMap<>();
    private final Map<String, String> usernamesByPhone = new ConcurrentHashMap<>();

    public UserStore() {
        System.out.println("[UserStore] File tài khoản: " + STORE_FILE);
        loadFromDisk();
        // Chỉ tạo tài khoản mẫu khi chưa có dữ liệu. Không ghi đè/xóa tài khoản đã đăng ký.
        if (users.isEmpty()) {
            addDemoUser("an", "123456");
            addDemoUser("binh", "123456");
            addDemoUser("tinh", "123456");
            saveToDisk();
        }
    }

    private void addDemoUser(String username, String password) {
        byte[] salt = new byte[SALT_BYTES];
        random.nextBytes(salt);
        users.put(username, new PasswordEntry(salt, derive(password.toCharArray(), salt)));
    }

    public synchronized RegistrationResult register(String username, String phone, String password) {
        if (username == null || !username.matches("[A-Za-z0-9_]{3,24}"))
            return new RegistrationResult(false, "Username phải có 3–24 ký tự, chỉ gồm chữ, số hoặc dấu gạch dưới.");
        if (phone == null || !phone.matches("0[0-9]{9}"))
            return new RegistrationResult(false, "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.");
        if (password == null || password.length() < 6 || password.length() > 72)
            return new RegistrationResult(false, "Mật khẩu phải có từ 6 đến 72 ký tự.");
        if (users.containsKey(username)) return new RegistrationResult(false, "Username đã tồn tại.");
        if (usernamesByPhone.containsKey(phone)) return new RegistrationResult(false, "Số điện thoại đã được đăng ký.");

        byte[] salt = new byte[SALT_BYTES];
        random.nextBytes(salt);
        users.put(username, new PasswordEntry(salt, derive(password.toCharArray(), salt)));
        phonesByUsername.put(username, phone);
        usernamesByPhone.put(phone, username);
        try {
            saveToDisk();
        } catch (RuntimeException e) {
            users.remove(username);
            phonesByUsername.remove(username);
            usernamesByPhone.remove(phone);
            return new RegistrationResult(false, "Không thể lưu tài khoản. Kiểm tra quyền ghi thư mục data.");
        }
        return new RegistrationResult(true, "Đăng ký thành công. Tài khoản đã được lưu, bạn có thể đăng nhập.");
    }

    public List<UserSearchResult> search(String query) {
        if (query == null || query.isBlank()) return List.of();
        String q = query.trim().toLowerCase(java.util.Locale.ROOT);
        return users.keySet().stream()
                .filter(u -> u.toLowerCase(java.util.Locale.ROOT).contains(q)
                        || phonesByUsername.getOrDefault(u, "").contains(q))
                .sorted().limit(30)
                .map(u -> new UserSearchResult(u, phonesByUsername.getOrDefault(u, "")))
                .toList();
    }

    /** Tìm kiếm chính xác theo số điện thoại */
    public List<UserSearchResult> searchByPhone(String phone) {
        if (phone == null || phone.isBlank()) return List.of();
        String phone2 = phone.trim();
        String username = usernamesByPhone.get(phone2);
        if (username == null) return List.of();
        return List.of(new UserSearchResult(username, phone2));
    }

    /** Lấy SĐT của user */
    public String getPhone(String username) {
        return phonesByUsername.getOrDefault(username, "");
    }

    public record RegistrationResult(boolean success, String message) {}
    public record UserSearchResult(String username, String phone) {}

    public boolean authenticate(String username, String password) {
        if (username == null || password == null || username.isBlank()) return false;
        PasswordEntry entry = users.get(username);
        if (entry == null) return false;
        byte[] candidate = derive(password.toCharArray(), entry.salt);
        return MessageDigest.isEqual(entry.hash, candidate);
    }

    private void loadFromDisk() {
        if (!Files.exists(STORE_FILE)) return;
        try {
            StoreData data = GSON.fromJson(Files.readString(STORE_FILE, StandardCharsets.UTF_8), StoreData.class);
            if (data == null || data.users == null) return;
            for (Map.Entry<String, StoredUser> item : data.users.entrySet()) {
                StoredUser stored = item.getValue();
                if (stored == null || stored.salt == null || stored.hash == null) continue;
                byte[] salt = Base64.getDecoder().decode(stored.salt);
                byte[] hash = Base64.getDecoder().decode(stored.hash);
                if (salt.length != SALT_BYTES || hash.length == 0) continue;
                users.put(item.getKey(), new PasswordEntry(salt, hash));
                if (stored.phone != null && !stored.phone.isBlank()) {
                    phonesByUsername.put(item.getKey(), stored.phone);
                    usernamesByPhone.put(stored.phone, item.getKey());
                }
            }
        } catch (Exception e) {
            throw new IllegalStateException("Không thể đọc dữ liệu tài khoản tại " + STORE_FILE.toAbsolutePath()
                    + ". Hãy sao lưu và kiểm tra file users.json.", e);
        }
    }

    private synchronized void saveToDisk() {
        try {
            Files.createDirectories(STORE_FILE.getParent());
            StoreData data = new StoreData();
            for (Map.Entry<String, PasswordEntry> item : users.entrySet()) {
                PasswordEntry entry = item.getValue();
                StoredUser stored = new StoredUser();
                stored.salt = Base64.getEncoder().encodeToString(entry.salt);
                stored.hash = Base64.getEncoder().encodeToString(entry.hash);
                stored.phone = phonesByUsername.get(item.getKey());
                data.users.put(item.getKey(), stored);
            }
            Path temp = STORE_FILE.resolveSibling(STORE_FILE.getFileName() + ".tmp");
            Files.writeString(temp, GSON.toJson(data), StandardCharsets.UTF_8);
            try {
                Files.move(temp, STORE_FILE, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (IOException unsupportedAtomicMove) {
                Files.move(temp, STORE_FILE, StandardCopyOption.REPLACE_EXISTING);
            }
            System.out.println("[UserStore] Đã lưu " + users.size() + " tài khoản vào " + STORE_FILE);
        } catch (IOException e) {
            throw new IllegalStateException("Không thể ghi dữ liệu tài khoản vào " + STORE_FILE.toAbsolutePath(), e);
        }
    }

    private byte[] derive(char[] password, byte[] salt) {
        PBEKeySpec spec = new PBEKeySpec(password, salt, ITERATIONS, KEY_BITS);
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(spec).getEncoded();
        } catch (Exception e) {
            throw new IllegalStateException("Không thể băm mật khẩu bằng PBKDF2", e);
        } finally {
            spec.clearPassword();
            java.util.Arrays.fill(password, '\0');
        }
    }

    private static final class StoreData {
        private Map<String, StoredUser> users = new java.util.LinkedHashMap<>();
    }
    private static final class StoredUser {
        private String phone;
        private String salt;
        private String hash;
    }
    private static final class PasswordEntry {
        private final byte[] salt;
        private final byte[] hash;
        private PasswordEntry(byte[] salt, byte[] hash) {
            this.salt = salt.clone();
            this.hash = hash.clone();
        }
    }
}
