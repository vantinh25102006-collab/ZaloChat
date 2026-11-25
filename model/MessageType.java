package model;

import com.google.gson.annotations.SerializedName;

/** Các loại thông điệp của giao thức SecureTcpChat (TCP + WebSocket). */
public enum MessageType {
    // ── TCP protocol (cũ, giữ nguyên) ──────────────────────────────────
    @SerializedName("login")         LOGIN,
    @SerializedName("register")      REGISTER,
    @SerializedName("register_result") REGISTER_RESULT,
    @SerializedName("search_users")   SEARCH_USERS,
    @SerializedName("search_results") SEARCH_RESULTS,
    @SerializedName("login_result")  LOGIN_RESULT,
    @SerializedName("message")       MESSAGE,
    @SerializedName("system")        SYSTEM,
    @SerializedName("disconnect")    DISCONNECT,

    // ── WebSocket protocol (mới) ────────────────────────────────────────
    @SerializedName("private_message")   PRIVATE_MESSAGE,   // Nhắn tin riêng
    @SerializedName("group_message")     GROUP_MESSAGE,     // Tin nhắn nhóm
    @SerializedName("create_group")      CREATE_GROUP,      // Tạo nhóm
    @SerializedName("group_created")     GROUP_CREATED,     // Phản hồi tạo nhóm thành công
    @SerializedName("add_to_group")      ADD_TO_GROUP,      // Thêm thành viên vào nhóm
    @SerializedName("file_share")        FILE_SHARE,        // Chia sẻ file (DM hoặc group)
    @SerializedName("user_list")         USER_LIST,         // Danh sách user online
    @SerializedName("group_list")        GROUP_LIST,        // Danh sách nhóm của user
    @SerializedName("history")           HISTORY,           // Lịch sử tin nhắn
    @SerializedName("typing")            TYPING,            // Đang gõ...
    @SerializedName("read")              READ,              // Đã đọc
    @SerializedName("error")             ERROR,             // Thông báo lỗi

    // ── Friend system ───────────────────────────────────────────────────
    @SerializedName("friend_request")    FRIEND_REQUEST,    // Gửi lời mời kết bạn
    @SerializedName("friend_accept")     FRIEND_ACCEPT,     // Chấp nhận kết bạn
    @SerializedName("friend_reject")     FRIEND_REJECT,     // Từ chối kết bạn
    @SerializedName("friend_cancel")     FRIEND_CANCEL,     // Hủy lời mời đã gửi
    @SerializedName("unfriend")          UNFRIEND,          // Hủy kết bạn
    @SerializedName("friend_list")       FRIEND_LIST,       // Danh sách bạn bè
    @SerializedName("friend_requests_list") FRIEND_REQUESTS_LIST, // Danh sách lời mời nhận được
    @SerializedName("user_profile")      USER_PROFILE,      // Thông tin trang cá nhân
    @SerializedName("search_by_phone")   SEARCH_BY_PHONE,   // Tìm user theo SĐT
    @SerializedName("react_message")    REACT_MESSAGE,
    @SerializedName("revoke_message")   REVOKE_MESSAGE,
    @SerializedName("message_reaction") MESSAGE_REACTION,
    @SerializedName("message_revoked")  MESSAGE_REVOKED,
    @SerializedName("delete_conversation") DELETE_CONVERSATION,
    @SerializedName("conversation_deleted") CONVERSATION_DELETED,
    @SerializedName("mark_read")        MARK_READ,
    @SerializedName("mute_conversation") MUTE_CONVERSATION,
    @SerializedName("block_user")       BLOCK_USER,
    @SerializedName("unblock_user")     UNBLOCK_USER,
    @SerializedName("profile_update")   PROFILE_UPDATE,
    @SerializedName("create_post")      CREATE_POST,
    @SerializedName("get_posts")       GET_POSTS,
    @SerializedName("posts_result")     POSTS_RESULT,
    @SerializedName("group_add_member") GROUP_ADD_MEMBER,
    @SerializedName("group_remove_member") GROUP_REMOVE_MEMBER,
    @SerializedName("group_update_info") GROUP_UPDATE_INFO,
    @SerializedName("group_transfer_owner") GROUP_TRANSFER_OWNER,
    @SerializedName("group_leave")      GROUP_LEAVE,
    @SerializedName("group_delete")     GROUP_DELETE,
    @SerializedName("group_update_settings") GROUP_UPDATE_SETTINGS,
    @SerializedName("delete_message_for_me") DELETE_MESSAGE_FOR_ME,
    @SerializedName("message_hidden") MESSAGE_HIDDEN,
    @SerializedName("conversation_list") CONVERSATION_LIST,
    @SerializedName("blocked_users") BLOCKED_USERS,
    @SerializedName("resume_session") RESUME_SESSION,
    @SerializedName("pin_message") PIN_MESSAGE,
    @SerializedName("unpin_message") UNPIN_MESSAGE,
    @SerializedName("message_pinned") MESSAGE_PINNED,
    @SerializedName("toggle_star_message") TOGGLE_STAR_MESSAGE,
    @SerializedName("message_starred") MESSAGE_STARRED
}
