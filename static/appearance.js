(() => {
  const STORAGE_KEY = 'zchat_appearance_v1';
  const defaults = {
    theme: 'system',
    fontSize: 14,
    bubbleWidth: 72,
    chatBackground: 'default',
  };
  const validThemes = new Set(['light', 'dark', 'system']);
  const validBackgrounds = new Set(['default', 'slate', 'warm']);
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function loadPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        theme: validThemes.has(saved.theme) ? saved.theme : defaults.theme,
        fontSize: Number.isFinite(Number(saved.fontSize))
          ? Math.min(18, Math.max(13, Number(saved.fontSize)))
          : defaults.fontSize,
        bubbleWidth: Number.isFinite(Number(saved.bubbleWidth))
          ? Math.min(85, Math.max(55, Number(saved.bubbleWidth)))
          : defaults.bubbleWidth,
        chatBackground: validBackgrounds.has(saved.chatBackground)
          ? saved.chatBackground
          : defaults.chatBackground,
      };
    } catch (error) {
      console.warn('Không thể đọc tùy chỉnh giao diện đã lưu.', error);
      return { ...defaults };
    }
  }

  let preferences = loadPreferences();

  function applyPreferences() {
    const theme = preferences.theme === 'system'
      ? (media.matches ? 'dark' : 'light')
      : preferences.theme;
    const root = document.documentElement;
    root.dataset.zchatTheme = theme;
    root.dataset.zchatChatBackground = preferences.chatBackground;
    root.style.setProperty('--zchat-message-font-size', `${preferences.fontSize}px`);
    root.style.setProperty('--zchat-bubble-width', `${preferences.bubbleWidth}%`);
  }

  function savePreferences() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Không thể lưu tùy chỉnh giao diện.', error);
      window.showToast?.('Không thể lưu tùy chỉnh trên trình duyệt này.', 'error');
    }
  }

  function updatePreference(key, value) {
    preferences = { ...preferences, [key]: value };
    applyPreferences();
    savePreferences();
    updateControlValues();
  }

  function settingsMarkup() {
    return `
      <section class="appearance-settings" aria-labelledby="appearance-title">
        <h3 id="appearance-title">Giao diện và phím tắt</h3>
        <label class="appearance-field">
          <span>Chế độ màu</span>
          <select id="appearance-theme">
            <option value="system">Theo hệ thống</option>
            <option value="light">Sáng</option>
            <option value="dark">Tối</option>
          </select>
        </label>
        <label class="appearance-field">
          <span>Nền khung chat</span>
          <select id="appearance-chat-background">
            <option value="default">Mặc định</option>
            <option value="slate">Xanh nhạt</option>
            <option value="warm">Ấm</option>
          </select>
        </label>
        <label class="appearance-range">
          <span>Cỡ chữ tin nhắn <output id="appearance-font-size-value"></output></span>
          <input id="appearance-font-size" type="range" min="13" max="18" step="1">
        </label>
        <label class="appearance-range">
          <span>Độ rộng bong bóng <output id="appearance-bubble-width-value"></output></span>
          <input id="appearance-bubble-width" type="range" min="55" max="85" step="1">
        </label>
        <section class="appearance-shortcuts" aria-labelledby="appearance-shortcuts-title">
          <h4 id="appearance-shortcuts-title">Phím tắt</h4>
          <div><kbd>Ctrl</kbd> + <kbd>K</kbd><span>Tìm cuộc trò chuyện</span></div>
          <div><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd><span>Đổi sáng / tối</span></div>
          <div><kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd><span>Mở cài đặt</span></div>
          <div><kbd>Esc</kbd><span>Đóng cửa sổ đang mở</span></div>
        </section>
        <button type="button" class="appearance-reset" id="appearance-reset">Đặt lại giao diện mặc định</button>
      </section>`;
  }

  function updateControlValues(container = document) {
    const theme = container.querySelector('#appearance-theme');
    if (!theme) return;
    theme.value = preferences.theme;
    container.querySelector('#appearance-chat-background').value = preferences.chatBackground;
    container.querySelector('#appearance-font-size').value = preferences.fontSize;
    container.querySelector('#appearance-font-size-value').textContent = `${preferences.fontSize}px`;
    container.querySelector('#appearance-bubble-width').value = preferences.bubbleWidth;
    container.querySelector('#appearance-bubble-width-value').textContent = `${preferences.bubbleWidth}%`;
  }

  function openSettings() {
    window.openSettingsModal();
    window.requestAnimationFrame(() => document.getElementById('appearance-theme')?.focus());
  }

  function toggleTheme() {
    updatePreference('theme', preferences.theme === 'dark' ? 'light' : 'dark');
    window.showToast?.(`Đã bật giao diện ${preferences.theme === 'dark' ? 'tối' : 'sáng'}.`, 'info');
  }

  function handleShortcuts(event) {
    const key = event.key.toLowerCase();
    if (event.altKey && event.shiftKey && key === 'a') {
      event.preventDefault();
      openSettings();
      return;
    }
    if (event.ctrlKey && event.shiftKey && key === 'd') {
      event.preventDefault();
      toggleTheme();
      return;
    }
    if (event.ctrlKey && !event.shiftKey && key === 'k') {
      event.preventDefault();
      const search = document.getElementById('search-input');
      search?.focus();
      search?.select();
      return;
    }
  }

  function bindSettingsControls(container) {
    container.querySelector('#appearance-theme').addEventListener('change', event => {
      updatePreference('theme', event.target.value);
    });
    container.querySelector('#appearance-chat-background').addEventListener('change', event => {
      updatePreference('chatBackground', event.target.value);
    });
    container.querySelector('#appearance-font-size').addEventListener('input', event => {
      updatePreference('fontSize', Number(event.target.value));
    });
    container.querySelector('#appearance-bubble-width').addEventListener('input', event => {
      updatePreference('bubbleWidth', Number(event.target.value));
    });
    container.querySelector('#appearance-reset').addEventListener('click', () => {
      preferences = { ...defaults };
      applyPreferences();
      savePreferences();
      updateControlValues(container);
    });
    updateControlValues(container);
  }

  document.addEventListener('keydown', handleShortcuts);
  if (media.addEventListener) {
    media.addEventListener('change', () => {
      if (preferences.theme === 'system') applyPreferences();
    });
  }
  window.ZChatAppearance = { settingsMarkup, bindSettingsControls };
  applyPreferences();
})();
