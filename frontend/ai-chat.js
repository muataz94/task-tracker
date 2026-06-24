// ─── AI Chat Assistant ────────────────────────────────────────────────────────

const AI_STORAGE_KEY = 'tt_ai_settings';
let _aiOpen     = false;
let _aiMessages = [];

const AI_MODELS = {
  openai:    ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'],
  anthropic: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-4-8'],
  gemini:    ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
};

function initAIChat() {
  const saved = _loadAISettings();
  if (saved.provider) {
    const provSel = document.getElementById('ai-provider');
    if (provSel) provSel.value = saved.provider;
    onAIProviderChange();
  }
  if (saved.model) {
    const modSel = document.getElementById('ai-model');
    if (modSel) modSel.value = saved.model;
  }
  if (saved.apiKey) {
    const keyEl = document.getElementById('ai-api-key');
    if (keyEl) keyEl.value = saved.apiKey;
  }
  _updateAIStatus();
}

function _loadAISettings() {
  try { return JSON.parse(localStorage.getItem(AI_STORAGE_KEY) || '{}'); } catch(_) { return {}; }
}

function _saveAISettingsToStorage(settings) {
  localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(settings));
}

function toggleAIChat() {
  _aiOpen = !_aiOpen;
  const panel = document.getElementById('ai-chat-panel');
  const btn   = document.getElementById('ai-chat-fab');
  if (!panel) return;
  if (_aiOpen) {
    panel.style.transform = 'translateY(0)';
    if (btn) {
      btn.style.transform  = 'scale(0.9)';
      btn.style.background = 'linear-gradient(135deg,#4f46e5,#7c3aed)';
    }
    setTimeout(() => {
      const input = document.getElementById('ai-input');
      if (input) input.focus();
    }, 350);
    const saved = _loadAISettings();
    if (!saved.apiKey) setTimeout(toggleAIChatSettings, 400);
  } else {
    panel.style.transform = 'translateY(100%)';
    if (btn) {
      btn.style.transform  = 'scale(1)';
      btn.style.background = 'linear-gradient(135deg,#6366f1,#8b5cf6)';
    }
    const settingsPanel = document.getElementById('ai-settings-panel');
    if (settingsPanel) settingsPanel.style.display = 'none';
  }
}

function toggleAIChatSettings() {
  const sp = document.getElementById('ai-settings-panel');
  if (!sp) return;
  sp.style.display = sp.style.display === 'none' ? 'block' : 'none';
}

function onAIProviderChange() {
  const provSel = document.getElementById('ai-provider');
  const modSel  = document.getElementById('ai-model');
  if (!provSel || !modSel) return;
  const models = AI_MODELS[provSel.value] || [];
  modSel.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
}

function saveAISettings() {
  const provider = document.getElementById('ai-provider')?.value || 'openai';
  const model    = document.getElementById('ai-model')?.value    || 'gpt-4o';
  const apiKey   = document.getElementById('ai-api-key')?.value?.trim() || '';
  if (!apiKey) { showToast('API key is required', 'error'); return; }
  _saveAISettingsToStorage({ provider, model, apiKey });
  showToast('AI settings saved ✓', 'success');
  toggleAIChatSettings();
  _updateAIStatus();
}

function _updateAIStatus() {
  const label   = document.getElementById('ai-status-label');
  const saved   = _loadAISettings();
  if (!label) return;
  if (saved.apiKey) {
    label.textContent = (saved.provider || 'openai') + ' · ' + (saved.model || 'gpt-4o');
    label.style.color = '#10b981';
  } else {
    label.textContent = 'Configure API key to start';
    label.style.color = '';
  }
}

function googleSearchFromAI() {
  const input = document.getElementById('ai-google-search');
  const q     = (input?.value || '').trim();
  if (!q) return;
  window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank');
}

async function sendAIMessage() {
  const input   = document.getElementById('ai-input');
  const userMsg = (input?.value || '').trim();
  if (!userMsg) return;

  const settings = _loadAISettings();
  if (!settings.apiKey) {
    showToast('Please configure your API key first (click the ⚙ button)', 'error');
    return;
  }

  if (input) { input.value = ''; input.style.height = 'auto'; }

  _aiMessages.push({ role: 'user', content: userMsg });
  _renderAIMessages();

  const sendBtn = document.getElementById('ai-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  const thinkingId = 'ai-thinking-' + Date.now();
  _appendAIThinking(thinkingId);

  try {
    let assistantReply = '';

    if (settings.provider === 'openai') {
      assistantReply = await _callOpenAI(settings.apiKey, settings.model || 'gpt-4o', _aiMessages);
    } else if (settings.provider === 'anthropic') {
      assistantReply = await _callAnthropic(settings.apiKey, settings.model || 'claude-sonnet-4-6', _aiMessages);
    } else if (settings.provider === 'gemini') {
      assistantReply = await _callGemini(settings.apiKey, settings.model || 'gemini-1.5-pro', _aiMessages);
    } else {
      assistantReply = 'Unknown provider selected.';
    }

    _aiMessages.push({ role: 'assistant', content: assistantReply });
  } catch(e) {
    _aiMessages.push({ role: 'assistant', content: '⚠️ Error: ' + e.message });
  } finally {
    document.getElementById(thinkingId)?.remove();
    _renderAIMessages();
    if (sendBtn) sendBtn.disabled = false;
  }
}

async function _callOpenAI(apiKey, model, messages) {
  const systemMsg = _buildSystemContext();
  const body = {
    model,
    messages: [
      { role: 'system', content: systemMsg },
      ...messages,
    ],
    max_tokens: 1024,
  };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'OpenAI API error ' + res.status);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '(no response)';
}

async function _callAnthropic(apiKey, model, messages) {
  const systemMsg = _buildSystemContext();
  const body = {
    model,
    max_tokens: 1024,
    system: systemMsg,
    messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
  };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':       'application/json',
      'x-api-key':          apiKey,
      'anthropic-version':  '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Anthropic API error ' + res.status);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '(no response)';
}

async function _callGemini(apiKey, model, messages) {
  const systemMsg = _buildSystemContext();
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    system_instruction: { parts: [{ text: systemMsg }] },
    contents,
    generationConfig: { maxOutputTokens: 1024 },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Gemini API error ' + res.status);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '(no response)';
}

function _buildSystemContext() {
  const company = typeof getCompanyName === 'function' ? getCompanyName() : 'the company';
  const user    = JSON.parse(localStorage.getItem('tt_user_profile') || '{}');
  const today   = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  return `You are an AI assistant embedded in a task tracker and procurement management app for ${company}.
The current user is ${user.name || user.email || 'a team member'} (${user.email || ''}).
Today is ${today}.
The app manages: Tasks, Purchase Orders (POs), Purchase Requests (PRs), Invoices, Expenses, Milestones, Quotations, and Vendors.
Help the user with questions about their work, explain app features, suggest workflows, and provide concise answers.
Keep responses focused and practical. Use markdown for formatting when helpful.`;
}

function _appendAIThinking(id) {
  const container = document.getElementById('ai-messages');
  if (!container) return;
  const el = document.createElement('div');
  el.id = id;
  el.style.cssText = 'display:flex;gap:8px;align-items:flex-start;';
  el.innerHTML = `
    <div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);
      display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="white"/><circle cx="12" cy="12" r="10"/></svg>
    </div>
    <div style="background:var(--glass-bg);border:1px solid var(--border);border-radius:0 var(--r-md) var(--r-md) var(--r-md);padding:10px 12px;font-size:12px;color:var(--text-3);">
      <span class="ai-thinking-dots">Thinking<span>.</span><span>.</span><span>.</span></span>
    </div>`;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function _renderAIMessages() {
  const container = document.getElementById('ai-messages');
  if (!container) return;

  if (!_aiMessages.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:1.5rem 0;">
        <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2));
          display:flex;align-items:center;justify-content:center;margin:0 auto 10px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="1.5"><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="#8b5cf6"/><circle cx="12" cy="12" r="10"/></svg>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:4px;">AI Assistant ready</div>
        <div style="font-size:11px;color:var(--text-3);">Ask anything about your tasks, POs, or workspace</div>
      </div>`;
    return;
  }

  container.innerHTML = _aiMessages.map(m => {
    if (m.role === 'user') {
      return `<div style="display:flex;justify-content:flex-end;">
        <div style="background:linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.15));border:1px solid rgba(99,102,241,0.25);
          border-radius:var(--r-md) var(--r-md) 0 var(--r-md);padding:9px 12px;max-width:85%;font-size:12.5px;line-height:1.5;color:var(--text-1);">
          ${escapeHtml(m.content)}
        </div>
      </div>`;
    }
    return `<div style="display:flex;gap:8px;align-items:flex-start;">
      <div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);
        display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="white"/><circle cx="12" cy="12" r="10"/></svg>
      </div>
      <div style="background:var(--glass-bg);border:1px solid var(--border);border-radius:0 var(--r-md) var(--r-md) var(--r-md);
        padding:10px 12px;max-width:88%;font-size:12.5px;line-height:1.6;color:var(--text-1);">
        ${_formatAIResponse(m.content)}
      </div>
    </div>`;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

function _formatAIResponse(text) {
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(99,102,241,0.12);padding:1px 5px;border-radius:3px;font-size:11px;">$1</code>')
    .replace(/\n/g, '<br>');
}
