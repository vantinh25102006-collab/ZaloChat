package model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/** Nhóm chat – lưu trong bộ nhớ, không persist. */
public class Group {
    private final String id;
    private String name;
    private String createdBy;
    private String avatarPath;
    private final List<String> members = new CopyOnWriteArrayList<>();
    private final Instant createdAt = Instant.now();

    public Group(String id, String name, String createdBy, List<String> initialMembers) {
        this(id, name, createdBy, initialMembers, null);
    }

    public Group(String id, String name, String createdBy, List<String> initialMembers, String avatarPath) {
        this.id = id;
        this.name = name;
        this.createdBy = createdBy;
        this.avatarPath = avatarPath;
        if (initialMembers != null) this.members.addAll(initialMembers);
        if (!this.members.contains(createdBy)) this.members.add(createdBy);
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
        m.put("createdAt", createdAt.toString());
        return m;
    }
}

