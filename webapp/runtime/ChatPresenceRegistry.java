package webapp.runtime;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** Một registry online dùng chung cho TCP Client và WebSocket Gateway. */
public class ChatPresenceRegistry {
    private final Set<String> online = ConcurrentHashMap.newKeySet();

    public boolean login(String username) { return online.add(username); }
    public void logout(String username) { if (username != null) online.remove(username); }
    public Set<String> onlineUsers() { return Set.copyOf(online); }
}
