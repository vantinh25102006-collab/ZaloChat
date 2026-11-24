/**
 * ZChat Web Client — ES2022
 * WebSocket: ws://localhost:8080/ws  |  File: POST /api/files/upload  GET /api/files/:id
 */

// ─── EMOJI DATA ───────────────────────────────────────────────────────────────
const EMOJI_CATEGORIES = {
  'Mới dùng': [],
  'Mặt cười': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  'Cử chỉ': ['👍','👎','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👋','🤚','🖐','✋','🖖','👏','🙌','🤲','🤝','🙏','✍️','💅','🤳','💪','🦵','🦶','👂','🦻','👃','🧠','🦷','🦴','👀','👁','👅','👄'],
  'Trái tim': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','❤️‍🔥','❤️‍🩹'],
  'Đồ vật': ['🎁','🎀','🎊','🎉','🎈','🎂','🍰','🧁','🥂','🍾','🎶','🎵','🎸','🎹','🎺','🎻','🥁','🎤','🎧','📱','💻','⌨️','🖥','📷','📸','🎥','📽','🎞','📺','📻','🎙'],
  'Thiên nhiên': ['🌸','🌺','🌻','🌼','🌷','🌹','🥀','💐','🌾','🍀','🌿','🍁','🍂','🍃','🌱','🌲','🌳','🌴','🌵','🌊','💧','🔥','⭐','🌟','✨','💥','🌈','☀️','🌤','⛅','☁️','🌧','⛈','🌩','❄️','🌙'],
};
let recentEmojis = JSON.parse(localStorage.getItem('zchat_recent_emojis') || '[]');
EMOJI_CATEGORIES['Mới dùng'] = recentEmojis.slice(0, 24);

// ─── STATE ────────────────────────────────────────────────────────────────────
const state = {
  ws: null,
  username: null,
  currentConvId: null,
  currentPanel: 'chats',      // 'chats' | 'contacts' | 'requests'
  conversations: new Map(),   // convId → { id, type, name, messages[], unread, lastMsg, lastTime }
  onlineUsers: [],
  searchResults: [],
  authMode: 'login',
  searchTimer: null,
  groups: new Map(),
  friends: [],                // [{username, since, online}]
  pendingRequests: [],        // [{requestId, sender, createdAt}]
  typingTimers: new Map(),
  reconnectCount: 0,
  intentionalLogout: false,
  activeTab: 'messages',
  activeRpTab: 'files',
  rightPanelOpen: false,
  msgSearchActive: false,
  msgSearchMatches: [],
  msgSearchIndex: 0,
  // Audio recording
  mediaRecorder: null,
  recordedChunks: [],
  recordingTimer: null,
  recordingSeconds: 0,
  // Current profile being viewed in add-friend modal
  viewedProfile: null,
  blockedUsers: new Set(),
  mutedConversations: new Set(),
  profileTarget: null,
  // Hồ sơ người dùng dùng để hiển thị avatar thật trong tin nhắn.
  userProfiles: new Map(),
  profileRequests: new Set(),
  lastSeenMap: new Map(),
  pendingSentByTarget: new Map(),
  replyTo: null,
};

// ─── VECTOR SVG ICONS (Chuẩn Zalo PC / Lucide, thay thế toàn bộ emoji thô) ────
const UI_ICONS = {
  user: '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  users: '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  userPlus: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>',
  userMinus: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/></svg>',
  ban: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
  unlock: '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
  crown: '<svg viewBox="0 0 24 24"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>',
  logOut: '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  bellOff: '<svg viewBox="0 0 24 24"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  folderSave: '<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><polyline points="12 11 12 17"/><polyline points="9 14 12 17 15 14"/></svg>',
  music: '<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  checkCircle: '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  xCircle: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
};

// ─── DOM ──────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const dom = {
  loginScreen:     $('login-screen'),
  chatScreen:      $('chat-screen'),
  usernameInput:   $('username-input'),
  passwordInput:   $('password-input'),
  loginBtn:        $('login-btn'),
  registerBtn:     $('register-btn'),
  toggleAuthBtn:   $('toggle-auth-btn'),
  registerPhone:   $('register-phone-input'),
  registerPhoneGroup: $('register-phone-group'),
  loginError:      $('login-error'),
  userAvatarBtn:   $('user-avatar-display'),
  panelTitle:      $('panel-title'),
  convList:        $('conversation-list'),
  searchInput:     $('search-input'),
  emptyState:      $('empty-state'),
  chatArea:        $('chat-area'),
  chatHeaderAv:    $('chat-header-avatar'),
  chatHeaderName:  $('chat-header-name'),
  chatHeaderStatus:$('chat-header-status'),
  messages:        $('messages-container'),
  typingIndicator: $('typing-indicator'),
  uploadProgress:  $('upload-progress'),
  progressFill:    $('progress-fill'),
  messageInput:    $('message-input'),
  sendBtn:         $('send-btn'),
  attachBtn:       $('attach-btn'),
  fileInput:       $('file-input'),
  toastContainer:  $('toast-container'),
  tabMessages:     $('tab-messages'),
  tabGroups:       $('tab-groups'),
  tabContacts:     $('tab-contacts'),
  tabRequests:     $('tab-requests'),
  emojiPicker:     $('emoji-picker'),
  emojiSearch:     $('emoji-search'),
  emojiGrid:       $('emoji-grid'),
  emojiCats:       $('emoji-cats'),
  rightPanel:      $('right-panel'),
  rpContent:       $('rp-content'),
  msgSearchBar:    $('msg-search-bar'),
  msgSearchInput:  $('msg-search-input'),
  msgSearchCount:  $('msg-search-count'),
  recordingBar:    $('recording-bar'),
  recTime:         $('rec-time'),
  micBtn:          $('mic-btn'),
  friendReqBadge:  $('friend-req-badge'),
  phoneSearchInput:$('phone-search-input'),
  phoneSearchResult:$('phone-search-result'),
  friendReqList:   $('friend-req-list'),
};

// ─── WebSocket ────────────────────────────────────────────────────────────────
function connectWebSocket() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  state.ws = new WebSocket(`${proto}://${location.host}/ws`);

  state.ws.onopen = () => { state.reconnectCount = 0; };

  state.ws.onmessage = e => {
    try { handleServerMessage(JSON.parse(e.data)); }
    catch(err) { console.error('Bad WS JSON:', err); }
  };

  state.ws.onclose = () => {
    if (state.intentionalLogout) {
      doLocalLogout();
      return;
    }
    if (state.username && state.reconnectCount < 5) {
      state.reconnectCount++;
      showToast(`Mất kết nối. Đang thử lại (${state.reconnectCount}/5)...`, 'error');
      setTimeout(connectWebSocket, 3000);
    }
  };
  state.ws.onerror = () => {};
}

function wsSend(obj) {
  if (state.ws?.readyState === WebSocket.OPEN) state.ws.send(JSON.stringify(obj));
}

// ─── Message handler ──────────────────────────────────────────────────────────
function handleServerMessage(msg) {
  switch (msg.type) {
    case 'login_result':         onLoginResult(msg);           break;
    case 'register_result':      onRegisterResult(msg);        break;
    case 'search_results':       onSearchResults(msg);         break;
    case 'message':              onGlobalMessage(msg);         break;
    case 'private_message':      onPrivateMessage(msg);        break;
    case 'group_message':        onGroupMessage(msg);          break;
    case 'group_created':        onGroupCreated(msg);          break;
    case 'group_list':           onGroupList(msg);             break;
    case 'conversation_list':    onConversationList(msg);      break;
    case 'blocked_users':        state.blockedUsers = new Set(msg.users || []); break;
    case 'user_list':            onUserList(msg);              break;
    case 'file_share':           onFileShare(msg);             break;
    case 'system':               onSystemMessage(msg);         break;
    case 'history':              onHistory(msg);               break;
    case 'typing':               onTyping(msg);                break;
    case 'friend_request':       onFriendRequest(msg);         break;
    case 'friend_accept':        onFriendAccept(msg);          break;
    case 'friend_reject':        onFriendReject(msg);          break;
    case 'friend_cancel':        onFriendCancel(msg);          break;
    case 'unfriend':             onUnfriend(msg);              break;
    case 'friend_list':          onFriendList(msg);            break;
    case 'friend_requests_list': onFriendRequestsList(msg);    break;
    case 'user_profile':         onUserProfile(msg);           break;
    case 'post_deleted':         wsSend({type:'get_posts',username:state.profileTarget}); break;
    case 'message_reaction':     onMessageReaction(msg);       break;
    case 'message_revoked':      onMessageRevoked(msg);        break;
    case 'message_hidden':       onMessageHidden(msg);         break;
    case 'conversation_deleted': onConversationDeleted(msg);   break;
    case 'user_blocked':         state.blockedUsers.add(msg.username); showToast('Đã chặn người dùng.','success'); break;
    case 'user_unblocked':       state.blockedUsers.delete(msg.username); showToast('Đã bỏ chặn.','success'); break;
    case 'group_updated':        onGroupUpdated(msg);           break;
    case 'group_deleted':        onGroupDeleted(msg);           break;
    case 'group_left':           onGroupDeleted(msg);           break;
    case 'posts_result':         onPostsResult(msg);              break;
    case 'profile_updated':      onProfileUpdated(msg); break;
    case 'mute_conversation':    if(msg.muted) state.mutedConversations.add(msg.conversationId); else state.mutedConversations.delete(msg.conversationId); showToast(msg.muted?'Đã tắt thông báo.':'Đã bật thông báo.','success'); break;
    case 'error':                showToast(msg.content, 'error'); break;
  }
}

// ─── Login / Register ─────────────────────────────────────────────────────────
function login() {
  const username = dom.usernameInput.value.trim();
  const password = dom.passwordInput.value;
  if (!username || !password) { if (dom.loginError) dom.loginError.textContent = 'Vui lòng nhập đầy đủ thông tin.'; return; }
  dom.loginBtn.disabled = true;
  dom.loginBtn.textContent = 'Đang kết nối...';
  if (dom.loginError) dom.loginError.textContent = '';
  connectWebSocket();
  const tryLogin = () => {
    if (state.ws.readyState === WebSocket.OPEN) wsSend({ type: 'login', username, password });
    else if (state.ws.readyState === WebSocket.CONNECTING) setTimeout(tryLogin, 100);
    else {
      if (dom.loginError) dom.loginError.textContent = 'Không thể kết nối server.';
      dom.loginBtn.disabled = false;
      dom.loginBtn.textContent = 'Đăng nhập';
    }
  };
  setTimeout(tryLogin, 100);
}

function toggleAuthMode() {
  state.authMode = state.authMode === 'login' ? 'register' : 'login';
  const reg = state.authMode === 'register';
  dom.registerPhoneGroup.style.display = reg ? 'block' : 'none';
  dom.loginBtn.style.display = reg ? 'none' : 'block';
  dom.registerBtn.style.display = reg ? 'block' : 'none';
  dom.toggleAuthBtn.textContent = reg ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký';
  if (dom.loginError) dom.loginError.textContent = '';
}

function registerAccount() {
  const username = dom.usernameInput.value.trim();
  const phone = dom.registerPhone.value.trim();
  const password = dom.passwordInput.value;
  if (!username || !phone || !password) { if (dom.loginError) dom.loginError.textContent = 'Vui lòng nhập đầy đủ thông tin.'; return; }
  if (!/^0[0-9]{9}$/.test(phone)) { if (dom.loginError) dom.loginError.textContent = 'Số điện thoại phải 10 số, bắt đầu bằng 0.'; return; }
  if (password.length < 6) { if (dom.loginError) dom.loginError.textContent = 'Mật khẩu phải ít nhất 6 ký tự.'; return; }
  dom.registerBtn.disabled = true;
  dom.registerBtn.textContent = 'Đang đăng ký...';
  const send = () => {
    if (state.ws?.readyState === WebSocket.OPEN) wsSend({ type: 'register', username, phone, password });
    else if (state.ws?.readyState === WebSocket.CONNECTING) setTimeout(send, 100);
    else { connectWebSocket(); setTimeout(send, 150); }
  };
  if (!state.ws || state.ws.readyState === WebSocket.CLOSED) connectWebSocket();
  setTimeout(send, 100);
}

function onRegisterResult(msg) {
  dom.registerBtn.disabled = false;
  dom.registerBtn.textContent = 'Tạo tài khoản mới';
  if (dom.loginError) dom.loginError.textContent = msg.content || (msg.success ? 'Đăng ký thành công.' : 'Đăng ký thất bại.');
  if (msg.success) {
    dom.passwordInput.value = '';
    if (state.ws?.readyState === WebSocket.OPEN) state.ws.close(1000, 'Registration complete');
    state.ws = null;
    toggleAuthMode();
    showToast('Đăng ký thành công! Hãy đăng nhập.', 'success');
  }
}

function onLoginResult(msg) {
  if (msg.success) {
    state.username = dom.usernameInput.value.trim();
    dom.loginScreen.style.display = 'none';
    dom.chatScreen.classList.add('visible');
    dom.userAvatarBtn.textContent = state.username[0].toUpperCase();
    requestUserProfile(state.username, true);
    showToast(msg.content || 'Đăng nhập thành công!', 'success');
    showPanel('chats');
    initEmojiPicker();
    if (!state.avatarRefreshTimer) {
      state.avatarRefreshTimer = setInterval(() => {
        if (!state.username) return;
        for (const c of state.conversations.values()) if (c.type === 'dm') requestUserProfile(c.name, true);
        updateChatHeaderStatus();
        if (state.activeTab === 'contacts') renderConversationList();
      }, 30000);
    }
  } else {
    if (dom.loginError) dom.loginError.textContent = msg.content || 'Đăng nhập thất bại.';
    dom.loginBtn.disabled = false;
    dom.loginBtn.textContent = 'Đăng nhập';
    if (state.ws) state.ws.close();
  }
}

function logout() {
  if (!state.username) return;
  if (confirm('Bạn có muốn đăng xuất?')) {
    state.intentionalLogout = true;
    const socket = state.ws;
    if (socket?.readyState === WebSocket.OPEN) {
      wsSend({ type: 'disconnect' });
      setTimeout(() => { if (socket.readyState !== WebSocket.CLOSED) socket.close(1000, 'User logout'); }, 1000);
    } else if (socket) {
      socket.close(1000, 'User logout');
    } else {
      doLocalLogout();
    }
  }
}

function doLocalLogout() {
  state.username = null;
  state.currentConvId = null;
  state.ws = null;
  state.conversations.clear();
  state.friends = [];
  state.pendingRequests = [];
  state.groups.clear();
  state.intentionalLogout = false;
  dom.chatScreen.classList.remove('visible');
  dom.loginScreen.style.display = 'flex';
  dom.passwordInput.value = '';
  dom.loginBtn.disabled = false;
  dom.loginBtn.textContent = 'Đăng nhập';
  showToast('Bạn đã đăng xuất.', 'success');
}

// ─── Panel switching ──────────────────────────────────────────────────────────
function showPanel(panelName) {
  state.currentPanel = 'chats';
  document.querySelectorAll('.sidebar-nav-btn').forEach(b => b.classList.remove('active'));
  $('nav-chats')?.classList.add('active');
  dom.panelTitle.textContent = 'Đoạn chat';
  $('create-group-btn').style.display = 'flex';
  $('add-friend-btn').style.display = 'flex';
  dom.tabMessages.style.display = '';
  dom.tabGroups.style.display = '';
  dom.tabContacts.style.display = 'none';
  dom.tabRequests.style.display = 'none';
  if ($('tab-unread')) $('tab-unread').style.display = '';
  switchTab('messages');
}

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(tab) {
  state.activeTab = tab;
  ['messages','groups','contacts','requests','unread'].forEach(t => {
    const el = $('tab-'+t);
    if (el) el.classList.toggle('active', t === tab);
  });
  renderConversationList();
}

// ─── Incoming messages ────────────────────────────────────────────────────────
function onGlobalMessage(msg) {
  // Skip global messages (no global room)
}

function onPrivateMessage(msg) {
  const convId = msg.conversationId || dmConvId(msg.username, msg.to);
  const other = msg.username === state.username ? msg.to : msg.username;
  ensureConversation(convId, 'dm', other, []);
  pushMessage(convId, msg);
}

function onGroupMessage(msg) {
  const convId = msg.conversationId || `group:${msg.groupId}`;
  ensureConversation(convId, 'group', msg.groupName || msg.groupId, msg.members || []);
  if (msg.messageType === 'system' || msg.username === 'SYSTEM') {
    msg.type = 'system';
  }
  pushMessage(convId, msg);
}

function onGroupCreated(msg) {
  const convId = `group:${msg.groupId}`;
  state.groups.set(msg.groupId, { id: msg.groupId, name: msg.groupName, members: msg.members, createdBy: msg.username, avatarPath: msg.avatarPath || null });
  ensureConversation(convId, 'group', msg.groupName, msg.members);
  showToast(`Nhóm "${msg.groupName}" đã được tạo!`, 'success');
  renderConversationList();
  if (msg.username === state.username) {
    closeGroupModal();
    selectConversation(convId);
  }
}

function onConversationList(msg) {
  for (const item of (msg.conversations || [])) {
    const id=item.conversationId;
    if (!id) continue;
    if (id.startsWith('dm:')) {
      const users=id.substring(3).split(':');
      const other=users.find(u=>u!==state.username)||users[0];
      ensureConversation(id,'dm',other,[]);
    } else if (id.startsWith('group:')) {
      const gid=id.substring(6),g=state.groups.get(gid);
      ensureConversation(id,'group',g?.name||gid,g?.members||[]);
    }
    const conv=state.conversations.get(id);
    if(conv){conv.lastMsg=item.lastMessage||'';conv.lastTimestamp=item.lastTimestamp||'';conv.lastTime=formatTime(item.lastTimestamp);conv.unread=Number(item.unread||0);if(item.muted)state.mutedConversations.add(id);}
  }
  updateUnreadBadge();
  renderConversationList();
}
function onGroupList(msg) {
  if (!msg.groups) return;
  for (const g of msg.groups) {
    state.groups.set(g.id, g);
    if (!g.conversationDeleted) ensureConversation(`group:${g.id}`, 'group', g.name, g.members);
    const conv = state.conversations.get(`group:${g.id}`);
    if (conv) conv.name = g.name;
  }
  renderConversationList();
}

function onUserList(msg) {
  state.onlineUsers = (msg.users || []).filter(u => u !== state.username);
  if (msg.lastSeenMap && typeof msg.lastSeenMap === 'object') {
    for (const [u, ts] of Object.entries(msg.lastSeenMap)) {
      if (u && ts) state.lastSeenMap.set(u, ts);
    }
  }
  // Update friend online status
  state.friends.forEach(f => {
    const wasOnline = f.online;
    f.online = state.onlineUsers.includes(f.username);
    if (wasOnline && !f.online && !state.lastSeenMap.has(f.username)) {
      state.lastSeenMap.set(f.username, new Date().toISOString());
    }
  });
  renderConversationList();
  renderMemberList();
  updateChatHeaderStatus();
}

function updateChatHeaderStatus() {
  const current = state.conversations.get(state.currentConvId);
  if (!current) return;
  if (current.type === 'dm') {
    const online = state.onlineUsers.includes(current.name);
    dom.chatHeaderStatus.textContent = formatPresenceStatus(current.name, online);
    dom.chatHeaderStatus.style.color = online ? '#2ecc71' : '#8893a4';
  } else if (current.type === 'group') {
    const g = state.groups.get(state.currentConvId.replace('group:',''));
    dom.chatHeaderStatus.textContent = `${g?.members?.length || 0} thành viên`;
    dom.chatHeaderStatus.style.color = '#0068ff';
  }
}

function formatPresenceStatus(username, isOnline = state.onlineUsers.includes(username)) {
  if (isOnline) return '● Đang hoạt động';
  const iso = state.lastSeenMap.get(username) || state.userProfiles.get(username)?.lastSeen;
  if (!iso) return '○ Ngoại tuyến';
  const seenDate = new Date(iso);
  if (isNaN(seenDate.getTime())) return '○ Ngoại tuyến';
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - seenDate.getTime()) / 1000));
  if (diffSec < 60) return '○ Truy cập vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `○ Truy cập ${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (seenDate.toDateString() === now.toDateString()) {
    return `○ Truy cập ${diffHours} giờ trước`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (seenDate.toDateString() === yesterday.toDateString()) {
    return '○ Truy cập hôm qua';
  }
  const dd = String(seenDate.getDate()).padStart(2, '0');
  const mm = String(seenDate.getMonth() + 1).padStart(2, '0');
  const yyyy = seenDate.getFullYear();
  return `○ Truy cập vào ngày ${dd}/${mm}/${yyyy}`;
}

function onFileShare(msg) {
  const convId = msg.conversationId || (msg.groupId ? `group:${msg.groupId}` :
                 (msg.to ? dmConvId(msg.username, msg.to) : null));
  if (!convId) return;
  if (msg.groupId) {
    const g = state.groups.get(msg.groupId);
    ensureConversation(convId, 'group', g ? g.name : msg.groupId, []);
  } else {
    const other = msg.username === state.username ? msg.to : msg.username;
    ensureConversation(convId, 'dm', other || '', []);
  }
  pushMessage(convId, msg);
  // Refresh right panel if open
  if (state.rightPanelOpen && state.currentConvId === convId) renderRightPanel();
}

function onSystemMessage(msg) {
  // System messages ignored (no global room)
}

function onHistory(msg) {
  if (!msg.conversationId || !msg.messages) return;
  const conv = state.conversations.get(msg.conversationId);
  if (!conv) return;
  conv.messages = msg.messages.map(item => ({
    ...item,
    from: item.from || item.username || '',
    type: typeof item.type === 'string' ? item.type.toLowerCase() : item.type,
    timestamp: item.timestamp || new Date().toISOString(),
    reactions: item.reactions || [],
  }));
  conv.lastMsg = conv.messages.length
    ? (conv.messages[conv.messages.length - 1].content || `📄 ${conv.messages[conv.messages.length - 1].filename || ''}`)
    : '';
  if (state.currentConvId === msg.conversationId) {
    renderMessages();
    if (state.rightPanelOpen) renderRightPanel();
  }
}

function onTyping(msg) {
  if (msg.username === state.username) return;
  const convId = msg.groupId ? `group:${msg.groupId}` : dmConvId(msg.username, state.username);
  if (state.currentConvId !== convId) return;
  dom.typingIndicator.textContent = `${msg.username} đang gõ...`;
  clearTimeout(state.typingTimers.get(convId));
  state.typingTimers.set(convId, setTimeout(() => { dom.typingIndicator.textContent = ''; }, 3000));
}

// ─── Friend system handlers ───────────────────────────────────────────────────
function onFriendList(msg) {
  state.friends = (msg.friendList || []).map(f => {
    if (f.lastSeen) state.lastSeenMap.set(f.username, f.lastSeen);
    return {
      ...f,
      online: state.onlineUsers.includes(f.username)
    };
  });
  state.friends.forEach(f => { if (f.conversationDeleted !== 'true') ensureConversation(dmConvId(state.username,f.username),'dm',f.username,[]); });
  if (state.activeTab === 'contacts' || state.activeTab === 'messages') renderConversationList();
  const current = state.conversations.get(state.currentConvId);
  if (current?.type === 'dm') updateStrangerBanner(current.name);
}

function onFriendRequestsList(msg) {
  state.pendingRequests = msg.pendingRequests || [];
  updateFriendReqBadge();
  renderFriendRequestModal();
  if (state.activeTab === 'requests') renderConversationList();
}

function refreshRelationshipUI(targetUsername) {
  if (!targetUsername) return;
  if (state.viewedProfile?.username === targetUsername) {
    renderProfileCard(state.viewedProfile);
  }
  if (state.profileTarget === targetUsername) {
    const cachedPosts = state.lastPostsPayload?.username === targetUsername ? state.lastPostsPayload : { username: targetUsername, profile: state.userProfiles.get(targetUsername) || { username: targetUsername }, posts: [] };
    renderProfilePage(cachedPosts);
  }
  const current = state.conversations.get(state.currentConvId);
  if (current?.type === 'dm' && current.name === targetUsername) {
    updateStrangerBanner(targetUsername);
  }
}

function onFriendRequest(msg) {
  if (msg.status === 'received') {
    // We received a request
    if (!state.pendingRequests.some(r => r.requestId === msg.requestId)) {
      state.pendingRequests.push({
        requestId: msg.requestId,
        sender: msg.username,
        createdAt: msg.timestamp,
      });
    }
    updateFriendReqBadge();
    renderFriendRequestModal();
    showToast(`${msg.username} đã gửi lời mời kết bạn!`, 'info');
    if (state.viewedProfile?.username === msg.username) {
      state.viewedProfile.relationship = 'pending_received';
      state.viewedProfile.requestId = msg.requestId;
    }
    refreshRelationshipUI(msg.username);
    if (state.activeTab === 'requests') renderConversationList();
  } else if (msg.status === 'sent') {
    // Ack for sender with real requestId -> cho phép bấm Hủy lời mời ngay lập tức
    if (msg.to && msg.requestId) {
      state.pendingSentByTarget.set(msg.to, msg.requestId);
      if (state.viewedProfile?.username === msg.to) {
        state.viewedProfile.relationship = 'pending_sent';
        state.viewedProfile.requestId = msg.requestId;
      }
      refreshRelationshipUI(msg.to);
    }
  }
}

function onFriendAccept(msg) {
  const friendUsername = msg.username;
  state.pendingSentByTarget.delete(friendUsername);
  state.pendingRequests = state.pendingRequests.filter(r => r.sender !== friendUsername);
  updateFriendReqBadge();
  wsSend({ type: 'friend_list' });
  showToast(`Bạn và ${friendUsername} đã trở thành bạn bè!`, 'success');
  const convId = dmConvId(state.username, friendUsername);
  ensureConversation(convId, 'dm', friendUsername, []);
  renderConversationList();
  if (state.viewedProfile?.username === friendUsername) {
    state.viewedProfile.relationship = 'friend';
  }
  refreshRelationshipUI(friendUsername);
}

function onFriendReject(msg) {
  state.pendingRequests = state.pendingRequests.filter(r => r.requestId !== msg.requestId && r.sender !== msg.username);
  if (msg.username) state.pendingSentByTarget.delete(msg.username);
  updateFriendReqBadge();
  if (state.viewedProfile && (state.viewedProfile.username === msg.username || state.viewedProfile.requestId === msg.requestId)) {
    state.viewedProfile.relationship = 'stranger';
    state.viewedProfile.requestId = null;
    refreshRelationshipUI(state.viewedProfile.username);
  }
}

function onFriendCancel(msg) {
  const target = msg.to || state.viewedProfile?.username;
  if (target) state.pendingSentByTarget.delete(target);
  if (state.viewedProfile && (state.viewedProfile.requestId === msg.requestId || state.viewedProfile.username === target)) {
    state.viewedProfile.relationship = 'stranger';
    state.viewedProfile.requestId = null;
    refreshRelationshipUI(state.viewedProfile.username);
  } else if (target) {
    refreshRelationshipUI(target);
  }
}

function onUnfriend(msg) {
  const other = msg.username;
  state.friends = state.friends.filter(f => f.username !== other);
  state.pendingSentByTarget.delete(other);
  showToast(`Đã hủy kết bạn với ${other}.`, 'info');
  if (state.viewedProfile?.username === other) {
    state.viewedProfile.relationship = 'stranger';
    state.viewedProfile.requestId = null;
  }
  refreshRelationshipUI(other);
  renderConversationList();
}

function onUserProfile(msg) {
  if (msg.lastSeen) state.lastSeenMap.set(msg.username, msg.lastSeen);
  if (msg.status === 'pending_sent' && msg.requestId) {
    state.pendingSentByTarget.set(msg.username, msg.requestId);
  } else if (msg.status !== 'pending_sent') {
    state.pendingSentByTarget.delete(msg.username);
  }
  state.viewedProfile = {
    username: msg.username,
    phone: msg.phone,
    online: msg.content === 'online',
    relationship: msg.status,
    requestId: msg.requestId || state.pendingSentByTarget.get(msg.username) || null,
    lastSeen: msg.lastSeen || state.lastSeenMap.get(msg.username) || null,
    avatarPath: msg.avatarPath || state.userProfiles.get(msg.username)?.avatarPath || null,
  };
  renderProfileCard(state.viewedProfile);
  if (state.profileTarget === msg.username) renderProfileRelationshipActions();
  const current = state.conversations.get(state.currentConvId);
  if (current?.type === 'dm' && current.name === msg.username) updateStrangerBanner(msg.username);
}

function onMessageReaction(msg) {
  const conv = state.conversations.get(msg.conversationId);
  const target = conv?.messages.find(m => m.messageId === msg.messageId);
  if (!target) return;
  target.reactions = msg.reactions || [];
  if (state.currentConvId === msg.conversationId) renderMessages();
}
function onMessageRevoked(msg) {
  const conv = state.conversations.get(msg.conversationId);
  const target = conv?.messages.find(m => m.messageId === msg.messageId);
  if (!target) return;
  target.type = 'revoked'; target.content = 'Tin nhắn đã được thu hồi';
  target.fileId = null; target.filename = null; target.mimeType = null;
  target.reactions = [];
  if (state.currentConvId === msg.conversationId) renderMessages();
  if (conv.messages[conv.messages.length-1]?.messageId === msg.messageId) conv.lastMsg = 'Tin nhắn đã được thu hồi';
  renderConversationList();
}
function onMessageHidden(msg) {
  const conv=state.conversations.get(msg.conversationId);if(!conv)return;
  conv.messages=conv.messages.filter(m=>m.messageId!==msg.messageId);
  const last=conv.messages[conv.messages.length-1];
  conv.lastMsg=last?(last.content||last.filename||''):'Chưa có tin nhắn';
  if(state.currentConvId===msg.conversationId)renderMessages();
  renderConversationList();
}
function onConversationDeleted(msg) {
  state.conversations.delete(msg.conversationId);
  if (state.currentConvId === msg.conversationId) {
    state.currentConvId = null;
    dom.chatArea.style.display = 'none'; dom.emptyState.style.display = 'flex';
  }
  updateUnreadBadge();
  renderConversationList(); closeConversationOptions();
}
function onGroupUpdated(msg) {
  const existing = state.groups.get(msg.id) || {};
  const merged = { ...existing, ...msg };
  state.groups.set(msg.id, merged);
  const convId=`group:${msg.id}`;
  const conv=state.conversations.get(convId);
  if(conv) conv.name=merged.name;
  else ensureConversation(convId,'group',merged.name,merged.members||[]);
  renderConversationList();
  if(state.currentConvId===convId) {
    dom.chatHeaderName.textContent = merged.name;
    dom.chatHeaderAv.innerHTML = groupAvatarInner(msg.id, merged.name);
    updateChatHeaderStatus();
    renderMessages();
  }
}
function onGroupDeleted(msg) {
  state.groups.delete(msg.groupId);state.conversations.delete(`group:${msg.groupId}`);
  if(state.currentConvId===`group:${msg.groupId}`){state.currentConvId=null;dom.chatArea.style.display='none';dom.emptyState.style.display='flex';}
  if (msg.kickedBy) showToast(`Bạn đã bị ${msg.kickedBy} xóa khỏi nhóm.`, 'info');
  updateUnreadBadge();
  renderConversationList();
}

function onSearchResults(msg) {
  state.searchResults = msg.searchResults || [];
  if (dom.phoneSearchInput.value.trim() && dom.phoneSearchResult) {
    renderPhoneSearchResult(state.searchResults);
  }
}

function updateUnreadBadge() {
  let totalUnreadConvs = 0;
  let totalUnreadMsgs = 0;
  for (const conv of state.conversations.values()) {
    if (conv.type === 'global') continue;
    const u = Number(conv.unread || 0);
    if (u > 0) {
      totalUnreadConvs++;
      totalUnreadMsgs += u;
    }
  }
  const unreadTab = $('tab-unread');
  if (unreadTab) {
    unreadTab.innerHTML = 'Chưa đọc' + (totalUnreadMsgs > 0 ? `<span class="tab-badge">${totalUnreadMsgs > 99 ? '99+' : totalUnreadMsgs}</span>` : '');
  }
  const navBadge = $('unread-nav-badge');
  if (navBadge) {
    if (totalUnreadMsgs > 0) {
      navBadge.style.display = 'block';
      navBadge.textContent = totalUnreadMsgs > 99 ? '99+' : totalUnreadMsgs;
      navBadge.title = `${totalUnreadMsgs} tin nhắn chưa đọc (${totalUnreadConvs} cuộc trò chuyện)`;
    } else {
      navBadge.style.display = 'none';
    }
  }
}

function updateFriendReqBadge() {
  const count = state.pendingRequests.length;
  if (count > 0) {
    dom.friendReqBadge.style.display = 'block';
    dom.friendReqBadge.textContent = count;
    dom.friendReqBadge.title = `${count} lời mời kết bạn`; 
  } else {
    dom.friendReqBadge.style.display = 'none';
  }
  const requestTab = $('tab-requests');
  if (requestTab) {
    requestTab.style.display = '';
    requestTab.innerHTML = 'Lời mời' + (count > 0 ? `<span class="tab-badge">${count > 99 ? '99+' : count}</span>` : '');
  }
}

function renderFriendRequestModal() {
  if (!dom.friendReqList) return;
  if (!state.pendingRequests.length) { dom.friendReqList.innerHTML='<div class="rp-empty">Không có lời mời nào</div>'; return; }
  dom.friendReqList.innerHTML=state.pendingRequests.map(req=>`<div class="friend-req-item"><div class="conv-avatar">${getInitials(req.sender)}</div><div class="freq-info"><div class="freq-name">${escHtml(req.sender)}</div><div class="freq-time">${formatTime(req.createdAt)}</div></div><div class="freq-actions"><button class="freq-accept" onclick="acceptFriendRequest('${escHtml(req.requestId)}','${escHtml(req.sender)}')">Đồng ý</button><button class="freq-reject" onclick="rejectFriendRequest('${escHtml(req.requestId)}','${escHtml(req.sender)}')">Từ chối</button></div></div>`).join('');
}
function openFriendReqModal(){ renderFriendRequestModal(); $('freq-modal-overlay')?.classList.add('visible'); }

// ─── Conversation management ──────────────────────────────────────────────────
function ensureConversation(convId, type, name, members) {
  if (!state.conversations.has(convId)) {
    state.conversations.set(convId, { id: convId, type, name, messages: [], unread: 0, lastMsg: '', lastTime: '' });
  }
}

function dmConvId(a, b) {
  if (!a || !b) return `dm:${a || b}`;
  return 'dm:' + (a < b ? `${a}:${b}` : `${b}:${a}`);
}

function pushMessage(convId, msg) {
  const conv = state.conversations.get(convId);
  if (!conv) return;
  const isSys = msg.type === 'system' || msg.messageType === 'system' || msg.username === 'SYSTEM';
  const msgObj = {
    type: isSys ? 'system' : msg.type, from: msg.username || msg.from, to: msg.to,
    content: msg.content || '', timestamp: msg.timestamp || new Date().toISOString(),
    messageId: msg.messageId, fileId: msg.fileId, filename: msg.filename,
    fileSize: msg.fileSize, mimeType: msg.mimeType, reactions: msg.reactions || [],
    replyToId: msg.replyToId, replyToUsername: msg.replyToUsername, replyToContent: msg.replyToContent,
  };
  if (msgObj.messageId && conv.messages.some(m => m.messageId === msgObj.messageId)) return;
  conv.messages.push(msgObj);
  conv.lastMsg = msgObj.content || (msgObj.mimeType?.startsWith('image/') ? '[Hình ảnh]' : msgObj.mimeType?.startsWith('video/') ? '[Video]' : (msgObj.filename ? `[Tệp] ${msgObj.filename}` : ''));
  conv.lastTime = formatTime(msgObj.timestamp);
  conv.lastTimestamp = msgObj.timestamp;
  if (state.currentConvId === convId) {
    renderMessages(msgObj.from === state.username);
    wsSend({type:'mark_read',conversationId:convId});
    if (state.rightPanelOpen) renderRightPanel();
  } else if (msgObj.from !== state.username && !isSys) {
    conv.unread = (conv.unread || 0) + 1;
    if (!state.mutedConversations.has(convId) && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification(conv.name, { body: msgObj.content || (msgObj.mimeType?.startsWith('image/') ? 'Đã gửi một ảnh' : 'Đã gửi tệp đính kèm') }); } catch (_) {}
    }
  }
  updateUnreadBadge();
  renderConversationList();
}

function getRelationshipWith(username) {
  if (state.friends.some(f => f.username === username)) return { rel: 'friend', requestId: null };
  const recv = state.pendingRequests.find(r => r.sender === username);
  if (recv) return { rel: 'pending_received', requestId: recv.requestId };
  if (state.pendingSentByTarget.has(username)) return { rel: 'pending_sent', requestId: state.pendingSentByTarget.get(username) };
  if (state.viewedProfile?.username === username && state.viewedProfile.relationship) {
    return { rel: state.viewedProfile.relationship, requestId: state.viewedProfile.requestId };
  }
  return { rel: 'stranger', requestId: null };
}

function updateStrangerBanner(otherUsername) {
  const strangerBanner = $('stranger-banner');
  const actionsEl = $('stranger-banner-actions');
  const isFriend = state.friends.some(f => f.username === otherUsername);
  if (dom.attachBtn) dom.attachBtn.style.display = isFriend ? 'flex' : 'none';
  if (dom.micBtn) dom.micBtn.style.display = isFriend ? 'flex' : 'none';
  if (dom.messageInput) dom.messageInput.placeholder = !isFriend ? 'Nhắn tin cho người lạ...' : 'Nhập tin nhắn...';
  if (!strangerBanner) return;
  if (isFriend) {
    strangerBanner.style.display = 'none';
    return;
  }
  strangerBanner.style.display = 'flex';
  const { rel, requestId } = getRelationshipWith(otherUsername);
  if (actionsEl) {
    if (rel === 'pending_sent') {
      actionsEl.innerHTML = `<button class="gm-btn" onclick="cancelFriendRequest('${escHtml(requestId || '')}','${escHtml(otherUsername)}')">Hủy lời mời</button>`;
    } else if (rel === 'pending_received') {
      actionsEl.innerHTML = `<button class="gm-btn" style="background:#0866d6;color:#fff;border-color:#0866d6" onclick="acceptFriendRequest('${escHtml(requestId || '')}','${escHtml(otherUsername)}')">Đồng ý kết bạn</button>`;
    } else {
      actionsEl.innerHTML = `<button class="gm-btn" style="background:#0866d6;color:#fff;border-color:#0866d6" onclick="sendFriendRequest('${escHtml(otherUsername)}')">+ Kết bạn</button>`;
    }
  }
}

// ─── Select conversation ───────────────────────────────────────────────────────
function selectConversation(convId) {
  state.currentConvId = convId;
  const conv = state.conversations.get(convId);
  if (!conv) return;
  conv.unread = 0;
  updateUnreadBadge();
  wsSend({type:'mark_read',conversationId:convId});

  dom.emptyState.style.display = 'none';
  dom.chatArea.style.display = 'flex';

  if (conv.type === 'dm') {
    requestUserProfile(conv.name, true);
    wsSend({ type: 'user_profile', username: conv.name });
    dom.chatHeaderAv.innerHTML = userAvatarInner(conv.name);
    updateStrangerBanner(conv.name);
  } else {
    const gid = convId.replace('group:', '');
    dom.chatHeaderAv.innerHTML = groupAvatarInner(gid, conv.name);
    const strangerBanner = $('stranger-banner');
    if (strangerBanner) strangerBanner.style.display = 'none';
    if (dom.attachBtn) dom.attachBtn.style.display = 'flex';
    if (dom.micBtn) dom.micBtn.style.display = 'flex';
    if (dom.messageInput) dom.messageInput.placeholder = 'Nhập tin nhắn...';
  }
  dom.chatHeaderAv.className = 'chat-hdr-avatar' + (conv.type === 'group' ? ' group' : '');
  dom.chatHeaderName.textContent = conv.name;
  updateChatHeaderStatus();

  if (conv.messages.length === 0) {
    wsSend({ type: 'history', conversationId: convId });
  }

  renderMessages();
  renderConversationList();
  dom.messageInput.focus();
  dom.typingIndicator.textContent = '';
  if (state.msgSearchActive) closeMsgSearch();
}

// ─── Render conversation list ─────────────────────────────────────────────────
function renderConversationList() {
  const filter = dom.searchInput.value.trim().toLowerCase();
  const tab = state.activeTab;
  dom.convList.innerHTML = '';

  if (tab === 'contacts') {
    // Show friends list
    const friends = state.friends.filter(f => !filter || f.username.toLowerCase().includes(filter));
    if (friends.length === 0) {
      dom.convList.innerHTML = '<div style="padding:24px;text-align:center;color:#aaa;font-size:13px">Chưa có bạn bè nào<br><small>Tìm bạn qua số điện thoại</small></div>';
      return;
    }
    for (const f of friends) {
      const convId = dmConvId(state.username, f.username);
      const item = document.createElement('div');
      item.className = 'conv-item';
      item.onclick = () => { ensureConversation(convId, 'dm', f.username, []); selectConversation(convId); };
      item.innerHTML = `
        <div class="conv-avatar">${userAvatarInner(f.username)}${f.online ? '<span class="online-dot"></span>' : ''}</div>
        <div class="conv-info">
          <div class="conv-name">${escHtml(f.username)}</div>
          <div class="conv-last" style="color:${f.online ? '#2ecc71' : '#8893a4'}">${escHtml(formatPresenceStatus(f.username, f.online))}</div>
        </div>
        <button onclick="event.stopPropagation();confirmUnfriend('${escHtml(f.username)}')" style="background:none;border:none;cursor:pointer;color:#999;font-size:12px;padding:4px 8px;border-radius:6px;" title="Hủy kết bạn">✕</button>`;
      dom.convList.appendChild(item);
    }
    return;
  }

  if (tab === 'requests') {
    if (state.pendingRequests.length === 0) {
      dom.convList.innerHTML = '<div style="padding:24px;text-align:center;color:#aaa;font-size:13px">Không có lời mời nào</div>';
      return;
    }
    for (const req of state.pendingRequests) {
      const item = document.createElement('div');
      item.className = 'friend-req-item';
      item.style.margin = '8px 12px';
      item.innerHTML = `
        <div class="conv-avatar" style="width:40px;height:40px;font-size:15px">${userAvatarInner(req.sender)}</div>
        <div class="freq-info">
          <div class="freq-name">${escHtml(req.sender)}</div>
          <div class="freq-time">${formatTime(req.createdAt)}</div>
        </div>
        <div class="freq-actions">
          <button class="freq-accept" onclick="acceptFriendRequest('${escHtml(req.requestId)}','${escHtml(req.sender)}')">Đồng ý</button>
          <button class="freq-reject" onclick="rejectFriendRequest('${escHtml(req.requestId)}','${escHtml(req.sender)}')">Từ chối</button>
        </div>`;
      dom.convList.appendChild(item);
    }
    return;
  }

  // Không tìm kiếm người chưa kết bạn ở danh sách đoạn chat: chỉ lọc trong các đoạn chat hiện có (hoặc bạn bè đã kết bạn / nhóm đã tham gia)
  const convArray = [...state.conversations.entries()].sort((a,b) => new Date(b[1].lastTimestamp || 0) - new Date(a[1].lastTimestamp || 0));
  for (const [convId, conv] of convArray) {
    if (tab === 'groups' && conv.type !== 'group') continue;
    if (tab === 'unread' && !(conv.unread > 0)) continue;
    if (tab === 'messages' && conv.type === 'global') continue;
    if (filter && !conv.name.toLowerCase().includes(filter)) continue;

    const item = document.createElement('div');
    item.className = 'conv-item' + (convId === state.currentConvId ? ' active' : '') + (conv.unread > 0 ? ' unread' : '');
    item.onclick = () => selectConversation(convId);

    const isOnline = conv.type === 'dm' && state.onlineUsers.includes(conv.name);
    const avClass = conv.type === 'group' ? 'conv-avatar group' : 'conv-avatar';
    const dot = isOnline ? '<span class="online-dot"></span>' : '';
    const gid = conv.type === 'group' ? convId.replace('group:', '') : '';

    item.innerHTML = `
      <div class="${avClass}">${conv.type === 'dm' ? userAvatarInner(conv.name) : groupAvatarInner(gid, conv.name)}${dot}</div>
      <div class="conv-info">
        <div class="conv-name">${escHtml(conv.name)}</div>
        ${conv.type==='dm'&&!state.friends.some(f=>f.username===conv.name)?'<div style="font-size:10px;color:#a0a7b4">Người lạ</div>':''}
        <div class="conv-last">${escHtml(conv.lastMsg || 'Chưa có tin nhắn')}</div>
      </div>
      <div class="conv-meta">
        <div class="conv-time">${conv.lastTime || ''}</div>
        ${conv.unread > 0 ? `<div class="conv-unread">${conv.unread > 99 ? '99+' : conv.unread}</div>` : ''}
      </div>`;
    dom.convList.appendChild(item);
  }
}

// ─── User avatars in conversations ────────────────────────────────────────────
function requestUserProfile(username, force = false) {
  if (!username || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
  if (!force && (state.userProfiles.has(username) || state.profileRequests.has(username))) return;
  state.profileRequests.add(username);
  // get_posts trả về cả profile (avatarPath/coverPath) và danh sách bài viết.
  wsSend({ type: 'get_posts', username });
}

function avatarMarkup(username, className = 'msg-av', clickableInGroup = false) {
  const profile = state.userProfiles.get(username);
  const avatarPath = profile?.avatarPath;
  const extraClass = clickableInGroup ? ' clickable-av' : '';
  const clickAttr = clickableInGroup ? ` onclick="openAvatarActionMenu(event, '${escHtml(username || '')}')"` : '';
  return avatarPath
    ? `<div class="${className}${extraClass}" title="${escHtml(username || '')}"${clickAttr}><img src="${escHtml(avatarPath)}" alt="Ảnh đại diện ${escHtml(username || '')}"></div>`
    : `<div class="${className}${extraClass}" title="${escHtml(username || '')}"${clickAttr}>${getInitials(username || '?')}</div>`;
}

function groupAvatarInner(groupId, groupName) {
  const g = state.groups.get(groupId);
  if (g?.avatarPath) {
    return `<img src="${escHtml(g.avatarPath)}" alt="Ảnh nhóm ${escHtml(groupName || g.name || '')}">`;
  }
  return getInitials(groupName || g?.name || '?');
}

function onPostsResult(msg) {
  const username = msg.username || msg.profile?.username;
  state.lastPostsPayload = msg;
  let avatarChanged = false;
  if (username) {
    if (msg.profile?.lastSeen) state.lastSeenMap.set(username, msg.profile.lastSeen);
    avatarChanged = (state.userProfiles.get(username)?.avatarPath || '') !== (msg.profile?.avatarPath || '');
    state.profileRequests.delete(username);
    state.userProfiles.set(username, { ...(msg.profile || {}), username });
    if (username === state.username && dom.userAvatarBtn) {
      const path = msg.profile?.avatarPath;
      dom.userAvatarBtn.innerHTML = path
        ? `<img src="${escHtml(path)}" alt="Ảnh đại diện">`
        : getInitials(username);
    }
  }
  const activeConv = state.conversations.get(state.currentConvId);
  if (avatarChanged) renderConversationList();
  if (activeConv?.type === 'dm' && activeConv.name === username) {
    dom.chatHeaderAv.innerHTML = msg.profile?.avatarPath
      ? `<img src="${escHtml(msg.profile.avatarPath)}" alt="Ảnh đại diện">`
      : getInitials(username);
    updateChatHeaderStatus();
  }
  // Chỉ render nội dung trang cá nhân khi phản hồi đúng trang đang mở.
  if (state.profileTarget === username) renderProfilePage(msg);
  else if (avatarChanged && state.currentConvId) renderMessages();
}

function onProfileUpdated(msg) {
  const username = msg.username || state.username;
  if (username && (msg.avatarPath !== undefined || msg.coverPath !== undefined || msg.bio !== undefined)) {
    const old = state.userProfiles.get(username) || { username };
    state.userProfiles.set(username, { ...old, ...msg });
    if (username === state.username && dom.userAvatarBtn) {
      dom.userAvatarBtn.innerHTML = msg.avatarPath
        ? `<img src="${escHtml(msg.avatarPath)}" alt="Ảnh đại diện">`
        : getInitials(username);
    }
    renderConversationList();
    if (state.currentConvId) renderMessages();
    if (state.profileTarget === username) {
      wsSend({ type: 'get_posts', username });
    }
  } else if (username) {
    state.userProfiles.delete(username);
    state.profileRequests.delete(username);
    requestUserProfile(username, true);
  }
  showToast('Đã cập nhật trang cá nhân.','success');
}

// ─── Render messages ──────────────────────────────────────────────────────────
function renderMessages(forceBottom = false) {
  const box = dom.messages;
  const prevTop = box.scrollTop;
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  const sameConv = state.renderedConvId === state.currentConvId;
  box.innerHTML = '';
  const conv = state.conversations.get(state.currentConvId);
  if (!conv) return;
  state.renderedConvId = state.currentConvId;

  if (!conv.messages || conv.messages.length === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'conv-empty-watermark';
    emptyEl.innerHTML = `
      <div class="conv-empty-watermark-text">Hãy bắt đầu cuộc trò chuyện</div>
      <div class="conv-empty-watermark-sub">Gửi tin nhắn hoặc chia sẻ tệp với ${escHtml(conv.name)}</div>
    `;
    dom.messages.appendChild(emptyEl);
    return;
  }

  let lastDay = '';
  let previous = null;

  for (const msg of conv.messages) {
    const isSys = msg.type === 'system' || msg.messageType === 'system' || msg.from === 'SYSTEM';
    if (!isSys && msg.from) requestUserProfile(msg.from);
    const day = getDayLabel(msg.timestamp);

    // Mỗi ngày mới bắt đầu một nhóm tin nhắn mới.
    if (day !== lastDay) {
      const dayLabel = document.createElement('div');
      dayLabel.className = 'msg-day-label';
      dayLabel.textContent = day;
      dom.messages.appendChild(dayLabel);
      lastDay = day;
      previous = null;
    }

    if (isSys) {
      appendMessageDOM(msg, false);
      previous = null;
      continue;
    }

    const currentTime = new Date(msg.timestamp).getTime();
    const previousTime = previous ? new Date(previous.timestamp).getTime() : 0;
    const gap = previous ? currentTime - previousTime : Infinity;

    // Mốc thời gian mới sau khi đổi người gửi hoặc cách nhau ít nhất 1 giờ.
    const startsNewGroup = !previous || previous.from !== msg.from || gap >= 3600000;
    if (!previous || gap >= 3600000) {
      const timeLabel = document.createElement('div');
      timeLabel.className = 'msg-time-break';
      timeLabel.textContent = gap >= 86400000
        ? new Date(msg.timestamp).toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })
        : new Date(msg.timestamp).toLocaleTimeString('vi-VN', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          });
      dom.messages.appendChild(timeLabel);
    }

    // Avatar được tạo cho tin nhắn đầu nhóm, bất kể đó là văn bản hay hình ảnh.
    appendMessageDOM(msg, !startsNewGroup);
    previous = msg;
  }

  // Nếu đang mở thanh tìm kiếm tin nhắn, giữ lại highlight từ khóa
  if (state.msgSearchActive && dom.msgSearchInput?.value.trim()) {
    performMsgSearch(dom.msgSearchInput.value, false);
  }

  // Chỉ cuộn xuống cuối khi đổi đoạn chat, đang ở cuối, hoặc chính mình vừa gửi; còn lại giữ nguyên vị trí đang xem.
  if (forceBottom || !sameConv || nearBottom) scrollToBottom();
  else box.scrollTop = prevTop;
}

function appendMessageDOM(msg, grouped=false) {
  const msgType=typeof msg.type==='string'?msg.type.toLowerCase():'';
  if (msgType === 'system' || msg.messageType === 'system' || msg.from === 'SYSTEM') {
    const el=document.createElement('div');
    el.className='msg-system';
    el.textContent=msg.content;
    dom.messages.appendChild(el);
    return;
  }
  const isMine=msg.from===state.username;
  const wrapper=document.createElement('div');
  wrapper.className=`message-item ${isMine?'mine':'theirs'}${grouped?' grouped':''}`;
  if(msg.messageId)wrapper.dataset.msgId=msg.messageId;
  const inDm=state.currentConvId?.startsWith('dm:');
  const inGroup=state.currentConvId?.startsWith('group:');
  const groupObj=inGroup?state.groups.get(state.currentConvId.replace('group:','')):null;
  const isGroupOwner=Boolean(inGroup && groupObj && groupObj.createdBy === state.username);
  const canRevokeBothSides=isMine || isGroupOwner;
  const showSender=!isMine&&!inDm;
  const senderInCard=msgType==='file_share'&&isFileCardMsg(msg);
  let bubbleContent=msgType==='file_share'?buildFileBubble(msg,isMine,showSender):`<div class="msg-bubble">${renderMessageText(msg.content)}</div>`;
  const time=formatTime(msg.timestamp);
  const replyCard=msg.replyToId?`<div class="message-reply-context"><b>${escHtml(msg.replyToUsername||'')}</b><span>${escHtml(msg.replyToContent||'Tin nhắn được trả lời')}</span></div>`:'';
  const bodyHtml=`<div class="msg-body">${showSender&&!senderInCard?`<div class="msg-sender">${escHtml(msg.from||'')}</div>`:''}${replyCard}${bubbleContent}<div class="msg-time">${time}</div></div>`;
  // Avatar nằm cùng hàng với bong bóng; trong nhóm có thể bấm vào avatar người khác để mở combobox thao tác.
  const clickableAvatar = inGroup && !isMine && Boolean(msg.from);
  const senderAvatar = grouped ? '<div class="msg-av-spacer" aria-hidden="true"></div>' : avatarMarkup(msg.from || '?', 'msg-av', clickableAvatar);
  wrapper.innerHTML = `${senderAvatar}${bodyHtml}`;
  if(msgType==='revoked'){
    const body=wrapper.querySelector('.msg-body');
    body.innerHTML=`<div class="revoked-note">Tin nhắn đã được thu hồi</div>${isMine?`<button class="delete-revoked-btn" onclick="hideMessageForMe('${msg.messageId}')">Xóa thông báo</button>`:''}<div class="msg-time">${time}</div>`;
    dom.messages.appendChild(wrapper);return;
  }
  const counts={};(msg.reactions||[]).forEach(r=>{if(r.emoji)counts[r.emoji]=(counts[r.emoji]||0)+1;});
  const myReaction=(msg.reactions||[]).find(r=>r.username===state.username);
  const reactionItems=Object.entries(counts).map(([emoji,count])=>`<button class="msg-reaction${myReaction?.emoji===emoji?' mine-reaction':''}" title="Xem người đã thả ${emoji}" onclick="showReactionPeople('${msg.messageId}')"><span>${emoji}</span><b>${count}</b></button>`).join('');
  const pickerEmojis=['❤️','😂','👍','😮','😢','🔥','🎉','😍'];
  const picker=pickerEmojis.map(emoji=>`<button type="button" class="reaction-option${myReaction?.emoji===emoji?' selected':''}" title="${emoji}" onclick="event.stopPropagation();reactToMessage('${msg.messageId}','${emoji}')">${emoji}</button>`).join('');
  const reactionBox=msg.messageId?`<div class="message-reaction-area" onclick="event.stopPropagation()">
    <div class="reaction-picker">${picker}</div>
    <button type="button" class="reaction-trigger${myReaction?' has-reaction':''}" title="${myReaction?'Xem người đã bày tỏ':'Bày tỏ cảm xúc'}" onclick="${myReaction?`showReactionPeople('${msg.messageId}')`:`this.parentElement.classList.toggle('picker-open')`}">${myReaction?myReaction.emoji:'♡'}</button>
  </div>`:'';
  const reactionPills=(msg.messageId&&reactionItems)?`<div class="msg-reactions">${reactionItems}</div>`:'';
  const actions=msg.messageId?`<div class="msg-actions">
    <button class="msg-action-btn" onclick="replyToMessage('${msg.messageId}')">Trả lời</button><button class="msg-action-btn" onclick="forwardMessage('${msg.messageId}')">Chuyển tiếp</button>
    ${isMine?`<button class="msg-action-btn" onclick="hideMessageForMe('${msg.messageId}')">Xóa ở phía tôi</button>`:''}
    ${canRevokeBothSides?`<button class="msg-action-btn" onclick="revokeMessage('${msg.messageId}')">Thu hồi hai phía</button>`:''}
  </div>`:'';
  const body=wrapper.querySelector('.msg-body');
  if(body) {
    body.insertAdjacentHTML('beforeend', actions);
    const bubble = body.querySelector('.msg-bubble');
    if (bubble && reactionBox) bubble.insertAdjacentHTML('beforeend', reactionBox);
    else if (reactionBox) body.insertAdjacentHTML('afterbegin', reactionBox);
    if (bubble && reactionPills) bubble.insertAdjacentHTML('afterend', reactionPills);
  }
  dom.messages.appendChild(wrapper);
}

// ─── Combobox / Popover khi bấm vào Avatar người nhắn trong nhóm ──────────────
function closeAvatarActionMenu() {
  document.querySelector('.avatar-action-popover')?.remove();
}

function openAvatarActionMenu(event, targetUsername) {
  event.stopPropagation();
  closeAvatarActionMenu();
  if (!targetUsername || targetUsername === state.username) return;
  const inGroup = state.currentConvId?.startsWith('group:');
  const gid = inGroup ? state.currentConvId.replace('group:', '') : '';
  const groupObj = inGroup ? state.groups.get(gid) : null;
  const isOwner = Boolean(groupObj && groupObj.createdBy === state.username);

  const menu = document.createElement('div');
  menu.className = 'avatar-action-popover';
  menu.innerHTML = `
    <div class="avatar-popover-head">${userAvatarInner(targetUsername)}<span>${escHtml(targetUsername)}</span></div>
    <button type="button" class="avatar-popover-item" onclick="closeAvatarActionMenu();startChat('${escHtml(targetUsername)}')">
      ${UI_ICONS.chat}<span>Nhắn tin</span>
    </button>
    <button type="button" class="avatar-popover-item" onclick="closeAvatarActionMenu();openProfilePage('${escHtml(targetUsername)}')">
      ${UI_ICONS.user}<span>Xem trang cá nhân</span>
    </button>
    ${isOwner ? `<button type="button" class="avatar-popover-item danger" onclick="closeAvatarActionMenu();kickGroupMember('${escHtml(gid)}','${escHtml(targetUsername)}')">
      ${UI_ICONS.userMinus}<span>Xóa khỏi nhóm</span>
    </button>` : ''}
  `;
  document.body.appendChild(menu);

  const rect = event.currentTarget.getBoundingClientRect();
  const menuW = 205;
  const menuH = isOwner ? 148 : 112;
  let left = rect.right + 8;
  let top = rect.top;
  if (left + menuW > window.innerWidth - 12) left = Math.max(12, rect.left - menuW - 8);
  if (top + menuH > window.innerHeight - 12) top = Math.max(12, window.innerHeight - menuH - 12);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function kickGroupMember(groupId, targetUsername) {
  if (!groupId || !targetUsername) return;
  if (!confirm(`Bạn có chắc chắn muốn xóa ${targetUsername} khỏi nhóm không?`)) return;
  wsSend({ type: 'group_remove_member', groupId, username: targetUsername });
}

function showReactionPeople(messageId){
  const conv=state.conversations.get(state.currentConvId),m=conv?.messages.find(x=>x.messageId===messageId);if(!m)return;
  document.querySelector('.reaction-people-overlay')?.remove();
  const overlay=document.createElement('div');overlay.className='reaction-people-overlay';
  const rows=(m.reactions||[]).map(r=>`<div class="reaction-person-row">${r.avatar?`<img class="reaction-person-avatar" src="${escHtml(r.avatar)}" alt="">`:`<div class="reaction-person-avatar">${getInitials(r.username)}</div>`}<span>${escHtml(r.username)}</span><b>${escHtml(r.emoji)}</b></div>`).join('')||'<div class="reaction-empty">Chưa có ai bày tỏ cảm xúc</div>';
  overlay.innerHTML=`<div class="reaction-people-card"><div class="reaction-people-head"><b>Cảm xúc</b><button onclick="this.closest('.reaction-people-overlay').remove()">×</button></div><div class="reaction-people-list">${rows}</div></div>`;
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});dom.messages.appendChild(overlay);
}
function replyToMessage(messageId){
  const conv=state.conversations.get(state.currentConvId),m=conv?.messages.find(x=>x.messageId===messageId);if(!m)return;
  state.replyTo=m;let el=$('reply-preview');if(!el){el=document.createElement('div');el.id='reply-preview';el.className='reply-preview';$('input-bar').prepend(el);}
  el.innerHTML=`<span>Đang trả lời <b>${escHtml(m.from)}</b>: ${escHtml((m.content||m.filename||'Tệp đính kèm').slice(0,120))}</span><button onclick="state.replyTo=null;this.parentElement.remove()">×</button>`;dom.messageInput.focus();
}
function forwardMessage(messageId){
  const conv=state.conversations.get(state.currentConvId),m=conv?.messages.find(x=>x.messageId===messageId);if(!m)return;
  openForwardPicker(m);
}
function openForwardPicker(message){
  document.querySelector('.forward-overlay')?.remove();
  const items=[...state.conversations.values()].filter(c=>c.id!==state.currentConvId).sort((a,b)=>(b.lastTimestamp||0)-(a.lastTimestamp||0));
  const overlay=document.createElement('div');overlay.className='forward-overlay';overlay.innerHTML=`<div class="forward-card"><div class="forward-head"><b>Chuyển tiếp tin nhắn</b><button onclick="this.closest('.forward-overlay').remove()">×</button></div><input class="forward-search" placeholder="Tìm cá nhân hoặc nhóm..." oninput="filterForwardTargets(this.value)"><div class="forward-targets">${items.map(c=>`<label class="forward-target" data-search="${escHtml((c.name+' '+c.id).toLowerCase())}"><input type="checkbox" value="${escHtml(c.id)}"><span class="forward-target-avatar">${getInitials(c.name)}</span><span>${escHtml(c.name)}</span><small>${c.type==='group'?'Nhóm':'Cá nhân'}</small></label>`).join('')||'<p>Chưa có đoạn chat khác.</p>'}</div><button class="forward-send" onclick="sendForwardedMessage('${message.messageId}')">Chuyển tiếp</button></div>`;
  overlay._message=message;overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});document.body.appendChild(overlay);
}
function filterForwardTargets(q){document.querySelectorAll('.forward-target').forEach(el=>el.style.display=el.dataset.search.includes(q.toLowerCase())?'flex':'none');}
function sendForwardedMessage(messageId){
  const overlay=document.querySelector('.forward-overlay'),message=overlay?._message;if(!overlay||!message)return;
  const selected=[...overlay.querySelectorAll('input[type=checkbox]:checked')].map(x=>x.value);if(!selected.length){showToast('Hãy chọn ít nhất một đoạn chat.','error');return;}
  const body=message.content||message.filename||'Tệp đính kèm';
  selected.forEach(id=>{const c=state.conversations.get(id);if(!c)return;const content=`${state.username} đã chuyển tiếp một tin nhắn.\n${body}`;if(c.type==='group')wsSend({type:'group_message',groupId:id.replace('group:',''),content});else wsSend({type:'private_message',to:c.name,content});});
  overlay.remove();showToast(`Đã chuyển tiếp đến ${selected.length} đoạn chat.`,'success');
}

function isFileCardMsg(msg) {
  const m = msg.mimeType || '';
  return !(m.startsWith('image/') || m.startsWith('audio/') || m.startsWith('video/'));
}

function getDownloadedFiles() {
  try { return new Set(JSON.parse(localStorage.getItem('zchat_downloaded_files') || '[]')); } catch (_) { return new Set(); }
}

function markFileDownloaded(fileId) {
  const set = getDownloadedFiles();
  set.add(fileId);
  try { localStorage.setItem('zchat_downloaded_files', JSON.stringify([...set].slice(-500))); } catch (_) {}
  document.querySelectorAll('.file-card-status').forEach(el => {
    if (el.dataset.file === fileId) {
      el.classList.add('ok');
      el.innerHTML = FILE_CHECK_SVG + 'Đã tải xuống';
    }
  });
}

const FILE_CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="8 12.5 11 15.5 16 9.5"/></svg>';

function formatDateTimeFull(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

async function saveFileWithLocation(url, rawFilename, fileId) {
  const suggestedName = rawFilename || 'downloaded_file';
  try {
    if (typeof window.showSaveFilePicker === 'function') {
      const extMatch = suggestedName.includes('.') ? '.' + suggestedName.split('.').pop().toLowerCase() : '';
      const opts = { suggestedName };
      if (extMatch && /^\.[a-z0-9]{1,10}$/.test(extMatch)) {
        opts.types = [{ description: 'Tệp đính kèm', accept: { 'application/octet-stream': [extMatch] } }];
      }
      const handle = await window.showSaveFilePicker(opts);
      const res = await fetch(url);
      if (!res.ok) throw new Error('Không thể tải tệp từ máy chủ.');
      const blob = await res.blob();
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      if (fileId) markFileDownloaded(fileId);
      showToast(`Đã lưu "${handle.name}" vào vị trí bạn chọn!`, 'success');
      return;
    }
    // Fallback cho trình duyệt không bật showSaveFilePicker: cho phép đặt tên tệp trước khi lưu
    const customName = prompt('Nhập tên tệp để lưu xuống máy:', suggestedName);
    if (customName === null) return;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Không thể tải tệp từ máy chủ.');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = customName.trim() || suggestedName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
    if (fileId) markFileDownloaded(fileId);
  } catch (err) {
    if (err && err.name === 'AbortError') return; // Người dùng bấm Cancel hộp thoại chọn thư mục
    showToast('Không thể lưu tệp: ' + (err.message || 'Lỗi'), 'error');
  }
}

function buildFileBubble(msg, isMine, showSender = false) {
  const url = `/api/files/${encodeURIComponent(msg.fileId || '')}`;
  const filename = escHtml(msg.filename || 'Tệp đính kèm');
  const rawName = (msg.filename || 'Tệp đính kèm').replace(/'/g, "\\'");
  const mime = msg.mimeType || '';
  const author = escHtml(msg.from || msg.username || '');
  const sentAt = formatDateTimeFull(msg.timestamp);

  if (mime.startsWith('image/')) {
    return `<div class="msg-bubble msg-image-only">
      <img src="${url}" alt="Ảnh được gửi" class="img-preview" onclick="openImageViewer('${url}','${filename}')" loading="lazy">
    </div>`;
  }

  if (mime.startsWith('video/')) {
    return `<div class="msg-bubble msg-video-only">
      <video class="video-player" src="${url}" controls preload="metadata" playsinline></video>
    </div>`;
  }

  if (mime.startsWith('audio/')) {
    const audioId = 'audio_' + (msg.messageId || Math.random().toString(36).slice(2));
    return `<div class="audio-player">
      <audio id="${audioId}" src="${url}" preload="metadata" controls playsinline></audio>
      <a class="audio-dl" href="${url}" download="${filename}" title="Tải xuống">${UI_ICONS.download}</a>
    </div>`;
  }

  const fileId = String(msg.fileId || '');
  const done = isMine || getDownloadedFiles().has(fileId);
  const statusText = isMine ? 'Đã gửi' : (done ? 'Đã tải xuống' : 'Nhấn để tải');
  return `<div class="msg-bubble file-card">
    <div class="file-card-sender">Người gửi: <b>${author}</b> · ${escHtml(sentAt)}</div>
    <div class="file-card-main">
      ${fileTypeIcon(mime, msg.filename)}
      <div class="file-card-info">
        <div class="file-card-name" title="${filename}">${filename}</div>
        <div class="file-card-meta">
          <span class="file-card-size">${escHtml(msg.fileSize || '')}</span>
          <span class="file-card-status${done ? ' ok' : ''}" data-file="${escHtml(fileId)}">${done ? FILE_CHECK_SVG : ''}${statusText}</span>
        </div>
      </div>
      <div class="file-card-actions">
        <button type="button" class="file-card-btn" title="Chọn đường dẫn lưu tệp (Save As...)" onclick="saveFileWithLocation('${url}','${rawName}','${escHtml(fileId)}')">${UI_ICONS.folderSave}</button>
        <a class="file-card-btn" href="${url}" download="${filename}" title="Tải về thư mục Downloads" onclick="markFileDownloaded('${escHtml(fileId)}')">${UI_ICONS.download}</a>
      </div>
    </div>
  </div>`;
}

// ─── Audio player controls ────────────────────────────────────────────────────
function toggleAudioPlay(audioId, btn) {
  const audio = document.getElementById(audioId);
  if (!audio) return;
  if (audio.paused) {
    // Pause all other playing audios
    document.querySelectorAll('audio').forEach(a => { if (a !== audio && !a.paused) a.pause(); });
    audio.play().then(() => {
      btn.innerHTML = '<svg viewBox="0 0 24 24" style="fill:currentColor;stroke:none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    }).catch(err => { console.error('Audio playback failed', err); showToast('Không phát được audio. Kiểm tra định dạng tệp hoặc quyền truy cập.','error'); });
  } else {
    audio.pause();
    btn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  }

  audio.ontimeupdate = () => {
    const seek = document.getElementById('seek_' + audioId);
    const dur = document.getElementById('dur_' + audioId);
    if (seek && audio.duration) {
      seek.value = (audio.currentTime / audio.duration) * 100;
    }
    if (dur) dur.textContent = `${fmtAudioTime(audio.currentTime)} / ${fmtAudioTime(audio.duration || 0)}`;
  };
  audio.onended = () => {
    btn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    const seek = document.getElementById('seek_' + audioId);
    if (seek) seek.value = 0;
  };
}

function seekAudio(audioId, val) {
  const audio = document.getElementById(audioId);
  if (audio?.duration) audio.currentTime = (val / 100) * audio.duration;
}

function fmtAudioTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

// ─── Message search ───────────────────────────────────────────────────────────
function toggleMsgSearch() {
  if (state.msgSearchActive) closeMsgSearch();
  else {
    state.msgSearchActive = true;
    dom.msgSearchBar.classList.add('visible');
    dom.msgSearchInput.focus();
    $('msg-search-toggle').classList.add('active-panel');
  }
}

function clearMsgSearchHighlights() {
  dom.messages.querySelectorAll('.search-active-msg').forEach(el => el.classList.remove('search-active-msg'));
  dom.messages.querySelectorAll('mark.search-highlight').forEach(el => {
    const parent = el.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    }
  });
  state.msgSearchMatches = [];
  state.msgSearchIndex = 0;
}

function closeMsgSearch() {
  state.msgSearchActive = false;
  dom.msgSearchBar?.classList.remove('visible');
  if (dom.msgSearchInput) dom.msgSearchInput.value = '';
  if (dom.msgSearchCount) dom.msgSearchCount.textContent = '';
  $('msg-search-toggle')?.classList.remove('active-panel');
  clearMsgSearchHighlights();
}

function highlightTextInElement(container, query) {
  const marks = [];
  const lowerQ = query.toLowerCase();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest('.message-reaction-area, .msg-actions, .msg-time, .file-card-actions, mark.search-highlight')) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.nodeValue.toLowerCase().includes(lowerQ) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const textNodes = [];
  let current;
  while ((current = walker.nextNode())) textNodes.push(current);

  for (const textNode of textNodes) {
    const text = textNode.nodeValue;
    const lower = text.toLowerCase();
    let idx = 0;
    let pos;
    const frag = document.createDocumentFragment();
    while ((pos = lower.indexOf(lowerQ, idx)) !== -1) {
      if (pos > idx) frag.appendChild(document.createTextNode(text.slice(idx, pos)));
      const mark = document.createElement('mark');
      mark.className = 'search-highlight';
      mark.textContent = text.slice(pos, pos + query.length);
      frag.appendChild(mark);
      marks.push(mark);
      idx = pos + query.length;
    }
    if (idx < text.length) frag.appendChild(document.createTextNode(text.slice(idx)));
    textNode.parentNode.replaceChild(frag, textNode);
  }
  return marks;
}

function performMsgSearch(query, scrollToFirst = true) {
  clearMsgSearchHighlights();
  const clean = (query || '').trim();
  if (!clean) {
    if (dom.msgSearchCount) dom.msgSearchCount.textContent = '';
    return;
  }

  const bubbles = dom.messages.querySelectorAll('.message-item .msg-bubble');
  const allMarks = [];
  bubbles.forEach(bubble => {
    const found = highlightTextInElement(bubble, clean);
    allMarks.push(...found);
  });

  state.msgSearchMatches = allMarks;
  if (allMarks.length === 0) {
    if (dom.msgSearchCount) dom.msgSearchCount.textContent = '0 kết quả';
    return;
  }
  // Mặc định trỏ tới kết quả gần nhất (cuối danh sách) hoặc đầu danh sách
  state.msgSearchIndex = 0;
  focusMsgSearchMatch(state.msgSearchIndex, scrollToFirst);
}

function focusMsgSearchMatch(index, shouldScroll = true) {
  const matches = state.msgSearchMatches || [];
  if (!matches.length) {
    if (dom.msgSearchCount) dom.msgSearchCount.textContent = '0 kết quả';
    return;
  }
  const total = matches.length;
  state.msgSearchIndex = ((index % total) + total) % total;

  dom.messages.querySelectorAll('mark.search-highlight.active-match').forEach(el => el.classList.remove('active-match'));
  dom.messages.querySelectorAll('.message-item.search-active-msg').forEach(el => el.classList.remove('search-active-msg'));

  const targetMark = matches[state.msgSearchIndex];
  if (targetMark) {
    targetMark.classList.add('active-match');
    const msgItem = targetMark.closest('.message-item');
    if (msgItem) msgItem.classList.add('search-active-msg');
    if (shouldScroll) {
      (msgItem || targetMark).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  if (dom.msgSearchCount) {
    dom.msgSearchCount.textContent = `${state.msgSearchIndex + 1}/${total} kết quả`;
  }
}

function stepMsgSearch(delta) {
  const matches = state.msgSearchMatches || [];
  if (!matches.length) return;
  focusMsgSearchMatch(state.msgSearchIndex + delta, true);
}

// ─── URL rendering ────────────────────────────────────────────────────────────
function renderMessageText(value) {
  const text = String(value || '');
  const urlPat = /((https?:\/\/|www\.)[^\s<]+)/gi;
  let html = '', last = 0;
  for (const match of text.matchAll(urlPat)) {
    const raw = match[0], start = match.index;
    html += escHtml(text.slice(last, start));
    const clean = raw.replace(/[),.!?;:]+$/, '');
    const suffix = raw.slice(clean.length);
    const href = clean.startsWith('www.') ? `https://${clean}` : clean;
    html += `<a class="message-link" href="${escHtml(href)}" target="_blank" rel="noopener noreferrer">${escHtml(clean)}</a>${escHtml(suffix)}`;
    last = start + raw.length;
  }
  html += escHtml(text.slice(last));
  return html.replace(/\n/g, '<br>');
}

// ─── Send message ─────────────────────────────────────────────────────────────
function sendMessage() {
  let content = dom.messageInput.value.trim();
  if (!content || !state.currentConvId) return;
  const replyMeta=state.replyTo?{replyToId:state.replyTo.messageId,replyToUsername:state.replyTo.from,replyToContent:String(state.replyTo.content||state.replyTo.filename||'Tệp đính kèm').slice(0,180)}:{};
  state.replyTo=null; $('reply-preview')?.remove();
  dom.messageInput.value = '';
  dom.messageInput.style.height = '';
  closeEmojiPicker();

  const conv = state.conversations.get(state.currentConvId);
  if (!conv) return;

  if (conv.type === 'dm') {
    wsSend({ type: 'private_message', to: conv.name, content, ...replyMeta });
  } else if (conv.type === 'group') {
    const groupId = state.currentConvId.replace('group:', '');
    wsSend({ type: 'group_message', groupId, content, ...replyMeta });
  }
}

// ─── File upload ──────────────────────────────────────────────────────────────
async function sendFile(file) {
  if (!file) return;
  const conv = state.conversations.get(state.currentConvId);
  if (!conv) return;
  if(conv.type==='dm'&&!state.friends.some(f=>f.username===conv.name)){showToast('Bạn cần kết bạn trước khi gửi tệp hoặc audio.','error');return;}

  dom.uploadProgress.style.display = 'flex';
  dom.progressFill.style.width = '0%';

  const fd = new FormData();
  fd.append('file', file);
  fd.append('uploader', state.username);
  fd.append('conversationId', conv.id);
  if (conv.type === 'dm') fd.append('to', conv.name);
  else if (conv.type === 'group') fd.append('groupId', conv.id.replace('group:', ''));

  try {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) dom.progressFill.style.width = (e.loaded / e.total * 100) + '%';
    };
    await new Promise((res, rej) => {
      xhr.onload = () => xhr.status < 300 ? res(JSON.parse(xhr.responseText)) : rej(new Error(xhr.responseText));
      xhr.onerror = rej;
      xhr.open('POST', '/api/files/upload');
      xhr.send(fd);
    });
    showToast('File đã được gửi thành công!', 'success');
  } catch (err) {
    showToast('Lỗi gửi file: ' + (err.message || 'unknown'), 'error');
  } finally {
    dom.uploadProgress.style.display = 'none';
    dom.progressFill.style.width = '0%';
    dom.fileInput.value = '';
  }
}

// ─── Audio recording ──────────────────────────────────────────────────────────
let mediaStream = null;

function toggleRecording() {
  if (state.mediaRecorder?.state === 'recording') {
    stopAndSendRecording();
  } else {
    startRecording();
  }
}

async function startRecording() {
  if (!state.currentConvId) { showToast('Chọn cuộc trò chuyện trước.', 'error'); return; }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const preferred = ['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
    state.recordingMime = preferred || '';
    state.mediaRecorder = new MediaRecorder(mediaStream, preferred ? { mimeType: preferred } : undefined);
    state.recordedChunks = [];
    state.recordingSeconds = 0;

    state.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) state.recordedChunks.push(e.data); };
    state.mediaRecorder.onstop = handleRecordingStop;
    state.mediaRecorder.start(100);

    dom.recordingBar.classList.add('visible');
    dom.micBtn.classList.add('recording');
    state.recordingTimer = setInterval(() => {
      state.recordingSeconds++;
      dom.recTime.textContent = fmtAudioTime(state.recordingSeconds);
    }, 1000);
  } catch (err) {
    showToast('Không thể truy cập microphone: ' + err.message, 'error');
  }
}

function stopAndSendRecording() {
  if (state.mediaRecorder?.state === 'recording') {
    state.mediaRecorder.stop();
    mediaStream?.getTracks().forEach(t => t.stop());
  }
  clearInterval(state.recordingTimer);
  dom.recordingBar.classList.remove('visible');
  dom.micBtn.classList.remove('recording');
}

function cancelRecording() {
  if (state.mediaRecorder?.state === 'recording') {
    state.mediaRecorder.onstop = null; // Don't send
    state.mediaRecorder.stop();
    mediaStream?.getTracks().forEach(t => t.stop());
  }
  state.recordedChunks = [];
  clearInterval(state.recordingTimer);
  dom.recordingBar.classList.remove('visible');
  dom.micBtn.classList.remove('recording');
}

async function handleRecordingStop() {
  if (state.recordedChunks.length === 0) return;
  const mime = state.mediaRecorder?.mimeType || state.recordingMime || state.recordedChunks[0]?.type || 'audio/webm';
  const ext = mime.includes('mp4') ? 'm4a' : 'webm';
  const blob = new Blob(state.recordedChunks, { type: mime });
  const filename = `voice_${Date.now()}.${ext}`;
  const file = new File([blob], filename, { type: mime });
  await sendFile(file);
  state.recordedChunks = [];
}

// ─── Emoji picker ─────────────────────────────────────────────────────────────
let currentEmojiCat = 'Mặt cười';

function initEmojiPicker() {
  // Render category buttons
  dom.emojiCats.innerHTML = '';
  for (const cat of Object.keys(EMOJI_CATEGORIES)) {
    const btn = document.createElement('button');
    btn.className = 'emoji-cat-btn' + (cat === currentEmojiCat ? ' active' : '');
    btn.textContent = cat;
    btn.onclick = () => { currentEmojiCat = cat; renderEmojiGrid(); document.querySelectorAll('.emoji-cat-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); };
    dom.emojiCats.appendChild(btn);
  }
  renderEmojiGrid();
}

function renderEmojiGrid(filter = '') {
  dom.emojiGrid.innerHTML = '';
  let emojis = EMOJI_CATEGORIES[currentEmojiCat] || [];
  if (filter) {
    emojis = Object.values(EMOJI_CATEGORIES).flat().filter(e => e.includes(filter));
  }
  for (const emoji of emojis) {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn';
    btn.textContent = emoji;
    btn.title = emoji;
    btn.onclick = () => insertEmoji(emoji);
    dom.emojiGrid.appendChild(btn);
  }
}

function insertEmoji(emoji) {
  const inp = dom.messageInput;
  const start = inp.selectionStart, end = inp.selectionEnd;
  inp.value = inp.value.slice(0, start) + emoji + inp.value.slice(end);
  inp.selectionStart = inp.selectionEnd = start + emoji.length;
  inp.focus();
  autoResize(inp);
  // Track recent
  recentEmojis = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 24);
  EMOJI_CATEGORIES['Mới dùng'] = recentEmojis;
  localStorage.setItem('zchat_recent_emojis', JSON.stringify(recentEmojis));
}

function toggleEmojiPicker() {
  if (dom.emojiPicker.classList.contains('visible')) {
    closeEmojiPicker();
  } else {
    dom.emojiPicker.classList.add('visible');
    dom.emojiSearch.focus();
  }
}
function closeEmojiPicker() { dom.emojiPicker.classList.remove('visible'); }

// ─── Right panel ──────────────────────────────────────────────────────────────
function toggleRightPanel() {
  state.rightPanelOpen = !state.rightPanelOpen;
  dom.rightPanel.classList.toggle('open', state.rightPanelOpen);
  $('shared-files-btn').classList.toggle('active-panel', state.rightPanelOpen);
  if (state.rightPanelOpen) renderRightPanel();
}

function closeRightPanel() {
  state.rightPanelOpen = false;
  dom.rightPanel.classList.remove('open');
  $('shared-files-btn').classList.remove('active-panel');
}

function switchRpTab(tab) {
  state.activeRpTab = tab;
  document.querySelectorAll('.rp-tab').forEach((el, i) => {
    el.classList.toggle('active', ['files','images','links'][i] === tab);
  });
  renderRightPanel();
}

function renderRightPanel() {
  const conv = state.conversations.get(state.currentConvId);
  if (!conv) { dom.rpContent.innerHTML = '<div class="rp-empty">Chọn một cuộc trò chuyện</div>'; return; }

  const msgs = conv.messages || [];
  const tab = state.activeRpTab;

  if (tab === 'images') {
    const images = msgs.filter(m => (m.mimeType || '').startsWith('image/') && m.fileId);
    if (!images.length) { dom.rpContent.innerHTML = '<div class="rp-empty">Chưa có ảnh nào</div>'; return; }
    dom.rpContent.innerHTML = `<div class="shared-img-grid">${images.map(m => {
      const url = `/api/files/${encodeURIComponent(m.fileId)}`;
      return `<img class="shared-img-thumb" src="${url}" alt="${escHtml(m.filename||'')}" onclick="openImageViewer('${url}','${escHtml(m.filename||'')}')">`;
    }).join('')}</div>`;
  } else if (tab === 'files') {
    const files = msgs.filter(m => m.fileId && !(m.mimeType || '').startsWith('image/') && !(m.mimeType || '').startsWith('audio/'));
    const audios = msgs.filter(m => m.fileId && (m.mimeType || '').startsWith('audio/'));
    let html = '';
    if (audios.length) {
      html += `<div style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:8px">Âm thanh (${audios.length})</div>`;
      for (const m of audios.slice().reverse()) {
        const url = `/api/files/${encodeURIComponent(m.fileId)}`;
        const sender = m.from || m.username || 'Không rõ';
        const timeStr = formatDateTimeFull(m.timestamp);
        html += `<div class="shared-file-row">
          <div class="shared-file-ico" style="width:36px!important;height:36px;background:#eaf3ff!important;color:#0866d6;border-radius:9px">${UI_ICONS.music}</div>
          <div class="shared-file-info">
            <div class="shared-file-name">${escHtml(m.filename || 'Audio')}</div>
            <div class="shared-file-meta">Người gửi: <b>${escHtml(sender)}</b> · ${escHtml(m.fileSize || '')}</div>
            <div class="shared-file-meta">${escHtml(timeStr)}</div>
          </div>
          <a class="shared-file-dl" href="${url}" download="${escHtml(m.filename || 'audio')}" title="Tải xuống">${UI_ICONS.download}</a>
        </div>`;
      }
    }
    if (files.length) {
      html += `<div style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;margin:12px 0 8px">File (${files.length})</div>`;
      for (const m of files.slice().reverse()) {
        const url = `/api/files/${encodeURIComponent(m.fileId)}`;
        const sender = m.from || m.username || 'Không rõ';
        const timeStr = formatDateTimeFull(m.timestamp);
        const rawName = (m.filename || 'file').replace(/'/g, "\\'");
        html += `<div class="shared-file-row">
          <div class="shared-file-ico">${fileTypeIcon(m.mimeType, m.filename)}</div>
          <div class="shared-file-info">
            <div class="shared-file-name" title="${escHtml(m.filename || 'File')}">${escHtml(m.filename || 'File')}</div>
            <div class="shared-file-meta">Người gửi: <b>${escHtml(sender)}</b> · ${escHtml(m.fileSize || '')}</div>
            <div class="shared-file-meta">${escHtml(timeStr)}</div>
          </div>
          <div style="display:flex;gap:5px">
            <button type="button" class="shared-file-dl" title="Chọn đường dẫn lưu tệp" onclick="saveFileWithLocation('${url}','${rawName}','${escHtml(m.fileId)}')">${UI_ICONS.folderSave}</button>
            <a class="shared-file-dl" href="${url}" download="${escHtml(m.filename || 'file')}" title="Tải về thư mục Downloads" onclick="markFileDownloaded('${escHtml(m.fileId)}')">${UI_ICONS.download}</a>
          </div>
        </div>`;
      }
    }
    if (!html) html = '<div class="rp-empty">Chưa có file nào</div>';
    dom.rpContent.innerHTML = html;
  } else if (tab === 'links') {
    const urlPat = /((https?:\/\/|www\.)[^\s<]+)/gi;
    const links = [];
    for (const m of msgs) {
      if (!m.content) continue;
      for (const match of m.content.matchAll(urlPat)) {
        const raw = match[0].replace(/[),.!?;:]+$/, '');
        const href = raw.startsWith('www.') ? `https://${raw}` : raw;
        links.push({ url: href, display: raw, from: m.from, time: m.timestamp });
      }
    }
    if (!links.length) { dom.rpContent.innerHTML = '<div class="rp-empty">Chưa có đường dẫn nào</div>'; return; }
    dom.rpContent.innerHTML = links.slice().reverse().map(l =>
      `<div class="link-item">
        <a href="${escHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escHtml(l.display)}</a>
        <div class="link-meta">${escHtml(l.from)} · ${formatTime(l.time)}</div>
      </div>`
    ).join('');
  }
}

// ─── Friend actions ───────────────────────────────────────────────────────────
function openAddFriendModal() {
  $('add-friend-modal-overlay').classList.add('visible');
  dom.phoneSearchInput.value = '';
  dom.phoneSearchResult.innerHTML = '';
  dom.phoneSearchInput.focus();
}
function closeAddFriendModal() { $('add-friend-modal-overlay').classList.remove('visible'); }

function searchByPhone() {
  const phone = dom.phoneSearchInput.value.trim();
  if (!phone) return;
  dom.phoneSearchResult.innerHTML = '<div style="text-align:center;padding:16px;color:#888">Đang tìm...</div>';
  wsSend({ type: 'search_by_phone', phone });
}

function renderPhoneSearchResult(results) {
  if (!results || results.length === 0) {
    dom.phoneSearchResult.innerHTML = '<div style="text-align:center;padding:16px;color:#888">Không tìm thấy tài khoản với số này.</div>';
    return;
  }
  const r = results[0];
  // Request user profile
  wsSend({ type: 'user_profile', username: r.username });
}

function renderProfileCard(profile) {
  if (!profile) return;
  const online = profile.online;
  const { rel, requestId } = getRelationshipWith(profile.username);
  const effectiveRel = profile.relationship || rel;
  const effectiveReqId = profile.requestId || requestId || '';
  let actions = '';

  if (effectiveRel === 'friend') {
    actions = `
      <button class="btn-friend btn-unfriend" onclick="confirmUnfriend('${escHtml(profile.username)}')">Hủy kết bạn</button>
      <button class="btn-friend btn-add-friend" onclick="startChat('${escHtml(profile.username)}')">Nhắn tin</button>`;
  } else if (effectiveRel === 'pending_sent') {
    actions = `<button class="btn-friend btn-cancel-req" onclick="cancelFriendRequest('${escHtml(effectiveReqId)}','${escHtml(profile.username)}')">Hủy lời mời</button>`;
  } else if (effectiveRel === 'pending_received') {
    actions = `
      <button class="btn-friend btn-accept-req" onclick="acceptFriendRequest('${escHtml(effectiveReqId)}','${escHtml(profile.username)}')">Đồng ý</button>
      <button class="btn-friend btn-reject-req" onclick="rejectFriendRequest('${escHtml(effectiveReqId)}','${escHtml(profile.username)}')">Từ chối</button>`;
  } else {
    actions = `<button class="btn-friend btn-add-friend" onclick="sendFriendRequest('${escHtml(profile.username)}')">Kết bạn</button>`;
  }

  dom.phoneSearchResult.innerHTML = `
    <div class="profile-card">
      <div class="profile-avatar" style="overflow:hidden">${userAvatarInner(profile.username)}</div>
      <div class="profile-name" style="cursor:pointer" onclick="openProfilePage('${escHtml(profile.username)}')">${escHtml(profile.username)}</div>
      <div class="profile-phone">${escHtml(profile.phone || '')}</div>
      <div class="profile-status ${online ? 'online' : 'offline'}">${escHtml(formatPresenceStatus(profile.username, online))}</div>
      <div class="profile-actions">${actions}<button class="btn-friend" onclick="openProfilePage('${escHtml(profile.username)}')">Trang cá nhân</button></div>
    </div>`;
}

function sendFriendRequest(username) {
  if (!username) return;
  wsSend({ type: 'friend_request', to: username });
  showToast(`Đã gửi lời mời kết bạn tới ${username}`, 'success');
  // Chuyển đổi trạng thái nút thành "Hủy lời mời" ngay lập tức trên mọi giao diện
  state.pendingSentByTarget.set(username, state.pendingSentByTarget.get(username) || '');
  if (!state.viewedProfile || state.viewedProfile.username !== username) {
    state.viewedProfile = { username, relationship: 'pending_sent', requestId: '' };
  } else {
    state.viewedProfile.relationship = 'pending_sent';
  }
  refreshRelationshipUI(username);
}

function acceptFriendRequest(requestId, senderUsername) {
  wsSend({ type: 'friend_accept', requestId, from: senderUsername });
  state.pendingRequests = state.pendingRequests.filter(r => r.requestId !== requestId);
  updateFriendReqBadge();
  if (state.activeTab === 'requests') renderConversationList();
}

function rejectFriendRequest(requestId, senderUsername) {
  wsSend({ type: 'friend_reject', requestId, from: senderUsername });
  state.pendingRequests = state.pendingRequests.filter(r => r.requestId !== requestId);
  updateFriendReqBadge();
  showToast('Đã từ chối lời mời kết bạn.', 'info');
  if (state.activeTab === 'requests') renderConversationList();
}

function cancelFriendRequest(requestId, receiverUsername) {
  const reqId = requestId || (receiverUsername ? state.pendingSentByTarget.get(receiverUsername) : '') || '';
  wsSend({ type: 'friend_cancel', requestId: reqId, to: receiverUsername });
  if (receiverUsername) state.pendingSentByTarget.delete(receiverUsername);
  if (state.viewedProfile && (!receiverUsername || state.viewedProfile.username === receiverUsername)) {
    state.viewedProfile.relationship = 'stranger';
    state.viewedProfile.requestId = null;
  }
  refreshRelationshipUI(receiverUsername || state.viewedProfile?.username);
  showToast('Đã hủy lời mời kết bạn.', 'info');
}

function confirmUnfriend(username) {
  if (confirm(`Bạn có chắc muốn hủy kết bạn với ${username}?`)) {
    unfriend(username);
  }
}

function unfriend(username) {
  wsSend({ type: 'unfriend', username });
}

function startChat(username) {
  const convId = dmConvId(state.username, username);
  ensureConversation(convId, 'dm', username, []);
  selectConversation(convId);
  closeAddFriendModal();
  showPanel('chats');
}

// ─── Group modal ──────────────────────────────────────────────────────────────
function openGroupModal() {
  $('group-name-input').value = '';
  renderMemberList();
  $('group-modal-overlay').classList.add('visible');
  setTimeout(() => $('group-name-input').focus(), 100);
}
function closeGroupModal() { $('group-modal-overlay').classList.remove('visible'); }

function renderMemberList() {
  const list = $('member-list');
  list.innerHTML = '';
  // Khi tạo nhóm mới, hiển thị danh sách bạn bè đã kết bạn
  const candidates = new Set(state.friends.map(f => f.username));
  candidates.delete(state.username);
  if (candidates.size === 0) {
    list.innerHTML = '<div style="padding:12px;text-align:center;color:#aaa;font-size:13px">Bạn chưa có bạn bè nào để thêm vào nhóm</div>';
    return;
  }
  for (const user of candidates) {
    const item = document.createElement('div');
    item.className = 'member-item';
    item.dataset.user = user;
    item.innerHTML = `
      <div class="member-chk">✓</div>
      <div class="member-av" style="overflow:hidden">${userAvatarInner(user)}</div>
      <span style="font-size:14px">${escHtml(user)}</span>`;
    item.onclick = () => item.classList.toggle('selected');
    list.appendChild(item);
  }
}

function submitCreateGroup() {
  const name = $('group-name-input').value.trim();
  if (!name) { $('group-name-input').focus(); return; }
  const selected = [...$('member-list').querySelectorAll('.member-item.selected')].map(el => el.dataset.user);
  wsSend({ type: 'create_group', groupName: name, members: selected });
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
let typingTimer = null;
function handleTypingInput() {
  if (!state.currentConvId) return;
  const conv = state.conversations.get(state.currentConvId);
  if (!conv) return;
  if (typingTimer) return;
  if (conv.type === 'dm') wsSend({ type: 'typing', to: conv.name });
  else if (conv.type === 'group') wsSend({ type: 'typing', groupId: state.currentConvId.replace('group:','') });
  typingTimer = setTimeout(() => { typingTimer = null; }, 2000);
}

// ─── Image viewer & Message actions ───────────────────────────────────────────
function reactToMessage(messageId, emoji) {
  const conv=state.conversations.get(state.currentConvId); if(!conv)return;
  const msg=conv.messages.find(m=>m.messageId===messageId); if(!msg)return;
  const mine=(msg.reactions||[]).find(r=>r.username===state.username);
  wsSend({type:'react_message',messageId,conversationId:state.currentConvId,emoji:(mine&&mine.emoji===emoji)?'':emoji});
}
function revokeMessage(messageId) {
  if(!confirm('Thu hồi tin nhắn này với tất cả mọi người?'))return;
  wsSend({type:'revoke_message',messageId,conversationId:state.currentConvId});
}
function hideMessageForMe(messageId) {
  if(!confirm('Xóa tin nhắn này chỉ ở phía bạn?'))return;
  wsSend({type:'delete_message_for_me',messageId,conversationId:state.currentConvId});
}

function optItem(iconSvg, label, onclickJs, danger = false) {
  return `<button class="option-action${danger ? ' danger' : ''}" onclick="${onclickJs}">
    <span class="opt-ico">${iconSvg}</span>
    <span>${label}</span>
  </button>`;
}

function openConversationOptions() {
  const conv=state.conversations.get(state.currentConvId);if(!conv)return;
  const root=$('conversation-options-content');if(!root)return;
  const isGroup=conv.type==='group';
  const gid = isGroup ? state.currentConvId.replace('group:','') : '';
  const group=isGroup?state.groups.get(gid):null;
  const other=conv.name;
  const muted=state.mutedConversations.has(conv.id);
  let html='';
  if(!isGroup){
    const blocked=state.blockedUsers.has(other);
    html += optItem(UI_ICONS.user, 'Xem trang cá nhân', `openProfilePage('${escHtml(other)}');closeConversationOptions()`);
    html += optItem(blocked ? UI_ICONS.unlock : UI_ICONS.ban, blocked ? 'Gỡ chặn người này' : 'Chặn người này', `toggleBlockUser('${escHtml(other)}',${blocked})`);
    if(state.friends.some(f=>f.username===other)) {
      html += optItem(UI_ICONS.userMinus, 'Hủy kết bạn', `confirmUnfriend('${escHtml(other)}');closeConversationOptions()`, true);
    }
  } else {
    const isOwner=group?.createdBy===state.username;
    html += optItem(UI_ICONS.users, `Xem thành viên nhóm (${group?.members?.length || 0})`, `closeConversationOptions();showGroupMembers()`);
    // Mọi thành viên trong nhóm đều có thể thêm thành viên mới
    html += optItem(UI_ICONS.userPlus, 'Thêm thành viên', `closeConversationOptions();addGroupMember()`);
    html += optItem(UI_ICONS.edit, 'Đổi tên & ảnh đại diện nhóm', `closeConversationOptions();openGroupEditInfoModal()`);
    if(isOwner){
      html += optItem(UI_ICONS.crown, 'Chuyển quyền trưởng nhóm', `closeConversationOptions();transferGroupOwner()`);
      html += optItem(UI_ICONS.logOut, 'Rời nhóm', `leaveGroup()`);
      html += optItem(UI_ICONS.trash, 'Giải tán nhóm', `deleteGroup()`, true);
    } else {
      html += optItem(UI_ICONS.logOut, 'Rời nhóm', `leaveGroup()`, true);
    }
  }
  html += optItem(muted ? UI_ICONS.bell : UI_ICONS.bellOff, muted ? 'Bật thông báo' : 'Tắt thông báo', `toggleMuteConversation(${!muted})`);
  html += optItem(UI_ICONS.search, 'Tìm kiếm cuộc trò chuyện', `toggleMsgSearch();closeConversationOptions()`);
  html += optItem(UI_ICONS.trash, 'Xóa cuộc trò chuyện ở phía tôi', `deleteConversation()`, true);
  root.innerHTML=html;$('conversation-options-overlay').classList.add('visible');
}
function closeConversationOptions(){$('conversation-options-overlay')?.classList.remove('visible');}
function toggleBlockUser(username,blocked){wsSend({type:blocked?'unblock_user':'block_user',username});closeConversationOptions();}
function toggleMuteConversation(muted){wsSend({type:'mute_conversation',conversationId:state.currentConvId,muted});closeConversationOptions();}
function deleteConversation(){if(!confirm('Xóa đoạn chat chỉ ở phía bạn? Người kia vẫn giữ lịch sử của họ.'))return;wsSend({type:'delete_conversation',conversationId:state.currentConvId});}

// ─── Group Action Modals (Xem thành viên, Thêm nhiều bạn bè, Nhượng quyền, Đổi tên/ảnh nhóm) ──
function closeGroupActionModal() {
  $('group-action-modal-overlay')?.classList.remove('visible');
}

function openGroupActionModal(title, bodyHtml, footerHtml = '') {
  $('group-action-modal-title').textContent = title;
  $('group-action-modal-body').innerHTML = bodyHtml;
  $('group-action-modal-footer').innerHTML = footerHtml || `<button class="btn-cancel" onclick="closeGroupActionModal()">Đóng</button>`;
  $('group-action-modal-overlay').classList.add('visible');
}

function showGroupMembers() {
  const gid = state.currentConvId?.replace('group:', '');
  const g = state.groups.get(gid);
  if (!g) return;
  const isOwner = g.createdBy === state.username;
  const members = g.members || [];

  const rows = members.map(u => {
    const isMemberOwner = u === g.createdBy;
    const isMe = u === state.username;
    const online = isMe || state.onlineUsers.includes(u);
    const statusText = isMe ? '● Bạn' : formatPresenceStatus(u, online);
    return `<div class="group-member-row">
      <div class="conv-avatar" style="width:38px;height:38px;font-size:14px;overflow:hidden">${userAvatarInner(u)}${online ? '<span class="online-dot"></span>' : ''}</div>
      <div style="min-width:0;flex:1">
        <div style="font-size:14px;font-weight:700;color:#172033;display:flex;align-items:center;flex-wrap:wrap">
          <span>${escHtml(u)}</span>
          ${isMemberOwner ? '<span class="group-owner-badge">Trưởng nhóm</span>' : ''}
        </div>
        <div style="font-size:11px;color:${online ? '#2ecc71' : '#8893a4'};margin-top:2px">${escHtml(statusText)}</div>
      </div>
      <div class="group-member-actions">
        ${!isMe ? `<button class="gm-btn" onclick="closeGroupActionModal();startChat('${escHtml(u)}')">Nhắn tin</button>` : ''}
        <button class="gm-btn" onclick="closeGroupActionModal();openProfilePage('${escHtml(u)}')">Hồ sơ</button>
        ${(isOwner && !isMe) ? `<button class="gm-btn danger" onclick="kickGroupMemberFromModal('${escHtml(gid)}','${escHtml(u)}')">Xóa</button>` : ''}
      </div>
    </div>`;
  }).join('');

  openGroupActionModal(
    `Thành viên nhóm · ${g.name} (${members.length})`,
    `<div style="max-height:360px;overflow-y:auto">${rows}</div>`,
    `<button class="btn-cancel" onclick="closeGroupActionModal()">Đóng</button>`
  );
}

function kickGroupMemberFromModal(groupId, targetUsername) {
  if (!confirm(`Bạn có chắc chắn muốn xóa ${targetUsername} khỏi nhóm không?`)) return;
  wsSend({ type: 'group_remove_member', groupId, username: targetUsername });
  closeGroupActionModal();
}

function addGroupMember() {
  const gid = state.currentConvId?.replace('group:', '');
  const g = state.groups.get(gid);
  if (!g) return;
  const currentMembers = new Set(g.members || []);
  const availableFriends = state.friends.filter(f => !currentMembers.has(f.username));

  if (availableFriends.length === 0) {
    openGroupActionModal(
      'Thêm thành viên vào nhóm',
      `<div class="rp-empty">Tất cả bạn bè của bạn đều đã ở trong nhóm này (hoặc bạn chưa kết bạn với người mới).</div>`,
      `<button class="btn-cancel" onclick="closeGroupActionModal()">Đóng</button>`
    );
    return;
  }

  const itemsHtml = availableFriends.map(f => `
    <div class="member-item group-add-candidate" data-user="${escHtml(f.username)}" onclick="this.classList.toggle('selected')">
      <div class="member-chk">✓</div>
      <div class="member-av" style="overflow:hidden">${userAvatarInner(f.username)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600">${escHtml(f.username)}</div>
        <div style="font-size:11px;color:${f.online ? '#2ecc71' : '#8893a4'}">${escHtml(formatPresenceStatus(f.username, f.online))}</div>
      </div>
    </div>
  `).join('');

  openGroupActionModal(
    `Thêm bạn bè vào nhóm · ${g.name}`,
    `<input type="text" class="modal-input" placeholder="Tìm bạn bè để thêm..." style="margin-bottom:10px" oninput="filterGroupAddCandidates(this.value)">
     <div id="group-add-member-list" style="max-height:280px;overflow-y:auto;border:1.5px solid var(--gray-mid);border-radius:8px">${itemsHtml}</div>`,
    `<button class="btn-cancel" onclick="closeGroupActionModal()">Hủy</button>
     <button class="btn-primary" onclick="submitAddGroupMembers('${escHtml(gid)}')">Thêm vào nhóm</button>`
  );
}

function filterGroupAddCandidates(q) {
  const clean = (q || '').trim().toLowerCase();
  document.querySelectorAll('.group-add-candidate').forEach(el => {
    const u = (el.dataset.user || '').toLowerCase();
    el.style.display = (!clean || u.includes(clean)) ? 'flex' : 'none';
  });
}

function submitAddGroupMembers(groupId) {
  const selected = [...document.querySelectorAll('.group-add-candidate.selected')].map(el => el.dataset.user);
  if (selected.length === 0) {
    showToast('Vui lòng chọn ít nhất một người bạn để thêm.', 'error');
    return;
  }
  wsSend({ type: 'group_add_member', groupId, usernames: selected });
  closeGroupActionModal();
}

function transferGroupOwner() {
  const gid = state.currentConvId?.replace('group:', '');
  const g = state.groups.get(gid);
  if (!g) return;
  const others = (g.members || []).filter(u => u !== state.username);
  if (others.length === 0) {
    openGroupActionModal(
      'Chuyển quyền trưởng nhóm',
      `<div class="rp-empty">Nhóm chưa có thành viên nào khác để nhượng quyền.</div>`,
      `<button class="btn-cancel" onclick="closeGroupActionModal()">Đóng</button>`
    );
    return;
  }

  const itemsHtml = others.map((u, idx) => `
    <label class="group-member-row" style="cursor:pointer">
      <input type="radio" name="transfer-owner-candidate" value="${escHtml(u)}" ${idx === 0 ? 'checked' : ''} style="accent-color:#0866d6;width:16px;height:16px">
      <div class="conv-avatar" style="width:36px;height:36px;font-size:13px;overflow:hidden">${userAvatarInner(u)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;color:#172033">${escHtml(u)}</div>
        <div style="font-size:11px;color:#8893a4">${escHtml(formatPresenceStatus(u))}</div>
      </div>
    </label>
  `).join('');

  openGroupActionModal(
    'Chuyển quyền trưởng nhóm',
    `<p style="font-size:13px;color:#536176;margin-bottom:10px">Chọn một thành viên trong nhóm để nhận quyền Trưởng nhóm:</p>
     <div style="max-height:280px;overflow-y:auto;border:1.5px solid var(--gray-mid);border-radius:8px;padding:4px">${itemsHtml}</div>`,
    `<button class="btn-cancel" onclick="closeGroupActionModal()">Hủy</button>
     <button class="btn-primary" onclick="confirmTransferGroupOwnerStep('${escHtml(gid)}')">Tiếp tục</button>`
  );
}

function confirmTransferGroupOwnerStep(groupId) {
  const radio = document.querySelector('input[name="transfer-owner-candidate"]:checked');
  const targetUser = radio?.value;
  if (!targetUser) {
    showToast('Vui lòng chọn một thành viên.', 'error');
    return;
  }
  const g = state.groups.get(groupId);
  // Bước xác nhận thêm 1 lần nữa ngay trên giao diện modal
  openGroupActionModal(
    'Xác nhận nhượng quyền trưởng nhóm',
    `<div style="text-align:center;padding:12px 4px">
       <div class="conv-avatar" style="width:56px;height:56px;margin:0 auto 12px;font-size:20px;overflow:hidden">${userAvatarInner(targetUser)}</div>
       <p style="font-size:14px;line-height:1.55;color:#172033">Bạn có chắc chắn muốn nhượng quyền <b>Trưởng nhóm "${escHtml(g?.name || '')}"</b> cho <b>${escHtml(targetUser)}</b> không?</p>
       <p style="font-size:12px;color:#8893a4;margin-top:6px">Sau khi xác nhận, bạn sẽ trở thành thành viên thường của nhóm.</p>
     </div>`,
    `<button class="btn-cancel" onclick="transferGroupOwner()">Quay lại</button>
     <button class="btn-primary" onclick="executeTransferGroupOwner('${escHtml(groupId)}','${escHtml(targetUser)}')">Xác nhận nhượng quyền</button>`
  );
}

function executeTransferGroupOwner(groupId, targetUser) {
  wsSend({ type: 'group_transfer_owner', groupId, username: targetUser });
  closeGroupActionModal();
}

function openGroupEditInfoModal() {
  const gid = state.currentConvId?.replace('group:', '');
  const g = state.groups.get(gid);
  if (!g) return;
  const avPreview = groupAvatarInner(gid, g.name);
  openGroupActionModal(
    'Đổi tên & Ảnh đại diện nhóm',
    `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:6px 0 14px">
       <div id="group-edit-avatar-preview" class="conv-avatar group" style="width:76px;height:76px;font-size:26px;overflow:hidden">${avPreview}</div>
       <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
         <label class="gm-btn" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
           <span>Chọn ảnh đại diện mới</span>
           <input type="file" accept="image/*" hidden onchange="uploadGroupAvatarFile('${escHtml(gid)}', this.files[0])">
         </label>
         ${g.avatarPath ? `<button type="button" class="gm-btn danger" onclick="clearGroupAvatar('${escHtml(gid)}')">Xóa ảnh nhóm</button>` : ''}
       </div>
     </div>
     <label class="modal-label">Tên nhóm</label>
     <input id="group-edit-name-input" class="modal-input" type="text" value="${escHtml(g.name || '')}" placeholder="Nhập tên nhóm mới...">`,
    `<button class="btn-cancel" onclick="closeGroupActionModal()">Hủy</button>
     <button class="btn-primary" onclick="submitGroupRename('${escHtml(gid)}')">Lưu thay đổi</button>`
  );
}

async function uploadGroupAvatarFile(groupId, file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Vui lòng chọn tệp ảnh.', 'error'); return; }
  const fd = new FormData();
  fd.append('file', file);
  fd.append('uploader', state.username);
  fd.append('target', 'group');
  fd.append('groupId', groupId);
  try {
    const r = await fetch('/api/files/avatar', { method: 'POST', body: fd });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Tải ảnh nhóm thất bại');
    const prev = $('group-edit-avatar-preview');
    if (prev) prev.innerHTML = `<img src="${escHtml(data.avatarUrl)}" alt="Ảnh nhóm">`;
    wsSend({ type: 'group_update_info', groupId, avatarPath: data.avatarUrl });
    showToast('Đã cập nhật ảnh đại diện nhóm!', 'success');
  } catch (e) {
    showToast(e.message || 'Lỗi tải ảnh nhóm', 'error');
  }
}

function clearGroupAvatar(groupId) {
  if (!confirm('Xóa ảnh đại diện hiện tại của nhóm?')) return;
  wsSend({ type: 'group_update_info', groupId, avatarPath: '__CLEAR__' });
  closeGroupActionModal();
}

function submitGroupRename(groupId) {
  const inp = $('group-edit-name-input');
  const newName = inp ? inp.value.trim() : '';
  if (!newName) {
    showToast('Tên nhóm không được để trống.', 'error');
    return;
  }
  const g = state.groups.get(groupId);
  if (g && newName !== g.name) {
    wsSend({ type: 'group_update_info', groupId, name: newName });
  }
  closeGroupActionModal();
}

function leaveGroup(){if(!confirm('Bạn muốn rời nhóm?'))return;wsSend({type:'group_leave',groupId:state.currentConvId.replace('group:','')});closeConversationOptions();}
function deleteGroup(){if(!confirm('Giải tán nhóm? Tất cả thành viên sẽ không thể tiếp tục trò chuyện.'))return;wsSend({type:'group_delete',groupId:state.currentConvId.replace('group:','')});closeConversationOptions();}

function openProfilePage(username=state.username){
  state.profileTarget=username;
  $('profile-page-title').textContent='Trang cá nhân · '+username;
  wsSend({type:'user_profile',username});
  $('profile-page-content').innerHTML='<div class="rp-empty">Đang tải trang cá nhân...</div>';
  $('profile-modal-overlay').classList.add('visible');
  wsSend({type:'get_posts',username});
}
function closeProfilePage(){$('profile-modal-overlay')?.classList.remove('visible');}
function renderProfilePage(msg){
  const p=msg.profile||{username:msg.username,bio:''};const posts=msg.posts||[];const own=msg.username===state.username;
  if (msg.username) {
    if (p.lastSeen) state.lastSeenMap.set(msg.username, p.lastSeen);
    state.userProfiles.set(msg.username, { ...p, username: msg.username });
    state.profileRequests.delete(msg.username);
  }
  if (state.currentConvId) renderMessages();
  state.currentProfileBio=p.bio||'';
  if(own && dom.userAvatarBtn) dom.userAvatarBtn.innerHTML=p.avatarPath?`<img src="${escHtml(p.avatarPath)}" alt="Ảnh đại diện">`:getInitials(msg.username);
  const avatar=p.avatarPath?`<img class="profile-page-avatar" src="${escHtml(p.avatarPath)}">`:`<div class="profile-page-avatar" style="display:flex;align-items:center;justify-content:center;font-size:32px">${getInitials(msg.username)}</div>`;
  const isOnline = own || state.onlineUsers.includes(msg.username);
  const statusStr = own ? '● Đang hoạt động' : formatPresenceStatus(msg.username, isOnline);
  let html=`<div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 0">${p.coverPath?`<img src="${escHtml(p.coverPath)}" style="width:100%;height:140px;object-fit:cover;border-radius:12px">`:''}${avatar}<h3>${escHtml(msg.username)}</h3><div style="font-size:12px;color:${isOnline?'#2ecc71':'#8893a4'};font-weight:600">${escHtml(statusStr)}</div><p>${escHtml(p.bio||'Chưa có tiểu sử')}</p>`;
  if(own) {
    html+=`<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
      <button class="btn-primary" onclick="editProfileBio()">Chỉnh sửa tiểu sử</button>
      <label class="btn-cancel" style="cursor:pointer;padding:9px 14px;border-radius:8px">Đổi ảnh đại diện<input type="file" accept="image/*" hidden onchange="uploadProfileAvatar(this.files[0])"></label>
      ${p.avatarPath ? `<button class="btn-cancel" style="padding:9px 12px;border-radius:8px;color:#d93025" onclick="clearProfileAvatar()">Xóa ảnh đại diện</button>` : ''}
      <label class="btn-cancel" style="cursor:pointer;padding:9px 14px;border-radius:8px">Đổi ảnh bìa<input type="file" accept="image/*" hidden onchange="uploadProfileCover(this.files[0])"></label>
      ${p.coverPath ? `<button class="btn-cancel" style="padding:9px 12px;border-radius:8px;color:#d93025" onclick="clearProfileCover()">Xóa ảnh bìa</button>` : ''}
    </div>`;
  } else {
    const { rel, requestId } = getRelationshipWith(msg.username);
    const reqId = requestId || state.viewedProfile?.requestId || '';
    let relButton = rel==='friend'
      ? `<button class="btn-friend btn-unfriend" onclick="confirmUnfriend('${escHtml(msg.username)}')">Hủy kết bạn</button>`
      : rel==='pending_sent'
        ? `<button class="btn-friend btn-cancel-req" onclick="cancelFriendRequest('${escHtml(reqId)}','${escHtml(msg.username)}')">Hủy lời mời</button>`
        : rel==='pending_received'
          ? `<button class="btn-friend btn-accept-req" onclick="acceptFriendRequest('${escHtml(reqId)}','${escHtml(msg.username)}')">Chấp nhận lời mời</button>`
          : `<button class="btn-friend btn-add-friend" onclick="sendFriendRequest('${escHtml(msg.username)}')">+ Kết bạn</button>`;
    html+=`<div style="display:flex;gap:8px;flex-wrap:wrap">${relButton}<button class="btn-primary" onclick="startChat('${escHtml(msg.username)}');closeProfilePage()">Nhắn tin</button><button class="btn-cancel" onclick="toggleBlockUser('${escHtml(msg.username)}',${state.blockedUsers.has(msg.username)})">${state.blockedUsers.has(msg.username)?'Gỡ chặn':'Chặn'}</button></div>`;
  }
  html+='</div>';
  if(own)html+=`<div class="profile-post-compose"><textarea id="new-post-content" placeholder="Bạn đang nghĩ gì?"></textarea><button class="btn-primary" style="margin-top:8px" onclick="createProfilePost()">Đăng bài viết</button></div>`;
  html+='<h3 style="margin:18px 0 4px">Bài viết</h3>';
  if(!posts.length)html+='<div class="rp-empty">Chưa có bài viết nào.</div>';
  posts.forEach(post=>{html+=`<div class="profile-post"><div style="font-weight:700">${escHtml(post.username)}</div><div style="font-size:11px;color:#8992a3">${formatTime(post.timestamp)}</div><p style="white-space:pre-wrap">${escHtml(post.content)}</p></div>`;});
  $('profile-page-content').innerHTML=html;
}
function renderProfileRelationshipActions(){
  if(state.profileTarget && state.lastPostsPayload?.username === state.profileTarget) {
    renderProfilePage(state.lastPostsPayload);
  } else if (state.profileTarget) {
    wsSend({type:'get_posts',username:state.profileTarget});
  }
}
async function uploadProfileCover(file){
  if(!file)return;
  if(!file.type.startsWith('image/')){showToast('Vui lòng chọn tệp ảnh.','error');return;}
  const fd=new FormData();
  fd.append('file',file);
  fd.append('uploader',state.username);
  fd.append('target','cover');
  try{
    const r=await fetch('/api/files/avatar',{method:'POST',body:fd});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Upload ảnh bìa thất bại');
    const coverPath = d.coverUrl || d.avatarUrl;
    state.userProfiles.set(state.username,{...(state.userProfiles.get(state.username)||{}),username:state.username,coverPath});
    wsSend({type:'get_posts',username:state.username});
    showToast('Đã cập nhật ảnh bìa!','success');
  }catch(e){showToast(e.message,'error');}
}
function clearProfileAvatar(){
  if(!confirm('Xóa ảnh đại diện hiện tại và quay về mặc định?'))return;
  wsSend({type:'profile_update',avatarPath:'__CLEAR__'});
}
function clearProfileCover(){
  if(!confirm('Xóa ảnh bìa hiện tại?'))return;
  wsSend({type:'profile_update',coverPath:'__CLEAR__'});
}
function editProfileBio(){const bio=prompt('Nhập tiểu sử:',state.currentProfileBio||'');if(bio!==null)wsSend({type:'profile_update',bio});}
function createProfilePost(){const el=$('new-post-content');if(!el||!el.value.trim())return;wsSend({type:'create_post',content:el.value.trim()});el.value='';}
async function uploadProfileAvatar(file){
  if(!file)return;if(!file.type.startsWith('image/')){showToast('Vui lòng chọn tệp ảnh.','error');return;}
  const fd=new FormData();fd.append('file',file);fd.append('uploader',state.username);fd.append('target','avatar');
  try{const r=await fetch('/api/files/avatar',{method:'POST',body:fd});const data=await r.json();if(!r.ok)throw new Error(data.error||'Upload thất bại');const avatarPath=data.avatarUrl;state.userProfiles.set(state.username,{...(state.userProfiles.get(state.username)||{}),username:state.username,avatarPath});if(dom.userAvatarBtn)dom.userAvatarBtn.innerHTML=`<img src="${escHtml(avatarPath)}" alt="Ảnh đại diện">`;if(state.currentConvId)renderMessages();wsSend({type:'get_posts',username:state.username});showToast('Đã cập nhật ảnh đại diện!','success');}
  catch(e){showToast(e.message,'error');}
}

function openImageViewer(url, filename = '') {
  const overlay = $('image-viewer');
  const img = $('image-viewer-img');
  const cap = $('image-viewer-caption');
  if (!overlay || !img) return;
  img.src = url;
  const dl = $('image-viewer-download');
  if (dl) { dl.href = url; dl.download = filename || 'image'; }
  if (cap) cap.textContent = '';
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}
function closeImageViewer() {
  $('image-viewer')?.classList.remove('visible');
  const img = $('image-viewer-img');
  if (img) img.src = '';
  document.body.style.overflow = '';
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const icons = { info: UI_ICONS.info, success: UI_ICONS.checkCircle, error: UI_ICONS.xCircle };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]||UI_ICONS.info}</span><span class="toast-text">${escHtml(message)}</span>`;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => { toast.style.opacity='0'; toast.style.transition='opacity .3s'; setTimeout(()=>toast.remove(),300); }, 3500);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

function getInitials(name) {
  if (!name) return '?';
  const clean = name.replace(/[^\p{L}\p{N}]/gu, '');
  return clean ? clean[0].toUpperCase() : '?';
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('vi', { day: '2-digit', month: '2-digit' });
}

function getDayLabel(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Hôm nay';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return d.toLocaleDateString('vi', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function scrollToBottom() {
  dom.messages.scrollTop = dom.messages.scrollHeight;
}

function userAvatarInner(username) {
  if (!username) return '?';
  requestUserProfile(username);
  const p = state.userProfiles.get(username);
  return p?.avatarPath ? `<img src="${escHtml(p.avatarPath)}" alt="Ảnh đại diện ${escHtml(username)}">` : getInitials(username);
}

// Biểu tượng tệp theo đuôi file: trang giấy gập góc, có màu và chữ đại diện (X, W, P, PDF...)
function fileTypeIcon(mime, filename) {
  mime = mime || '';
  const ext = ((filename || '').split('.').pop() || '').toLowerCase();
  const groups = [
    [['pdf'], '#e5484d', 'PDF'],
    [['doc','docx','dot','dotx','rtf','odt'], '#2b6be6', 'W'],
    [['xls','xlsx','xlsm','csv','ods'], '#1f9d55', 'X'],
    [['ppt','pptx','pps','odp'], '#e8702a', 'P'],
    [['zip','rar','7z','tar','gz'], '#e0a31a', 'ZIP'],
    [['txt','md','log'], '#7b8799', 'TXT'],
    [['js','ts','py','java','c','cpp','cs','go','rs','php','html','css','json','xml','sql','sh','jsx','tsx'], '#6e56cf', '</>'],
  ];
  let color = '#5b6b82', label = (ext && ext.length <= 4 && /^[a-z0-9]+$/.test(ext)) ? ext.toUpperCase() : 'FILE';
  let found = false;
  for (const [exts, c, l] of groups) if (exts.includes(ext)) { color = c; label = l; found = true; break; }
  if (!found) {
    if (mime.includes('pdf')) { color = '#e5484d'; label = 'PDF'; }
    else if (mime.includes('word')) { color = '#2b6be6'; label = 'W'; }
    else if (mime.includes('excel') || mime.includes('spreadsheet')) { color = '#1f9d55'; label = 'X'; }
    else if (mime.includes('powerpoint') || mime.includes('presentation')) { color = '#e8702a'; label = 'P'; }
    else if (mime.includes('zip') || mime.includes('rar')) { color = '#e0a31a'; label = 'ZIP'; }
  }
  const fs = label.length <= 1 ? 26 : label.length <= 3 ? 14 : 11;
  return `<svg class="ftype" viewBox="0 0 44 52" aria-hidden="true"><path d="M6 0H28L42 14V48A4 4 0 0 1 38 52H6A4 4 0 0 1 2 48V4A4 4 0 0 1 6 0Z" fill="${color}"/><path d="M28 0L42 14H32A4 4 0 0 1 28 10Z" fill="#fff" fill-opacity=".55"/><text x="22" y="38" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-weight="700" font-size="${fs}" fill="#fff">${escHtml(label)}</text></svg>`;
}

function getFileIcon(mime, filename) {
  return fileTypeIcon(mime, filename);
}

function autoResize(el) {
  el.style.height = '';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// ─── Event listeners ──────────────────────────────────────────────────────────
dom.loginBtn?.addEventListener('click', login);
dom.registerBtn?.addEventListener('click', registerAccount);
dom.toggleAuthBtn?.addEventListener('click', toggleAuthMode);
dom.usernameInput?.addEventListener('keydown', e => e.key === 'Enter' && dom.passwordInput.focus());
dom.passwordInput?.addEventListener('keydown', e => e.key === 'Enter' && login());

dom.sendBtn?.addEventListener('click', sendMessage);
dom.messageInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
dom.messageInput?.addEventListener('input', () => { autoResize(dom.messageInput); handleTypingInput(); });

dom.attachBtn?.addEventListener('click', () => dom.fileInput.click());
dom.fileInput?.addEventListener('change', e => { const f = e.target.files[0]; if (f) sendFile(f); });

// Chỉ lọc danh sách đoạn chat/bạn bè hiện có, KHÔNG tìm người lạ chưa kết bạn ở thanh tìm kiếm đoạn chat
dom.searchInput?.addEventListener('input', () => {
  renderConversationList();
});

dom.emojiSearch?.addEventListener('input', e => {
  const q = e.target.value.trim();
  renderEmojiGrid(q);
});

dom.msgSearchInput?.addEventListener('input', e => {
  clearTimeout(state.msgSearchTimer);
  state.msgSearchTimer = setTimeout(() => performMsgSearch(e.target.value, true), 200);
});
dom.msgSearchInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    stepMsgSearch(e.shiftKey ? -1 : 1);
  }
});

dom.phoneSearchInput?.addEventListener('keydown', e => { if (e.key === 'Enter') searchByPhone(); });

// Close emoji picker & avatar popover when clicking outside
document.addEventListener('click', e => {
  if (!dom.emojiPicker.contains(e.target) && e.target !== $('emoji-btn') && !$('emoji-btn').contains(e.target)) {
    closeEmojiPicker();
  }
  if (!e.target.closest('.avatar-action-popover') && !e.target.closest('.clickable-av')) {
    closeAvatarActionMenu();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelector('.reaction-people-overlay')?.remove();
    document.querySelector('.forward-overlay')?.remove();
    closeAvatarActionMenu();
    closeGroupModal();
    closeGroupActionModal();
    closeImageViewer();
    closeAddFriendModal();
    closeFriendReqModal();
    closeProfilePage();
    closeConversationOptions();
    closeEmojiPicker();
    if (state.msgSearchActive) closeMsgSearch();
  }
});

// Modal backdrop close
$('group-modal-overlay')?.addEventListener('click', e => { if (e.target === $('group-modal-overlay')) closeGroupModal(); });
$('group-action-modal-overlay')?.addEventListener('click', e => { if (e.target === $('group-action-modal-overlay')) closeGroupActionModal(); });
$('add-friend-modal-overlay')?.addEventListener('click', e => { if (e.target === $('add-friend-modal-overlay')) closeAddFriendModal(); });
$('freq-modal-overlay')?.addEventListener('click', e => { if (e.target === $('freq-modal-overlay')) closeFriendReqModal(); });

function closeFriendReqModal() { $('freq-modal-overlay')?.classList.remove('visible'); }

// ─── Global expose ────────────────────────────────────────────────────────────
Object.assign(window, {
  markFileDownloaded, saveFileWithLocation,
  selectConversation, switchTab, openGroupModal, closeGroupModal, submitCreateGroup,
  logout, openImageViewer, closeImageViewer, showPanel,
  toggleRightPanel, closeRightPanel, switchRpTab,
  toggleMsgSearch, closeMsgSearch, stepMsgSearch,
  openAddFriendModal, closeAddFriendModal, searchByPhone,
  sendFriendRequest, acceptFriendRequest, rejectFriendRequest, cancelFriendRequest,
  unfriend, confirmUnfriend, startChat,
  closeFriendReqModal,
  toggleAudioPlay, seekAudio,
  toggleRecording, stopAndSendRecording, cancelRecording,
  toggleEmojiPicker, closeEmojiPicker,
  reactToMessage,revokeMessage,hideMessageForMe,showReactionPeople,replyToMessage,forwardMessage,filterForwardTargets,sendForwardedMessage,openConversationOptions,closeConversationOptions,
  openProfilePage,closeProfilePage,editProfileBio,createProfilePost,uploadProfileAvatar,uploadProfileCover,clearProfileAvatar,clearProfileCover,openFriendReqModal,
  toggleBlockUser,showGroupMembers,addGroupMember,filterGroupAddCandidates,submitAddGroupMembers,transferGroupOwner,confirmTransferGroupOwnerStep,executeTransferGroupOwner,leaveGroup,deleteGroup,
  openGroupEditInfoModal,uploadGroupAvatarFile,clearGroupAvatar,submitGroupRename,closeGroupActionModal,
  openAvatarActionMenu,closeAvatarActionMenu,kickGroupMember,kickGroupMemberFromModal,
  deleteConversation,toggleMuteConversation,
});
