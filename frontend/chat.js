var currentUserEmail  = null;
var currentUserName   = null;
var currentUserAvatar = null;

let chatPollingInterval = null;
let lastMessageId       = null;
let currentTopic        = 'general';
let _chatInitialized    = false;
let chatMessages        = [];
let sessionFileMap      = {}; // Maps topic ID to array of files

const DEFAULT_TOPICS = [
  { id: 'general', label: 'General',
    icon: `<svg class="topic-svg topic-anim-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    description: 'Team discussions' },
  { id: 'tasks', label: 'Tasks',
    icon: `<svg class="topic-svg topic-anim-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    description: 'Task coordination' },
  { id: 'finance', label: 'Finance',
    icon: `<svg class="topic-svg topic-anim-float" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    description: 'Financial updates' },
  { id: 'announcements', label: 'Announcements',
    icon: `<svg class="topic-svg topic-anim-shake" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    description: 'Announcements' },
];

// Initialize session file map
DEFAULT_TOPICS.forEach(t => {
  sessionFileMap[t.id] = [];
});

function renderTopicTabs() {
  const bar = document.getElementById('chat-topics-bar');
  if (!bar) return;
  bar.innerHTML = DEFAULT_TOPICS.map(t => `
    <button class="chat-topic-tab ${t.id === currentTopic ? 'active' : ''}"
            data-topic="${t.id}"
            onclick="switchTopic('${t.id}')"
            title="${escapeHtml(t.description)}">
      <span class="topic-icon" style="width:13px;height:13px;display:flex;align-items:center">${t.icon}</span>
      <span>${escapeHtml(t.label)}</span>
    </button>
  `).join('');
}

function initChat(email, name, avatar) {
  currentUserEmail  = email;
  currentUserName   = name;
  currentUserAvatar = avatar;

  const avatarEl = document.getElementById('chat-avatar');
  if (avatarEl) avatarEl.src = avatar || '';

  // Sync channel header to current topic
  const _topicInit = DEFAULT_TOPICS.find(t => t.id === currentTopic) || DEFAULT_TOPICS[0];
  const _chIcon = document.getElementById('chat-channel-icon');
  const _chName = document.getElementById('chat-channel-name');
  const _chDesc = document.getElementById('chat-channel-desc');
  if (_chIcon) _chIcon.innerHTML = _topicInit.icon;
  if (_chName) _chName.textContent = _topicInit.label;
  if (_chDesc) _chDesc.textContent = _topicInit.description || '';

  if (_chatInitialized) { renderTopicTabs(); renderTopicSidebar(); return; }
  _chatInitialized = true;

  const sendBtn = document.getElementById('chat-send');
  const inputEl = document.getElementById('chat-input');
  if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
  if (inputEl) {
    inputEl.addEventListener('keydown', e => {
      if (_mentionActive) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
          e.preventDefault();
          _handleMentionKey(e.key);
          return;
        }
        if (e.key === 'Escape') { hideMentionDropdown(); return; }
      }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
    });
    inputEl.addEventListener('input', _onMentionInput);
    inputEl.addEventListener('blur', () => setTimeout(hideMentionDropdown, 180));
  }

  // Delegate mention badge clicks in chat messages
  const msgContainer = document.getElementById('chat-messages');
  if (msgContainer) {
    msgContainer.addEventListener('click', (e) => {
      const badge = e.target.closest('.mention-badge');
      if (badge) navigateMention(badge.dataset.type, badge.dataset.id);
    });
  }

  initEmojiPicker();
  initFileAttachment();
  renderTopicTabs();
  renderTopicSidebar();
}

function renderTopicSidebar() {
  const list = document.getElementById('topic-list');
  if (!list) return;
  list.innerHTML = DEFAULT_TOPICS.map(t => {
    const fileCount = (sessionFileMap[t.id] || []).length;
    return `
    <div class="topic-item ${t.id === currentTopic ? 'active' : ''}" data-topic="${t.id}" title="${t.description}">
      <div class="topic-item-top">
        <span class="topic-icon">${t.icon}</span>
        <span class="topic-label">${t.label}</span>
        ${fileCount > 0 ? `<span class="topic-file-badge">${fileCount}</span>` : ''}
      </div>
      ${t.description ? `<div class="topic-description">${t.description}</div>` : ''}
    </div>`}).join('');
  list.querySelectorAll('.topic-item').forEach(item => {
    item.addEventListener('click', () => switchTopic(item.dataset.topic));
  });
}

function switchTopic(topicId) {
  currentTopic = topicId;
  renderTopicTabs();
  renderTopicSidebar();

  const topicObj = DEFAULT_TOPICS.find(t => t.id === topicId) || { label: topicId, icon: '', description: '' };

  // Update legacy name element
  const nameEl = document.getElementById('chat-topic-name');
  if (nameEl) nameEl.innerHTML = (topicObj.icon ? topicObj.icon + ' ' : '') + escapeHtml(topicObj.label);

  // Update channel header
  const chIconEl = document.getElementById('chat-channel-icon');
  const chNameEl = document.getElementById('chat-channel-name');
  const chDescEl = document.getElementById('chat-channel-desc');
  if (chIconEl) chIconEl.innerHTML = topicObj.icon || '';
  if (chNameEl) chNameEl.textContent = topicObj.label;
  if (chDescEl) chDescEl.textContent = topicObj.description || '';

  // Animate out → load → animate in
  const container = document.getElementById('chat-messages');
  if (container) {
    container.style.opacity = '0';
    container.style.transform = 'translateY(6px)';
  }
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
    if (document.hidden) return; // pause when tab not visible
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

// ── Session File Management ────────────────────────────────────────

function addFileToSession(topicId, file) {
  if (!sessionFileMap[topicId]) sessionFileMap[topicId] = [];
  const fileExists = sessionFileMap[topicId].some(f => f.name === file.name);
  if (!fileExists) {
    sessionFileMap[topicId].push(file);
    renderTopicSidebar();
    renderSessionFiles();
  }
}

function removeFileFromSession(topicId, fileName) {
  if (sessionFileMap[topicId]) {
    sessionFileMap[topicId] = sessionFileMap[topicId].filter(f => f.name !== fileName);
    renderTopicSidebar();
    renderSessionFiles();
  }
}

function renderSessionFiles() {
  const fileContainer = document.getElementById('session-files-container');
  if (!fileContainer) return;
  
  const files = sessionFileMap[currentTopic] || [];
  if (files.length === 0) {
    fileContainer.innerHTML = '';
    return;
  }
  
  fileContainer.innerHTML = `
    <div class="session-files-header">
      <span class="session-files-title">📎 Files in this session</span>
    </div>
    <div class="session-files-list">
      ${files.map(f => `
        <div class="session-file-item">
          <span class="session-file-icon">${getFileIcon(f.name)}</span>
          <span class="session-file-name" title="${f.name}">${f.name}</span>
          <button class="session-file-remove" onclick="removeFileFromSession('${currentTopic}', '${escapeHtml(f.name)}')" title="Remove">✕</button>
        </div>
      `).join('')}
    </div>
  `;
}

function getFileIcon(fileName) {
  if (fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return '🖼️';
  if (fileName.match(/\.(pdf)$/i)) return '📄';
  if (fileName.match(/\.(doc|docx)$/i)) return '📝';
  if (fileName.match(/\.(xlsx|xls|csv)$/i)) return '📊';
  if (fileName.match(/\.(txt)$/i)) return '📃';
  return '📎';
}

// ── Message rendering ──────────────────────────────────────────────

function formatMessageContent(message, fileUrl, fileName, fileType) {
  let content;
  if (message && message.startsWith('data:image')) {
    content = `<div class="msg-image-wrap"><img src="${message}" class="msg-image" alt="image" /></div>`;
  } else {
    content = escapeHtml(message || '').replace(/\n/g, '<br>');
    // Render @[Type:ID:Title] mention tags as clickable badges
    content = content.replace(/@\[([^:[\]]+):([^:[\]]+):([^\]]*)\]/g, (_, type, id, title) => {
      return `<span class="mention-badge" data-type="${escapeHtml(type)}" data-id="${escapeHtml(id)}">@${escapeHtml(title || type)}</span>`;
    });
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

function createMessageElement(msg, isGrouped = false) {
  const isMe    = msg.sender_email === currentUserEmail;
  const time    = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const initial = (msg.sender_name || msg.sender_email || '?').charAt(0).toUpperCase();

  const wrapper = document.createElement('div');
  wrapper.className = `chat-message ${isMe ? 'mine' : 'theirs'}${msg._pending ? ' pending' : ''}${isGrouped ? ' grouped' : ''}`;
  wrapper.id = 'msg-' + msg.id;
  wrapper.dataset.msgId   = msg.id;
  wrapper.dataset.msgText = msg.message || '';

  const avatarHTML = msg.sender_avatar
    ? `<img src="${msg.sender_avatar}" onerror="this.style.display='none'" />`
    : `<span>${initial}</span>`;

  const actionsHTML = isMe ? `
    <div class="msg-actions">
      <button class="msg-action-btn" onclick="startEditMessage('${msg.id}', this)" title="Edit">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="msg-action-btn danger" onclick="confirmDeleteMessage('${msg.id}', this)" title="Delete">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3,6 5,6 21,6"/>
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
        </svg>
      </button>
    </div>` : '';

  wrapper.innerHTML = `
    ${isMe ? `<div class="msg-avatar mine-av">${currentUserAvatar ? `<img src="${currentUserAvatar}"/>` : `<span>${initial}</span>`}</div>` : ''}
    ${!isMe ? `<div class="msg-avatar">${avatarHTML}</div>` : ''}
    <div class="msg-content">
      ${!isMe && !isGrouped ? `<div class="msg-sender">${escapeHtml(msg.sender_name || msg.sender_email)}</div>` : ''}
      <div class="msg-bubble-wrap">
        ${actionsHTML}
        <div class="msg-bubble">${formatMessageContent(msg.message, msg.file_url, msg.file_name, msg.file_type)}${msg.edited_at ? '<span class="msg-edited">(edited)</span>' : ''}</div>
      </div>
      <div class="msg-time">
        ${time}
        ${msg._pending ? '<span class="msg-pending">●</span>' : ''}
      </div>
    </div>
  `;
  return wrapper;
}

function renderMessages(messages) {
  chatMessages = messages;
  const container = document.getElementById('chat-messages');
  if (!container) return;

  // Empty state — shown when topic has no messages
  if (!messages.length) {
    const topicObj = DEFAULT_TOPICS.find(t => t.id === currentTopic) || { label: currentTopic, icon: '', description: 'No messages yet' };
    container.innerHTML = `
      <div class="chat-empty">
        <div class="chat-empty-icon">${topicObj.icon}</div>
        <div class="chat-empty-title"># ${escapeHtml(topicObj.label)}</div>
        <div class="chat-empty-sub">${escapeHtml(topicObj.description || 'No messages yet')}<br><span style="opacity:0.6;">Be the first to say something!</span></div>
      </div>`;
    _animateChatIn(container);
    return;
  }

  const existingIds = new Set([...container.querySelectorAll('.chat-message')].map(el => el.dataset.msgId));
  const newIds = new Set(messages.map(m => String(m.id)));

  // Full re-render only if message count changed significantly (deletions, edits, topic switch)
  const needsFullRender = existingIds.size > newIds.size ||
    [...existingIds].some(id => !newIds.has(id));

  const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 60;

  if (needsFullRender || existingIds.size === 0) {
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    messages.forEach((msg, i) => {
      const prev = i > 0 ? messages[i - 1] : null;
      const isGrouped = prev && prev.sender_email === msg.sender_email;
      const el = createMessageElement(msg, isGrouped);
      if (el) frag.appendChild(el);
    });
    container.appendChild(frag);
    if (window.twemoji) {
      twemoji.parse(container, { folder: 'svg', ext: '.svg', base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/' });
    }
    _animateChatIn(container);
  } else {
    // Incremental: only append new messages
    const newMessages = messages.filter(m => !existingIds.has(String(m.id)));
    if (newMessages.length > 0) {
      const frag = document.createDocumentFragment();
      newMessages.forEach((msg, i) => {
        const allIdx = messages.indexOf(msg);
        const prev = allIdx > 0 ? messages[allIdx - 1] : null;
        const isGrouped = prev && prev.sender_email === msg.sender_email;
        const el = createMessageElement(msg, isGrouped);
        if (el) frag.appendChild(el);
      });
      container.appendChild(frag);
      if (window.twemoji) {
        const newEls = [...container.querySelectorAll('.chat-message')].slice(-newMessages.length);
        newEls.forEach(el => twemoji.parse(el, { folder: 'svg', ext: '.svg', base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/' }));
      }
    }
  }

  if (wasAtBottom) container.scrollTop = container.scrollHeight;
  // Re-apply any active filter
  if (typeof _applyChatFilter === 'function') _applyChatFilter();

  // Fade in after topic switch
  _animateChatIn(container);
}

function _animateChatIn(container) {
  if (!container) return;
  // Already visible — skip
  if (container.style.opacity === '1' || !container.style.opacity) return;
  requestAnimationFrame(() => {
    container.style.transition = 'opacity 220ms ease, transform 220ms cubic-bezier(0.34,1.56,0.64,1)';
    container.style.opacity    = '1';
    container.style.transform  = 'translateY(0)';
  });
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
    await updateRow('Chat', msgId, { message: newText, edited_at: new Date().toISOString() });
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

function showConfirm(title, message, onConfirm) {
  const existing = document.getElementById('cc-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'cc-overlay';
  overlay.className = 'cc-overlay';
  overlay.innerHTML = `
    <div class="cc-box glass">
      <div class="cc-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div class="cc-title">${escapeHtml(title)}</div>
      <div class="cc-body">${escapeHtml(message)}</div>
      <div class="cc-actions">
        <button class="cc-cancel">Cancel</button>
        <button class="cc-confirm">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('cc-in'), 10);
  const close = () => { overlay.classList.remove('cc-in'); setTimeout(() => overlay.remove(), 220); };
  overlay.querySelector('.cc-cancel').onclick = close;
  overlay.querySelector('.cc-confirm').onclick = () => { close(); onConfirm(); };
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
}

async function confirmDeleteMessage(msgId, btn) {
  showConfirm('Delete Message', 'This message will be permanently deleted.', async () => {
    const wrapper = document.getElementById('msg-' + msgId);
    if (wrapper) wrapper.style.opacity = '0.4';
    try {
      await deleteRow('Chat', msgId);
      wrapper?.remove();
      chatMessages = chatMessages.filter(m => m.id !== msgId);
    } catch(e) {
      if (wrapper) wrapper.style.opacity = '1';
      showToast('Delete failed: ' + e.message, 'error');
    }
  });
}

// ── File Attachment (Google Drive upload) ──────────────────────────

function initFileAttachment() {
  const fileInput = document.getElementById('chat-file-input');
  if (!fileInput) return;

  // Restrict to images only — non-image file upload requires backend support not yet available
  fileInput.setAttribute('accept', 'image/*');

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    fileInput.value = '';

    if (!file.type.startsWith('image/')) {
      showToast('Only image files can be shared in chat.', 'error');
      return;
    }

    const MAX_SIZE = 8 * 1024 * 1024;
    if (file.size > MAX_SIZE) { showToast('Image too large. Max 8MB.', 'error'); return; }

    const input       = document.getElementById('chat-input');
    const attachLabel = document.getElementById('chat-attach-label');
    const prevPH      = input.placeholder;
    input.placeholder = '📎 Uploading ' + file.name + '…';
    input.disabled    = true;
    if (attachLabel) attachLabel.classList.add('uploading');

    try {
      // Compress aggressively so it fits in a Google Sheets cell (~45k char limit)
      const compressed = await compressImage(file, 360, 0.68);
      const dataUrl = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(compressed);
      });

      await callAPI('sendMessage', {
        data: {
          message:       dataUrl,
          sender_name:   currentUserName,
          sender_avatar: currentUserAvatar,
          topic:         currentTopic,
          file_name:     file.name,
          file_type:     file.type
        }
      });

      input.value = '';
      const msgs = await callAPI('getChat', {});
      renderMessages((msgs.rows || []).filter(m => !m.topic || m.topic === currentTopic));

    } catch(e) {
      showToast('Upload failed: ' + e.message, 'error');
    } finally {
      input.placeholder = prevPH;
      input.disabled    = false;
      if (attachLabel) attachLabel.classList.remove('uploading');
    }
  });
}

function compressImage(file, maxDim, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => resolve(file);
    img.src = url;
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

const EMOJI_CATEGORIES = [
  { label: '😊', name: 'Smileys',  emojis: ['😀','😄','😂','🤣','😊','😍','🥰','😎','🤔','😅','😢','😡','🤯','🥳','😴','🤗','😬','🫡','🫶','😇','🤩','🙃','😤','🥺','😈','💀','😏','🫠','😻','🤭'] },
  { label: '👋', name: 'People',   emojis: ['👍','👎','👏','🙌','👋','🤝','💪','👀','🤞','✌️','☝️','🫂','💅','🙏','🫵','🤜','🤛','👊','🤚','🖐️','✋','🤙','🦾','🧠','🫀'] },
  { label: '🎉', name: 'Fun',      emojis: ['🎉','🔥','💯','✅','❌','⚠️','🏆','🎯','🚀','⭐','🌟','💡','🎊','🎈','🎁','🥇','🎶','🌈','⚡','💎','🦋','🌺','🌸','🍀','🔮','🎠'] },
  { label: '💼', name: 'Work',     emojis: ['📌','📎','🗂️','💬','📊','📅','📝','🔔','💼','🕐','📱','💻','📧','📋','🔍','⚙️','🛠️','📐','📁','🏗️','🖥️','🖨️','⌨️','🗃️','📈'] },
  { label: '❤️', name: 'Symbols',  emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💕','💞','💓','✨','💫','🌊','🌙','☀️','❄️','🔴','🟡','🟢','🔵','⚪','⚫','🟣'] },
];

function _initSimpleEmojiPicker(btn, picker, input) {
  let activeCategory = 0;

  function renderPicker() {
    picker.innerHTML = `
      <div class="ep-cats">
        ${EMOJI_CATEGORIES.map((c, i) => `<button class="ep-cat${i === activeCategory ? ' active' : ''}" data-cat="${i}" title="${c.name}">${c.label}</button>`).join('')}
      </div>
      <div class="ep-grid">
        ${EMOJI_CATEGORIES[activeCategory].emojis.map(e => `<button class="ep-btn" data-emoji="${encodeURIComponent(e)}">${e}</button>`).join('')}
      </div>
    `;
    picker.querySelectorAll('.ep-cat').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        activeCategory = parseInt(b.dataset.cat);
        renderPicker();
        picker.classList.remove('hidden');
      });
    });
    picker.querySelector('.ep-grid').addEventListener('click', ev => {
      const b = ev.target.closest('.ep-btn');
      if (!b) return;
      const emoji = decodeURIComponent(b.dataset.emoji);
      const pos = input.selectionStart || 0;
      input.value = input.value.slice(0, pos) + emoji + input.value.slice(pos);
      input.focus();
      input.setSelectionRange(pos + emoji.length, pos + emoji.length);
      picker.classList.add('hidden');
    });
  }

  renderPicker();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (picker.classList.contains('hidden')) { renderPicker(); picker.classList.remove('hidden'); }
    else picker.classList.add('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!picker.contains(e.target) && e.target !== btn) picker.classList.add('hidden');
  });
}

// ── @Mention Autocomplete ──────────────────────────────────────────

let _mentionActive = false;
let _mentionSelectedIdx = -1;

function _onMentionInput(e) {
  const input  = e.target;
  const before = input.value.slice(0, input.selectionStart);
  const match  = before.match(/@([^@\s]*)$/);
  if (match) {
    _showMentionDropdown(match[1].toLowerCase());
  } else {
    hideMentionDropdown();
  }
}

function _handleMentionKey(key) {
  const items = [...document.querySelectorAll('#chat-mention-dropdown .mention-item')];
  if (!items.length) return;
  if (key === 'ArrowDown') {
    _mentionSelectedIdx = Math.min(_mentionSelectedIdx + 1, items.length - 1);
  } else if (key === 'ArrowUp') {
    _mentionSelectedIdx = Math.max(_mentionSelectedIdx - 1, 0);
  } else if (key === 'Enter' && _mentionSelectedIdx >= 0) {
    items[_mentionSelectedIdx]?.click();
    return;
  }
  items.forEach((el, i) => el.classList.toggle('selected', i === _mentionSelectedIdx));
}

function _showMentionDropdown(query) {
  const dropdown = document.getElementById('chat-mention-dropdown');
  if (!dropdown) return;

  const sources = [
    { label: 'Tasks',           type: 'Tasks',      rows: window.tableData?.Tasks      || [] },
    { label: 'Purchase Orders', type: 'POs',        rows: window.tableData?.POs        || [] },
    { label: 'Expenses',        type: 'Expenses',   rows: window.tableData?.Expenses   || [] },
    { label: 'Quotations',      type: 'Quotations', rows: window.tableData?.Quotations || [] },
  ];

  let html = '';
  let count = 0;

  for (const src of sources) {
    const hits = src.rows.filter(r => {
      const text = (r.title || r.name || r.description || r.number || String(r.id || '')).toLowerCase();
      return !query || text.includes(query);
    }).slice(0, 4);
    if (!hits.length) continue;
    html += `<div class="mention-group-label">${escapeHtml(src.label)}</div>`;
    for (const row of hits) {
      const title = row.title || row.name || row.description || '#' + row.id;
      const sub   = row.status || row.amount || '';
      html += `<div class="mention-item" data-type="${escapeHtml(src.type)}" data-id="${escapeHtml(String(row.id))}" data-title="${escapeHtml(title)}">
        <span class="mention-item-label">${escapeHtml(title)}</span>
        ${sub ? `<span class="mention-item-sub">${escapeHtml(String(sub))}</span>` : ''}
      </div>`;
      count++;
    }
  }

  if (!count) {
    html = `<div class="mention-empty">${query.length < 1 ? 'Type to search…' : 'No results for "' + escapeHtml(query) + '"'}</div>`;
  }

  dropdown.innerHTML = html;
  dropdown.classList.remove('hidden');
  _mentionActive     = true;
  _mentionSelectedIdx = -1;

  dropdown.querySelectorAll('.mention-item').forEach(el => {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      _insertMention(el.dataset.type, el.dataset.id, el.dataset.title);
    });
  });
}

function hideMentionDropdown() {
  const dropdown = document.getElementById('chat-mention-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
  _mentionActive      = false;
  _mentionSelectedIdx = -1;
}

function _insertMention(type, id, title) {
  const input  = document.getElementById('chat-input');
  if (!input) return;
  const val    = input.value;
  const pos    = input.selectionStart;
  const before = val.slice(0, pos).replace(/@([^@\s]*)$/, '');
  const after  = val.slice(pos);
  const tag    = `@[${type}:${id}:${title}] `;
  input.value  = before + tag + after;
  const newPos = (before + tag).length;
  input.focus();
  input.setSelectionRange(newPos, newPos);
  hideMentionDropdown();
}

function navigateMention(type, id) {
  const viewMap = { Tasks: 'tasks', POs: 'pos', Expenses: 'expenses', Quotations: 'quotations' };
  const view = viewMap[type] || type.toLowerCase();
  if (typeof navigateTo === 'function') navigateTo(view);
  setTimeout(() => {
    const row = document.querySelector(`tr[data-id="${CSS.escape(String(id))}"]`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('row-mention-highlight');
      setTimeout(() => row.classList.remove('row-mention-highlight'), 2000);
    }
  }, 420);
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
