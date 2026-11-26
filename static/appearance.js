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
      <div class="appearance-overlay" id="appearance-overlay" role="presentation" hidden>
        <section class="appearance-dialog" role="dialog" aria-modal="true" aria-labelledby="appearance-title">
          <header class="appearance-header">
            <div>
              <h2 id="appearance-title">Giao diện và phím tắt</h2>
              <p>Tùy chỉnh riêng trên trình duyệt này</p>
            </div>
            <button type="button" class="appearance-close" data-appearance-close aria-label="Đóng">×</button>
          </header>
          <div class="appearance-content">
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
              <h3 id="appearance-shortcuts-title">Phím tắt</h3>
              <div><kbd>Ctrl</kbd> + <kbd>K</kbd><span>Tìm cuộc trò chuyện</span></div>
              <div><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd><span>Đổi sáng / tối</span></div>
              <div><kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd><span>Mở cài đặt giao diện</span></div>
              <div><kbd>Esc</kbd><span>Đóng cửa sổ đang mở</span></div>
            </section>
          </div>
          <footer class="appearance-footer">
            <button type="button" class="appearance-reset" id="appearance-reset">Đặt lại mặc định</button>
            <button type="button" class="appearance-done" data-appearance-close>Hoàn tất</button>
          </footer>
        </section>
      </div>`;
  }

  function updateControlValues() {
    const theme = document.getElementById('appearance-theme');
    if (!theme) return;
    theme.value = preferences.theme;
    document.getElementById('appearance-chat-background').value = preferences.chatBackground;
    document.getElementById('appearance-font-size').value = preferences.fontSize;
    document.getElementById('appearance-font-size-value').textContent = `${preferences.fontSize}px`;
    document.getElementById('appearance-bubble-width').value = preferences.bubbleWidth;
    document.getElementById('appearance-bubble-width-value').textContent = `${preferences.bubbleWidth}%`;
  }

  function closeSettings() {
    const overlay = document.getElementById('appearance-overlay');
    if (overlay) overlay.hidden = true;
  }

  function openSettings() {
    const overlay = document.getElementById('appearance-overlay');
    if (!overlay) return;
    overlay.hidden = false;
    updateControlValues();
    document.getElementById('appearance-theme').focus();
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
    if (event.key === 'Escape') closeSettings();
  }

  function initializeSettings() {
    document.body.insertAdjacentHTML('beforeend', settingsMarkup());
    const overlay = document.getElementById('appearance-overlay');
    document.getElementById('appearance-settings-btn')?.addEventListener('click', openSettings);
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-appearance-close]')) closeSettings();
    });
    document.getElementById('appearance-theme').addEventListener('change', event => {
      updatePreference('theme', event.target.value);
    });
    document.getElementById('appearance-chat-background').addEventListener('change', event => {
      updatePreference('chatBackground', event.target.value);
    });
    document.getElementById('appearance-font-size').addEventListener('input', event => {
      updatePreference('fontSize', Number(event.target.value));
    });
    document.getElementById('appearance-bubble-width').addEventListener('input', event => {
      updatePreference('bubbleWidth', Number(event.target.value));
    });
    document.getElementById('appearance-reset').addEventListener('click', () => {
      preferences = { ...defaults };
      applyPreferences();
      savePreferences();
      updateControlValues();
    });
    document.addEventListener('keydown', handleShortcuts);
    if (media.addEventListener) {
      media.addEventListener('change', () => {
        if (preferences.theme === 'system') applyPreferences();
      });
    }
    updateControlValues();
  }

  applyPreferences();
  document.addEventListener('DOMContentLoaded', initializeSettings, { once: true });
})();
