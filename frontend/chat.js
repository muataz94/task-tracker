var currentUserEmail  = null;
var currentUserName   = null;
var currentUserAvatar = null;

let chatPollingInterval = null;
let lastMessageId       = null;
let currentTopic        = 'general';
let _chatInitialized    = false;
let chatMessages        = [];

const DEFAULT_TOPICS = [
  { id: 'general',       label: 'General',      icon: '💬' },
  { id: 'tasks',         label: 'Tasks',         icon: '✅' },
  { id: 'finance',       label: 'Finance',       icon: '💰' },
  { id: 'announcements', label: 'Announcements', icon: '📢' },
];

function initChat(email, name, avatar) {
  currentUserEmail  = email;
  currentUserName   = name;
  currentUserAvatar = avatar;

  const avatarEl = document.getElementById('chat-avatar');
  if (avatarEl) avatarEl.src = avatar || '';

  if (_chatInitialized) { renderTopicSidebar(); return; }
  _chatInitialized = true;

  const sendBtn = document.getElementById('chat-send');
  const inputEl = document.getElementById('chat-input');
  if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
  if (inputEl) inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  });

  initEmojiPicker();
  initFileAttachment();
  renderTopicSidebar();
}

function renderTopicSidebar() {
  const list = document.getElementById('topic-list');
  if (!list) return;
  list.innerHTML = DEFAULT_TOPICS.map(t => `
    <div class="topic-item ${t.id === currentTopic ? 'active' : ''}" data-topic="${t.id}">
      <span class="topic-icon">${t.icon}</span>
      <span>${t.label}</span>
    </div>`).join('');
  list.querySelectorAll('.topic-item').forEach(item => {
    item.addEventListener('click', () => switchTopic(item.dataset.topic));
  });
}

function switchTopic(topicId) {
  currentTopic = topicId;
  renderTopicSidebar();
  const topicObj = DEFAULT_TOPICS.find(t => t.id === topicId) || { label: topicId, icon: '💬' };
  const nameEl = document.getElementById('chat-topic-name');
  if (nameEl) nameEl.textContent = topicObj.icon + ' ' + topicObj.label;
  loadChat();
}

async function loadChat() {
  try {
    const result   = await callAPI('getChat', {});
    const all      = result.rows || [];
    const messages = all.filter(m => !m.topic || m.topic === currentTopic);
    renderMessages(messages);
    if (all.length) lastMessageId = all[all.length - 1].id;
    startChatPolling();
  } catch (e) {
    console.error('Chat load error:', e);
  }
}

function startChatPolling() {
  if (chatPollingInterval) clearInterval(chatPollingInterval);
  chatPollingInterval = setInterval(async () => {
    try {
      const result = await callAPI('getChat', {});
      const all    = result.rows || [];
      const lastId = all.length ? all[all.length - 1].id : null;
      if (lastId !== lastMessageId) {
        const messages = all.filter(m => !m.topic || m.topic === currentTopic);
        renderMessages(messages);
        lastMessageId = lastId;

        const prefs = JSON.parse(localStorage.getItem('tt_prefs') || '{}');
        if (prefs.desktopNotifications && all.length) {
          const latest = all[all.length - 1];
          if (latest.sender_email !== currentUserEmail && Notification.permission === 'granted') {
            new Notification(latest.sender_name || 'New message', {
              body: latest.message?.slice(0, 100) || '',
              icon: latest.sender_avatar || ''
            });
          }
        }
      }
    } catch (e) {}
  }, 5000);
}

function stopChatPolling() {
  if (chatPollingInterval) { clearInterval(chatPollingInterval); chatPollingInterval = null; }
}

// ── Message rendering ──────────────────────────────────────────────

function formatMessageContent(message, fileUrl, fileName, fileType) {
  let content;
  if (message && message.startsWith('data:image')) {
    content = `<img src="${message}" style="max-width:200px;max-height:160px;border-radius:12px;display:block;" />`;
  } else {
    content = escapeHtml(message || '').replace(/\n/g, '<br>');
  }
  if (fileUrl) {
    if (fileType && fileType.startsWith('image/')) {
      content += `
        <div class="msg-image-wrap" onclick="openImageViewer('${fileUrl}', '${escapeHtml(fileName || '')}')">
          <img src="${fileUrl}" class="msg-image" alt="${escapeHtml(fileName || 'image')}"
            onerror="this.parentElement.innerHTML='<span class=msg-file-link>📎 ${escapeHtml(fileName || 'Image')}</span>'" />
          <div class="msg-image-overlay">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
        </div>`;
    } else {
      content += `
        <a href="${fileUrl}" target="_blank" class="msg-file-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          ${escapeHtml(fileName || 'File')}
        </a>`;
    }
  }
  return content;
}

function createMessageElement(msg) {
  const isMe    = msg.sender_email === currentUserEmail;
  const time    = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const initial = (msg.sender_name || msg.sender_email || '?').charAt(0).toUpperCase();

  const wrapper = document.createElement('div');
  wrapper.className = `chat-message ${isMe ? 'mine' : 'theirs'}${msg._pending ? ' pending' : ''}`;
  wrapper.id = 'msg-' + msg.id;
  wrapper.dataset.msgId   = msg.id;
  wrapper.dataset.msgText = msg.message || '';

  const avatarHTML = msg.sender_avatar
    ? `<img src="${msg.sender_avatar}" onerror="this.style.display='none'" />`
    : `<span>${initial}</span>`;

  wrapper.innerHTML = `
    ${!isMe ? `<div class="msg-avatar">${avatarHTML}</div>` : ''}
    <div class="msg-content">
      ${!isMe ? `<div class="msg-sender">${escapeHtml(msg.sender_name || msg.sender_email)}</div>` : ''}
      <div class="msg-bubble-wrap">
        <div class="msg-bubble">${formatMessageContent(msg.message, msg.file_url, msg.file_name, msg.file_type)}${msg.edited_at ? '<span class="msg-edited">(edited)</span>' : ''}</div>
        ${isMe ? `<div class="msg-actions">
          <button class="msg-action-btn" onclick="startEditMessage('${msg.id}', this)" title="Edit">✎</button>
          <button class="msg-action-btn danger" onclick="confirmDeleteMessage('${msg.id}', this)" title="Delete">✕</button>
        </div>` : ''}
      </div>
      <div class="msg-time">
        ${time}
        ${msg._pending ? '<span class="msg-pending">●</span>' : ''}
      </div>
    </div>
    ${isMe ? `<div class="msg-avatar">${currentUserAvatar ? `<img src="${currentUserAvatar}"/>` : `<span>${initial}</span>`}</div>` : ''}
  `;
  return wrapper;
}

function renderMessages(messages) {
  chatMessages = messages;
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 60;
  container.innerHTML = '';
  messages.forEach(msg => {
    const el = createMessageElement(msg);
    if (el) container.appendChild(el);
  });
  if (wasAtBottom) container.scrollTop = container.scrollHeight;
  if (window.twemoji && container) {
    twemoji.parse(container, {
      folder: 'svg', ext: '.svg',
      base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/'
    });
  }
}

// ── Send message (optimistic UI) ───────────────────────────────────

async function sendChatMessage() {
  const input   = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message || !currentUserEmail) return;

  input.value = '';

  const tempId  = 'temp-' + Date.now();
  const tempMsg = {
    id:            tempId,
    message,
    sender_email:  currentUserEmail,
    sender_name:   currentUserName,
    sender_avatar: currentUserAvatar,
    timestamp:     new Date().toISOString(),
    _pending:      true
  };

  const container = document.getElementById('chat-messages');
  const msgEl     = createMessageElement(tempMsg);
  if (msgEl) {
    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
  }

  try {
    const result = await callAPI('sendMessage', {
      data: {
        message,
        sender_name:   currentUserName,
        sender_avatar: currentUserAvatar,
        topic:         currentTopic
      }
    });

    const existing = document.getElementById('msg-' + tempId);
    if (existing) {
      existing.id = 'msg-' + result.id;
      existing.classList.remove('pending');
      const pendingDot = existing.querySelector('.msg-pending');
      if (pendingDot) pendingDot.remove();
    }

    if (!chatMessages) chatMessages = [];
    chatMessages.push({ ...tempMsg, id: result.id, _pending: false });
    lastMessageId = result.id;

  } catch(e) {
    const existing = document.getElementById('msg-' + tempId);
    if (existing) {
      existing.classList.add('failed');
      existing.querySelector('.msg-pending')?.remove();
      const failEl = document.createElement('span');
      failEl.className = 'msg-failed-label';
      failEl.textContent = typeof t === 'function' ? t('send_failed') : 'Failed. Tap to retry.';
      failEl.onclick = () => { input.value = message; existing.remove(); };
      existing.querySelector('.msg-content')?.appendChild(failEl);
    }
    console.error('Send failed:', e.message);
  }
}

// ── Edit & Delete ──────────────────────────────────────────────────

function startEditMessage(msgId, btn) {
  const wrapper  = document.getElementById('msg-' + msgId);
  if (!wrapper) return;
  const bubble   = wrapper.querySelector('.msg-bubble');
  const original = wrapper.dataset.msgText;

  bubble.innerHTML = `
    <textarea class="msg-edit-input">${escapeHtml(original)}</textarea>
    <div class="msg-edit-actions">
      <button class="msg-edit-save" onclick="saveEditMessage('${msgId}', this)">Save</button>
      <button class="msg-edit-cancel" onclick="cancelEditMessage('${msgId}', '${escapeHtml(original)}', this)">Cancel</button>
    </div>
  `;
  const ta = bubble.querySelector('textarea');
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEditMessage(msgId, ta); }
    if (e.key === 'Escape') cancelEditMessage(msgId, original, ta);
  });
}

async function saveEditMessage(msgId, el) {
  const wrapper = document.getElementById('msg-' + msgId);
  const ta      = wrapper?.querySelector('textarea');
  const newText = ta?.value.trim();
  if (!newText) return;

  try {
    await callAPI('editMessage', { id: msgId, message: newText });
    const bubble = wrapper.querySelector('.msg-bubble');
    bubble.innerHTML = formatMessageContent(newText) + '<span class="msg-edited">(edited)</span>';
    wrapper.dataset.msgText = newText;
  } catch(e) { showToast('Edit failed: ' + e.message, 'error'); }
}

function cancelEditMessage(msgId, original, el) {
  const wrapper = document.getElementById('msg-' + msgId);
  const bubble  = wrapper?.querySelector('.msg-bubble');
  if (bubble) bubble.innerHTML = formatMessageContent(original);
}

async function confirmDeleteMessage(msgId, btn) {
  if (!confirm(typeof t === 'function' ? t('confirm_delete_message') : 'Delete this message?')) return;
  const wrapper = document.getElementById('msg-' + msgId);
  if (wrapper) wrapper.style.opacity = '0.4';
  try {
    await callAPI('deleteMessage', { id: msgId });
    wrapper?.remove();
    chatMessages = chatMessages.filter(m => m.id !== msgId);
  } catch(e) {
    if (wrapper) wrapper.style.opacity = '1';
    showToast('Delete failed: ' + e.message, 'error');
  }
}

// ── File Attachment (Google Drive upload) ──────────────────────────

function initFileAttachment() {
  const fileInput = document.getElementById('chat-file-input');
  if (!fileInput) return;
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) { showToast('File too large. Max 5MB.', 'error'); return; }

    const input = document.getElementById('chat-input');
    const prevPlaceholder = input.placeholder;
    input.placeholder = 'Uploading ' + file.name + '...';
    input.disabled = true;

    try {
      const base64 = await fileToBase64(file);
      const result = await callAPI('uploadFile', {
        fileData: base64,
        fileName: file.name,
        fileType: file.type
      });

      if (result.error) throw new Error(result.error);

      await callAPI('sendMessage', {
        data: {
          message:       input.value.trim() || file.name,
          sender_name:   currentUserName,
          sender_avatar: currentUserAvatar,
          topic:         currentTopic,
          file_url:      result.url,
          file_name:     file.name,
          file_type:     file.type
        }
      });

      input.value = '';
      fileInput.value = '';
      const msgs = await callAPI('getChat', {});
      renderMessages((msgs.rows || []).filter(m => !m.topic || m.topic === currentTopic));

    } catch(e) {
      showToast('Upload failed: ' + e.message, 'error');
    } finally {
      input.placeholder = prevPlaceholder;
      input.disabled = false;
    }
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Emoji Picker ───────────────────────────────────────────────────

function initEmojiPicker() {
  const btn    = document.getElementById('emoji-btn');
  const picker = document.getElementById('emoji-picker');
  const input  = document.getElementById('chat-input');
  if (!btn || !picker) return;

  if (typeof EmojiMart === 'undefined') {
    _initSimpleEmojiPicker(btn, picker, input);
    return;
  }

  const emojiPicker = new EmojiMart.Picker({
    onEmojiSelect: (emoji) => {
      const pos = input.selectionStart || 0;
      const val = input.value;
      input.value = val.slice(0, pos) + emoji.native + val.slice(pos);
      input.focus();
      input.setSelectionRange(pos + emoji.native.length, pos + emoji.native.length);
      picker.classList.add('hidden');
    },
    theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
    set: 'twitter',
    skinTonePosition: 'preview',
    previewPosition: 'none',
    maxFrequentRows: 2
  });

  picker.appendChild(emojiPicker);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    picker.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!picker.contains(e.target) && e.target !== btn) {
      picker.classList.add('hidden');
    }
  });
}

const EMOJI_LIST = [
  '😀','😊','😂','🤣','❤️','😍','🥰','😎','🤔','😅',
  '👍','👎','👏','🙌','🎉','🔥','💯','✅','❌','⚠️',
  '📌','📎','🗂️','💡','🚀','⭐','🌟','💬','📊','📅',
  '🏆','🎯','📝','🔔','💪','🤝','👀','💼','🕐','📱',
  '😢','😡','🤯','🥳','😴','🤗','😬','🤭','🫡','🫶',
];

function _initSimpleEmojiPicker(btn, picker, input) {
  picker.style.cssText = 'background:var(--glass-bg-strong);backdrop-filter:var(--glass-blur);border:1px solid var(--glass-border);border-radius:var(--r-md);padding:10px;display:flex;flex-wrap:wrap;gap:4px;width:280px;max-height:200px;overflow-y:auto;';
  picker.innerHTML = EMOJI_LIST.map(e =>
    `<button class="emoji-item" type="button" data-emoji="${encodeURIComponent(e)}">${e}</button>`
  ).join('');
  picker.addEventListener('click', ev => {
    const b = ev.target.closest('.emoji-item');
    if (!b) return;
    const emoji = decodeURIComponent(b.dataset.emoji);
    const pos = input.selectionStart || 0;
    input.value = input.value.slice(0, pos) + emoji + input.value.slice(pos);
    input.focus();
    input.setSelectionRange(pos + emoji.length, pos + emoji.length);
    picker.classList.add('hidden');
  });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    picker.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!picker.contains(e.target) && e.target !== btn) {
      picker.classList.add('hidden');
    }
  });
}

// ── Utilities ──────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message, type = 'info') {
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.className = 'app-toast app-toast-' + type;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}
