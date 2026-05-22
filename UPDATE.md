# Task Tracker — Full Update Prompt for Claude Code

Read ALL files in `E:\task-tracker\` before making any changes.
Do not skip any file. After all changes, list every file modified or created.

---

## PART 1 — LOGO FILES SETUP

Copy the 6 uploaded logo files into `E:\task-tracker\frontend\assets\`:
- `favicon.svg`
- `icon-dark.svg`
- `icon-light.svg`
- `icon-solid.svg`
- `logo-dark.svg`
- `logo-light.svg`

Create the folder `frontend/assets/` if it doesn't exist.

The user will manually copy the SVG files there. Your job is to wire them up:

### In `index.html` `<head>`:
```html
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
<link rel="apple-touch-icon" href="assets/icon-solid.svg">
```

### Sidebar logo — use theme-aware logo:
Replace the `.nav-logo` inner HTML with:
```html
<div class="nav-logo">
  <img id="sidebar-logo" src="assets/logo-dark.svg" alt="Task Tracker" height="36" style="max-width:160px;object-fit:contain;">
</div>
```

### Login card logo — use icon only:
Replace `.login-logo-icon` inner content with:
```html
<img id="login-icon" src="assets/icon-dark.svg" alt="Task Tracker" width="44" height="44" style="border-radius:10px;">
```

### Theme-aware logo switching — add to `applyTheme()` function in inline script:
```javascript
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : '');
  localStorage.setItem('tt_theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';

  // Switch logos based on theme
  const sidebarLogo = document.getElementById('sidebar-logo');
  const loginIcon   = document.getElementById('login-icon');
  if (sidebarLogo) sidebarLogo.src = theme === 'light' ? 'assets/logo-light.svg' : 'assets/logo-dark.svg';
  if (loginIcon)   loginIcon.src   = theme === 'light' ? 'assets/icon-light.svg' : 'assets/icon-dark.svg';
}
```

### CSS for sidebar logo:
```css
.nav-logo {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
}
#sidebar-logo {
  height: 36px;
  max-width: 160px;
  object-fit: contain;
  transition: opacity 0.2s;
}
```

---

## PART 2 — CHAT PERFORMANCE FIX (optimistic UI)

The current flow is slow: send → wait for API → then fetch all messages.
Replace with optimistic UI: show message instantly, confirm in background.

### Update `frontend/chat.js` — replace `sendChatMessage()`:

```javascript
async function sendChatMessage() {
  const input   = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message || !currentUserEmail) return;

  // Clear input immediately
  input.value = '';

  // OPTIMISTIC: add message to DOM instantly
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
        topic:         'general'
      }
    });

    // Replace temp message with confirmed one
    const existing = document.getElementById('msg-' + tempId);
    if (existing) {
      existing.id = 'msg-' + result.id;
      existing.classList.remove('pending');
      const pendingDot = existing.querySelector('.msg-pending');
      if (pendingDot) pendingDot.remove();
    }

    // Update local cache
    if (!chatMessages) chatMessages = [];
    chatMessages.push({ ...tempMsg, id: result.id, _pending: false });
    lastMessageId = result.id;

  } catch(e) {
    // Mark as failed
    const existing = document.getElementById('msg-' + tempId);
    if (existing) {
      existing.classList.add('failed');
      existing.querySelector('.msg-pending')?.remove();
      const failEl = document.createElement('span');
      failEl.className = 'msg-failed-label';
      failEl.textContent = t('send_failed');
      failEl.onclick = () => { input.value = message; existing.remove(); };
      existing.querySelector('.msg-content')?.appendChild(failEl);
    }
    console.error('Send failed:', e.message);
  }
}
```

Add `chatMessages` array to store local state at top of chat.js:
```javascript
let chatMessages = [];
```

Update `renderMessages()` to also update `chatMessages`:
```javascript
function renderMessages(messages) {
  chatMessages = messages;
  // ... rest of existing renderMessages code
}
```

Create a `createMessageElement(msg)` function that returns a DOM element:
```javascript
function createMessageElement(msg) {
  const isMe    = msg.sender_email === currentUserEmail;
  const time    = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const initial = (msg.sender_name || msg.sender_email || '?').charAt(0).toUpperCase();

  const wrapper = document.createElement('div');
  wrapper.className = `chat-message ${isMe ? 'mine' : 'theirs'}${msg._pending ? ' pending' : ''}`;
  wrapper.id = 'msg-' + msg.id;
  wrapper.dataset.msgId = msg.id;
  wrapper.dataset.msgText = msg.message;

  const avatarHTML = msg.sender_avatar
    ? `<img src="${msg.sender_avatar}" onerror="this.style.display='none'" />`
    : `<span>${initial}</span>`;

  wrapper.innerHTML = `
    ${!isMe ? `<div class="msg-avatar">${avatarHTML}</div>` : ''}
    <div class="msg-content">
      ${!isMe ? `<div class="msg-sender">${escapeHtml(msg.sender_name || msg.sender_email)}</div>` : ''}
      <div class="msg-bubble-wrap">
        <div class="msg-bubble">${formatMessageContent(msg.message)}${msg.edited_at ? '<span class="msg-edited">(edited)</span>' : ''}</div>
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
```

Update `renderMessages()` to use `createMessageElement()`:
```javascript
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
}
```

---

## PART 3 — CHAT EDIT & DELETE MESSAGES

### Add to `backend/Code.gs` inside the switch(action) block:
```javascript
case 'editMessage':   return respond(editMessage(body.id, body.message));
case 'deleteMessage': return respond(deleteMessage(body.id));
```

### Add these functions to Code.gs:
```javascript
function editMessage(id, newMessage) {
  const sheet = getSpreadsheet().getSheetByName('Chat');
  if (!sheet) return { error: 'Chat sheet not found' };
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { error: 'Message not found' };
  const data    = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = data[0];
  const idCol   = headers.indexOf('id');
  const msgCol  = headers.indexOf('message');
  const editCol = headers.indexOf('edited_at');
  const rowIdx  = data.findIndex((r, i) => i > 0 && r[idCol] === id);
  if (rowIdx === -1) return { error: 'Message not found' };
  sheet.getRange(rowIdx + 1, msgCol + 1).setValue(newMessage);
  if (editCol >= 0) sheet.getRange(rowIdx + 1, editCol + 1).setValue(new Date().toISOString());
  return { success: true };
}

function deleteMessage(id) {
  const sheet = getSpreadsheet().getSheetByName('Chat');
  if (!sheet) return { error: 'Chat sheet not found' };
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { error: 'Message not found' };
  const data   = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const idCol  = data[0].indexOf('id');
  const rowIdx = data.findIndex((r, i) => i > 0 && r[idCol] === id);
  if (rowIdx === -1) return { error: 'Message not found' };
  sheet.deleteRow(rowIdx + 1);
  return { success: true };
}
```

### Also add `edited_at` column to Chat sheet headers note:
Tell user to add `edited_at` as column H in the Chat sheet (after timestamp).

### Frontend edit/delete functions — add to `chat.js`:
```javascript
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
  const wrapper  = document.getElementById('msg-' + msgId);
  const ta       = wrapper?.querySelector('textarea');
  const newText  = ta?.value.trim();
  if (!newText) return;

  try {
    await callAPI('editMessage', { id: msgId, message: newText });
    const bubble = wrapper.querySelector('.msg-bubble');
    bubble.innerHTML = formatMessageContent(newText) + '<span class="msg-edited">(edited)</span>';
    wrapper.dataset.msgText = newText;
  } catch(e) { alert('Edit failed: ' + e.message); }
}

function cancelEditMessage(msgId, original, el) {
  const wrapper = document.getElementById('msg-' + msgId);
  const bubble  = wrapper?.querySelector('.msg-bubble');
  if (bubble) bubble.innerHTML = formatMessageContent(original);
}

async function confirmDeleteMessage(msgId, btn) {
  if (!confirm(t('confirm_delete_message'))) return;
  const wrapper = document.getElementById('msg-' + msgId);
  if (wrapper) wrapper.style.opacity = '0.4';
  try {
    await callAPI('deleteMessage', { id: msgId });
    wrapper?.remove();
    chatMessages = chatMessages.filter(m => m.id !== msgId);
  } catch(e) {
    if (wrapper) wrapper.style.opacity = '1';
    alert('Delete failed: ' + e.message);
  }
}
```

### CSS for edit/delete — add to `style.css`:
```css
.msg-bubble-wrap { position: relative; display: flex; align-items: flex-end; gap: 4px; }
.msg-actions {
  display: none; flex-direction: column; gap: 2px;
  position: absolute; right: -52px; top: 0;
}
.mine .msg-actions { right: auto; left: -52px; }
.chat-message:hover .msg-actions { display: flex; }

.msg-action-btn {
  width: 24px; height: 24px; border-radius: 6px;
  background: var(--glass-bg); border: 1px solid var(--border);
  color: var(--text-3); font-size: 12px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.msg-action-btn:hover { background: var(--glass-bg-hover); color: var(--text-1); }
.msg-action-btn.danger:hover { background: rgba(239,68,68,0.12); color: var(--accent-red); border-color: rgba(239,68,68,0.2); }

.msg-edit-input {
  width: 100%; min-height: 60px; padding: 6px 10px;
  background: var(--glass-bg); border: 1px solid var(--accent);
  border-radius: 10px; color: var(--text-1); font-size: 13px;
  font-family: 'Inter', sans-serif; resize: none; outline: none;
}

.msg-edit-actions { display: flex; gap: 6px; margin-top: 6px; }
.msg-edit-save {
  background: var(--accent); color: white; border: none;
  padding: 4px 12px; border-radius: 6px; font-size: 12px;
  cursor: pointer; font-family: 'Inter', sans-serif;
}
.msg-edit-cancel {
  background: var(--glass-bg); border: 1px solid var(--border);
  color: var(--text-2); padding: 4px 12px; border-radius: 6px;
  font-size: 12px; cursor: pointer; font-family: 'Inter', sans-serif;
}

.msg-edited { font-size: 10px; color: var(--text-4); margin-left: 6px; font-style: italic; }
.msg-pending { color: var(--text-4); font-size: 10px; margin-left: 4px; animation: blink 1s infinite; }
.msg-failed-label { font-size: 11px; color: var(--accent-red); cursor: pointer; display: block; margin-top: 4px; }
.chat-message.pending .msg-bubble { opacity: 0.65; }
.chat-message.failed .msg-bubble { border-color: rgba(239,68,68,0.3); }
@keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
```

---

## PART 4 — FILE & IMAGE ATTACHMENTS IN CHAT

Use Google Drive via Apps Script — files upload to Drive, URL stored in Chat sheet.

### Add `file_url` and `file_name` and `file_type` columns to Chat sheet (columns I, J, K).

### Add to Code.gs:
```javascript
case 'uploadFile': return respond(uploadFileToDrive(body.fileData, body.fileName, body.fileType, user.email));
```

```javascript
function uploadFileToDrive(base64Data, fileName, mimeType, uploaderEmail) {
  try {
    const folder = getOrCreateFolder('TaskTrackerChat');
    const bytes  = Utilities.base64Decode(base64Data);
    const blob   = Utilities.newBlob(bytes, mimeType, fileName);
    const file   = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId  = file.getId();
    const viewUrl = 'https://drive.google.com/file/d/' + fileId + '/view';
    const directUrl = mimeType.startsWith('image/')
      ? 'https://drive.google.com/uc?export=view&id=' + fileId
      : viewUrl;
    return { success: true, url: directUrl, viewUrl, fileId, fileName };
  } catch(e) {
    return { error: 'Upload failed: ' + e.message };
  }
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}
```

### Update sendMessage in Code.gs to accept file_url, file_name, file_type:
```javascript
function sendMessage(data, senderEmail) {
  const sheet = getSpreadsheet().getSheetByName('Chat');
  if (!sheet) return { error: 'Chat sheet not found' };
  const now = new Date().toISOString();
  const id  = Utilities.getUuid();
  sheet.appendRow([
    id,
    data.message       || '',
    senderEmail,
    data.sender_name   || senderEmail,
    data.sender_avatar || '',
    data.topic         || 'general',
    now,
    '',                         // edited_at
    data.file_url      || '',   // file_url
    data.file_name     || '',   // file_name
    data.file_type     || ''    // file_type
  ]);
  return { success: true, id, timestamp: now };
}
```

### Frontend — add file attachment button to chat input bar in index.html:
```html
<div class="chat-input-bar">
  <img id="chat-avatar" src="" class="chat-input-avatar" />
  <label class="chat-attach-btn" title="Attach file">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
    </svg>
    <input type="file" id="chat-file-input" accept="image/*,.pdf,.doc,.docx,.xlsx,.txt" style="display:none" />
  </label>
  <input id="chat-input" type="text" placeholder="Message your team..." autocomplete="off" />
  <button id="emoji-btn" class="emoji-toggle-btn">😊</button>
  <div id="emoji-picker" class="emoji-picker hidden"></div>
  <button id="chat-send">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/>
    </svg>
  </button>
</div>
```

### Add to chat.js — file upload handler:
```javascript
function initFileAttachment() {
  const fileInput = document.getElementById('chat-file-input');
  if (!fileInput) return;
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) { alert('File too large. Max 5MB.'); return; }

    // Show uploading indicator
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

      // Send message with file
      await callAPI('sendMessage', {
        data: {
          message:       input.value.trim() || file.name,
          sender_name:   currentUserName,
          sender_avatar: currentUserAvatar,
          topic:         'general',
          file_url:      result.url,
          file_name:     file.name,
          file_type:     file.type
        }
      });

      input.value = '';
      fileInput.value = '';
      const msgs = await callAPI('getChat', {});
      renderMessages(msgs.rows || []);

    } catch(e) {
      alert('Upload failed: ' + e.message);
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
```

### Update `formatMessageContent()` in chat.js to render images and file links:
```javascript
function formatMessageContent(message, fileUrl, fileName, fileType) {
  let content = escapeHtml(message || '');
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
```

### Add image viewer to index.html (before </body>):
```html
<div id="image-viewer" class="hidden">
  <div class="image-viewer-backdrop" onclick="closeImageViewer()"></div>
  <div class="image-viewer-content">
    <button class="image-viewer-close" onclick="closeImageViewer()">✕</button>
    <img id="image-viewer-img" src="" alt="" />
    <div id="image-viewer-caption"></div>
    <a id="image-viewer-download" href="" target="_blank" class="image-viewer-download">Open in Drive ↗</a>
  </div>
</div>
```

```javascript
function openImageViewer(url, name) {
  document.getElementById('image-viewer-img').src = url;
  document.getElementById('image-viewer-caption').textContent = name || '';
  document.getElementById('image-viewer-download').href = url;
  document.getElementById('image-viewer').classList.remove('hidden');
}
function closeImageViewer() {
  document.getElementById('image-viewer').classList.add('hidden');
  document.getElementById('image-viewer-img').src = '';
}
```

### CSS for file/image features:
```css
.chat-attach-btn {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--glass-bg); border: 1px solid var(--border);
  color: var(--text-3); display: flex; align-items: center;
  justify-content: center; cursor: pointer; transition: all 0.15s; flex-shrink: 0;
}
.chat-attach-btn:hover { background: var(--glass-bg-hover); color: var(--text-1); }

.msg-image-wrap {
  position: relative; cursor: pointer; border-radius: 10px;
  overflow: hidden; max-width: 240px; margin-top: 6px; display: block;
}
.msg-image { width: 100%; max-height: 200px; object-fit: cover; display: block; border-radius: 10px; }
.msg-image-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0);
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px; transition: background 0.2s;
}
.msg-image-wrap:hover .msg-image-overlay { background: rgba(0,0,0,0.35); }

.msg-file-link {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 8px; margin-top: 6px;
  background: var(--glass-bg); border: 1px solid var(--border);
  color: var(--text-2); font-size: 12px; text-decoration: none;
  transition: all 0.15s;
}
.msg-file-link:hover { background: var(--glass-bg-hover); color: var(--text-1); }

#image-viewer {
  position: fixed; inset: 0; z-index: 500;
  display: flex; align-items: center; justify-content: center;
}
.image-viewer-backdrop {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(12px);
  cursor: pointer;
}
.image-viewer-content {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  max-width: 90vw; max-height: 90vh;
}
.image-viewer-close {
  position: absolute; top: -40px; right: 0;
  background: var(--glass-bg); border: 1px solid var(--border);
  color: white; width: 32px; height: 32px; border-radius: 8px;
  cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;
}
#image-viewer-img {
  max-width: 90vw; max-height: 75vh;
  object-fit: contain; border-radius: 14px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6);
}
#image-viewer-caption { font-size: 13px; color: rgba(255,255,255,0.6); }
.image-viewer-download {
  font-size: 12px; color: var(--accent); text-decoration: none; padding: 6px 16px;
  background: var(--glass-bg); border: 1px solid var(--border);
  border-radius: 20px; transition: all 0.15s;
}
.image-viewer-download:hover { background: var(--glass-bg-hover); }
```

---

## PART 5 — EMOJI PICKER (iOS-style using Twemoji + emoji-mart)

### Add to `index.html` `<head>`:
```html
<script src="https://cdn.jsdelivr.net/npm/twemoji@14.0.2/dist/twemoji.min.js" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/emoji-mart@5.5.2/dist/browser.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/emoji-mart@5.5.2/css/emoji-mart.css" />
```

### Add emoji rendering globally — call after sign-in and after any DOM update:
```javascript
function renderTwemoji(element) {
  if (window.twemoji && element) {
    twemoji.parse(element, {
      folder: 'svg',
      ext: '.svg',
      base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/'
    });
  }
}
```

Call `renderTwemoji(document.body)` once after sign-in.
Call `renderTwemoji(container)` inside `renderMessages()` after building DOM.

### Emoji picker button in chat input bar — add to chat.js:
```javascript
function initEmojiPicker() {
  const btn     = document.getElementById('emoji-btn');
  const picker  = document.getElementById('emoji-picker');
  const input   = document.getElementById('chat-input');
  if (!btn || !picker) return;

  const emojiPicker = new EmojiMart.Picker({
    onEmojiSelect: (emoji) => {
      const pos = input.selectionStart;
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
```

Call `initEmojiPicker()` inside `initChat()`.

### CSS for emoji picker:
```css
.emoji-toggle-btn {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--glass-bg); border: 1px solid var(--border);
  font-size: 18px; cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  transition: all 0.15s; flex-shrink: 0;
}
.emoji-toggle-btn:hover { background: var(--glass-bg-hover); transform: scale(1.1); }

.emoji-picker {
  position: absolute; bottom: 80px; right: 1.25rem;
  z-index: 100; border-radius: var(--r-md);
  box-shadow: var(--glass-shadow-lg);
  overflow: hidden;
}

/* Style twemoji images */
img.emoji {
  height: 1.2em; width: 1.2em;
  margin: 0 0.05em 0 0.1em;
  vertical-align: -0.2em;
  display: inline-block;
}
```

---

## PART 6 — ARABIC LANGUAGE + RTL SUPPORT

### Create `frontend/i18n.js`:
```javascript
const TRANSLATIONS = {
  en: {
    // Nav
    dashboard:        'Dashboard',
    tasks:            'Tasks',
    purchase_orders:  'Purchase Orders',
    milestones:       'Milestones',
    expenses:         'Expenses',
    team_chat:        'Team Chat',
    settings:         'Settings',
    sign_out:         'Sign out',

    // Actions
    add_task:         'Add Task',
    add_po:           'Add PO',
    add_milestone:    'Add Milestone',
    add_expense:      'Add Expense',
    edit:             'Edit',
    delete:           'Delete',
    save:             'Save',
    cancel:           'Cancel',
    search:           'Search...',
    refresh:          'Refresh',
    view_all:         'View all →',

    // Dashboard
    open_tasks:       'Open Tasks',
    overdue:          'Overdue',
    po_spend:         'PO Spend',
    avg_progress:     'Avg Progress',
    total_expenses:   'Total Expenses',
    task_status:      'Task Status',
    po_status:        'PO Status',
    recent_tasks:     'Recent Tasks',
    recent_expenses:  'Recent Expenses',

    // Chat
    message_placeholder: 'Message your team...',
    send_failed:      'Failed. Tap to retry.',
    confirm_delete_message: 'Delete this message?',
    live:             'Live',

    // Table headers
    title:            'Title',
    status:           'Status',
    priority:         'Priority',
    assignee:         'Assignee',
    due_date:         'Due Date',
    project:          'Project',
    supplier:         'Supplier',
    amount:           'Amount',
    date:             'Date',
    actions:          'Actions',

    // Status values
    open:             'Open',
    in_progress:      'In Progress',
    done:             'Done',
    overdue_status:   'Overdue',
    draft:            'Draft',
    submitted:        'Submitted',
    received:         'Received',
    cancelled:        'Cancelled',

    // Settings
    team_members:     'Team Members',
    preferences:      'Preferences',
    language:         'Language',
    currency:         'Currency',
    date_format:      'Date format',
    save_preferences: 'Save preferences',
    add_member:       'Add',
    remove:           'Remove',
    you:              'You',
    about:            'About',
    notifications_enabled: 'Notifications are enabled for this device.',

    // Auth
    welcome_back:     'Welcome back',
    sign_in_subtitle: 'Sign in to continue to your workspace',
    secured_by:       'Secured with Google OAuth 2.0',
    continue_as:      'Continue as',

    // Greeting
    good_morning:     'Good morning',
    good_afternoon:   'Good afternoon',
    good_evening:     'Good evening',
  },

  ar: {
    // Nav
    dashboard:        'لوحة التحكم',
    tasks:            'المهام',
    purchase_orders:  'طلبات الشراء',
    milestones:       'المراحل',
    expenses:         'المصروفات',
    team_chat:        'دردشة الفريق',
    settings:         'الإعدادات',
    sign_out:         'تسجيل الخروج',

    // Actions
    add_task:         'إضافة مهمة',
    add_po:           'إضافة طلب شراء',
    add_milestone:    'إضافة مرحلة',
    add_expense:      'إضافة مصروف',
    edit:             'تعديل',
    delete:           'حذف',
    save:             'حفظ',
    cancel:           'إلغاء',
    search:           'بحث...',
    refresh:          'تحديث',
    view_all:         'عرض الكل ←',

    // Dashboard
    open_tasks:       'المهام المفتوحة',
    overdue:          'متأخرة',
    po_spend:         'إجمالي الطلبات',
    avg_progress:     'متوسط التقدم',
    total_expenses:   'إجمالي المصروفات',
    task_status:      'حالة المهام',
    po_status:        'حالة الطلبات',
    recent_tasks:     'أحدث المهام',
    recent_expenses:  'أحدث المصروفات',

    // Chat
    message_placeholder: 'أرسل رسالة للفريق...',
    send_failed:      'فشل الإرسال. انقر للمحاولة.',
    confirm_delete_message: 'حذف هذه الرسالة؟',
    live:             'مباشر',

    // Table headers
    title:            'العنوان',
    status:           'الحالة',
    priority:         'الأولوية',
    assignee:         'المسؤول',
    due_date:         'تاريخ الاستحقاق',
    project:          'المشروع',
    supplier:         'المورد',
    amount:           'المبلغ',
    date:             'التاريخ',
    actions:          'الإجراءات',

    // Status values
    open:             'مفتوح',
    in_progress:      'قيد التنفيذ',
    done:             'مكتمل',
    overdue_status:   'متأخر',
    draft:            'مسودة',
    submitted:        'مُقدَّم',
    received:         'مُستلَم',
    cancelled:        'ملغي',

    // Settings
    team_members:     'أعضاء الفريق',
    preferences:      'التفضيلات',
    language:         'اللغة',
    currency:         'العملة',
    date_format:      'تنسيق التاريخ',
    save_preferences: 'حفظ التفضيلات',
    add_member:       'إضافة',
    remove:           'إزالة',
    you:              'أنت',
    about:            'حول التطبيق',
    notifications_enabled: 'الإشعارات مفعّلة على هذا الجهاز.',

    // Auth
    welcome_back:     'مرحباً بعودتك',
    sign_in_subtitle: 'سجّل دخولك للمتابعة إلى مساحة عملك',
    secured_by:       'محمي بـ Google OAuth 2.0',
    continue_as:      'متابعة كـ',

    // Greeting
    good_morning:     'صباح الخير',
    good_afternoon:   'مساء الخير',
    good_evening:     'مساء النور',
  }
};

let currentLang = localStorage.getItem('tt_lang') || 'en';

function t(key) {
  return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key])
    || TRANSLATIONS['en'][key]
    || key;
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('tt_lang', lang);
  applyLanguage();
}

function applyLanguage() {
  const isRTL = currentLang === 'ar';

  // Set HTML dir and lang attributes
  document.documentElement.dir  = isRTL ? 'rtl' : 'ltr';
  document.documentElement.lang = currentLang;

  // Apply RTL class for CSS targeting
  document.body.classList.toggle('rtl', isRTL);

  // Translate all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else if (el.tagName === 'OPTION') {
      // skip — keep values
    } else {
      el.textContent = val;
    }
  });

  // Translate placeholders with data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });

  // Update chat input placeholder
  const chatInput = document.getElementById('chat-input');
  if (chatInput) chatInput.placeholder = t('message_placeholder');

  // Re-render active view to apply translations
  const activeNav = document.querySelector('.nav-item.active');
  if (activeNav) navigateTo(activeNav.dataset.view);
}

// Initialize on load
function initLanguage() {
  currentLang = localStorage.getItem('tt_lang') || 'en';
  applyLanguage();
}
```

### Add `data-i18n` attributes to key elements in `index.html`:

Nav items:
```html
<li class="nav-item active" data-view="dashboard">
  <svg ...></svg>
  <span data-i18n="dashboard">Dashboard</span>
</li>
<li class="nav-item" data-view="tasks">
  <svg ...></svg>
  <span data-i18n="tasks">Tasks</span>
</li>
<!-- repeat for all nav items -->
```

Add `data-i18n` to: all `.view-header h2`, all `.btn-add`, `#modal-cancel`, `#modal-save`, stat card labels, chart titles, panel headers, settings section titles, signout button.

### Add RTL CSS to `style.css`:
```css
/* RTL Layout */
.rtl #sidebar {
  border-right: none;
  border-left: 1px solid var(--border);
  order: 2;
}

.rtl .main-col { order: 1; }

.rtl .nav-item { flex-direction: row-reverse; }
.rtl .nav-item.active::before {
  left: auto; right: 0;
  border-radius: 2px 0 0 2px;
}

.rtl .topbar-right { flex-direction: row-reverse; }

.rtl table { direction: rtl; }
.rtl th, .rtl td { text-align: right; }

.rtl .filter-input { direction: rtl; }

.rtl .chat-message.mine { flex-direction: row; }
.rtl .chat-message.theirs { flex-direction: row-reverse; }
.rtl .mine .msg-content { align-items: flex-start; }
.rtl .mine .msg-bubble {
  border-radius: 16px;
  border-bottom-right-radius: 16px;
  border-bottom-left-radius: 4px;
}
.rtl .theirs .msg-bubble {
  border-radius: 16px;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 4px;
}

.rtl .chat-input-bar { flex-direction: row-reverse; }
.rtl #chat-input { direction: rtl; text-align: right; }

.rtl .modal-footer { flex-direction: row-reverse; }
.rtl .form-group label { text-align: right; }

.rtl .stat-card { text-align: right; }
.rtl .view-header { flex-direction: row-reverse; }

.rtl .recent-item { flex-direction: row-reverse; }
.rtl .recent-item-left { flex-direction: row-reverse; }

/* Arabic font enhancement */
.rtl, .rtl * {
  font-family: 'Segoe UI', 'Tahoma', 'Arial', system-ui, sans-serif;
  letter-spacing: 0;
}
```

### Add language selector in Settings tab:
In the Preferences section of the settings view HTML, add:
```html
<div class="pref-item">
  <div>
    <div class="pref-label" data-i18n="language">Language</div>
    <div class="pref-sub">Interface language / لغة الواجهة</div>
  </div>
  <select id="pref-language" class="pref-select" onchange="setLanguage(this.value)">
    <option value="en">English</option>
    <option value="ar">العربية</option>
  </select>
</div>
```

In `loadSettings()`, add:
```javascript
const langEl = document.getElementById('pref-language');
if (langEl) langEl.value = currentLang;
```

### Script load order — add i18n.js BEFORE all other scripts:
```html
<script src="i18n.js"></script>
<script src="config.js"></script>
<script src="cache.js"></script>
<script src="api.js"></script>
<script src="tables.js"></script>
<script src="dashboard.js"></script>
<script src="chat.js"></script>
<script> ... inline script ... </script>
```

Call `initLanguage()` inside `window.onload` BEFORE `initGoogleAuth()`.

---

## PART 7 — APPS SCRIPT: REDEPLOY REMINDER

After updating Code.gs, the user MUST:
1. Go to Apps Script editor → **Deploy → Manage deployments**
2. Click ✏️ edit → set **New version** → click **Deploy**
3. Add to Chat sheet column H: `edited_at`
4. Add to Chat sheet columns I, J, K: `file_url`, `file_name`, `file_type`

---

## FINAL RULES

1. Read ALL files before editing
2. Create `frontend/i18n.js` as a new file
3. Create `frontend/assets/` folder reference — user will copy SVG files there manually
4. Script load order: `i18n.js` → `config.js` → `cache.js` → `api.js` → `tables.js` → `dashboard.js` → `chat.js` → inline script
5. Do NOT modify `config.js`
6. Do NOT remove any existing working functionality
7. All new user-facing text strings must use `t('key')` function
8. After all changes list every file modified or created
9. Tell user: copy the 6 SVG logo files to `frontend/assets/` folder
10. Tell user: redeploy Apps Script and update Chat sheet columns
