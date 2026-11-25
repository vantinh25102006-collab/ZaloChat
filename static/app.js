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
  contactsSubView: 'friends', // 'friends' | 'groups' | 'requests'
  contactsSearch: '',
  contactsSort: 'az',
  rpCollapsed: new Set(),
  rpShowAll: {},
  sidebarSearchActive: false,
  topSearchPhoneQuery: '',
  topSearchPhonePending: false,
  topSearchPhoneResults: null,
  topSearchTimer: null,
  recentSearches: JSON.parse(localStorage.getItem('zchat_recent_searches') || '[]'),
  recentPhoneSearches: JSON.parse(localStorage.getItem('zchat_recent_phone_searches') || '[]'),
  rightPanelView: 'info', // 'info' | 'members'
  profileEditMode: false,
  resumingSession: false,
  pendingRestoreConvId: null,
  multiSelectMode: false,
  selectedMsgIds: new Set(),
  activeMsgMenuId: null,
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
  keyGold: '<svg viewBox="0 0 24 24"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2"/><path d="M17 6l3 3"/><path d="M14 9l2.5 2.5"/></svg>',
  quote: '<svg class="solid-fill" viewBox="0 0 24 24"><path d="M10 7H6C4.9 7 4 7.9 4 9v4c0 1.1.9 2 2 2h2v2c0 .6-.4 1-1 1H6c-.6 0-1 .4-1 1s.4 1 1 1h1c1.7 0 3-1.3 3-3V9c0-1.1-.9-2-2-2zm9 0h-4c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h2v2c0 .6-.4 1-1 1h-1c-.6 0-1 .4-1 1s.4 1 1 1h1c1.7 0 3-1.3 3-3V9c0-1.1-.9-2-2-2z"/></svg>',
  forward: '<svg class="solid-fill" viewBox="0 0 24 24"><path d="M14 8V4l8 7-8 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>',
  dotsH: '<svg class="solid-fill" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2.1"/><circle cx="12" cy="12" r="2.1"/><circle cx="19" cy="12" r="2.1"/></svg>',
  thumbUp: '<svg viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  checkList: '<svg viewBox="0 0 24 24"><polyline points="3 7 5 9 8 5"/><line x1="12" y1="7" x2="21" y2="7"/><polyline points="3 14 5 16 8 12"/><line x1="12" y1="14" x2="21" y2="14"/><line x1="3" y1="20" x2="21" y2="20"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>',
};

const OWNER_KEY_BADGE_HTML = `<span class="owner-key-badge" title="Trưởng nhóm">${UI_ICONS.keyGold}</span>`;

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

// ─── WebSocket & Persistent Session ───────────────────────────────────────────
const SESSION_TOKEN_KEY = 'zchat_session_token';
const SESSION_USER_KEY = 'zchat_session_user';
const ACTIVE_CONV_KEY = 'zchat_active_conv';

function getStoredSessionToken() {
  try { return localStorage.getItem(SESSION_TOKEN_KEY) || ''; } catch (_) { return ''; }
}
function getStoredSessionUser() {
  try { return localStorage.getItem(SESSION_USER_KEY) || ''; } catch (_) { return ''; }
}
function saveStoredSession(username, token) {
  try {
    if (username) localStorage.setItem(SESSION_USER_KEY, username);
    if (token) localStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch (_) {}
}
function clearStoredSession() {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(ACTIVE_CONV_KEY);
  } catch (_) {}
}
function saveActiveConv(username, convId) {
  try {
    if (username && convId) localStorage.setItem(ACTIVE_CONV_KEY, JSON.stringify({ username, convId }));
  } catch (_) {}
}
function getSavedActiveConv(username) {
  try {
    const raw = JSON.parse(localStorage.getItem(ACTIVE_CONV_KEY) || 'null');
    if (raw && raw.username === username && raw.convId) return raw.convId;
  } catch (_) {}
  return null;
}

function connectWebSocket() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  state.ws = new WebSocket(`${proto}://${location.host}/ws`);

  state.ws.onopen = () => {
    state.reconnectCount = 0;
    const savedToken = getStoredSessionToken();
    if (savedToken && (state.resumingSession || state.username)) {
      wsSend({ type: 'resume_session', sessionToken: savedToken });
    }
  };

  state.ws.onmessage = e => {
    try { handleServerMessage(JSON.parse(e.data)); }
    catch(err) { console.error('Bad WS JSON:', err); }
  };

  state.ws.onclose = () => {
    if (state.intentionalLogout) {
      doLocalLogout();
      return;
    }
    if ((state.username || state.resumingSession) && state.reconnectCount < 5) {
      state.reconnectCount++;
      if (!state.resumingSession) showToast(`Mất kết nối. Đang thử lại (${state.reconnectCount}/5)...`, 'error');
      setTimeout(connectWebSocket, 1500);
    } else if (state.resumingSession) {
      state.resumingSession = false;
      document.documentElement.classList.remove('zchat-resuming');
      if (dom.loginError) dom.loginError.textContent = 'Không thể kết nối lại tới server.';
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
    case 'message_pinned':       onMessagePinned(msg);         break;
    case 'message_starred':      onMessageStarred(msg);        break;
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
    const wasSilentResume = Boolean(state.resumingSession || state.username);
    state.resumingSession = false;
    document.documentElement.classList.remove('zchat-resuming');
    state.username = msg.username || getStoredSessionUser() || dom.usernameInput.value.trim();
    if (msg.sessionToken) saveStoredSession(state.username, msg.sessionToken);
    if (!state.currentConvId) state.pendingRestoreConvId = getSavedActiveConv(state.username);
    dom.loginScreen.style.display = 'none';
    dom.chatScreen.classList.add('visible');
    dom.userAvatarBtn.textContent = state.username[0].toUpperCase();
    requestUserProfile(state.username, true);
    if (!wasSilentResume) showToast(msg.content || 'Đăng nhập thành công!', 'success');
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
    const wasResuming = state.resumingSession;
    state.resumingSession = false;
    document.documentElement.classList.remove('zchat-resuming');
    if (wasResuming) clearStoredSession();
    dom.chatScreen.classList.remove('visible');
    dom.loginScreen.style.display = 'flex';
    if (dom.loginError) dom.loginError.textContent = msg.content || 'Đăng nhập thất bại.';
    dom.loginBtn.disabled = false;
    dom.loginBtn.textContent = 'Đăng nhập';
    if (state.ws) state.ws.close();
  }
}

function bootSessionRestore() {
  const token = getStoredSessionToken();
  if (!token) {
    document.documentElement.classList.remove('zchat-resuming');
    return;
  }
  state.resumingSession = true;
  document.documentElement.classList.add('zchat-resuming');
  const savedUser = getStoredSessionUser();
  if (savedUser && $('session-restore-text')) {
    $('session-restore-text').textContent = `Đang khôi phục phiên đăng nhập (${savedUser})...`;
  }
  connectWebSocket();
}

function cancelSessionRestore() {
  state.resumingSession = false;
  clearStoredSession();
  document.documentElement.classList.remove('zchat-resuming');
  try { state.ws?.close(1000, 'Cancelled restore'); } catch (_) {}
  state.ws = null;
}

function logout() {
  if (!state.username) return;
  if (confirm('Bạn có muốn đăng xuất?')) {
    const token = getStoredSessionToken();
    clearStoredSession();
    state.intentionalLogout = true;
    const socket = state.ws;
    if (socket?.readyState === WebSocket.OPEN) {
      wsSend({ type: 'disconnect', sessionToken: token });
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
  state.pendingRestoreConvId = null;
  state.resumingSession = false;
  state.ws = null;
  state.conversations.clear();
  state.friends = [];
  state.pendingRequests = [];
  state.groups.clear();
  state.intentionalLogout = false;
  clearStoredSession();
  document.documentElement.classList.remove('zchat-resuming');
  closeMessageMenu?.();
  exitMultiSelectMode?.();
  dom.chatScreen.classList.remove('visible');
  dom.loginScreen.style.display = 'flex';
  dom.passwordInput.value = '';
  dom.loginBtn.disabled = false;
  dom.loginBtn.textContent = 'Đăng nhập';
  showToast('Bạn đã đăng xuất.', 'success');
}

// ─── Panel switching ──────────────────────────────────────────────────────────
function closeMobileChat() {
  dom.chatScreen?.classList.remove('mobile-chat-open');
}

function showPanel(panelName) {
  dom.chatScreen?.classList.remove('mobile-chat-open');
  const isContacts = panelName === 'contacts';
  state.currentPanel = isContacts ? 'contacts' : 'chats';
  document.querySelectorAll('.sidebar-nav-btn').forEach(b => b.classList.remove('active'));
  $(isContacts ? 'nav-contacts' : 'nav-chats')?.classList.add('active');
  if (dom.panelTitle) dom.panelTitle.style.display = 'none';
  $('create-group-btn').style.display = 'flex';
  $('add-friend-btn').style.display = 'flex';

  const tabsEl = $('conv-tabs');
  const cnavEl = $('contacts-nav-list');
  const cMainEl = $('contacts-main-view');
  if (tabsEl) tabsEl.style.display = isContacts ? 'none' : 'flex';
  if (dom.convList) dom.convList.style.display = isContacts ? 'none' : '';
  if (cnavEl) cnavEl.style.display = isContacts ? 'flex' : 'none';
  if (cMainEl) cMainEl.style.display = isContacts ? 'flex' : 'none';

  if (isContacts) {
    dom.emptyState.style.display = 'none';
    dom.chatArea.style.display = 'none';
    if (dom.rightPanel) dom.rightPanel.classList.remove('open');
    state.rightPanelOpen = false;
    $('shared-files-btn')?.classList.remove('active-panel');
    switchContactsSubView(state.contactsSubView || 'friends');
  } else {
    dom.tabMessages.style.display = '';
    if ($('tab-unread')) $('tab-unread').style.display = '';
    dom.tabContacts.style.display = 'none';
    dom.tabGroups.style.display = 'none';
    dom.tabRequests.style.display = 'none';
    if (state.currentConvId && state.conversations.has(state.currentConvId)) {
      dom.emptyState.style.display = 'none';
      dom.chatArea.style.display = 'flex';
    } else {
      dom.emptyState.style.display = 'flex';
      dom.chatArea.style.display = 'none';
    }
    switchTab(state.activeTab === 'unread' ? 'unread' : 'messages');
  }
}

function switchContactsSubView(subView) {
  state.contactsSubView = subView || 'friends';
  state.contactsSearch = '';
  ['friends', 'groups', 'requests'].forEach(k => {
    $(`cnav-${k}`)?.classList.toggle('active', k === state.contactsSubView);
  });
  if (window.innerWidth <= 640) {
    dom.chatScreen?.classList.add('mobile-chat-open');
  }
  renderContactsMainView();
}

function setContactsSearch(val) {
  state.contactsSearch = val || '';
  renderContactsMainBody();
}

function setContactsSort(val) {
  state.contactsSort = val || 'az';
  renderContactsMainBody();
}

function renderContactsMainView() {
  if (state.currentPanel !== 'contacts') return;
  const sub = state.contactsSubView || 'friends';
  const titles = {
    friends: ['Danh sách bạn bè', UI_ICONS.user],
    groups: ['Danh sách nhóm và cộng đồng', UI_ICONS.users],
    requests: ['Lời mời kết bạn', UI_ICONS.userPlus],
  };
  const [title, ico] = titles[sub] || titles.friends;
  if ($('contacts-main-title')) $('contacts-main-title').textContent = title;
  if ($('contacts-main-ico')) $('contacts-main-ico').innerHTML = ico;
  renderContactsMainBody(true);
}

function renderContactsMainBody(rebuildChrome = false) {
  const container = $('contacts-main-body');
  if (!container) return;
  const sub = state.contactsSubView || 'friends';
  const q = (state.contactsSearch || '').trim().toLowerCase();

  if (sub === 'friends') {
    let friends = state.friends.filter(f => !q || f.username.toLowerCase().includes(q));
    friends.sort((a, b) => state.contactsSort === 'za'
      ? b.username.localeCompare(a.username)
      : a.username.localeCompare(b.username));

    const groupsByLetter = new Map();
    for (const f of friends) {
      const letter = getInitials(f.username);
      if (!groupsByLetter.has(letter)) groupsByLetter.set(letter, []);
      groupsByLetter.get(letter).push(f);
    }

    let rowsHtml = '';
    if (friends.length === 0) {
      rowsHtml = `<div class="contacts-empty-box"><div class="contacts-empty-ico">${UI_ICONS.user}</div><div>${q ? 'Không tìm thấy bạn bè phù hợp' : 'Bạn chưa có bạn bè nào'}</div></div>`;
    } else {
      for (const [letter, list] of groupsByLetter.entries()) {
        rowsHtml += `<div class="contacts-alpha-hdr">${escHtml(letter)}</div>`;
        for (const f of list) {
          const online = Boolean(f.online || state.onlineUsers.includes(f.username));
          rowsHtml += `
            <div class="contacts-row" onclick="startChat('${escHtml(f.username)}')">
              <div class="conv-avatar" style="width:42px;height:42px;font-size:15px">${userAvatarInner(f.username)}${online ? '<span class="online-dot"></span>' : ''}</div>
              <div class="contacts-row-info">
                <div class="contacts-row-name">${escHtml(f.username)}</div>
                <div class="contacts-row-sub" style="color:${online ? '#1f9d55' : '#758398'}">${escHtml(formatPresenceStatus(f.username, online))}</div>
              </div>
              <div class="contacts-row-actions" onclick="event.stopPropagation()">
                <button type="button" class="gm-btn" onclick="openProfilePage('${escHtml(f.username)}')">Hồ sơ</button>
                <button type="button" class="gm-btn danger" onclick="confirmUnfriend('${escHtml(f.username)}')">Hủy kết bạn</button>
              </div>
            </div>`;
        }
      }
    }

    if (rebuildChrome || !$('contacts-list-wrap')) {
      container.innerHTML = `
        <div class="contacts-count-lbl">Bạn bè (${state.friends.length})</div>
        <div class="contacts-card">
          <div class="contacts-toolbar">
            <div class="contacts-search-in">${UI_ICONS.search}<input type="text" value="${escHtml(state.contactsSearch)}" placeholder="Tìm bạn" oninput="setContactsSearch(this.value)"></div>
            <select class="contacts-sort-sel" onchange="setContactsSort(this.value)">
              <option value="az"${state.contactsSort==='az'?' selected':''}>Tên (A-Z)</option>
              <option value="za"${state.contactsSort==='za'?' selected':''}>Tên (Z-A)</option>
            </select>
          </div>
          <div id="contacts-list-wrap">${rowsHtml}</div>
        </div>`;
    } else {
      $('contacts-list-wrap').innerHTML = rowsHtml;
    }
    return;
  }

  if (sub === 'groups') {
    const allGroups = [...state.groups.values()];
    let list = allGroups.filter(g => !q || (g.name || '').toLowerCase().includes(q));
    list.sort((a, b) => state.contactsSort === 'za'
      ? (b.name || '').localeCompare(a.name || '')
      : (a.name || '').localeCompare(b.name || ''));

    const rowsHtml = list.length === 0
      ? `<div class="contacts-empty-box"><div class="contacts-empty-ico">${UI_ICONS.users}</div><div>${q ? 'Không tìm thấy nhóm phù hợp' : 'Bạn chưa tham gia nhóm nào'}</div></div>`
      : list.map(g => {
          const isOwner = g.createdBy === state.username;
          return `
            <div class="contacts-row" onclick="selectConversation('group:${escHtml(g.id)}')">
              <div class="conv-avatar group" style="width:42px;height:42px;font-size:15px">${groupAvatarInner(g.id, g.name)}</div>
              <div class="contacts-row-info">
                <div class="contacts-row-name"><span class="conv-group-ico">${UI_ICONS.users}</span><span>${escHtml(g.name)}</span>${isOwner ? '<span class="group-owner-badge">Trưởng nhóm</span>' : ''}</div>
                <div class="contacts-row-sub">${(g.members || []).length} thành viên</div>
              </div>
              <div class="contacts-row-actions" onclick="event.stopPropagation()">
                <button type="button" class="gm-btn" onclick="selectConversation('group:${escHtml(g.id)}')">Nhắn tin</button>
              </div>
            </div>`;
        }).join('');

    if (rebuildChrome || !$('contacts-list-wrap')) {
      container.innerHTML = `
        <div class="contacts-count-lbl">Nhóm và cộng đồng (${allGroups.length})</div>
        <div class="contacts-card">
          <div class="contacts-toolbar">
            <div class="contacts-search-in">${UI_ICONS.search}<input type="text" value="${escHtml(state.contactsSearch)}" placeholder="Tìm kiếm..." oninput="setContactsSearch(this.value)"></div>
            <select class="contacts-sort-sel" onchange="setContactsSort(this.value)">
              <option value="az"${state.contactsSort==='az'?' selected':''}>Tên (A-Z)</option>
              <option value="za"${state.contactsSort==='za'?' selected':''}>Tên (Z-A)</option>
            </select>
          </div>
          <div id="contacts-list-wrap">${rowsHtml}</div>
        </div>`;
    } else {
      $('contacts-list-wrap').innerHTML = rowsHtml;
    }
    return;
  }

  // sub === 'requests'
  const reqs = state.pendingRequests || [];
  if (reqs.length === 0) {
    container.innerHTML = `
      <div class="contacts-empty-box">
        <div class="contacts-empty-ico">${UI_ICONS.userPlus}</div>
        <div style="font-size:14px;font-weight:600;color:#081c36;margin-bottom:4px">Không có lời mời kết bạn</div>
        <div style="font-size:13px;color:#758398">Các lời mời kết bạn mới sẽ hiển thị tại đây</div>
      </div>`;
  } else {
    const cards = reqs.map(req => `
      <div class="contacts-row" style="cursor:default">
        <div class="conv-avatar" style="width:44px;height:44px;font-size:16px">${userAvatarInner(req.sender)}</div>
        <div class="contacts-row-info">
          <div class="contacts-row-name">${escHtml(req.sender)}</div>
          <div class="contacts-row-sub">Đã gửi lời mời · ${formatTime(req.createdAt)}</div>
        </div>
        <div class="contacts-row-actions">
          <button class="freq-accept" onclick="acceptFriendRequest('${escHtml(req.requestId)}','${escHtml(req.sender)}')">Đồng ý</button>
          <button class="freq-reject" onclick="rejectFriendRequest('${escHtml(req.requestId)}','${escHtml(req.sender)}')">Từ chối</button>
        </div>
      </div>`).join('');
    container.innerHTML = `<div class="contacts-count-lbl">Lời mời kết bạn (${reqs.length})</div><div class="contacts-card">${cards}</div>`;
  }
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

function tryRestoreActiveConv() {
  const target = state.pendingRestoreConvId;
  if (!target || state.currentConvId) return;
  if (state.conversations.has(target)) {
    state.pendingRestoreConvId = null;
    selectConversation(target);
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
  tryRestoreActiveConv();
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
  if (state.currentPanel === 'contacts') renderContactsMainView();
  tryRestoreActiveConv();
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
    dom.chatHeaderStatus.innerHTML = `<span class="hdr-members-link" title="Xem thành viên nhóm" onclick="openRightPanelMembers()">${UI_ICONS.user}<span>${g?.members?.length || 0} thành viên</span></span>`;
    dom.chatHeaderStatus.style.color = '#52627a';
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

function computeLastMessagePreview(conv) {
  if (!conv || !conv.messages || conv.messages.length === 0) return '';
  const msgs = conv.messages;
  const last = msgs[msgs.length - 1];
  const isGroup = conv.type === 'group';
  const sender = last.from || last.username || '';
  const isSys = last.type === 'system' || last.messageType === 'system' || sender === 'SYSTEM';
  if (isSys) return last.content || '';
  const prefix = sender === state.username ? 'Bạn: ' : (isGroup && sender ? `${sender}: ` : '');

  const t = typeof last.type === 'string' ? last.type.toLowerCase() : '';
  if (t === 'revoked') {
    return isGroup ? `${prefix}đã thu hồi 1 tin nhắn.` : 'Tin nhắn đã được thu hồi';
  }
  const mime = last.mimeType || '';
  if (t === 'file_share' || last.fileId) {
    if (mime.startsWith('image/')) {
      let imgCount = 0;
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        const mSender = m.from || m.username || '';
        const mMime = m.mimeType || '';
        const mType = typeof m.type === 'string' ? m.type.toLowerCase() : '';
        if (mSender === sender && (mType === 'file_share' || m.fileId) && mMime.startsWith('image/')) {
          imgCount++;
        } else {
          break;
        }
      }
      return `${prefix}đã gửi ${Math.max(1, imgCount)} ảnh.`;
    }
    if (mime.startsWith('video/')) return `${prefix}đã gửi 1 video.`;
    if (mime.startsWith('audio/')) return `${prefix}đã gửi 1 tệp âm thanh.`;
    return `${prefix}đã gửi 1 file.`;
  }
  return `${prefix}${last.content || ''}`;
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
    starred: Boolean(item.starred),
  }));
  conv.pinnedMessage = msg.pinnedMessage || null;
  conv.lastMsg = computeLastMessagePreview(conv);
  if (state.currentConvId === msg.conversationId) {
    renderPinnedBanner();
    renderMessages();
    if (state.rightPanelOpen) renderRightPanel();
  }
  renderConversationList();
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
  if (state.currentPanel === 'contacts') renderContactsMainView();
  const current = state.conversations.get(state.currentConvId);
  if (current?.type === 'dm') updateStrangerBanner(current.name);
  tryRestoreActiveConv();
}

function onFriendRequestsList(msg) {
  state.pendingRequests = msg.pendingRequests || [];
  updateFriendReqBadge();
  renderFriendRequestModal();
  if (state.activeTab === 'requests') renderConversationList();
  if (state.currentPanel === 'contacts') renderContactsMainView();
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
  if (state.sidebarSearchActive) renderSidebarSearchResults();
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
  target.reactions = []; target.starred = false;
  if (conv.pinnedMessage?.messageId === msg.messageId) conv.pinnedMessage = null;
  if (state.currentConvId === msg.conversationId) {
    renderPinnedBanner();
    renderMessages();
    if (state.rightPanelOpen) renderRightPanel();
  }
  conv.lastMsg = computeLastMessagePreview(conv);
  renderConversationList();
}
function onMessageHidden(msg) {
  const conv=state.conversations.get(msg.conversationId);if(!conv)return;
  conv.messages=conv.messages.filter(m=>m.messageId!==msg.messageId);
  state.selectedMsgIds?.delete(msg.messageId);
  if (conv.pinnedMessage?.messageId === msg.messageId) conv.pinnedMessage = null;
  conv.lastMsg = computeLastMessagePreview(conv) || 'Chưa có tin nhắn';
  if(state.currentConvId===msg.conversationId) {
    renderPinnedBanner();
    renderMessages();
    if (state.rightPanelOpen) renderRightPanel();
  }
  renderConversationList();
}
function onMessagePinned(msg) {
  const conv = state.conversations.get(msg.conversationId);
  if (!conv) return;
  conv.pinnedMessage = msg.pinnedMessage || null;
  if (state.currentConvId === msg.conversationId) renderPinnedBanner();
  showToast(conv.pinnedMessage ? 'Đã ghim tin nhắn.' : 'Đã bỏ ghim tin nhắn.', 'success');
}
function onMessageStarred(msg) {
  const conv = state.conversations.get(msg.conversationId);
  const target = conv?.messages.find(m => m.messageId === msg.messageId);
  if (target) target.starred = Boolean(msg.starred);
  if (state.currentConvId === msg.conversationId) renderMessages();
  showToast(msg.starred ? 'Đã đánh dấu tin nhắn.' : 'Đã bỏ đánh dấu tin nhắn.', 'success');
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
  const prevOwner = existing.createdBy;
  const merged = { ...existing, ...msg };
  state.groups.set(msg.id, merged);
  const convId=`group:${msg.id}`;
  const conv=state.conversations.get(convId);
  if(conv) conv.name=merged.name;
  else ensureConversation(convId,'group',merged.name,merged.members||[]);
  if (prevOwner && merged.createdBy && prevOwner !== merged.createdBy) {
    if (merged.createdBy === state.username) {
      showToast(`Bạn đã trở thành Trưởng nhóm "${merged.name}".`, 'success');
    } else if (prevOwner === state.username) {
      showToast(`Đã nhượng quyền Trưởng nhóm cho ${merged.createdBy}.`, 'success');
    }
  }
  renderConversationList();
  if (state.currentPanel === 'contacts') renderContactsMainView();
  if(state.currentConvId===convId) {
    dom.chatHeaderName.textContent = merged.name;
    dom.chatHeaderAv.innerHTML = groupAvatarInner(msg.id, merged.name);
    updateChatHeaderStatus();
    renderMessages();
    if (state.rightPanelOpen) renderRightPanel();
    const modalOpen = $('group-action-modal-overlay')?.classList.contains('visible');
    if (modalOpen && $('group-action-modal-body')?.dataset.modalMode === 'members') {
      showGroupMembers();
    }
  }
}
function onGroupDeleted(msg) {
  state.groups.delete(msg.groupId);state.conversations.delete(`group:${msg.groupId}`);
  if(state.currentConvId===`group:${msg.groupId}`){state.currentConvId=null;dom.chatArea.style.display='none';dom.emptyState.style.display='flex';}
  if (msg.kickedBy) showToast(`Bạn đã bị ${msg.kickedBy} xóa khỏi nhóm.`, 'info');
  updateUnreadBadge();
  renderConversationList();
}

function normalizeVnPhone(raw) {
  const cleaned = String(raw || '').replace(/[\s.\-()]/g, '');
  let normalized = cleaned;
  if (cleaned.startsWith('+84') && cleaned.length >= 11) {
    normalized = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length >= 10) {
    normalized = '0' + cleaned.slice(2);
  }
  return {
    normalized,
    isPhone: /^0[0-9]{9}$/.test(normalized),
    looksLikePhoneDigits: /^[+0-9][0-9]{2,}$/.test(cleaned),
  };
}

function saveRecentSearch(entry) {
  if (!entry || !entry.name) return;
  const key = `${entry.kind}:${entry.id || entry.name}`;
  state.recentSearches = [
    entry,
    ...state.recentSearches.filter(r => `${r.kind}:${r.id || r.name}` !== key),
  ].slice(0, 8);
  localStorage.setItem('zchat_recent_searches', JSON.stringify(state.recentSearches));
}

function saveRecentPhoneSearch(userObj) {
  if (!userObj || !userObj.username) return;
  const item = { username: userObj.username, phone: userObj.phone || '' };
  state.recentPhoneSearches = [
    item,
    ...state.recentPhoneSearches.filter(r => r.username !== item.username),
  ].slice(0, 5);
  localStorage.setItem('zchat_recent_phone_searches', JSON.stringify(state.recentPhoneSearches));
}

function onSearchResults(msg) {
  state.searchResults = msg.searchResults || [];
  for (const r of state.searchResults) {
    if (r.username) {
      requestUserProfile(r.username);
      if (r.phone) saveRecentPhoneSearch(r);
    }
  }
  if (state.sidebarSearchActive && state.topSearchPhoneQuery) {
    state.topSearchPhonePending = false;
    state.topSearchPhoneResults = state.searchResults;
    renderSidebarSearchResults();
  }
  if ($('add-friend-modal-overlay')?.classList.contains('visible') && dom.phoneSearchInput?.value.trim() && dom.phoneSearchResult) {
    renderPhoneSearchResult(state.searchResults);
    renderRecentPhoneList();
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
  const cnavBadge = $('cnav-req-badge');
  if (cnavBadge) {
    cnavBadge.style.display = count > 0 ? 'inline-flex' : 'none';
    cnavBadge.textContent = count > 99 ? '99+' : count;
  }
  const requestTab = $('tab-requests');
  if (requestTab) {
    requestTab.style.display = 'none';
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
  conv.lastMsg = computeLastMessagePreview(conv);
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
  closeMessageMenu();
  exitMultiSelectMode();
  state.currentConvId = convId;
  saveActiveConv(state.username, convId);
  const conv = state.conversations.get(convId);
  if (!conv) return;
  if (state.currentPanel === 'contacts') {
    state.currentPanel = 'chats';
    document.querySelectorAll('.sidebar-nav-btn').forEach(b => b.classList.remove('active'));
    $('nav-chats')?.classList.add('active');
    if ($('conv-tabs')) $('conv-tabs').style.display = 'flex';
    if (dom.convList) dom.convList.style.display = '';
    if ($('contacts-nav-list')) $('contacts-nav-list').style.display = 'none';
    if ($('contacts-main-view')) $('contacts-main-view').style.display = 'none';
  }
  dom.chatScreen?.classList.add('mobile-chat-open');
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
    if ($('hdr-add-member-btn')) $('hdr-add-member-btn').style.display = 'none';
  } else {
    const gid = convId.replace('group:', '');
    dom.chatHeaderAv.innerHTML = groupAvatarInner(gid, conv.name);
    const strangerBanner = $('stranger-banner');
    if (strangerBanner) strangerBanner.style.display = 'none';
    if (dom.attachBtn) dom.attachBtn.style.display = 'flex';
    if (dom.micBtn) dom.micBtn.style.display = 'flex';
    if ($('hdr-add-member-btn')) $('hdr-add-member-btn').style.display = 'flex';
  }
  if (dom.messageInput) dom.messageInput.placeholder = `Nhập @, tin nhắn tới ${conv.name}`;
  updateComposerActionBtn();
  dom.chatHeaderAv.className = 'chat-hdr-avatar' + (conv.type === 'group' ? ' group' : '');
  dom.chatHeaderName.textContent = conv.name;
  state.rightPanelView = 'info';
  updateChatHeaderStatus();
  if (state.rightPanelOpen) renderRightPanel();

  if (conv.messages.length === 0) {
    wsSend({ type: 'history', conversationId: convId });
  }

  renderPinnedBanner();
  renderMessages();
  renderConversationList();
  dom.messageInput.focus();
  dom.typingIndicator.textContent = '';
  if (state.msgSearchActive) closeMsgSearch();
}

function enterSidebarSearch() {
  if (state.sidebarSearchActive) return;
  state.sidebarSearchActive = true;
  if ($('conv-header-actions')) $('conv-header-actions').style.display = 'none';
  if ($('search-close-btn')) $('search-close-btn').style.display = 'inline-flex';
  if ($('conv-tabs')) $('conv-tabs').style.display = 'none';
  if ($('contacts-nav-list')) $('contacts-nav-list').style.display = 'none';
  if (dom.convList) dom.convList.style.display = '';
  renderSidebarSearchResults();
}

function exitSidebarSearch() {
  clearTimeout(state.topSearchTimer);
  state.sidebarSearchActive = false;
  state.topSearchPhoneQuery = '';
  state.topSearchPhonePending = false;
  state.topSearchPhoneResults = null;
  if (dom.searchInput) dom.searchInput.value = '';
  if ($('conv-header-actions')) $('conv-header-actions').style.display = 'flex';
  if ($('search-close-btn')) $('search-close-btn').style.display = 'none';
  if (state.currentPanel === 'contacts') {
    if ($('conv-tabs')) $('conv-tabs').style.display = 'none';
    if ($('contacts-nav-list')) $('contacts-nav-list').style.display = 'flex';
    if (dom.convList) dom.convList.style.display = 'none';
  } else {
    if ($('conv-tabs')) $('conv-tabs').style.display = 'flex';
    if (dom.convList) dom.convList.style.display = '';
    renderConversationList();
  }
}

function clearRecentSearches() {
  state.recentSearches = [];
  localStorage.removeItem('zchat_recent_searches');
  if (state.sidebarSearchActive) renderSidebarSearchResults();
}

function openSearchConvTarget(kind, id, name) {
  saveRecentSearch({ kind, id, name });
  exitSidebarSearch();
  if (kind === 'group') selectConversation(id);
  else if (kind === 'dm') startChat(name);
  else if (kind === 'user') openProfilePage(name);
}

function handleSidebarSearchInput() {
  if (!state.sidebarSearchActive) enterSidebarSearch();
  const raw = dom.searchInput?.value || '';
  const { normalized, isPhone } = normalizeVnPhone(raw);
  clearTimeout(state.topSearchTimer);

  if (isPhone) {
    state.topSearchPhoneQuery = normalized;
    state.topSearchPhonePending = true;
    state.topSearchPhoneResults = null;
    state.topSearchTimer = setTimeout(() => {
      wsSend({ type: 'search_by_phone', phone: normalized });
    }, 200);
  } else {
    state.topSearchPhoneQuery = '';
    state.topSearchPhonePending = false;
    state.topSearchPhoneResults = null;
  }
  renderSidebarSearchResults();
}

function renderSidebarSearchUserRow(u) {
  const uname = u.username;
  const { rel, requestId } = getRelationshipWith(uname);
  const effRel = (rel && rel !== 'stranger') ? rel : (u.relationship || 'stranger');
  const effReqId = requestId || u.requestId || '';
  let actionHtml = '';
  if (effRel === 'friend') {
    actionHtml = `<button type="button" class="zalo-add-pill-btn" onclick="event.stopPropagation();openSearchConvTarget('dm','${escHtml(dmConvId(state.username, uname))}','${escHtml(uname)}')">Nhắn tin</button>`;
  } else if (effRel === 'pending_sent') {
    actionHtml = `<button type="button" class="zalo-add-pill-btn muted" onclick="event.stopPropagation();cancelFriendRequest('${escHtml(effReqId)}','${escHtml(uname)}')">Hủy lời mời</button>`;
  } else if (effRel === 'pending_received') {
    actionHtml = `<button type="button" class="zalo-add-pill-btn solid" onclick="event.stopPropagation();acceptFriendRequest('${escHtml(effReqId)}','${escHtml(uname)}')">Đồng ý</button>`;
  } else {
    actionHtml = `<button type="button" class="zalo-add-pill-btn solid" onclick="event.stopPropagation();sendFriendRequest('${escHtml(uname)}')">Kết bạn</button>`;
  }
  const phoneDisplay = u.phone ? `(+84) ${u.phone.replace(/^0/, '')}` : '';
  return `
    <div class="zalo-search-user-row" onclick="saveRecentSearch({kind:'user',id:'${escHtml(uname)}',name:'${escHtml(uname)}',phone:'${escHtml(u.phone||'')}'});openProfilePage('${escHtml(uname)}')">
      <div class="conv-avatar" style="width:42px;height:42px;font-size:15px">${userAvatarInner(uname)}</div>
      <div class="zalo-search-user-info">
        <div class="zalo-search-user-name">${escHtml(uname)}</div>
        <div class="zalo-search-user-sub">${escHtml(phoneDisplay || 'Người dùng ZChat')}</div>
      </div>
      ${actionHtml}
    </div>`;
}

function renderSidebarSearchResults() {
  if (!dom.convList) return;
  const raw = (dom.searchInput?.value || '').trim();
  const q = raw.toLowerCase();
  const { isPhone, looksLikePhoneDigits } = normalizeVnPhone(raw);

  if (!raw) {
    if (!state.recentSearches.length) {
      dom.convList.innerHTML = `
        <div class="zalo-search-sec-hdr"><span>Tìm gần đây</span></div>
        <div class="rp-empty-inline" style="padding:28px 16px">Chưa có tìm kiếm gần đây.<br>Nhập tên bạn bè, nhóm hoặc số điện thoại (10 số) để tìm & kết bạn nhanh.</div>`;
      return;
    }
    const itemsHtml = state.recentSearches.map(r => {
      const av = r.kind === 'group'
        ? `<div class="conv-avatar group" style="width:40px;height:40px;font-size:14px">${groupAvatarInner((r.id||'').replace('group:',''), r.name)}</div>`
        : `<div class="conv-avatar" style="width:40px;height:40px;font-size:14px">${userAvatarInner(r.name)}</div>`;
      const sub = r.kind === 'group' ? 'Nhóm trò chuyện' : (r.phone ? `(+84) ${r.phone.replace(/^0/, '')}` : 'Bạn bè');
      return `<div class="zalo-search-user-row" onclick="openSearchConvTarget('${escHtml(r.kind)}','${escHtml(r.id||'')}','${escHtml(r.name)}')">
        ${av}
        <div class="zalo-search-user-info">
          <div class="zalo-search-user-name">${escHtml(r.name)}</div>
          <div class="zalo-search-user-sub">${escHtml(sub)}</div>
        </div>
      </div>`;
    }).join('');
    dom.convList.innerHTML = `
      <div class="zalo-search-sec-hdr"><span>Tìm gần đây</span><button type="button" class="zalo-search-sec-action" onclick="clearRecentSearches()">Xóa lịch sử</button></div>
      ${itemsHtml}`;
    return;
  }

  let html = '';

  if (isPhone && state.topSearchPhoneQuery) {
    html += `<div class="zalo-search-sec-hdr"><span>Tìm bạn qua số điện thoại</span></div>`;
    if (state.topSearchPhonePending) {
      html += `<div class="rp-empty-inline" style="padding:14px 16px">Đang tìm số ${escHtml(state.topSearchPhoneQuery)}...</div>`;
    } else if (!state.topSearchPhoneResults || state.topSearchPhoneResults.length === 0) {
      html += `<div class="rp-empty-inline" style="padding:14px 16px">Không tìm thấy tài khoản với SĐT <b>${escHtml(state.topSearchPhoneQuery)}</b>.</div>`;
    } else {
      html += state.topSearchPhoneResults.map(u => renderSidebarSearchUserRow(u)).join('');
    }
  } else if (looksLikePhoneDigits) {
    html += `<div class="zalo-search-sec-hdr"><span>Tìm bạn qua số điện thoại</span></div>
      <div class="rp-empty-inline" style="padding:10px 16px">Nhập đủ 10 số (vd: 0332018432) để tìm người lạ kết bạn.</div>`;
  }

  const matchedConvs = [...state.conversations.entries()]
    .filter(([_, c]) => c.type !== 'global' && (c.name || '').toLowerCase().includes(q))
    .slice(0, 15);
  const matchedFriends = state.friends
    .filter(f => f.username.toLowerCase().includes(q) && !matchedConvs.some(([_, c]) => c.type === 'dm' && c.name === f.username))
    .slice(0, 10);

  if (matchedConvs.length || matchedFriends.length) {
    html += `<div class="zalo-search-sec-hdr"><span>Liên hệ & Đoạn chat</span></div>`;
    for (const [cid, c] of matchedConvs) {
      const av = c.type === 'group'
        ? `<div class="conv-avatar group" style="width:40px;height:40px;font-size:14px">${groupAvatarInner(cid.replace('group:',''), c.name)}</div>`
        : `<div class="conv-avatar" style="width:40px;height:40px;font-size:14px">${userAvatarInner(c.name)}</div>`;
      html += `<div class="zalo-search-user-row" onclick="openSearchConvTarget('${c.type}','${escHtml(cid)}','${escHtml(c.name)}')">
        ${av}
        <div class="zalo-search-user-info">
          <div class="zalo-search-user-name">${escHtml(c.name)}</div>
          <div class="zalo-search-user-sub">${c.type === 'group' ? 'Nhóm trò chuyện' : 'Đoạn chat'}</div>
        </div>
      </div>`;
    }
    for (const f of matchedFriends) {
      html += `<div class="zalo-search-user-row" onclick="openSearchConvTarget('dm','${escHtml(dmConvId(state.username, f.username))}','${escHtml(f.username)}')">
        <div class="conv-avatar" style="width:40px;height:40px;font-size:14px">${userAvatarInner(f.username)}</div>
        <div class="zalo-search-user-info">
          <div class="zalo-search-user-name">${escHtml(f.username)}</div>
          <div class="zalo-search-user-sub">Bạn bè</div>
        </div>
      </div>`;
    }
  } else if (!isPhone && !looksLikePhoneDigits) {
    html += `<div class="rp-empty-inline" style="padding:28px 16px">Không tìm thấy kết quả phù hợp.</div>`;
  }

  dom.convList.innerHTML = html;
}

// ─── Render conversation list ─────────────────────────────────────────────────
function renderConversationList() {
  if (state.sidebarSearchActive) { renderSidebarSearchResults(); return; }
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
    const isMuted = state.mutedConversations.has(convId);
    const groupBadge = conv.type === 'group' ? `<span class="conv-group-ico">${UI_ICONS.users}</span>` : '';
    const lastTs = conv.lastTimestamp ? formatRelativeShort(conv.lastTimestamp) : (conv.lastTime || '');

    item.innerHTML = `
      <div class="${avClass}">${conv.type === 'dm' ? userAvatarInner(conv.name) : groupAvatarInner(gid, conv.name)}${dot}</div>
      <div class="conv-info">
        <div class="conv-name">${groupBadge}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(conv.name)}</span></div>
        ${conv.type==='dm'&&!state.friends.some(f=>f.username===conv.name)?'<div style="font-size:10px;color:#a0a7b4">Người lạ</div>':''}
        <div class="conv-last">${escHtml(conv.lastMsg || 'Chưa có tin nhắn')}</div>
      </div>
      <div class="conv-meta">
        <div style="display:flex;align-items:center;gap:4px">
          ${isMuted ? `<span class="conv-meta-icons" title="Đã tắt thông báo">${UI_ICONS.bellOff}</span>` : ''}
          <div class="conv-time">${escHtml(lastTs)}</div>
        </div>
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

function avatarMarkup(username, className = 'msg-av', clickableInGroup = false, isGroupLeader = false) {
  const profile = state.userProfiles.get(username);
  const avatarPath = profile?.avatarPath;
  const extraClass = clickableInGroup ? ' clickable-av' : '';
  const clickAttr = clickableInGroup ? ` onclick="openAvatarActionMenu(event, '${escHtml(username || '')}')"` : '';
  const keyBadge = isGroupLeader ? OWNER_KEY_BADGE_HTML : '';
  return avatarPath
    ? `<div class="${className}${extraClass}" title="${escHtml(username || '')}${isGroupLeader ? ' (Trưởng nhóm)' : ''}"${clickAttr}><img src="${escHtml(avatarPath)}" alt="Ảnh đại diện ${escHtml(username || '')}">${keyBadge}</div>`
    : `<div class="${className}${extraClass}" title="${escHtml(username || '')}${isGroupLeader ? ' (Trưởng nhóm)' : ''}"${clickAttr}>${getInitials(username || '?')}${keyBadge}</div>`;
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
  const msgs = conv.messages;

  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];
    const isSys = msg.type === 'system' || msg.messageType === 'system' || msg.from === 'SYSTEM';
    if (!isSys && msg.from) requestUserProfile(msg.from);
    const day = getDayLabel(msg.timestamp);

    let showedDayBreak = false;
    if (day !== lastDay) {
      const dayLabel = document.createElement('div');
      dayLabel.className = 'msg-day-label';
      dayLabel.textContent = day === 'Hôm nay' ? 'Hôm nay' : `${formatTime(msg.timestamp)} ${day}`;
      dom.messages.appendChild(dayLabel);
      lastDay = day;
      previous = null;
      showedDayBreak = true;
    }

    if (isSys) {
      appendMessageDOM(msg, false, true, false);
      previous = null;
      continue;
    }

    const currentTime = new Date(msg.timestamp).getTime();
    const previousTime = previous ? new Date(previous.timestamp).getTime() : 0;
    const gap = previous ? currentTime - previousTime : Infinity;

    const startsNewGroup = !previous || previous.from !== msg.from || gap >= 300000;
    if (!showedDayBreak && (!previous || gap >= 3600000)) {
      const timeLabel = document.createElement('div');
      timeLabel.className = 'msg-time-break';
      timeLabel.textContent = new Date(msg.timestamp).toLocaleTimeString('vi-VN', {
        hour: '2-digit', minute: '2-digit'
      });
      dom.messages.appendChild(timeLabel);
    }

    const nextMsg = msgs[i + 1];
    const nextIsSys = nextMsg && (nextMsg.type === 'system' || nextMsg.messageType === 'system' || nextMsg.from === 'SYSTEM');
    const nextGap = nextMsg ? (new Date(nextMsg.timestamp).getTime() - currentTime) : Infinity;
    const nextSameDay = nextMsg && getDayLabel(nextMsg.timestamp) === day;
    const isLastInGroup = !nextMsg || nextIsSys || !nextSameDay || nextMsg.from !== msg.from || nextGap >= 300000;
    const isVeryLastMine = (i === msgs.length - 1) && msg.from === state.username && msg.type !== 'revoked';

    appendMessageDOM(msg, !startsNewGroup, isLastInGroup, isVeryLastMine);
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

function appendMessageDOM(msg, grouped=false, isLastInGroup=true, isVeryLastMine=false) {
  const msgType=typeof msg.type==='string'?msg.type.toLowerCase():'';
  if (msgType === 'system' || msg.messageType === 'system' || msg.from === 'SYSTEM') {
    const el=document.createElement('div');
    el.className='msg-system';
    el.textContent=msg.content;
    dom.messages.appendChild(el);
    return;
  }
  const isMine=msg.from===state.username;
  const isSelected = Boolean(msg.messageId && state.multiSelectMode && state.selectedMsgIds.has(msg.messageId));
  const wrapper=document.createElement('div');
  wrapper.className=`message-item ${isMine?'mine':'theirs'}${grouped?' grouped':''}${isSelected?' msg-selected':''}`;
  if(msg.messageId)wrapper.dataset.msgId=msg.messageId;
  if (state.multiSelectMode && msg.messageId) {
    wrapper.onclick = (e) => {
      if (e.target.closest('button, a, video, audio')) return;
      toggleSelectMessage(msg.messageId);
    };
  }
  const inDm=state.currentConvId?.startsWith('dm:');
  const inGroup=state.currentConvId?.startsWith('group:');
  const groupObj=inGroup?state.groups.get(state.currentConvId.replace('group:','')):null;
  const isGroupOwner=Boolean(inGroup && groupObj && groupObj.createdBy === state.username);
  const canRevokeBothSides=isMine || isGroupOwner;
  const showSender=!isMine&&!inDm&&!grouped;
  const senderInCard=msgType==='file_share'&&isFileCardMsg(msg);
  const time=formatTime(msg.timestamp);
  const starBadge = msg.starred ? `<span class="msg-star-badge" title="Tin nhắn đã đánh dấu">★</span>` : '';
  const metaHtml = (isLastInGroup || msg.starred)
    ? `<div class="msg-bubble-meta-row">${starBadge}${isLastInGroup ? `<span class="msg-bubble-time">${time}</span>` : ''}</div>`
    : '';
  let bubbleContent=msgType==='file_share'?buildFileBubble(msg,isMine,showSender):`<div class="msg-bubble">${renderMessageText(msg.content)}${metaHtml}</div>`;
  const replyCard=msg.replyToId?`<div class="message-reply-context"><b>${escHtml(msg.replyToUsername||'')}</b><span>${escHtml(msg.replyToContent||'Tin nhắn được trả lời')}</span></div>`:'';
  const deliveredPill = isVeryLastMine ? `<div class="msg-delivered-pill">✓✓ Đã nhận</div>` : '';
  const actions=msg.messageId?`<div class="msg-actions" onclick="event.stopPropagation()">
    <button type="button" class="msg-act-circle" title="Trả lời" onclick="replyToMessage('${msg.messageId}')">${UI_ICONS.quote}</button>
    <button type="button" class="msg-act-circle" title="Chuyển tiếp" onclick="forwardMessage('${msg.messageId}')">${UI_ICONS.forward}</button>
    <button type="button" class="msg-act-circle more" title="Thêm" onclick="openMessageMenu(event,'${msg.messageId}')">${UI_ICONS.dotsH}</button>
  </div>`:'';
  const bodyHtml=`<div class="msg-body">${showSender&&!senderInCard?`<div class="msg-sender">${escHtml(msg.from||'')}</div>`:''}${replyCard}<div class="msg-bubble-row">${bubbleContent}${actions}</div>${deliveredPill}<div class="msg-time">${time}</div></div>`;
  const selectChk = msg.messageId
    ? `<button type="button" class="msg-select-chk" aria-label="Chọn tin nhắn" onclick="event.stopPropagation();toggleSelectMessage('${msg.messageId}')">${isSelected?'✓':''}</button>`
    : '';
  // Avatar nằm cùng hàng với bong bóng; trong nhóm có thể bấm vào avatar người khác để mở combobox thao tác, và hiện chìa khóa vàng nếu người nhắn là trưởng nhóm.
  const clickableAvatar = inGroup && !isMine && Boolean(msg.from);
  const isSenderGroupOwner = Boolean(inGroup && groupObj && msg.from && groupObj.createdBy === msg.from);
  const senderAvatar = grouped ? '<div class="msg-av-spacer" aria-hidden="true"></div>' : avatarMarkup(msg.from || '?', 'msg-av', clickableAvatar, isSenderGroupOwner);
  wrapper.innerHTML = `${selectChk}${senderAvatar}${bodyHtml}`;
  if(msgType==='revoked'){
    const body=wrapper.querySelector('.msg-body');
    body.innerHTML=`<div class="revoked-note">Tin nhắn đã được thu hồi</div><button class="delete-revoked-btn" onclick="hideMessageForMe('${msg.messageId}')">Xóa chỉ ở phía tôi</button><div class="msg-time">${time}</div>`;
    dom.messages.appendChild(wrapper);return;
  }
  const counts={};(msg.reactions||[]).forEach(r=>{if(r.emoji)counts[r.emoji]=(counts[r.emoji]||0)+1;});
  const myReaction=(msg.reactions||[]).find(r=>r.username===state.username);
  const reactionItems=Object.entries(counts).map(([emoji,count])=>`<button class="msg-reaction${myReaction?.emoji===emoji?' mine-reaction':''}" title="Xem người đã thả ${emoji}" onclick="showReactionPeople('${msg.messageId}')"><span>${emoji}</span><b>${count}</b></button>`).join('');
  const pickerEmojis=['❤️','😂','👍','😮','😢','🔥','🎉','😍'];
  const picker=pickerEmojis.map(emoji=>`<button type="button" class="reaction-option${myReaction?.emoji===emoji?' selected':''}" title="${emoji}" onclick="event.stopPropagation();reactToMessage('${msg.messageId}','${emoji}')">${emoji}</button>`).join('');
  const reactionBox=msg.messageId?`<div class="message-reaction-area" onclick="event.stopPropagation()">
    <div class="reaction-picker">${picker}</div>
    <button type="button" class="reaction-trigger${myReaction?' has-reaction':''}" title="${myReaction?'Xem người đã bày tỏ':'Bày tỏ cảm xúc'}" onclick="${myReaction?`showReactionPeople('${msg.messageId}')`:`this.parentElement.classList.toggle('picker-open')`}">${myReaction?escHtml(myReaction.emoji):UI_ICONS.thumbUp}</button>
  </div>`:'';
  const reactionPills=(msg.messageId&&reactionItems)?`<div class="msg-reactions">${reactionItems}</div>`:'';
  const body=wrapper.querySelector('.msg-body');
  const bubbleRow=wrapper.querySelector('.msg-bubble-row');
  if(body) {
    const bubble = body.querySelector('.msg-bubble');
    const attachTarget = bubble || bubbleRow;
    if (attachTarget && msg.messageId) {
      attachTarget.oncontextmenu = (ev) => {
        if (state.multiSelectMode) return;
        const sel = window.getSelection()?.toString();
        if (sel) return;
        openMessageContextMenu(ev, msg.messageId);
      };
    }
    if (bubble && reactionBox) bubble.insertAdjacentHTML('beforeend', reactionBox);
    else if (bubbleRow && reactionBox) bubbleRow.insertAdjacentHTML('beforeend', reactionBox);
    if (bubbleRow && reactionPills) bubbleRow.insertAdjacentHTML('afterend', reactionPills);
  }
  dom.messages.appendChild(wrapper);
}

// ─── Zalo Message Menu (... / Right Click), Pin, Star, Multi-select & Details ─
function closeMessageMenu() {
  document.querySelector('.zalo-msg-menu')?.remove();
  document.querySelectorAll('.message-item.menu-open').forEach(el => el.classList.remove('menu-open'));
  state.activeMsgMenuId = null;
}

function openMessageContextMenu(event, messageId) {
  event.preventDefault();
  openMessageMenu(event, messageId);
}

function openMessageMenu(event, messageId) {
  event.stopPropagation();
  const alreadyOpen = state.activeMsgMenuId === messageId && document.querySelector('.zalo-msg-menu');
  closeMessageMenu();
  if (alreadyOpen) return;

  const conv = state.conversations.get(state.currentConvId);
  const msg = conv?.messages.find(m => m.messageId === messageId);
  if (!conv || !msg) return;

  state.activeMsgMenuId = messageId;
  const itemEl = dom.messages?.querySelector(`.message-item[data-msg-id="${CSS.escape(messageId)}"]`);
  if (itemEl) itemEl.classList.add('menu-open');

  const isMine = msg.from === state.username;
  const inGroup = state.currentConvId?.startsWith('group:');
  const groupObj = inGroup ? state.groups.get(state.currentConvId.replace('group:', '')) : null;
  const isGroupOwner = Boolean(inGroup && groupObj && groupObj.createdBy === state.username);
  const canRevokeBothSides = isMine || isGroupOwner;
  const isPinned = conv.pinnedMessage?.messageId === messageId;
  const isStarred = Boolean(msg.starred);
  const hasFile = Boolean(msg.fileId);

  const menu = document.createElement('div');
  menu.className = 'zalo-msg-menu';
  menu.onclick = (e) => e.stopPropagation();
  menu.innerHTML = `
    <button type="button" class="zalo-mmenu-item" onclick="closeMessageMenu();copyMessageText('${escHtml(messageId)}')">
      <span class="zalo-mmenu-ico">${UI_ICONS.copy}</span><span class="zalo-mmenu-lbl">Copy tin nhắn</span>
    </button>
    <div class="zalo-mmenu-sep"></div>
    <button type="button" class="zalo-mmenu-item" onclick="closeMessageMenu();togglePinMessage('${escHtml(messageId)}')">
      <span class="zalo-mmenu-ico">${UI_ICONS.pin}</span><span class="zalo-mmenu-lbl">${isPinned ? 'Bỏ ghim tin nhắn' : 'Ghim tin nhắn'}</span>
    </button>
    <button type="button" class="zalo-mmenu-item" onclick="closeMessageMenu();toggleStarMessage('${escHtml(messageId)}')">
      <span class="zalo-mmenu-ico" style="${isStarred ? 'color:#f5a623' : ''}">${UI_ICONS.star}</span><span class="zalo-mmenu-lbl">${isStarred ? 'Bỏ đánh dấu tin nhắn' : 'Đánh dấu tin nhắn'}</span>
    </button>
    <button type="button" class="zalo-mmenu-item" onclick="closeMessageMenu();enterMultiSelectMode('${escHtml(messageId)}')">
      <span class="zalo-mmenu-ico">${UI_ICONS.checkList}</span><span class="zalo-mmenu-lbl">Chọn nhiều tin nhắn</span>
    </button>
    <button type="button" class="zalo-mmenu-item" onclick="closeMessageMenu();openMessageDetails('${escHtml(messageId)}')">
      <span class="zalo-mmenu-ico">${UI_ICONS.info}</span><span class="zalo-mmenu-lbl">Xem chi tiết</span>
    </button>
    <div class="zalo-mmenu-item has-sub" onclick="this.classList.toggle('sub-open')">
      <span class="zalo-mmenu-ico"></span>
      <span class="zalo-mmenu-lbl">Tuỳ chọn khác</span>
      <span class="zalo-mmenu-chev">${UI_ICONS.chevronRight}</span>
      <div class="zalo-msg-submenu">
        <button type="button" class="zalo-mmenu-item" onclick="event.stopPropagation();closeMessageMenu();replyToMessage('${escHtml(messageId)}')">
          <span class="zalo-mmenu-ico">${UI_ICONS.quote}</span><span class="zalo-mmenu-lbl">Trả lời</span>
        </button>
        <button type="button" class="zalo-mmenu-item" onclick="event.stopPropagation();closeMessageMenu();forwardMessage('${escHtml(messageId)}')">
          <span class="zalo-mmenu-ico">${UI_ICONS.forward}</span><span class="zalo-mmenu-lbl">Chuyển tiếp</span>
        </button>
        ${hasFile ? `<button type="button" class="zalo-mmenu-item" onclick="event.stopPropagation();closeMessageMenu();saveFileWithLocation('/api/files/${encodeURIComponent(msg.fileId)}','${(msg.filename||'file').replace(/'/g,"\\'")}','${escHtml(msg.fileId)}')">
          <span class="zalo-mmenu-ico">${UI_ICONS.download}</span><span class="zalo-mmenu-lbl">Tải tệp về máy</span>
        </button>` : ''}
      </div>
    </div>
    <div class="zalo-mmenu-sep"></div>
    ${canRevokeBothSides ? `<button type="button" class="zalo-mmenu-item danger" onclick="closeMessageMenu();revokeMessage('${escHtml(messageId)}')">
      <span class="zalo-mmenu-ico">${UI_ICONS.undo}</span><span class="zalo-mmenu-lbl">Thu hồi</span>
    </button>` : ''}
    <button type="button" class="zalo-mmenu-item danger" onclick="closeMessageMenu();hideMessageForMe('${escHtml(messageId)}')">
      <span class="zalo-mmenu-ico">${UI_ICONS.trash}</span><span class="zalo-mmenu-lbl">Xóa chỉ ở phía tôi</span>
    </button>
  `;
  document.body.appendChild(menu);

  const menuW = 228;
  const menuH = menu.offsetHeight || 310;
  let left, top;
  if (event.type === 'contextmenu') {
    left = event.clientX + 4;
    top = event.clientY + 4;
  } else {
    const rect = event.currentTarget.getBoundingClientRect();
    left = isMine ? rect.left : rect.right + 6;
    top = rect.top - Math.min(menuH * 0.4, 120);
  }
  if (left + menuW > window.innerWidth - 10) left = Math.max(10, window.innerWidth - menuW - 10);
  if (top + menuH > window.innerHeight - 10) top = Math.max(10, window.innerHeight - menuH - 10);
  if (top < 10) top = 10;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  const subEl = menu.querySelector('.zalo-msg-submenu');
  if (subEl && left + menuW + 196 > window.innerWidth - 10) subEl.classList.add('open-left');
}

function getMessageCopyableText(msg) {
  if (!msg) return '';
  if (msg.content) return msg.content;
  if (msg.filename) return msg.filename;
  if (msg.fileId) return `${location.origin}/api/files/${msg.fileId}`;
  return '';
}

async function copyTextToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (_) { return false; }
}

async function copyMessageText(messageId) {
  const conv = state.conversations.get(state.currentConvId);
  const msg = conv?.messages.find(m => m.messageId === messageId);
  const txt = getMessageCopyableText(msg);
  if (!txt) { showToast('Không có nội dung văn bản để sao chép.', 'info'); return; }
  const ok = await copyTextToClipboard(txt);
  showToast(ok ? 'Đã sao chép tin nhắn.' : 'Không thể truy cập clipboard.', ok ? 'success' : 'error');
}

function togglePinMessage(messageId) {
  const conv = state.conversations.get(state.currentConvId);
  if (!conv) return;
  if (conv.pinnedMessage?.messageId === messageId) {
    wsSend({ type: 'unpin_message', conversationId: state.currentConvId });
  } else {
    wsSend({ type: 'pin_message', messageId, conversationId: state.currentConvId });
  }
}

function unpinCurrentMessage(event) {
  event?.stopPropagation();
  if (!state.currentConvId) return;
  wsSend({ type: 'unpin_message', conversationId: state.currentConvId });
}

function renderPinnedBanner() {
  const bar = $('pinned-msg-bar');
  if (!bar) return;
  const conv = state.conversations.get(state.currentConvId);
  const pin = conv?.pinnedMessage;
  if (!pin || !pin.messageId) {
    bar.style.display = 'none';
    bar.innerHTML = '';
    return;
  }
  const preview = pin.content || (pin.filename ? `[Tệp] ${pin.filename}` : 'Tin nhắn đã ghim');
  bar.style.display = 'flex';
  bar.onclick = () => jumpToMessage(pin.messageId);
  bar.innerHTML = `
    <span class="zalo-pinned-ico">${UI_ICONS.pin}</span>
    <div class="zalo-pinned-text">
      <div class="zalo-pinned-title">Tin nhắn đã ghim</div>
      <div class="zalo-pinned-sub"><b>${escHtml(pin.sender || '')}:</b> ${escHtml(preview)}</div>
    </div>
    <button type="button" class="zalo-pinned-close" onclick="unpinCurrentMessage(event)">Bỏ ghim</button>
  `;
}

function jumpToMessage(messageId) {
  const el = dom.messages?.querySelector(`.message-item[data-msg-id="${CSS.escape(messageId)}"]`);
  if (!el) { showToast('Tin nhắn này không nằm trong lịch sử hiển thị hiện tại.', 'info'); return; }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('msg-jump-flash');
  setTimeout(() => el.classList.remove('msg-jump-flash'), 1600);
}

function toggleStarMessage(messageId) {
  if (!state.currentConvId || !messageId) return;
  wsSend({ type: 'toggle_star_message', messageId, conversationId: state.currentConvId });
}

function enterMultiSelectMode(initialMessageId = null) {
  state.multiSelectMode = true;
  state.selectedMsgIds = new Set(initialMessageId ? [initialMessageId] : []);
  renderMessages();
  renderMultiSelectBar();
}

function exitMultiSelectMode() {
  if (!state.multiSelectMode && state.selectedMsgIds.size === 0) return;
  state.multiSelectMode = false;
  state.selectedMsgIds.clear();
  dom.messages?.classList.remove('multi-select-active');
  renderMessages();
  renderMultiSelectBar();
}

function toggleSelectMessage(messageId) {
  if (!messageId) return;
  if (state.selectedMsgIds.has(messageId)) state.selectedMsgIds.delete(messageId);
  else state.selectedMsgIds.add(messageId);
  const el = dom.messages?.querySelector(`.message-item[data-msg-id="${CSS.escape(messageId)}"]`);
  if (el) {
    const active = state.selectedMsgIds.has(messageId);
    el.classList.toggle('msg-selected', active);
    const chk = el.querySelector('.msg-select-chk');
    if (chk) chk.textContent = active ? '✓' : '';
  }
  renderMultiSelectBar();
}

function renderMultiSelectBar() {
  const bar = $('multi-select-bar');
  const shell = document.querySelector('#input-bar .composer-shell');
  if (!bar) return;
  if (!state.multiSelectMode) {
    dom.messages?.classList.remove('multi-select-active');
    bar.style.display = 'none';
    bar.innerHTML = '';
    if (shell) shell.style.display = '';
    return;
  }
  dom.messages?.classList.add('multi-select-active');
  if (shell) shell.style.display = 'none';
  bar.style.display = 'flex';
  const count = state.selectedMsgIds.size;
  bar.innerHTML = `
    <span class="zalo-ms-count">Đã chọn ${count} tin nhắn</span>
    <div class="zalo-ms-actions">
      <button type="button" class="zalo-ms-btn" onclick="multiSelectCopy()" ${count === 0 ? 'disabled' : ''}>Copy</button>
      <button type="button" class="zalo-ms-btn primary" onclick="multiSelectForward()" ${count === 0 ? 'disabled' : ''}>Chuyển tiếp</button>
      <button type="button" class="zalo-ms-btn danger" onclick="multiSelectDeleteForMe()" ${count === 0 ? 'disabled' : ''}>Xóa ở phía tôi</button>
      <button type="button" class="zalo-ms-btn" onclick="exitMultiSelectMode()">Hủy</button>
    </div>
  `;
}

async function multiSelectCopy() {
  const conv = state.conversations.get(state.currentConvId);
  if (!conv) return;
  const lines = conv.messages
    .filter(m => state.selectedMsgIds.has(m.messageId))
    .map(m => `${m.from || ''}: ${getMessageCopyableText(m)}`)
    .filter(Boolean);
  if (!lines.length) return;
  const ok = await copyTextToClipboard(lines.join('\n'));
  showToast(ok ? `Đã sao chép ${lines.length} tin nhắn.` : 'Không thể sao chép.', ok ? 'success' : 'error');
  exitMultiSelectMode();
}

function multiSelectForward() {
  const conv = state.conversations.get(state.currentConvId);
  if (!conv) return;
  const selected = conv.messages.filter(m => state.selectedMsgIds.has(m.messageId));
  if (!selected.length) return;
  const combined = selected.map(m => getMessageCopyableText(m)).filter(Boolean).join('\n');
  exitMultiSelectMode();
  openForwardPicker({ messageId: selected[0].messageId, content: combined || 'Tin nhắn được chuyển tiếp' });
}

function multiSelectDeleteForMe() {
  const ids = [...state.selectedMsgIds];
  if (!ids.length) return;
  if (!confirm(`Xóa ${ids.length} tin nhắn đã chọn chỉ ở phía bạn?`)) return;
  ids.forEach(messageId => wsSend({ type: 'delete_message_for_me', messageId, conversationId: state.currentConvId }));
  exitMultiSelectMode();
}

function openMessageDetails(messageId) {
  const conv = state.conversations.get(state.currentConvId);
  const m = conv?.messages.find(x => x.messageId === messageId);
  if (!m) return;
  const fullTime = formatDateTimeFull(m.timestamp) || m.timestamp || '';
  const typeLabel = m.fileId ? `Tệp đính kèm (${m.mimeType || 'file'})` : 'Tin nhắn văn bản';
  const bodyText = m.content || (m.filename ? `${m.filename} (${m.fileSize || ''})` : '');
  const reactions = (m.reactions || []).map(r => `${escHtml(r.username)} ${escHtml(r.emoji)}`).join(', ') || 'Chưa có';
  openGroupActionModal(
    'Chi tiết tin nhắn',
    `<div class="zalo-acc-kv" style="padding:4px 0">
       <div class="zalo-acc-k">Người gửi</div><div class="zalo-acc-v"><b>${escHtml(m.from || '')}</b></div>
       <div class="zalo-acc-k">Hội thoại</div><div class="zalo-acc-v">${escHtml(conv.name || '')}</div>
       <div class="zalo-acc-k">Thời gian</div><div class="zalo-acc-v">${escHtml(fullTime)}</div>
       <div class="zalo-acc-k">Loại</div><div class="zalo-acc-v">${escHtml(typeLabel)}</div>
       <div class="zalo-acc-k">Cảm xúc</div><div class="zalo-acc-v">${reactions}</div>
       <div class="zalo-acc-k">Nội dung</div><div class="zalo-acc-v" style="white-space:pre-wrap">${escHtml(bodyText)}</div>
     </div>`,
    `<button class="btn-primary" onclick="closeGroupActionModal()">Đóng</button>`
  );
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
    ${isOwner ? `<button type="button" class="avatar-popover-item" onclick="closeAvatarActionMenu();confirmTransferGroupOwnerDirect('${escHtml(gid)}','${escHtml(targetUsername)}')">
      ${UI_ICONS.crown}<span>Nhượng quyền trưởng nhóm</span>
    </button>
    <button type="button" class="avatar-popover-item danger" onclick="closeAvatarActionMenu();kickGroupMember('${escHtml(gid)}','${escHtml(targetUsername)}')">
      ${UI_ICONS.userMinus}<span>Xóa khỏi nhóm</span>
    </button>` : ''}
  `;
  document.body.appendChild(menu);

  const rect = event.currentTarget.getBoundingClientRect();
  const menuW = 215;
  const menuH = isOwner ? 186 : 112;
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
  updateComposerActionBtn();
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

function updateComposerActionBtn() {
  const hasText = Boolean(dom.messageInput?.value.trim());
  if ($('quick-like-btn')) $('quick-like-btn').style.display = hasText ? 'none' : 'inline-flex';
  if (dom.sendBtn) dom.sendBtn.style.display = hasText ? 'flex' : 'none';
}

function sendQuickLike() {
  if (!state.currentConvId) return;
  const conv = state.conversations.get(state.currentConvId);
  if (!conv) return;
  if (conv.type === 'dm') wsSend({ type: 'private_message', to: conv.name, content: '👍' });
  else if (conv.type === 'group') wsSend({ type: 'group_message', groupId: state.currentConvId.replace('group:', ''), content: '👍' });
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
function toggleUserMenu(event) {
  event?.stopPropagation();
  const pop = $('user-menu-popover');
  if (!pop) return;
  const open = pop.style.display === 'block';
  if (open) { closeUserMenu(); return; }
  pop.innerHTML = `
    <div class="zalo-upop-name">${escHtml(state.username || 'Tài khoản')}</div>
    <button type="button" class="zalo-upop-item" onclick="closeUserMenu();openProfilePage()"><span>Hồ sơ của bạn</span></button>
    <button type="button" class="zalo-upop-item" onclick="closeUserMenu();openSettingsModal()"><span>Cài đặt</span></button>
    <div class="zalo-upop-sep"></div>
    <button type="button" class="zalo-upop-item danger" onclick="closeUserMenu();logout()"><span>Đăng xuất</span></button>`;
  pop.style.display = 'block';
}
function closeUserMenu() {
  const pop = $('user-menu-popover');
  if (pop) pop.style.display = 'none';
}

function toggleRightPanel() {
  state.rightPanelOpen = !state.rightPanelOpen;
  if (!state.rightPanelOpen) state.rightPanelView = 'info';
  dom.rightPanel.classList.toggle('open', state.rightPanelOpen);
  $('shared-files-btn').classList.toggle('active-panel', state.rightPanelOpen);
  if (state.rightPanelOpen) renderRightPanel();
}

function closeRightPanel() {
  state.rightPanelOpen = false;
  state.rightPanelView = 'info';
  dom.rightPanel.classList.remove('open');
  $('shared-files-btn').classList.remove('active-panel');
}

function openRightPanelMembers() {
  const conv = state.conversations.get(state.currentConvId);
  if (!conv || conv.type !== 'group') return;
  state.rightPanelView = 'members';
  state.rightPanelOpen = true;
  dom.rightPanel.classList.add('open');
  $('shared-files-btn')?.classList.add('active-panel');
  renderRightPanel();
}

function backToRightPanelInfo() {
  state.rightPanelView = 'info';
  renderRightPanel();
}

function switchRpTab(tab) {
  state.activeRpTab = tab;
  document.querySelectorAll('.rp-tab').forEach((el, i) => {
    el.classList.toggle('active', ['files','images','links'][i] === tab);
  });
  renderRightPanel();
}

function renderRightPanelSummary(conv) {
  const sumEl = $('rp-conv-summary');
  if (!sumEl) return;
  if (!conv) { sumEl.innerHTML = ''; return; }
  const isGroup = conv.type === 'group';
  const gid = isGroup ? conv.id.replace('group:', '') : '';
  const g = isGroup ? state.groups.get(gid) : null;
  const isOwner = Boolean(isGroup && g && g.createdBy === state.username);
  const avHtml = isGroup ? groupAvatarInner(gid, conv.name) : userAvatarInner(conv.name);
  const subText = isGroup ? `${g?.members?.length || 0} thành viên${g?.createdBy ? ` · Trưởng nhóm: ${g.createdBy}` : ''}` : 'Trò chuyện riêng';
  const muted = state.mutedConversations.has(conv.id);
  sumEl.innerHTML = `
    <div class="rp-sum-av">${avHtml}</div>
    <div class="rp-sum-name">${escHtml(conv.name)}</div>
    <div class="rp-sum-sub">${escHtml(subText)}</div>
    <div class="rp-quick-actions">
      <button type="button" class="rp-qa-btn" onclick="toggleMuteConversation(${!muted});setTimeout(()=>renderRightPanel(),150)">
        <span class="rp-qa-ico">${muted ? UI_ICONS.bell : UI_ICONS.bellOff}</span>
        <span>${muted ? 'Bật thông báo' : 'Tắt thông báo'}</span>
      </button>
      ${isGroup ? `
        <button type="button" class="rp-qa-btn" onclick="openRightPanelMembers()">
          <span class="rp-qa-ico">${UI_ICONS.users}</span>
          <span>Thành viên</span>
        </button>
        <button type="button" class="rp-qa-btn" onclick="addGroupMember()">
          <span class="rp-qa-ico">${UI_ICONS.userPlus}</span>
          <span>Thêm bạn</span>
        </button>
        ${isOwner ? `<button type="button" class="rp-qa-btn" onclick="transferGroupOwner()">
          <span class="rp-qa-ico">${UI_ICONS.crown}</span>
          <span>Nhượng quyền</span>
        </button>` : ''}
      ` : `
        <button type="button" class="rp-qa-btn" onclick="openProfilePage('${escHtml(conv.name)}')">
          <span class="rp-qa-ico">${UI_ICONS.user}</span>
          <span>Trang cá nhân</span>
        </button>
      `}
    </div>`;
}

function toggleRpSection(key) {
  if (state.rpCollapsed.has(key)) state.rpCollapsed.delete(key);
  else state.rpCollapsed.add(key);
  document.querySelector(`.rp-section[data-sec="${key}"]`)?.classList.toggle('collapsed', state.rpCollapsed.has(key));
}

function toggleRpShowAll(key) {
  state.rpShowAll[key] = !state.rpShowAll[key];
  renderRightPanel();
}

function renderRightPanel() {
  const conv = state.conversations.get(state.currentConvId);
  const isGroup = conv?.type === 'group';
  const showMembersView = Boolean(isGroup && state.rightPanelView === 'members');

  if ($('rp-back-btn')) $('rp-back-btn').style.display = showMembersView ? 'inline-flex' : 'none';
  if ($('rp-header-title')) $('rp-header-title').textContent = showMembersView ? 'Thành viên' : 'Thông tin hội thoại';
  if ($('rp-conv-summary')) $('rp-conv-summary').style.display = showMembersView ? 'none' : 'flex';

  if (!conv) {
    renderRightPanelSummary(null);
    dom.rpContent.innerHTML = '<div class="rp-empty">Chọn một cuộc trò chuyện</div>';
    return;
  }

  if (showMembersView) {
    renderRightPanelMembersView(conv);
    return;
  }

  renderRightPanelSummary(conv);

  const msgs = conv.messages || [];
  const gid = isGroup ? conv.id.replace('group:', '') : '';
  const g = isGroup ? state.groups.get(gid) : null;
  const isOwner = Boolean(isGroup && g && g.createdBy === state.username);
  const other = conv.name;
  const blocked = !isGroup && state.blockedUsers.has(other);
  const chevSvg = '<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>';

  const mediaList = msgs.filter(m => m.fileId && ((m.mimeType || '').startsWith('image/') || (m.mimeType || '').startsWith('video/'))).slice().reverse();
  const showAllMedia = Boolean(state.rpShowAll.media);
  const visibleMedia = showAllMedia ? mediaList : mediaList.slice(0, 6);
  const mediaBody = mediaList.length === 0
    ? '<div class="rp-empty-inline">Chưa có Ảnh/Video được chia sẻ trong hội thoại này</div>'
    : `<div class="shared-img-grid">${visibleMedia.map(m => {
        const url = `/api/files/${encodeURIComponent(m.fileId)}`;
        const isVideo = (m.mimeType || '').startsWith('video/');
        const titleInfo = `${m.filename || (isVideo ? 'Video' : 'Ảnh')} · ${m.from || m.username || ''} · ${formatDateTimeFull(m.timestamp)}`;
        if (isVideo) {
          return `<div class="shared-media-item" title="${escHtml(titleInfo)}" onclick="openVideoViewer('${url}','${escHtml(m.filename||'video.mp4')}')">
            <video src="${url}#t=0.1" preload="metadata" muted playsinline></video>
            <div class="shared-video-badge"><span><svg viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20 6 4"/></svg></span></div>
          </div>`;
        }
        return `<div class="shared-media-item" title="${escHtml(titleInfo)}" onclick="openImageViewer('${url}','${escHtml(m.filename||'')}')">
          <img class="shared-img-thumb" src="${url}" alt="${escHtml(m.filename||'')}" loading="lazy">
        </div>`;
      }).join('')}</div>${mediaList.length > 6 ? `<button type="button" class="rp-view-all-btn" onclick="toggleRpShowAll('media')">${showAllMedia ? 'Thu gọn' : `Xem tất cả (${mediaList.length})`}</button>` : ''}`;

  const files = msgs.filter(m => m.fileId && !(m.mimeType || '').startsWith('image/') && !(m.mimeType || '').startsWith('video/')).slice().reverse();
  const showAllFiles = Boolean(state.rpShowAll.files);
  const visibleFiles = showAllFiles ? files : files.slice(0, 4);
  const filesBody = files.length === 0
    ? '<div class="rp-empty-inline">Chưa có File được chia sẻ trong hội thoại này</div>'
    : visibleFiles.map(m => {
        const url = `/api/files/${encodeURIComponent(m.fileId)}`;
        const isAudio = (m.mimeType || '').startsWith('audio/');
        const sender = m.from || m.username || 'Không rõ';
        const rawName = (m.filename || 'file').replace(/'/g, "\\'");
        return `<div class="shared-file-row">
          <div class="shared-file-ico"${isAudio ? ' style="width:36px!important;height:36px;background:#eaf3ff!important;color:#0866d6;border-radius:9px"' : ''}>${isAudio ? UI_ICONS.music : fileTypeIcon(m.mimeType, m.filename)}</div>
          <div class="shared-file-info">
            <div class="shared-file-name" title="${escHtml(m.filename || 'File')}">${escHtml(m.filename || 'File')}</div>
            <div class="shared-file-meta">${escHtml(sender)} · ${escHtml(m.fileSize || '')}</div>
          </div>
          <div style="display:flex;gap:4px">
            ${!isAudio ? `<button type="button" class="shared-file-dl" title="Chọn vị trí lưu" onclick="saveFileWithLocation('${url}','${rawName}','${escHtml(m.fileId)}')">${UI_ICONS.folderSave}</button>` : ''}
            <a class="shared-file-dl" href="${url}" download="${escHtml(m.filename || 'file')}" title="Tải xuống" onclick="markFileDownloaded('${escHtml(m.fileId)}')">${UI_ICONS.download}</a>
          </div>
        </div>`;
      }).join('') + (files.length > 4 ? `<button type="button" class="rp-view-all-btn" onclick="toggleRpShowAll('files')">${showAllFiles ? 'Thu gọn' : `Xem tất cả (${files.length})`}</button>` : '');

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
  const revLinks = links.slice().reverse();
  const showAllLinks = Boolean(state.rpShowAll.links);
  const visibleLinks = showAllLinks ? revLinks : revLinks.slice(0, 4);
  const linksBody = revLinks.length === 0
    ? '<div class="rp-empty-inline">Chưa có Link được chia sẻ trong hội thoại này</div>'
    : visibleLinks.map(l => `<div class="link-item"><a href="${escHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escHtml(l.display)}</a><div class="link-meta">${escHtml(l.from)} · ${formatTime(l.time)}</div></div>`).join('')
      + (revLinks.length > 4 ? `<button type="button" class="rp-view-all-btn" onclick="toggleRpShowAll('links')">${showAllLinks ? 'Thu gọn' : `Xem tất cả (${revLinks.length})`}</button>` : '');

  const membersSection = isGroup ? `
    <div class="rp-section${state.rpCollapsed.has('members') ? ' collapsed' : ''}" data-sec="members">
      <button type="button" class="rp-section-hdr" onclick="toggleRpSection('members')"><span>Thành viên nhóm</span>${chevSvg}</button>
      <div class="rp-section-body">
        <button type="button" class="rp-opt-row" onclick="openRightPanelMembers()">${UI_ICONS.users}<span>${(g?.members || []).length} thành viên</span></button>
        <button type="button" class="rp-opt-row" onclick="addGroupMember()">${UI_ICONS.userPlus}<span>Thêm thành viên</span></button>
        <button type="button" class="rp-opt-row" onclick="openGroupEditInfoModal()">${UI_ICONS.edit}<span>Đổi tên & ảnh nhóm</span></button>
        ${isOwner ? `<button type="button" class="rp-opt-row" onclick="transferGroupOwner()">${UI_ICONS.crown}<span>Nhượng quyền trưởng nhóm</span></button>` : ''}
      </div>
    </div>` : '';

  const securitySection = `
    <div class="rp-section${state.rpCollapsed.has('security') ? ' collapsed' : ''}" data-sec="security">
      <button type="button" class="rp-section-hdr" onclick="toggleRpSection('security')"><span>Thiết lập bảo mật</span>${chevSvg}</button>
      <div class="rp-section-body">
        <button type="button" class="rp-opt-row" onclick="toggleMsgSearch()">${UI_ICONS.search}<span>Tìm trong hội thoại</span></button>
        ${!isGroup ? `<button type="button" class="rp-opt-row" onclick="toggleBlockUser('${escHtml(other)}',${blocked})">${blocked ? UI_ICONS.unlock : UI_ICONS.ban}<span>${blocked ? 'Gỡ chặn người này' : 'Chặn người này'}</span></button>` : ''}
        <button type="button" class="rp-opt-row danger" onclick="deleteConversation()">${UI_ICONS.trash}<span>Xóa lịch sử trò chuyện</span></button>
        ${isGroup ? `<button type="button" class="rp-opt-row danger" onclick="leaveGroup()">${UI_ICONS.logOut}<span>Rời nhóm</span></button>` : ''}
        ${isOwner ? `<button type="button" class="rp-opt-row danger" onclick="deleteGroup()">${UI_ICONS.trash}<span>Giải tán nhóm</span></button>` : ''}
      </div>
    </div>`;

  dom.rpContent.innerHTML = `
    ${membersSection}
    <div class="rp-section${state.rpCollapsed.has('media') ? ' collapsed' : ''}" data-sec="media">
      <button type="button" class="rp-section-hdr" onclick="toggleRpSection('media')"><span>Ảnh/Video</span>${chevSvg}</button>
      <div class="rp-section-body">${mediaBody}</div>
    </div>
    <div class="rp-section${state.rpCollapsed.has('files') ? ' collapsed' : ''}" data-sec="files">
      <button type="button" class="rp-section-hdr" onclick="toggleRpSection('files')"><span>File</span>${chevSvg}</button>
      <div class="rp-section-body">${filesBody}</div>
    </div>
    <div class="rp-section${state.rpCollapsed.has('links') ? ' collapsed' : ''}" data-sec="links">
      <button type="button" class="rp-section-hdr" onclick="toggleRpSection('links')"><span>Link</span>${chevSvg}</button>
      <div class="rp-section-body">${linksBody}</div>
    </div>
    ${securitySection}`;
}

function renderRightPanelMembersView(conv) {
  const gid = conv.id.replace('group:', '');
  const g = state.groups.get(gid);
  if (!g) { dom.rpContent.innerHTML = '<div class="rp-empty">Không có thông tin nhóm</div>'; return; }
  const isOwner = g.createdBy === state.username;
  const members = [...(g.members || [])].sort((a, b) => {
    if (a === g.createdBy) return -1;
    if (b === g.createdBy) return 1;
    if (a === state.username) return 1;
    if (b === state.username) return -1;
    return a.localeCompare(b);
  });

  const rowsHtml = members.map(u => {
    const isMe = u === state.username;
    const isLeader = u === g.createdBy;
    const displayName = isMe ? 'Bạn' : u;
    return `
      <div class="rp-member-row" onclick="${isMe ? 'openProfilePage()' : `openRightPanelMemberMenu(event,'${escHtml(gid)}','${escHtml(u)}')`}">
        <div class="rp-member-av">${userAvatarInner(u)}${isLeader ? OWNER_KEY_BADGE_HTML : ''}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600;color:#081c36;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(displayName)}</div>
          ${isLeader ? '<div style="font-size:12px;color:#758398;margin-top:1px">Trưởng nhóm</div>' : ''}
        </div>
        ${!isMe ? `<button type="button" class="rp-member-more" title="Tùy chọn" onclick="event.stopPropagation();openRightPanelMemberMenu(event,'${escHtml(gid)}','${escHtml(u)}')">•••</button>` : ''}
      </div>`;
  }).join('');

  dom.rpContent.innerHTML = `
    <div style="padding:14px 16px">
      <button type="button" class="rp-add-member-btn" onclick="addGroupMember()">
        ${UI_ICONS.userPlus}
        <span>Thêm thành viên</span>
      </button>
      <div class="rp-members-subhdr">
        <span>Danh sách thành viên (${members.length})</span>
        ${isOwner ? `<button type="button" class="rp-member-more" style="opacity:1" title="Nhượng quyền trưởng nhóm" onclick="transferGroupOwner()">•••</button>` : ''}
      </div>
      <div>${rowsHtml}</div>
    </div>`;
}

function openRightPanelMemberMenu(event, gid, targetUsername) {
  event?.stopPropagation();
  closeAvatarActionMenu();
  if (!targetUsername || targetUsername === state.username) return;
  const g = state.groups.get(gid);
  const isOwner = Boolean(g && g.createdBy === state.username);

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
    ${isOwner ? `<button type="button" class="avatar-popover-item" onclick="closeAvatarActionMenu();confirmTransferGroupOwnerDirect('${escHtml(gid)}','${escHtml(targetUsername)}')">
      ${UI_ICONS.crown}<span>Nhượng quyền trưởng nhóm</span>
    </button>
    <button type="button" class="avatar-popover-item danger" onclick="closeAvatarActionMenu();kickGroupMember('${escHtml(gid)}','${escHtml(targetUsername)}')">
      ${UI_ICONS.userMinus}<span>Xóa khỏi nhóm</span>
    </button>` : ''}
  `;
  document.body.appendChild(menu);

  const rect = event.currentTarget.getBoundingClientRect();
  const menuW = 215;
  const menuH = isOwner ? 186 : 112;
  let left = rect.left - menuW - 6;
  if (left < 12) left = Math.min(window.innerWidth - menuW - 12, rect.right + 6);
  let top = rect.top;
  if (top + menuH > window.innerHeight - 12) top = Math.max(12, window.innerHeight - menuH - 12);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

// ─── Friend actions ───────────────────────────────────────────────────────────
function openAddFriendModal() {
  $('add-friend-modal-overlay').classList.add('visible');
  dom.phoneSearchInput.value = '';
  dom.phoneSearchResult.innerHTML = '';
  renderRecentPhoneList();
  dom.phoneSearchInput.focus();
}
function closeAddFriendModal() { $('add-friend-modal-overlay').classList.remove('visible'); }

function renderRecentPhoneList() {
  const box = $('recent-phone-list');
  if (!box) return;
  if (!state.recentPhoneSearches.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="zalo-recent-title">Kết quả gần nhất</div>` +
    state.recentPhoneSearches.map(u => {
      const phoneDisp = u.phone ? `(+84) ${u.phone.replace(/^0/, '')}` : '';
      return `<div class="zalo-recent-phone-item" onclick="dom.phoneSearchInput.value='${escHtml(u.phone||'')}';searchByPhone()">
        <div class="conv-avatar" style="width:36px;height:36px;font-size:13px">${userAvatarInner(u.username)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:600;color:#081c36">${escHtml(u.username)}</div>
          <div style="font-size:11.5px;color:#758398">${escHtml(phoneDisp)}</div>
        </div>
      </div>`;
    }).join('');
}

function searchByPhone() {
  const raw = dom.phoneSearchInput.value.trim();
  if (!raw) return;
  const { normalized } = normalizeVnPhone(raw);
  dom.phoneSearchResult.innerHTML = '<div style="text-align:center;padding:16px;color:#888">Đang tìm...</div>';
  wsSend({ type: 'search_by_phone', phone: normalized });
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
  if ($('group-member-search')) $('group-member-search').value = '';
  renderMemberList();
  updateCreateGroupChips();
  $('group-modal-overlay').classList.add('visible');
  setTimeout(() => $('group-name-input').focus(), 100);
}
function closeGroupModal() { $('group-modal-overlay').classList.remove('visible'); }

function updateCreateGroupChips() {
  const box = $('group-selected-chips');
  if (!box) return;
  const selected = [...$('member-list').querySelectorAll('.member-item.selected')].map(el => el.dataset.user);
  if (!selected.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = 'flex';
  box.innerHTML = `<span style="font-size:11px;font-weight:700;color:#52627a;align-self:center;margin-right:4px">Đã chọn (${selected.length}):</span>` +
    selected.map(u => `<span class="zalo-chip">${escHtml(u)}<button type="button" onclick="toggleCreateGroupUser('${escHtml(u)}')">&times;</button></span>`).join('');
}

function toggleCreateGroupUser(username) {
  const el = [...$('member-list').querySelectorAll('.member-item')].find(i => i.dataset.user === username);
  if (el) { el.classList.toggle('selected'); updateCreateGroupChips(); }
}

function filterCreateGroupCandidates(q) {
  const clean = (q || '').trim().toLowerCase();
  $('member-list').querySelectorAll('.member-item').forEach(el => {
    const u = (el.dataset.user || '').toLowerCase();
    el.style.display = (!clean || u.includes(clean)) ? 'flex' : 'none';
  });
}

function renderMemberList() {
  const list = $('member-list');
  list.innerHTML = '';
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
    item.onclick = () => { item.classList.toggle('selected'); updateCreateGroupChips(); };
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

function openGroupActionModal(title, bodyHtml, footerHtml = '', modalMode = '') {
  $('group-action-modal-title').textContent = title;
  const bodyEl = $('group-action-modal-body');
  bodyEl.innerHTML = bodyHtml;
  if (modalMode) bodyEl.dataset.modalMode = modalMode;
  else delete bodyEl.dataset.modalMode;
  $('group-action-modal-footer').innerHTML = footerHtml || `<button class="btn-cancel" onclick="closeGroupActionModal()">Đóng</button>`;
  $('group-action-modal-overlay').classList.add('visible');
}

function showGroupMembers() {
  const gid = state.currentConvId?.replace('group:', '');
  const g = state.groups.get(gid);
  if (!g) return;
  const isOwner = g.createdBy === state.username;
  const members = [...(g.members || [])].sort((a, b) => {
    if (a === g.createdBy) return -1;
    if (b === g.createdBy) return 1;
    if (a === state.username) return -1;
    if (b === state.username) return 1;
    return a.localeCompare(b);
  });

  const rows = members.map(u => {
    const isMemberOwner = u === g.createdBy;
    const isMe = u === state.username;
    const online = isMe || state.onlineUsers.includes(u);
    const statusText = isMe ? '● Bạn' : formatPresenceStatus(u, online);
    return `<div class="group-member-row group-member-filter-row" data-user="${escHtml(u)}">
      <div class="conv-avatar" style="width:38px;height:38px;font-size:14px;overflow:visible;position:relative">${userAvatarInner(u)}${isMemberOwner ? OWNER_KEY_BADGE_HTML : (online ? '<span class="online-dot"></span>' : '')}</div>
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
        ${(isOwner && !isMe) ? `<button class="gm-btn transfer" onclick="confirmTransferGroupOwnerDirect('${escHtml(gid)}','${escHtml(u)}')">Nhượng quyền</button>` : ''}
        ${(isOwner && !isMe) ? `<button class="gm-btn danger" onclick="kickGroupMemberFromModal('${escHtml(gid)}','${escHtml(u)}')">Xóa</button>` : ''}
      </div>
    </div>`;
  }).join('');

  openGroupActionModal(
    `Thành viên nhóm · ${g.name} (${members.length})`,
    `<div class="zalo-member-search-wrap">
       <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
       <input type="text" placeholder="Tìm thành viên trong nhóm..." oninput="filterGroupMembersModal(this.value)">
     </div>
     <div style="max-height:340px;overflow-y:auto">${rows}</div>`,
    `<button class="btn-primary" onclick="addGroupMember()">+ Thêm thành viên</button>
     <button class="btn-cancel" onclick="closeGroupActionModal()">Đóng</button>`,
    'members'
  );
}

function filterGroupMembersModal(q) {
  const clean = (q || '').trim().toLowerCase();
  document.querySelectorAll('.group-member-filter-row').forEach(el => {
    const u = (el.dataset.user || '').toLowerCase();
    el.style.display = (!clean || u.includes(clean)) ? 'flex' : 'none';
  });
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
  const allFriends = state.friends.slice();

  if (allFriends.length === 0) {
    openGroupActionModal(
      'Thêm thành viên vào nhóm',
      `<div class="rp-empty">Bạn chưa có bạn bè nào để thêm vào nhóm.</div>`,
      `<button class="btn-cancel" onclick="closeGroupActionModal()">Đóng</button>`
    );
    return;
  }

  const itemsHtml = allFriends.map(f => {
    const alreadyIn = currentMembers.has(f.username);
    return `
      <div class="member-item group-add-candidate${alreadyIn ? ' already-in' : ''}" data-user="${escHtml(f.username)}" ${alreadyIn ? '' : 'onclick="this.classList.toggle(\'selected\');updateGroupAddChips()"'}>
        <div class="member-chk">✓</div>
        <div class="member-av" style="overflow:hidden">${userAvatarInner(f.username)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600">${escHtml(f.username)}</div>
          <div style="font-size:11px;color:${f.online ? '#2ecc71' : '#8893a4'}">${escHtml(formatPresenceStatus(f.username, f.online))}</div>
        </div>
        ${alreadyIn ? '<span class="member-already-tag">Đã tham gia</span>' : ''}
      </div>`;
  }).join('');

  openGroupActionModal(
    `Thêm thành viên · ${g.name}`,
    `<div class="zalo-member-search-wrap">
       <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
       <input type="text" placeholder="Nhập tên để tìm bạn bè..." oninput="filterGroupAddCandidates(this.value)">
     </div>
     <div id="group-add-selected-chips" class="zalo-selected-chips" style="display:none"></div>
     <div id="group-add-member-list" style="max-height:280px;overflow-y:auto;border:1px solid #dfe4ec;border-radius:8px">${itemsHtml}</div>`,
    `<button class="btn-cancel" onclick="closeGroupActionModal()">Hủy</button>
     <button class="btn-primary" id="group-add-submit-btn" onclick="submitAddGroupMembers('${escHtml(gid)}')">Xác nhận</button>`
  );
}

function updateGroupAddChips() {
  const box = $('group-add-selected-chips');
  if (!box) return;
  const selected = [...document.querySelectorAll('.group-add-candidate.selected')].map(el => el.dataset.user);
  const submitBtn = $('group-add-submit-btn');
  if (submitBtn) submitBtn.textContent = selected.length ? `Xác nhận (${selected.length})` : 'Xác nhận';
  if (!selected.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = 'flex';
  box.innerHTML = `<span style="font-size:11px;font-weight:700;color:#52627a;align-self:center;margin-right:4px">Đã chọn (${selected.length}):</span>` +
    selected.map(u => `<span class="zalo-chip">${escHtml(u)}<button type="button" onclick="toggleGroupAddCandidate('${escHtml(u)}')">&times;</button></span>`).join('');
}

function toggleGroupAddCandidate(username) {
  const el = [...document.querySelectorAll('.group-add-candidate')].find(i => i.dataset.user === username && !i.classList.contains('already-in'));
  if (el) { el.classList.toggle('selected'); updateGroupAddChips(); }
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

function transferGroupOwner(leaveAfter = false) {
  const gid = state.currentConvId?.replace('group:', '');
  const g = state.groups.get(gid);
  if (!g) return;
  if (g.createdBy !== state.username) {
    showToast('Chỉ trưởng nhóm mới có quyền chuyển quyền quản trị.', 'error');
    return;
  }
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
    <label class="transfer-candidate-row${idx === 0 ? ' selected' : ''}" data-user="${escHtml(u)}" onclick="selectTransferCandidate(this)">
      <input type="radio" name="transfer-owner-candidate" value="${escHtml(u)}" ${idx === 0 ? 'checked' : ''} style="accent-color:#0866d6;width:16px;height:16px">
      <div class="conv-avatar" style="width:38px;height:38px;font-size:14px;overflow:hidden">${userAvatarInner(u)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;color:#172033">${escHtml(u)}</div>
        <div style="font-size:11px;color:${state.onlineUsers.includes(u) ? '#2ecc71' : '#8893a4'}">${escHtml(formatPresenceStatus(u))}</div>
      </div>
    </label>
  `).join('');

  const title = leaveAfter ? 'Chọn trưởng nhóm mới trước khi rời nhóm' : 'Chuyển quyền trưởng nhóm';
  const subtitle = leaveAfter
    ? 'Bạn đang là Trưởng nhóm. Hãy chọn một thành viên nhận quyền quản trị để có thể rời nhóm:'
    : 'Chọn một thành viên trong nhóm để nhận quyền Trưởng nhóm:';

  openGroupActionModal(
    title,
    `<p style="font-size:13px;color:#536176;margin-bottom:10px">${subtitle}</p>
     <div class="zalo-member-search-wrap">
       <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
       <input type="text" placeholder="Tìm thành viên..." oninput="filterTransferCandidates(this.value)">
     </div>
     <div style="max-height:280px;overflow-y:auto;border:1px solid #dfe4ec;border-radius:10px;padding:6px">${itemsHtml}</div>`,
    `<button class="btn-cancel" onclick="closeGroupActionModal()">Hủy</button>
     <button class="btn-primary" onclick="confirmTransferGroupOwnerStep('${escHtml(gid)}',${leaveAfter})">Tiếp tục</button>`
  );
}

function selectTransferCandidate(row) {
  document.querySelectorAll('.transfer-candidate-row').forEach(r => r.classList.remove('selected'));
  row?.classList.add('selected');
}

function filterTransferCandidates(q) {
  const clean = (q || '').trim().toLowerCase();
  document.querySelectorAll('.transfer-candidate-row').forEach(el => {
    const u = (el.dataset.user || '').toLowerCase();
    el.style.display = (!clean || u.includes(clean)) ? 'flex' : 'none';
  });
}

function confirmTransferGroupOwnerStep(groupId, leaveAfter = false) {
  const radio = document.querySelector('input[name="transfer-owner-candidate"]:checked');
  const targetUser = radio?.value;
  if (!targetUser) {
    showToast('Vui lòng chọn một thành viên.', 'error');
    return;
  }
  confirmTransferGroupOwnerDirect(groupId, targetUser, leaveAfter);
}

function confirmTransferGroupOwnerDirect(groupId, targetUser, leaveAfter = false) {
  const g = state.groups.get(groupId);
  if (!g) return;
  const noteText = leaveAfter
    ? `• <b>${escHtml(targetUser)}</b> sẽ trở thành Trưởng nhóm mới của "${escHtml(g.name || '')}".<br>• Bạn sẽ rời khỏi nhóm ngay sau khi chuyển quyền.`
    : `• <b>${escHtml(targetUser)}</b> sẽ có toàn quyền quản lý thành viên, thu hồi tin nhắn và giải tán nhóm.<br>• Bạn sẽ trở thành thành viên thường của nhóm.`;
  openGroupActionModal(
    leaveAfter ? 'Xác nhận chuyển quyền & rời nhóm' : 'Xác nhận nhượng quyền trưởng nhóm',
    `<div style="text-align:center;padding:8px 4px">
       <div class="conv-avatar" style="width:60px;height:60px;margin:0 auto 12px;font-size:22px;overflow:hidden">${userAvatarInner(targetUser)}</div>
       <p style="font-size:14px;line-height:1.55;color:#172033">Nhượng quyền Trưởng nhóm <b>"${escHtml(g.name || '')}"</b> cho <b>${escHtml(targetUser)}</b>?</p>
       <div class="transfer-warning-box">${noteText}</div>
     </div>`,
    `<button class="btn-cancel" onclick="transferGroupOwner(${leaveAfter})">Quay lại</button>
     <button class="${leaveAfter ? 'btn-danger' : 'btn-primary'}" onclick="executeTransferGroupOwner('${escHtml(groupId)}','${escHtml(targetUser)}',${leaveAfter})">${leaveAfter ? 'Chuyển quyền & Rời nhóm' : 'Xác nhận nhượng quyền'}</button>`
  );
}

function executeTransferGroupOwner(groupId, targetUser, leaveAfter = false) {
  wsSend({ type: 'group_transfer_owner', groupId, username: targetUser, leaveAfter });
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

function leaveGroup() {
  const gid = state.currentConvId?.replace('group:', '');
  const g = state.groups.get(gid);
  closeConversationOptions();
  if (!gid || !g) return;
  if (g.createdBy === state.username) {
    const others = (g.members || []).filter(u => u !== state.username);
    if (others.length > 0) {
      transferGroupOwner(true);
    } else if (confirm('Bạn là thành viên duy nhất còn lại trong nhóm. Bạn muốn giải tán nhóm luôn không?')) {
      wsSend({ type: 'group_delete', groupId: gid });
    }
    return;
  }
  if (!confirm('Bạn muốn rời nhóm?')) return;
  wsSend({ type: 'group_leave', groupId: gid });
}
function deleteGroup(){if(!confirm('Giải tán nhóm? Tất cả thành viên sẽ không thể tiếp tục trò chuyện.'))return;wsSend({type:'group_delete',groupId:state.currentConvId.replace('group:','')});closeConversationOptions();}

function openProfilePage(username=state.username){
  state.profileTarget=username;
  state.profileEditMode=false;
  if ($('profile-modal-back')) $('profile-modal-back').style.display='none';
  $('profile-page-title').textContent = username===state.username ? 'Thông tin tài khoản' : `Thông tin tài khoản · ${username}`;
  wsSend({type:'user_profile',username});
  $('profile-page-content').innerHTML='<div class="rp-empty">Đang tải thông tin tài khoản...</div>';
  $('profile-modal-overlay').classList.add('visible');
  wsSend({type:'get_posts',username});
}
function closeProfilePage(){
  state.profileEditMode=false;
  $('profile-modal-overlay')?.classList.remove('visible');
}
function openProfileEditView(){
  if (!state.lastPostsPayload || state.lastPostsPayload.username !== state.username) return;
  state.profileEditMode = true;
  renderProfilePage(state.lastPostsPayload);
}
function closeProfileEditView(){
  state.profileEditMode = false;
  if (state.lastPostsPayload) renderProfilePage(state.lastPostsPayload);
}
function submitProfileEdit(){
  const bioEl = $('profile-edit-bio-input');
  if (bioEl) wsSend({type:'profile_update',bio:bioEl.value.trim()});
  state.profileEditMode = false;
}
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

  if (own && state.profileEditMode) {
    if ($('profile-modal-back')) $('profile-modal-back').style.display='inline-flex';
    $('profile-page-title').textContent = 'Cập nhật thông tin cá nhân';
    $('profile-page-content').innerHTML = `
      <div style="padding:18px 20px;display:flex;flex-direction:column;gap:14px">
        <div>
          <label class="modal-label">Tên tài khoản</label>
          <input class="modal-input" type="text" value="${escHtml(msg.username)}" disabled style="opacity:.7">
        </div>
        <div>
          <label class="modal-label">Tiểu sử / Giới thiệu</label>
          <textarea id="profile-edit-bio-input" class="modal-input" rows="3" placeholder="Nhập tiểu sử của bạn...">${escHtml(p.bio||'')}</textarea>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <label class="gm-btn" style="cursor:pointer">Đổi ảnh đại diện<input type="file" accept="image/*" hidden onchange="uploadProfileAvatar(this.files[0])"></label>
          ${p.avatarPath ? `<button type="button" class="gm-btn danger" onclick="clearProfileAvatar()">Xóa ảnh đại diện</button>` : ''}
          <label class="gm-btn" style="cursor:pointer">Đổi ảnh bìa<input type="file" accept="image/*" hidden onchange="uploadProfileCover(this.files[0])"></label>
          ${p.coverPath ? `<button type="button" class="gm-btn danger" onclick="clearProfileCover()">Xóa ảnh bìa</button>` : ''}
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:10px;border-top:1px solid #eef0f4">
          <button type="button" class="btn-cancel" onclick="closeProfileEditView()">Hủy</button>
          <button type="button" class="btn-primary" onclick="submitProfileEdit()">Cập nhật</button>
        </div>
      </div>`;
    return;
  }

  if ($('profile-modal-back')) $('profile-modal-back').style.display='none';
  $('profile-page-title').textContent = own ? 'Thông tin tài khoản' : `Thông tin tài khoản · ${msg.username}`;

  const avInner = p.avatarPath?`<img src="${escHtml(p.avatarPath)}" alt="Ảnh đại diện">`:getInitials(msg.username);
  const isOnline = own || state.onlineUsers.includes(msg.username);
  const statusStr = own ? '● Đang hoạt động' : formatPresenceStatus(msg.username, isOnline);
  const phoneStr = p.phone ? `(+84) ${p.phone.replace(/^0/, '')}` : 'Chưa cập nhật';

  let html = `
    <div class="zalo-acc-cover">
      ${p.coverPath ? `<img src="${escHtml(p.coverPath)}" alt="Ảnh bìa">` : ''}
      ${own ? `<label class="zalo-acc-cover-btn">Đổi ảnh bìa<input type="file" accept="image/*" hidden onchange="uploadProfileCover(this.files[0])"></label>` : ''}
    </div>
    <div class="zalo-acc-head-row">
      <div class="zalo-acc-av-wrap">
        <div class="zalo-acc-av">${avInner}</div>
        ${own ? `<label class="zalo-acc-cam-btn" title="Đổi ảnh đại diện">${UI_ICONS.camera}<input type="file" accept="image/*" hidden onchange="uploadProfileAvatar(this.files[0])"></label>` : ''}
      </div>
      <div class="zalo-acc-name-line">
        <span>${escHtml(msg.username)}</span>
        ${own ? `<button type="button" class="zalo-acc-edit-ico" title="Cập nhật" onclick="openProfileEditView()">${UI_ICONS.edit}</button>` : ''}
      </div>
    </div>`;

  if (!own) {
    const { rel, requestId } = getRelationshipWith(msg.username);
    const reqId = requestId || state.viewedProfile?.requestId || '';
    let relButton = rel==='friend'
      ? `<button class="btn-friend btn-unfriend" onclick="confirmUnfriend('${escHtml(msg.username)}')">Hủy kết bạn</button>`
      : rel==='pending_sent'
        ? `<button class="btn-friend btn-cancel-req" onclick="cancelFriendRequest('${escHtml(reqId)}','${escHtml(msg.username)}')">Hủy lời mời</button>`
        : rel==='pending_received'
          ? `<button class="btn-friend btn-accept-req" onclick="acceptFriendRequest('${escHtml(reqId)}','${escHtml(msg.username)}')">Chấp nhận</button>`
          : `<button class="btn-friend btn-add-friend" onclick="sendFriendRequest('${escHtml(msg.username)}')">+ Kết bạn</button>`;
    html += `<div style="display:flex;gap:8px;flex-wrap:wrap;padding:0 18px 14px">${relButton}<button class="btn-primary" style="padding:8px 16px" onclick="startChat('${escHtml(msg.username)}');closeProfilePage()">Nhắn tin</button><button class="btn-cancel" style="padding:8px 14px" onclick="toggleBlockUser('${escHtml(msg.username)}',${state.blockedUsers.has(msg.username)})">${state.blockedUsers.has(msg.username)?'Gỡ chặn':'Chặn'}</button></div>`;
  }

  html += `
    <div class="zalo-acc-section">
      <div class="zalo-acc-sec-title">Thông tin cá nhân</div>
      <div class="zalo-acc-kv">
        <div class="zalo-acc-k">Tiểu sử</div><div class="zalo-acc-v">${escHtml(p.bio||'Chưa có tiểu sử')}</div>
        <div class="zalo-acc-k">Điện thoại</div><div class="zalo-acc-v">${escHtml(phoneStr)}</div>
        <div class="zalo-acc-k">Trạng thái</div><div class="zalo-acc-v" style="color:${isOnline?'#1f9d55':'#758398'};font-weight:600">${escHtml(statusStr)}</div>
      </div>
      ${own ? `<button type="button" class="zalo-acc-update-btn" onclick="openProfileEditView()">${UI_ICONS.edit}<span>Cập nhật</span></button>` : ''}
    </div>`;

  html += `<div class="zalo-acc-section">`;
  if(own) html+=`<div class="profile-post-compose" style="margin-bottom:14px"><textarea id="new-post-content" placeholder="Bạn đang nghĩ gì?"></textarea><button class="btn-primary" style="margin-top:8px" onclick="createProfilePost()">Đăng bài viết</button></div>`;
  html+='<div class="zalo-acc-sec-title">Bài viết</div>';
  if(!posts.length) html+='<div class="rp-empty" style="padding:12px 0">Chưa có bài viết nào.</div>';
  posts.forEach(post=>{html+=`<div class="profile-post"><div style="font-weight:700">${escHtml(post.username)}</div><div style="font-size:11px;color:#8992a3">${formatTime(post.timestamp)}</div><p style="white-space:pre-wrap">${escHtml(post.content)}</p></div>`;});
  html += `</div>`;
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
  const oldVid = $('image-viewer-video');
  if (oldVid) { oldVid.pause(); oldVid.remove(); }
  img.style.display = 'block';
  img.src = url;
  const dl = $('image-viewer-download');
  if (dl) { dl.href = url; dl.download = filename || 'image'; }
  if (cap) cap.textContent = filename || '';
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function openVideoViewer(url, filename = 'video.mp4') {
  const overlay = $('image-viewer');
  const img = $('image-viewer-img');
  const cap = $('image-viewer-caption');
  if (!overlay || !img) return;
  img.style.display = 'none';
  img.src = '';
  let vid = $('image-viewer-video');
  if (!vid) {
    vid = document.createElement('video');
    vid.id = 'image-viewer-video';
    vid.controls = true;
    vid.autoplay = true;
    vid.playsInline = true;
    vid.style.cssText = 'max-width:min(94vw,1200px);max-height:80vh;border-radius:10px;background:#000;box-shadow:0 12px 50px rgba(0,0,0,.5)';
    img.insertAdjacentElement('afterend', vid);
  }
  vid.src = url;
  const dl = $('image-viewer-download');
  if (dl) { dl.href = url; dl.download = filename || 'video.mp4'; }
  if (cap) cap.textContent = filename || '';
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeImageViewer() {
  $('image-viewer')?.classList.remove('visible');
  const img = $('image-viewer-img');
  if (img) { img.src = ''; img.style.display = 'block'; }
  const vid = $('image-viewer-video');
  if (vid) { vid.pause(); vid.remove(); }
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

function formatRelativeShort(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin >= 0 && diffMin < 1) return 'Vừa xong';
  if (diffMin >= 1 && diffMin < 60) return `${diffMin} phút`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr >= 1 && diffHr < 24 && d.toDateString() === new Date().toDateString()) return `${diffHr} giờ`;
  return d.toLocaleDateString('vi', { day: '2-digit', month: '2-digit' });
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
dom.messageInput?.addEventListener('input', () => { autoResize(dom.messageInput); handleTypingInput(); updateComposerActionBtn(); });

$('image-input')?.addEventListener('change', async e => {
  const files = [...(e.target.files || [])];
  for (const f of files) {
    await sendFile(f);
  }
  e.target.value = '';
});

function openSettingsModal() {
  openGroupActionModal(
    'Cài đặt',
    `<div style="display:flex;flex-direction:column;gap:8px">
       <button type="button" class="option-action" onclick="closeGroupActionModal();openProfilePage()">
         <span class="opt-ico">${UI_ICONS.user}</span><span>Thông tin tài khoản (${escHtml(state.username || '')})</span>
       </button>
       <button type="button" class="option-action" onclick="Notification?.requestPermission?.().then(p=>showToast('Quyền thông báo: '+p,'info'))">
         <span class="opt-ico">${UI_ICONS.bell}</span><span>Bật thông báo trình duyệt</span>
       </button>
       <button type="button" class="option-action danger" onclick="closeGroupActionModal();logout()">
         <span class="opt-ico">${UI_ICONS.logOut}</span><span>Đăng xuất</span>
       </button>
     </div>`,
    `<button class="btn-cancel" onclick="closeGroupActionModal()">Đóng</button>`
  );
}

dom.attachBtn?.addEventListener('click', () => dom.fileInput.click());
dom.fileInput?.addEventListener('change', async e => {
  const files = [...(e.target.files || [])];
  for (const f of files) {
    await sendFile(f);
  }
});

// Ô tìm kiếm phía trên: hỗ trợ lọc đoạn chat + tìm SĐT kết bạn trực tiếp kiểu Zalo PC
dom.searchInput?.addEventListener('focus', enterSidebarSearch);
dom.searchInput?.addEventListener('input', handleSidebarSearchInput);
dom.searchInput?.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); exitSidebarSearch(); dom.searchInput.blur(); }
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
  if (!dom.emojiPicker.contains(e.target)
      && e.target !== $('emoji-btn') && !$('emoji-btn')?.contains(e.target)
      && e.target !== $('inline-emoji-btn') && !$('inline-emoji-btn')?.contains(e.target)) {
    closeEmojiPicker();
  }
  if (!e.target.closest('.avatar-action-popover') && !e.target.closest('.clickable-av') && !e.target.closest('.rp-member-row')) {
    closeAvatarActionMenu();
  }
  if (!e.target.closest('#user-menu-popover') && !e.target.closest('#user-avatar-display')) {
    closeUserMenu();
  }
  if (!e.target.closest('.zalo-msg-menu') && !e.target.closest('.msg-act-circle.more')) {
    closeMessageMenu();
  }
  if (!e.target.closest('.message-reaction-area')) {
    document.querySelectorAll('.message-reaction-area.picker-open').forEach(el => el.classList.remove('picker-open'));
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelector('.reaction-people-overlay')?.remove();
    document.querySelector('.forward-overlay')?.remove();
    closeMessageMenu();
    if (state.multiSelectMode) exitMultiSelectMode();
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
  selectConversation, switchTab, switchContactsSubView, setContactsSearch, setContactsSort, toggleRpSection, toggleRpShowAll, enterSidebarSearch, exitSidebarSearch, openSearchConvTarget, clearRecentSearches, saveRecentSearch, openGroupModal, closeGroupModal, submitCreateGroup,
  logout, cancelSessionRestore, openImageViewer, openVideoViewer, closeImageViewer, showPanel,
  toggleRightPanel, closeRightPanel, openRightPanelMembers, backToRightPanelInfo, openRightPanelMemberMenu, toggleUserMenu, closeUserMenu, switchRpTab,
  toggleMsgSearch, closeMsgSearch, stepMsgSearch,
  openAddFriendModal, closeAddFriendModal, searchByPhone,
  sendFriendRequest, acceptFriendRequest, rejectFriendRequest, cancelFriendRequest,
  unfriend, confirmUnfriend, startChat,
  closeFriendReqModal,
  toggleAudioPlay, seekAudio,
  toggleRecording, stopAndSendRecording, cancelRecording,
  toggleEmojiPicker, closeEmojiPicker,
  reactToMessage,revokeMessage,hideMessageForMe,showReactionPeople,replyToMessage,forwardMessage,filterForwardTargets,sendForwardedMessage,openConversationOptions,closeConversationOptions,
  openMessageMenu,openMessageContextMenu,closeMessageMenu,copyMessageText,togglePinMessage,unpinCurrentMessage,jumpToMessage,toggleStarMessage,enterMultiSelectMode,exitMultiSelectMode,toggleSelectMessage,multiSelectCopy,multiSelectForward,multiSelectDeleteForMe,openMessageDetails,
  openProfilePage,closeProfilePage,openProfileEditView,closeProfileEditView,submitProfileEdit,editProfileBio,createProfilePost,uploadProfileAvatar,uploadProfileCover,clearProfileAvatar,clearProfileCover,openFriendReqModal,
  toggleBlockUser,showGroupMembers,filterGroupMembersModal,addGroupMember,filterGroupAddCandidates,submitAddGroupMembers,transferGroupOwner,selectTransferCandidate,filterTransferCandidates,confirmTransferGroupOwnerStep,confirmTransferGroupOwnerDirect,executeTransferGroupOwner,leaveGroup,deleteGroup,
  openGroupEditInfoModal,uploadGroupAvatarFile,clearGroupAvatar,submitGroupRename,closeGroupActionModal,
  openAvatarActionMenu,closeAvatarActionMenu,kickGroupMember,kickGroupMemberFromModal,
  deleteConversation,toggleMuteConversation,
});

// Tự động khôi phục phiên đăng nhập khi F5 nếu tài khoản chưa bấm Đăng xuất
bootSessionRestore();
