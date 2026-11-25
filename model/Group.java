package model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/** Nhóm chat – đồng bộ bộ nhớ & SQLite kèm cài đặt quản trị nhóm. */
public class Group {
    public static final Set<String> SETTING_KEYS = Set.of(
        "allowEditInfo",
        "allowPin",
        "allowNotes",
        "allowPolls",
        "allowSendMessage",
        "requireApproval",
        "highlightOwnerMsg",
        "allowNewMemberHistory"
    );

    private final String id;
    private String name;
    private String createdBy;
    private String avatarPath;
    private final List<String> members = new CopyOnWriteArrayList<>();
    private final Map<String, Boolean> settings = new ConcurrentHashMap<>();
    private final Instant createdAt = Instant.now();

    public Group(String id, String name, String createdBy, List<String> initialMembers) {
        this(id, name, createdBy, initialMembers, null, null);
    }

    public Group(String id, String name, String createdBy, List<String> initialMembers, String avatarPath) {
        this(id, name, createdBy, initialMembers, avatarPath, null);
    }

    public Group(String id, String name, String createdBy, List<String> initialMembers, String avatarPath, Map<String, Boolean> initialSettings) {
        this.id = id;
        this.name = name;
        this.createdBy = createdBy;
        this.avatarPath = avatarPath;
        if (initialMembers != null) this.members.addAll(initialMembers);
        if (!this.members.contains(createdBy)) this.members.add(createdBy);
        this.settings.putAll(defaultSettings());
        if (initialSettings != null) applySettings(initialSettings);
    }

    public static Map<String, Boolean> defaultSettings() {
        Map<String, Boolean> defaults = new LinkedHashMap<>();
        defaults.put("allowEditInfo", true);
        defaults.put("allowPin", true);
        defaults.put("allowNotes", true);
        defaults.put("allowPolls", true);
        defaults.put("allowSendMessage", true);
        defaults.put("requireApproval", false);
        defaults.put("highlightOwnerMsg", true);
        defaults.put("allowNewMemberHistory", true);
        return defaults;
    }

    public Map<String, Boolean> getSettings() {
        return Collections.unmodifiableMap(new LinkedHashMap<>(settings));
    }

    public boolean getSetting(String key, boolean fallback) {
        return settings.getOrDefault(key, fallback);
    }

    public void applySettings(Map<String, Boolean> updates) {
        if (updates == null) return;
        for (Map.Entry<String, Boolean> e : updates.entrySet()) {
            if (SETTING_KEYS.contains(e.getKey()) && e.getValue() != null) {
                settings.put(e.getKey(), e.getValue());
            }
        }
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String username) { this.createdBy = username; }
    public String getAvatarPath() { return avatarPath; }
    public void setAvatarPath(String avatarPath) { this.avatarPath = avatarPath; }
    public List<String> getMembers() { return new ArrayList<>(members); }
    public boolean hasMember(String username) { return members.contains(username); }
    public void addMember(String username) { if (!members.contains(username)) members.add(username); }
    public void removeMember(String username) { members.remove(username); }
    public Instant getCreatedAt() { return createdAt; }

    /** Trả về object đơn giản để serialize thành JSON cho client. */
    public java.util.Map<String, Object> toMap() {
        java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("id", id);
        m.put("name", name);
        m.put("createdBy", createdBy);
        m.put("members", members);
        m.put("avatarPath", avatarPath);
        m.put("settings", new LinkedHashMap<>(settings));
        m.put("createdAt", createdAt.toString());
        return m;
    }
}

