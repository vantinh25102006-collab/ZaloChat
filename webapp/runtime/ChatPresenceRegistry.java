package webapp.runtime;

import server.DatabaseManager;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** Một registry online dùng chung cho TCP Client và WebSocket Gateway, kèm theo dõi thời điểm truy cập gần nhất. */
public class ChatPresenceRegistry {
    private final Set<String> online = ConcurrentHashMap.newKeySet();
    private final Map<String, String> lastSeen = new ConcurrentHashMap<>();

    public ChatPresenceRegistry() {
        try {
            lastSeen.putAll(DatabaseManager.getInstance().getAllLastSeen());
        } catch (Exception ignored) { }
    }

    public boolean login(String username) {
        boolean ok = online.add(username);
        if (ok) {
            String now = Instant.now().toString();
            lastSeen.put(username, now);
            try { DatabaseManager.getInstance().updateLastSeen(username, now); } catch (Exception ignored) { }
        }
        return ok;
    }

    public void logout(String username) {
        if (username != null) {
            online.remove(username);
            String now = Instant.now().toString();
            lastSeen.put(username, now);
            try { DatabaseManager.getInstance().updateLastSeen(username, now); } catch (Exception ignored) { }
        }
    }

    public Set<String> onlineUsers() { return Set.copyOf(online); }

    public String getLastSeen(String username) {
        if (username == null) return null;
        String cached = lastSeen.get(username);
        if (cached != null) return cached;
        try {
            String fromDb = DatabaseManager.getInstance().getLastSeen(username);
            if (fromDb != null) lastSeen.put(username, fromDb);
            return fromDb;
        } catch (Exception ignored) { return null; }
    }

    public Map<String, String> getLastSeenSnapshot() {
        return Map.copyOf(lastSeen);
    }
}
