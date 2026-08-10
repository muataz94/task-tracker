const AI_STORAGE_KEY = 'tt_ai_settings_v5';
const AI_LEGACY_KEYS = ['tt_ai_settings', 'tt_ai_session_key'];
const AI_GATEWAY_META = document.querySelector('meta[name="task-tracker-ai-gateway"]')?.content || '';
const AI_GATEWAY_URL = String(window.TASK_TRACKER_AI_GATEWAY_URL || (AI_GATEWAY_META.startsWith('__') ? '' : AI_GATEWAY_META)).replace(/\/+$/, '');

class AIProviderAdapter {
  constructor(config) {
    this.id = config.id;
    this.label = config.label;
    this.gateway = config.gateway;
  }

  detect(config) { return config?.provider?.id === this.id; }
  validateConfig(config) { return Boolean(this.gateway && config?.provider?.models?.length); }
  listModels(config) { return this.detect(config) ? config.provider.models : []; }
  complete(request) { return aiGatewayRequest('/v1/chat', request); }
  normalizeError(error) { return normalizeAIError(error); }
}

class AIProviderRegistry {
  constructor() { this.adapters = new Map(); }
  register(adapter) { this.adapters.set(adapter.id, adapter); return adapter; }
  detect(config) { return [...this.adapters.values()].find(adapter => adapter.detect(config)) || null; }
  get(id) { return this.adapters.get(id) || null; }
}

const aiProviderRegistry = new AIProviderRegistry();
let aiState = {
  open: false,
  settingsOpen: false,
  loading: false,
  config: null,
  adapter: null,
  messages: [],
};

function aiT(key, vars) {
  return typeof t === 'function' ? t(key, vars) : key;
}

function loadAISettings() {
  try { return JSON.parse(localStorage.getItem(AI_STORAGE_KEY) || '{}'); }
  catch (_) { return {}; }
}

function saveAISettingsPreference(settings) {
  localStorage.setItem(AI_STORAGE_KEY, JSON.stringify({ model: String(settings.model || '') }));
}

function clearAISessionCredentials() {
  AI_LEGACY_KEYS.forEach(key => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

function normalizeAIError(error) {
  const code = String(error?.code || 'AI_UNAVAILABLE');
  const keys = {
    SESSION_REQUIRED: 'ai_error_session',
    AI_AUTH_FAILED: 'ai_error_auth',
    AI_RATE_LIMITED: 'ai_error_rate_limit',
    AI_PROVIDER_BUSY: 'ai_error_busy',
    AI_TIMEOUT: 'ai_error_timeout',
    AI_MODEL_NOT_FOUND: 'ai_error_model',
    AI_NOT_CONFIGURED: 'ai_error_not_configured',
    AI_INVALID_REQUEST: 'ai_error_invalid',
  };
  return { code, message: aiT(keys[code] || 'ai_error_generic'), retryable: Boolean(error?.retryable) };
}

async function aiGatewayRequest(path, payload = {}) {
  if (!AI_GATEWAY_URL) throw normalizeAIError({ code: 'AI_NOT_CONFIGURED' });
  if (!window.idToken && typeof idToken === 'undefined') throw normalizeAIError({ code: 'SESSION_REQUIRED' });
  let response;
  try {
    response = await fetch(`${AI_GATEWAY_URL}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${window.idToken || idToken}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (_) {
    throw normalizeAIError({ code: 'AI_UNAVAILABLE', retryable: true });
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw normalizeAIError(body.error || { code: 'AI_UNAVAILABLE', retryable: response.status >= 500 });
  return body;
}

function registerDetectedProvider(config) {
  const provider = config?.provider;
  if (!provider?.id) return null;
  const existing = aiProviderRegistry.get(provider.id);
  if (existing) return existing;
  return aiProviderRegistry.register(new AIProviderAdapter({ id: provider.id, label: provider.label, gateway: AI_GATEWAY_URL }));
}

async function refreshAIGatewayConfig({ test = false } = {}) {
  setAIConnectionState('checking');
  try {
    const config = await aiGatewayRequest(test ? '/v1/test' : '/v1/config');
    aiState.config = config;
    aiState.adapter = registerDetectedProvider(config);
    populateAIModels(config);
    setAIConnectionState('connected');
    return config;
  } catch (error) {
    aiState.config = null;
    aiState.adapter = null;
    setAIConnectionState('error', error);
    throw error;
  }
}

function populateAIModels(config) {
  const select = document.getElementById('ai-model');
  if (!select) return;
  const adapter = aiProviderRegistry.detect(config);
  const models = adapter?.listModels(config) || config?.provider?.models || [];
  const savedModel = loadAISettings().model;
  const selected = models.includes(savedModel) ? savedModel : (config?.provider?.model || models[0] || '');
  select.replaceChildren(...models.map(model => {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    option.selected = model === selected;
    return option;
  }));
  select.disabled = models.length < 2;
}

function setAIConnectionState(state, error = null) {
  const status = document.getElementById('ai-status-label');
  const provider = document.getElementById('ai-detected-provider');
  const connection = document.getElementById('ai-connection-state');
  const config = aiState.config;
  if (status) status.textContent = state === 'connected'
    ? `${config.provider.label} · ${config.provider.model}`
    : aiT(state === 'checking' ? 'ai_checking' : state === 'error' ? 'ai_needs_attention' : 'ai_not_connected');
  if (provider) provider.textContent = config?.provider?.label || aiT('ai_detected_automatically');
  if (connection) {
    connection.textContent = state === 'connected' ? aiT('ai_connected')
      : state === 'checking' ? aiT('ai_checking')
        : error?.message || aiT('ai_not_connected');
    connection.dataset.state = state;
  }
}

function initAIChat() {
  clearAISessionCredentials();
  const panel = document.getElementById('ai-chat-panel');
  const input = document.getElementById('ai-input');
  panel?.setAttribute('aria-hidden', 'true');
  input?.addEventListener('input', updateAIComposer);
  document.querySelectorAll('[data-ai-quick-action]').forEach(button => {
    button.addEventListener('click', () => {
      if (!input) return;
      input.value = aiT(button.dataset.aiQuickAction);
      updateAIComposer();
      input.focus();
    });
  });
  updateAIComposer();
  renderAIMessages();
  setAIConnectionState('idle');
}

function toggleAIChat(force) {
  const opening = typeof force === 'boolean' ? force : !aiState.open;
  aiState.open = opening;
  const panel = document.getElementById('ai-chat-panel');
  const launcher = document.getElementById('ai-chat-fab');
  panel?.classList.toggle('is-open', opening);
  panel?.setAttribute('aria-hidden', String(!opening));
  launcher?.setAttribute('aria-expanded', String(opening));
  document.body.classList.toggle('ai-panel-open', opening);
  if (opening) {
    refreshAIGatewayConfig().catch(() => {});
    window.setTimeout(() => document.getElementById('ai-input')?.focus(), 220);
  } else {
    toggleAIChatSettings(false);
    launcher?.focus();
  }
}

function toggleAIChatSettings(force) {
  const panel = document.getElementById('ai-settings-panel');
  const opening = typeof force === 'boolean' ? force : !aiState.settingsOpen;
  aiState.settingsOpen = opening;
  if (panel) panel.hidden = !opening;
  document.getElementById('ai-settings-button')?.setAttribute('aria-expanded', String(opening));
  if (opening && !aiState.config) refreshAIGatewayConfig().catch(() => {});
}

function clearAIChat() {
  aiState.messages = [];
  renderAIMessages();
}

async function testAIConnection() {
  const button = document.getElementById('ai-test-connection');
  if (button) button.disabled = true;
  try {
    await refreshAIGatewayConfig({ test: true });
    if (typeof showToast === 'function') showToast(aiT('ai_connection_success'), 'success');
  } catch (error) {
    if (typeof showToast === 'function') showToast(error.message, 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

function saveAISettings() {
  const model = document.getElementById('ai-model')?.value || '';
  saveAISettingsPreference({ model });
  if (aiState.config?.provider) aiState.config.provider.model = model || aiState.config.provider.model;
  setAIConnectionState(aiState.config ? 'connected' : 'idle');
  toggleAIChatSettings(false);
  if (typeof showToast === 'function') showToast(aiT('ai_settings_saved'), 'success');
}

function gatherAIContext() {
  const sections = [
    ['Tasks', 'Tasks', ['id', 'title', 'status', 'priority', 'assignee', 'due_date', 'project']],
    ['Purchase requests', 'PurchaseRequests', ['id', 'pr_number', 'description', 'status', 'requested_by', 'required_by_date']],
    ['Purchase orders', 'POs', ['id', 'po_number', 'item_description', 'supplier', 'total_value', 'currency', 'status', 'expected_delivery']],
    ['Vendors', 'Vendors', ['id', 'vendor_name', 'category', 'status', 'performance_score']],
    ['Invoices', 'Invoices', ['id', 'invoice_number', 'supplier', 'amount', 'currency', 'status']],
  ];
  return sections.map(([label, cacheKey, fields]) => {
    const cached = typeof cacheGet === 'function' ? cacheGet(cacheKey) : null;
    const rows = cached?.data?.rows || (typeof tableData !== 'undefined' ? tableData[cacheKey] : []) || [];
    if (!rows.length) return '';
    const records = rows.slice(0, 20).map(row => fields.map(field => `${field}:${String(row[field] ?? '').slice(0, 240)}`).join(' | '));
    return `${label} (${rows.length})\n${records.join('\n')}`;
  }).filter(Boolean).join('\n\n').slice(0, 18000);
}

function aiHistoryForGateway() {
  return aiState.messages.filter(message => !message.error).slice(-20).map(({ role, content }) => ({ role, content }));
}

async function sendAIMessage() {
  const input = document.getElementById('ai-input');
  const draft = String(input?.value || '').trim();
  if (!draft || aiState.loading) return;
  aiState.messages.push({ role: 'user', content: draft });
  if (input) { input.value = ''; input.style.height = ''; }
  aiState.loading = true;
  updateAIComposer();
  renderAIMessages();
  try {
    if (!aiState.adapter || !aiState.config) await refreshAIGatewayConfig();
    const model = document.getElementById('ai-model')?.value || loadAISettings().model || aiState.config.provider.model;
    const result = await aiState.adapter.complete({
      messages: aiHistoryForGateway(),
      context: gatherAIContext(),
      model,
      maxTokens: 900,
      temperature: 0.25,
    });
    aiState.messages.push({
      role: 'assistant',
      content: String(result.message?.content || ''),
      provider: result.provider,
      fallback: result.fallback,
    });
  } catch (error) {
    const safeError = aiState.adapter?.normalizeError(error) || normalizeAIError(error);
    aiState.messages.push({ role: 'assistant', content: safeError.message, error: true, retryable: safeError.retryable });
    if (safeError.retryable && input) input.value = draft;
  } finally {
    aiState.loading = false;
    updateAIComposer();
    renderAIMessages();
    if (input?.value) input.focus();
  }
}

function updateAIComposer() {
  const input = document.getElementById('ai-input');
  const button = document.getElementById('ai-send-btn');
  if (input) input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  if (button) button.disabled = aiState.loading || !String(input?.value || '').trim();
  document.getElementById('ai-composer-status')?.classList.toggle('is-visible', aiState.loading);
}

function appendIcon(target, name, size = 20) {
  if (!target || typeof window.taskTrackerIcon !== 'function') return;
  target.insertAdjacentHTML('beforeend', window.taskTrackerIcon(name, { size }));
}

function renderAIMessages() {
  const container = document.getElementById('ai-messages');
  if (!container) return;
  container.replaceChildren();
  if (!aiState.messages.length) {
    const empty = document.createElement('div');
    empty.className = 'ai-empty-state';
    const icon = document.createElement('span');
    icon.className = 'ai-empty-icon';
    appendIcon(icon, 'sparkles', 28);
    const title = document.createElement('strong');
    title.textContent = aiT('ai_ready');
    const body = document.createElement('p');
    body.textContent = aiT('ai_ready_body');
    empty.append(icon, title, body);
    container.append(empty);
    return;
  }
  aiState.messages.forEach(message => {
    const row = document.createElement('article');
    row.className = `ai-message is-${message.role}${message.error ? ' is-error' : ''}`;
    const bubble = document.createElement('div');
    bubble.className = 'ai-message-bubble';
    bubble.textContent = message.content;
    row.append(bubble);
    if (message.role === 'assistant' && message.provider) {
      const provenance = document.createElement('small');
      provenance.className = 'ai-provenance';
      provenance.textContent = message.fallback
        ? `${aiT('ai_fallback')}: ${message.provider.label} · ${message.provider.model}`
        : `${message.provider.label} · ${message.provider.model}`;
      row.append(provenance);
    }
    container.append(row);
  });
  if (aiState.loading) {
    const thinking = document.createElement('div');
    thinking.className = 'ai-thinking';
    thinking.setAttribute('aria-label', aiT('ai_thinking'));
    thinking.append(...[0, 1, 2].map(() => document.createElement('span')));
    container.append(thinking);
  }
  container.scrollTop = container.scrollHeight;
}

window.AIProviderAdapter = AIProviderAdapter;
window.AIProviderRegistry = aiProviderRegistry;
