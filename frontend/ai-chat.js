// ─── AI Chat Assistant ────────────────────────────────────────────────────────

const AI_STORAGE_KEY = 'tt_ai_settings';
const AI_SESSION_KEY = 'tt_ai_session_key';
let _aiOpen     = false;
let _aiMessages = [];

const AI_MODELS = {
  openai:      ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'],
  anthropic:   ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-4-8'],
  gemini:      ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
  openrouter:  ['meta-llama/llama-3.3-70b-instruct', 'google/gemini-2.0-flash-001', 'anthropic/claude-sonnet-4-6', 'openai/gpt-4o', 'mistralai/mixtral-8x7b-instruct'],
};

function initAIChat() {
  const panel = document.getElementById('ai-chat-panel');
  if (panel) {
    panel.style.pointerEvents = 'none';
    panel.style.visibility = 'hidden';
    panel.style.opacity = '0';
  }
  const saved = _loadAISettings();

  // Re-detect provider from saved key — corrects stale/wrong saved provider silently
  if (saved.apiKey) {
    const detected = _detectProviderFromKey(saved.apiKey);
    if (detected && detected !== saved.provider) {
      saved.provider = detected;
      _saveAISettingsToStorage(saved);
    }
  }

  // Validate saved model against the provider's model list — reset if mismatch
  if (saved.provider && saved.model) {
    const validModels = AI_MODELS[saved.provider] || [];
    if (validModels.length && !validModels.includes(saved.model)) {
      saved.model = validModels[0];
      _saveAISettingsToStorage(saved);
    }
  }

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
    if (keyEl) { keyEl.value = saved.apiKey; onAIKeyInput(keyEl); }
  }
  _updateAIStatus();
}

function _loadAISettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(AI_STORAGE_KEY) || '{}');
    const migratedKey = saved.apiKey || '';
    if (migratedKey) {
      sessionStorage.setItem(AI_SESSION_KEY, migratedKey);
      delete saved.apiKey;
      localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(saved));
    }
    return { ...saved, apiKey: sessionStorage.getItem(AI_SESSION_KEY) || '' };
  } catch (_) {
    return { apiKey: sessionStorage.getItem(AI_SESSION_KEY) || '' };
  }
}

function _saveAISettingsToStorage(settings) {
  const { apiKey = '', ...preferences } = settings;
  localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(preferences));
  if (apiKey) sessionStorage.setItem(AI_SESSION_KEY, apiKey);
  else sessionStorage.removeItem(AI_SESSION_KEY);
}

function clearAISessionCredentials() {
  sessionStorage.removeItem(AI_SESSION_KEY);
}

function toggleAIChat() {
  _aiOpen = !_aiOpen;
  const panel = document.getElementById('ai-chat-panel');
  const btn   = document.getElementById('ai-chat-fab');
  if (!panel) return;
  if (_aiOpen) {
    panel.style.transform = 'translateY(0)';
    panel.style.pointerEvents = 'auto';
    panel.style.visibility = 'visible';
    panel.style.opacity = '1';
    if (btn) btn.style.display = 'none';
    _renderAIMessages();
    setTimeout(() => {
      const input = document.getElementById('ai-input');
      if (input) input.focus();
    }, 350);
    const saved = _loadAISettings();
    if (!saved.apiKey) setTimeout(toggleAIChatSettings, 400);
  } else {
    panel.style.transform = 'translateY(calc(100% + 2px))';
    panel.style.pointerEvents = 'none';
    panel.style.visibility = 'hidden';
    panel.style.opacity = '0';
    if (btn) btn.style.display = '';
    const sp = document.getElementById('ai-settings-panel');
    if (sp) sp.style.display = 'none';
  }
}

function clearAIChat() {
  _aiMessages = [];
  _renderAIMessages();
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
  const apiKey = document.getElementById('ai-api-key')?.value?.trim() || '';
  const panel = document.getElementById('ai-settings-panel');
  if (typeof window.formV4Validate === 'function' && !window.formV4Validate(panel)) return;

  // Auto-detect from key takes priority over dropdown selection
  const detected = _detectProviderFromKey(apiKey);
  const provSel  = document.getElementById('ai-provider');
  if (detected && provSel) { provSel.value = detected; onAIProviderChange(); }
  const provider = detected || provSel?.value || 'openai';
  const model    = document.getElementById('ai-model')?.value || AI_MODELS[provider]?.[0] || 'gpt-4o';

  _saveAISettingsToStorage({ provider, model, apiKey });
  showToast('AI settings saved · provider: ' + provider, 'success');
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

// ─── Card Rendering ───────────────────────────────────────────────────────────

const _CARDS_ = '[[CARDS]]';

function _detectIntent(text) {
  const t = text.toLowerCase();
  if (/task|pending|overdue|to-?do|assignee/.test(t))         return 'tasks';
  if (/purchase order|\bpos\b/.test(t))                        return 'pos';
  if (/purchase request|\bprs\b/.test(t))                      return 'prs';
  if (/invoice/.test(t))                                       return 'invoices';
  if (/expense/.test(t))                                       return 'expenses';
  if (/milestone/.test(t))                                     return 'milestones';
  return 'general';
}

function _statusColor(status) {
  return { open:'#6366f1', in_progress:'#f59e0b', overdue:'#ef4444', done:'#10b981',
           draft:'#6366f1', submitted:'#f59e0b', received:'#10b981', cancelled:'#6b7280',
           pending:'#f59e0b', approved:'#10b981', rejected:'#ef4444',
           not_started:'#6366f1', in_review:'#f59e0b', awarded:'#10b981', blocked:'#ef4444',
           unpaid:'#ef4444', partial:'#f59e0b', paid:'#10b981' }[status] || '#6366f1';
}

function _badge(label, color) {
  return `<span class="ai-card-badge" style="background:${color}22;color:${color};border-color:${color}55;">${label.replace(/_/g,' ')}</span>`;
}

function _renderAppDataCards(intent) {
  try {
    if (intent === 'tasks') {
      const c = cacheGet('Tasks');
      const rows = (c?.data?.rows || []).filter(t => t.status !== 'done');
      if (!rows.length) return null;
      return `<div class="ai-results-header"><span class="ai-results-count">${rows.length}</span> Pending Tasks</div>` +
        rows.slice(0, 18).map(t => `
        <div class="ai-data-card" data-status="${escapeAttr(t.status || 'open')}">
          <div class="ai-card-badges">
            ${_badge(t.status || 'open', _statusColor(t.status))}
            ${t.priority ? _badge(t.priority, { high:'#ef4444', medium:'#f59e0b', low:'#10b981' }[t.priority] || '#6366f1') : ''}
          </div>
          <div class="ai-card-title">${escapeHtml(t.title || '')}</div>
          <div class="ai-card-meta">
            ${t.due_date  ? `<span class="ai-meta-chip">📅 ${t.due_date}</span>` : ''}
            ${t.assignee  ? `<span class="ai-meta-chip">👤 ${escapeHtml(t.assignee)}</span>` : ''}
            ${t.project   ? `<span class="ai-meta-chip">📁 ${escapeHtml(t.project)}</span>` : ''}
          </div>
        </div>`).join('');
    }
    if (intent === 'pos') {
      const c = cacheGet('POs');
      const rows = c?.data?.rows || [];
      if (!rows.length) return null;
      return `<div class="ai-results-header"><span class="ai-results-count">${rows.length}</span> Purchase Orders</div>` +
        rows.slice(0, 12).map(p => `
        <div class="ai-data-card">
          <div class="ai-card-badges">
            ${_badge(p.status || 'draft', _statusColor(p.status))}
            ${p.approval_status ? _badge(p.approval_status, _statusColor(p.approval_status)) : ''}
            ${p.payment_status  ? _badge(p.payment_status,  _statusColor(p.payment_status))  : ''}
          </div>
          <div class="ai-card-title">${escapeHtml(p.po_number || 'PO')} — ${escapeHtml(p.item_description || '')}</div>
          <div class="ai-card-meta">
            ${p.supplier      ? `<span class="ai-meta-chip">🏭 ${escapeHtml(p.supplier)}</span>` : ''}
            ${p.total_value   ? `<span class="ai-meta-chip">💰 ${p.currency || ''} ${p.total_value}</span>` : ''}
            ${p.expected_delivery ? `<span class="ai-meta-chip">📅 ${p.expected_delivery}</span>` : ''}
          </div>
        </div>`).join('');
    }
    if (intent === 'invoices') {
      const c = cacheGet('Invoices');
      const rows = c?.data?.rows || [];
      if (!rows.length) return null;
      return `<div class="ai-results-header"><span class="ai-results-count">${rows.length}</span> Invoices</div>` +
        rows.slice(0, 12).map(i => `
        <div class="ai-data-card">
          <div class="ai-card-badges">${_badge(i.status || 'pending', _statusColor(i.status))}</div>
          <div class="ai-card-title">${escapeHtml(i.invoice_number || i.id || 'Invoice')}</div>
          <div class="ai-card-meta">
            ${i.supplier           ? `<span class="ai-meta-chip">🏭 ${escapeHtml(i.supplier)}</span>` : ''}
            ${(i.amount || i.total) ? `<span class="ai-meta-chip">💰 ${i.currency || ''} ${i.amount || i.total}</span>` : ''}
          </div>
        </div>`).join('');
    }
    if (intent === 'expenses') {
      const c = cacheGet('Expenses');
      const rows = c?.data?.rows || [];
      if (!rows.length) return null;
      const total = rows.reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
      return `<div class="ai-results-header"><span class="ai-results-count">${rows.length}</span> Expenses — Total: ${total.toLocaleString()}</div>` +
        rows.slice(0, 12).map(e => `
        <div class="ai-data-card">
          <div class="ai-card-badges">${_badge(e.category || 'expense', '#6366f1')}</div>
          <div class="ai-card-title">${escapeHtml(e.description || e.category || '')}</div>
          <div class="ai-card-meta">
            <span class="ai-meta-chip">💰 ${e.currency || ''} ${e.amount || 0}</span>
            ${e.date ? `<span class="ai-meta-chip">📅 ${e.date}</span>` : ''}
            ${e.approved_by ? `<span class="ai-meta-chip">✅ ${escapeHtml(e.approved_by)}</span>` : ''}
          </div>
        </div>`).join('');
    }
    if (intent === 'milestones') {
      const c = cacheGet('Milestones');
      const rows = c?.data?.rows || [];
      if (!rows.length) return null;
      return `<div class="ai-results-header"><span class="ai-results-count">${rows.length}</span> Milestones</div>` +
        rows.slice(0, 10).map(m => `
        <div class="ai-data-card">
          <div class="ai-card-badges">${_badge(m.status || 'not_started', _statusColor(m.status))}</div>
          <div class="ai-card-title">${escapeHtml(m.project || '')} / ${escapeHtml(m.milestone_name || '')}</div>
          <div class="ai-card-meta">
            <span class="ai-meta-chip">📊 ${m.completion_pct || 0}%</span>
            ${m.target_date ? `<span class="ai-meta-chip">📅 ${m.target_date}</span>` : ''}
            ${m.owner ? `<span class="ai-meta-chip">👤 ${escapeHtml(m.owner)}</span>` : ''}
          </div>
        </div>`).join('');
    }
  } catch(_) {}
  return null;
}

// Balanced-bracket JSON array extraction — handles nested objects and strings
function _extractJSONArray(text) {
  const start = text.indexOf('[');
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (esc)       { esc = false; continue; }
    if (c === '\\') { esc = true;  continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

function _parseBizCards(text) {
  const raw = _extractJSONArray(text);
  if (!raw) return null;
  try {
    // Repair common AI JSON quirks before parsing
    const cleaned = raw.replace(/,(\s*[}\]])/g, '$1');
    const results = JSON.parse(cleaned);
    if (!Array.isArray(results) || !results.length || !results[0]?.name) return null;
    return `<div class="ai-results-header"><span class="ai-results-count">${results.length}</span> Search Results</div>` +
      results.map(b => {
        const href = b.website
          ? (b.website.startsWith('http') ? escapeAttr(b.website) : 'https://' + escapeAttr(b.website))
          : '';
        const label = b.website ? escapeHtml(b.website.replace(/^https?:\/\//, '')) : '';
        return `
        <div class="ai-biz-card">
          <div class="ai-biz-header">
            <div class="ai-biz-name">${escapeHtml(b.name || '')}</div>
          </div>
          <div class="ai-biz-body">
            <div class="ai-biz-fields">
              ${b.phone ? `<div class="ai-biz-field"><span class="ai-biz-icon">📞</span><span>${escapeHtml(b.phone)}</span></div>` : ''}
              ${href    ? `<div class="ai-biz-field"><span class="ai-biz-icon">🌐</span><a href="${href}" target="_blank" rel="noopener" class="ai-biz-link">${label}</a></div>` : ''}
              ${b.email ? `<div class="ai-biz-field"><span class="ai-biz-icon">✉️</span><span>${escapeHtml(b.email)}</span></div>` : ''}
            </div>
            ${b.services ? `<div class="ai-biz-services">${escapeHtml(b.services)}</div>` : ''}
          </div>
        </div>`;
      }).join('');
  } catch(_) { return null; }
}

// Shared AI message avatar HTML
function _aiAvatar() {
  return `<div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);
    display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><path d="M10.5 2.4a.55.55 0 011 0l.85 2.75a4.4 4.4 0 002.5 2.5l2.75.85a.55.55 0 010 1l-2.75.85a4.4 4.4 0 00-2.5 2.5l-.85 2.75a.55.55 0 01-1 0l-.85-2.75a4.4 4.4 0 00-2.5-2.5L4.4 9.55a.55.55 0 010-1l2.75-.85a4.4 4.4 0 002.5-2.5l.85-2.75z"/></svg>
  </div>`;
}

async function googleSearchFromAI() {
  const input = document.getElementById('ai-google-search');
  const q     = (input?.value || '').trim();
  if (!q) return;
  if (input) input.value = '';

  const settings = _loadAISettings();
  if (!settings.apiKey) {
    window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank');
    return;
  }

  _aiMessages.push({ role: 'user', content: '🔍 ' + q });
  _renderAIMessages();

  const sendBtn = document.getElementById('ai-send-btn');
  if (sendBtn) sendBtn.disabled = true;
  const thinkingId = 'ai-thinking-' + Date.now();
  _appendAIThinking(thinkingId);

  try {
    const searchCtx = [
      ..._aiHistoryForAPI().slice(0, -1),
      { role: 'user', content: `SEARCH: "${q}"

RULE: Is this query asking about businesses, shops, stores, companies, services, or suppliers in a city or region?

YES → Output ONLY a raw JSON array. Absolutely nothing before or after it. No markdown, no explanation, no intro sentence.
[{"name":"Company Name","phone":"+964 XXX XXX XXXX","website":"example.com","email":"info@example.com","services":"One-line description"}]
Include 4–8 results. Use "" for unknown fields. The very first character of your reply must be [ and the very last must be ].

NO → Answer concisely from your knowledge with key facts. Do not mention web access limitations.` }
    ];
    let reply = '';
    if (settings.provider === 'anthropic')        reply = await _callAnthropic(settings.apiKey, settings.model || 'claude-sonnet-4-6', searchCtx);
    else if (settings.provider === 'gemini')      reply = await _callGemini(settings.apiKey, settings.model || 'gemini-1.5-pro', searchCtx);
    else if (settings.provider === 'openrouter')  reply = await _callOpenRouter(settings.apiKey, settings.model || 'meta-llama/llama-3.3-70b-instruct', searchCtx);
    else                                           reply = await _callOpenAI(settings.apiKey, settings.model || 'gpt-4o', searchCtx);
    _aiMessages.push({ role: 'assistant', content: reply });
  } catch(e) {
    _aiMessages.push({ role: 'assistant', content: '⚠️ ' + e.message });
  } finally {
    document.getElementById(thinkingId)?.remove();
    _renderAIMessages();
    if (sendBtn) sendBtn.disabled = false;
  }
}

// Strip [[CARDS]] markers from history before sending to AI
function _aiHistoryForAPI() {
  return _aiMessages.map(m =>
    (m.role === 'assistant' && m.content.startsWith(_CARDS_))
      ? { role: 'assistant', content: '[Shown as interactive cards]' }
      : m
  );
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

  // Try direct card rendering for app-data queries (fast, always accurate)
  const intent = _detectIntent(userMsg);
  if (intent !== 'general') {
    const cardHtml = _renderAppDataCards(intent);
    if (cardHtml) {
      _aiMessages.push({ role: 'assistant', content: _CARDS_ + cardHtml });
      _renderAIMessages();
      if (sendBtn) sendBtn.disabled = false;
      return;
    }
  }

  const thinkingId = 'ai-thinking-' + Date.now();
  _appendAIThinking(thinkingId);

  try {
    const hist = _aiHistoryForAPI();
    let assistantReply = '';
    if (settings.provider === 'anthropic') {
      assistantReply = await _callAnthropic(settings.apiKey, settings.model || 'claude-sonnet-4-6', hist);
    } else if (settings.provider === 'gemini') {
      assistantReply = await _callGemini(settings.apiKey, settings.model || 'gemini-1.5-pro', hist);
    } else if (settings.provider === 'openrouter') {
      assistantReply = await _callOpenRouter(settings.apiKey, settings.model || 'meta-llama/llama-3.3-70b-instruct', hist);
    } else {
      assistantReply = await _callOpenAI(settings.apiKey, settings.model || 'gpt-4o', hist);
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

async function _callOpenRouter(apiKey, model, messages) {
  const systemMsg = _buildSystemContext();
  const body = {
    model,
    messages: [
      { role: 'system', content: systemMsg },
      ...messages,
    ],
    max_tokens: 1024,
  };
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + apiKey,
      'HTTP-Referer':  location.origin,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'OpenRouter API error ' + res.status);
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

function _gatherAppData() {
  const parts = [];
  try {
    const tasksC = cacheGet('Tasks');
    if (tasksC?.data?.rows?.length) {
      const rows = tasksC.data.rows;
      const pending = rows.filter(t => t.status !== 'done');
      parts.push(`## Tasks (${rows.length} total, ${pending.length} not done)\n` +
        pending.slice(0, 20).map(t =>
          `- [${t.status || '?'}] "${t.title}" | priority:${t.priority || '-'} | assignee:${t.assignee || 'unassigned'} | due:${t.due_date || 'none'} | project:${t.project || '-'}`
        ).join('\n'));
    }
    const posC = cacheGet('POs');
    if (posC?.data?.rows?.length) {
      const rows = posC.data.rows;
      parts.push(`## Purchase Orders (${rows.length} total)\n` +
        rows.slice(0, 12).map(p =>
          `- [${p.po_number}] ${p.item_description || '-'} | supplier:${p.supplier || '-'} | ${p.currency || ''} ${p.total_value || 0} | status:${p.status}/${p.approval_status}`
        ).join('\n'));
    }
    const prsC = cacheGet('PurchaseRequests');
    if (prsC?.data?.rows?.length) {
      const rows = prsC.data.rows;
      parts.push(`## Purchase Requests (${rows.length} total)\n` +
        rows.slice(0, 10).map(r =>
          `- [${r.pr_number || r.id || '?'}] ${r.description || r.item_description || '-'} | status:${r.status || '-'} | requester:${r.requester || '-'}`
        ).join('\n'));
    }
    const invC = cacheGet('Invoices');
    if (invC?.data?.rows?.length) {
      const rows = invC.data.rows;
      parts.push(`## Invoices (${rows.length} total)\n` +
        rows.slice(0, 8).map(i =>
          `- [${i.invoice_number || i.id || '?'}] ${i.supplier || '-'} | amount:${i.currency || ''} ${i.amount || i.total || 0} | status:${i.status || '-'}`
        ).join('\n'));
    }
    const expC = cacheGet('Expenses');
    if (expC?.data?.rows?.length) {
      const rows = expC.data.rows;
      const total = rows.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
      parts.push(`## Expenses (${rows.length} total, sum≈${total.toLocaleString()})\n` +
        rows.slice(0, 8).map(e =>
          `- ${e.category || '-'}: ${e.currency || ''} ${e.amount || 0} — ${e.description || '-'}`
        ).join('\n'));
    }
    const msC = cacheGet('Milestones');
    if (msC?.data?.rows?.length) {
      const rows = msC.data.rows;
      parts.push(`## Milestones (${rows.length} total)\n` +
        rows.slice(0, 8).map(m =>
          `- [${m.status || '-'}] ${m.project || '-'} / ${m.milestone_name || '-'} | ${m.completion_pct || 0}% | target:${m.target_date || '-'}`
        ).join('\n'));
    }
  } catch(_) {}
  return parts.length
    ? parts.join('\n\n')
    : '(App data not yet loaded — navigate to a section first so the cache populates, then ask again.)';
}

function _buildSystemContext() {
  const company = typeof getCompanyName === 'function' ? getCompanyName() : 'the company';
  const user    = JSON.parse(localStorage.getItem('tt_user_profile') || '{}');
  const today   = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const appData = _gatherAppData();
  return `You are an AI assistant for ${company}'s task tracker and procurement app.
Current user: ${user.name || user.email || 'team member'} (${user.email || ''}).
Today: ${today}.

=== LIVE APP DATA ===
${appData}
=== END APP DATA ===

INSTRUCTIONS:
- When the user asks about tasks, POs, PRs, invoices, expenses, or milestones — answer using the live data above. List actual records, counts, and details.
- When the user asks general knowledge questions (products, prices, market info, how-to, web searches) — answer from your training knowledge directly. Do NOT say you cannot access the web; instead, give the best answer you have and note the knowledge cutoff date if relevant.
- For truly real-time data (live stock prices, today's news) — say so briefly, then provide what you do know.
- Use markdown, bullet points, and tables when helpful. Be concise.`;
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
      <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><path d="M10.5 2.4a.55.55 0 011 0l.85 2.75a4.4 4.4 0 002.5 2.5l2.75.85a.55.55 0 010 1l-2.75.85a4.4 4.4 0 00-2.5 2.5l-.85 2.75a.55.55 0 01-1 0l-.85-2.75a4.4 4.4 0 00-2.5-2.5L4.4 9.55a.55.55 0 010-1l2.75-.85a4.4 4.4 0 002.5-2.5l.85-2.75z"/></svg>
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
        <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);
          display:flex;align-items:center;justify-content:center;margin:0 auto 10px;box-shadow:0 4px 16px rgba(99,102,241,0.4);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M10.5 2.4a.55.55 0 011 0l.85 2.75a4.4 4.4 0 002.5 2.5l2.75.85a.55.55 0 010 1l-2.75.85a4.4 4.4 0 00-2.5 2.5l-.85 2.75a.55.55 0 01-1 0l-.85-2.75a4.4 4.4 0 00-2.5-2.5L4.4 9.55a.55.55 0 010-1l2.75-.85a4.4 4.4 0 002.5-2.5l.85-2.75z"/><path d="M18.5 14.8a.35.35 0 01.65 0l.5 1.6 1.6.5a.35.35 0 010 .65l-1.6.5-.5 1.6a.35.35 0 01-.65 0l-.5-1.6-1.6-.5a.35.35 0 010-.65l1.6-.5.5-1.6z"/></svg>
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
    // Cards message — render HTML directly
    if (m.content.startsWith(_CARDS_)) {
      return `<div style="display:flex;gap:8px;align-items:flex-start;">
        ${_aiAvatar()}
        <div style="flex:1;min-width:0;">${m.content.slice(_CARDS_.length)}</div>
      </div>`;
    }
    return `<div style="display:flex;gap:8px;align-items:flex-start;">
      ${_aiAvatar()}
      <div style="background:var(--glass-bg);border:1px solid var(--border);border-radius:0 var(--r-md) var(--r-md) var(--r-md);
        padding:10px 12px;max-width:88%;font-size:12.5px;line-height:1.6;color:var(--text-1);">
        ${_formatAIResponse(m.content)}
      </div>
    </div>`;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

function _formatAIResponse(text) {
  // Try business card JSON first
  const biz = _parseBizCards(text);
  if (biz) return biz;

  // Escape HTML first
  let t = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Headers
  t = t.replace(/^### (.+)$/gm, '<div class="ai-resp-h3">$1</div>');
  t = t.replace(/^## (.+)$/gm,  '<div class="ai-resp-h2">$1</div>');
  t = t.replace(/^# (.+)$/gm,   '<div class="ai-resp-h1">$1</div>');

  // Bold / italic / inline code
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-1);font-weight:700;">$1</strong>');
  t = t.replace(/\*(.+?)\*/g,     '<em style="color:var(--text-2);">$1</em>');
  t = t.replace(/`(.+?)`/g,       '<code class="ai-inline-code">$1</code>');

  // Numbered lists — wrap consecutive items in a counter-reset div
  t = t.replace(/((?:^\d+\..+$\n?)+)/gm, m => `<div class="ai-num-list">${m}</div>`);
  t = t.replace(/^\d+\.\s+(.+)$/gm,  '<div class="ai-list-item ai-list-numbered">$1</div>');

  // Bullet lists
  t = t.replace(/^[-•]\s+(.+)$/gm, '<div class="ai-list-item">$1</div>');

  // Horizontal rule
  t = t.replace(/^---+$/gm, '<div class="ai-resp-hr"></div>');

  // Paragraph spacing
  t = t.replace(/\n\n/g, '<div class="ai-resp-gap"></div>');
  t = t.replace(/\n/g,   '<br>');

  return t;
}

function togglePermCard(idx) {
  const card = document.getElementById('perm-card-' + idx);
  if (!card) return;
  const grid    = card.querySelector('.perm-toggles-grid');
  const chevron = card.querySelector('.perm-card-chevron');
  const isOpen  = card.classList.toggle('expanded');
  if (grid)    grid.style.display    = isOpen ? 'grid' : 'none';
  if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : '';
}

function _detectProviderFromKey(key) {
  if (!key) return null;
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-or-'))  return 'openrouter';
  if (key.startsWith('sk-'))     return 'openai';
  if (key.startsWith('AIza'))    return 'gemini';
  return null;
}

function onAIKeyInput(el) {
  const key      = (el.value || '').trim();
  const detected = _detectProviderFromKey(key);
  const badge    = document.getElementById('ai-provider-badge');
  const provSel  = document.getElementById('ai-provider');
  const names    = { openai: '✓ OpenAI', anthropic: '✓ Anthropic', gemini: '✓ Gemini', openrouter: '✓ OpenRouter' };
  if (detected) {
    // Auto-switch provider dropdown to match key
    if (provSel && provSel.value !== detected) { provSel.value = detected; onAIProviderChange(); }
    if (badge) {
      badge.textContent = names[detected];
      badge.style.cssText = 'display:inline-block;font-size:10px;background:rgba(16,185,129,0.15);color:#10b981;padding:1px 7px;border-radius:20px;font-weight:600;';
    }
  } else if (key.length > 8) {
    // Key entered but unrecognised — warn user
    if (badge) {
      badge.textContent = '⚠ Unrecognised key format';
      badge.style.cssText = 'display:inline-block;font-size:10px;background:rgba(245,158,11,0.15);color:#f59e0b;padding:1px 7px;border-radius:20px;font-weight:600;';
    }
  } else {
    if (badge) badge.style.display = 'none';
  }
}
