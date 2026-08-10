const FORM_V4_CONTROL_SELECTOR = 'input:not([type="hidden"]), select, textarea';

function formV4Text(key, fallback) {
  return typeof t === 'function' ? t(key) : fallback;
}

function formV4SafeUrl(value, { allowRelative = false, allowDataImage = false } = {}) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (allowDataImage && /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(raw)) return raw;
  try {
    const parsed = new URL(raw, window.location.href);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (!allowRelative && !/^[a-z][a-z\d+.-]*:/i.test(raw)) return '';
    return parsed.href;
  } catch (_) {
    return '';
  }
}

function formV4ValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function formV4FieldLabel(control) {
  const group = control.closest('.form-field, .form-group');
  const label = group?.querySelector('label');
  return String(label?.textContent || control.getAttribute('aria-label') || control.name || 'Field')
    .replace(/\s*\*\s*$/, '').trim();
}

function formV4ClearError(control) {
  if (!control) return;
  control.removeAttribute('aria-invalid');
  const errorId = control.dataset.formErrorId;
  if (errorId) document.getElementById(errorId)?.remove();
  const describedBy = String(control.getAttribute('aria-describedby') || '')
    .split(/\s+/).filter(Boolean).filter(id => id !== errorId);
  if (describedBy.length) control.setAttribute('aria-describedby', describedBy.join(' '));
  else control.removeAttribute('aria-describedby');
  delete control.dataset.formErrorId;
}

function formV4SetError(control, message) {
  if (!control) return false;
  formV4ClearError(control);
  if (!control.id) control.id = `form-v4-${Math.random().toString(36).slice(2, 10)}`;
  const error = document.createElement('span');
  error.className = 'field-error';
  error.id = `${control.id}-error`;
  error.setAttribute('role', 'alert');
  error.textContent = message;
  (control.closest('.form-field, .form-group') || control.parentElement)?.appendChild(error);
  control.setAttribute('aria-invalid', 'true');
  const describedBy = new Set(String(control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  describedBy.add(error.id);
  control.setAttribute('aria-describedby', Array.from(describedBy).join(' '));
  control.dataset.formErrorId = error.id;
  return false;
}

function formV4ValidateControl(control) {
  if (!control || control.disabled || control.hidden) return true;
  formV4ClearError(control);
  const label = formV4FieldLabel(control);
  const value = String(control.value || '').trim();
  if (control.required && !value) {
    return formV4SetError(control, formV4Text('form_required', '{field} is required.').replace('{field}', label));
  }
  if (!value) return true;
  if (control.type === 'email' && !formV4ValidEmail(value)) {
    return formV4SetError(control, formV4Text('form_invalid_email', 'Enter a valid email address.'));
  }
  if (control.type === 'url' && !formV4SafeUrl(value)) {
    return formV4SetError(control, formV4Text('form_invalid_url', 'Enter a valid http or https URL.'));
  }
  if (control.validity?.badInput || control.validity?.stepMismatch) {
    return formV4SetError(control, formV4Text('form_invalid_number', 'Enter a valid number.'));
  }
  if (control.validity?.rangeUnderflow) {
    return formV4SetError(control, formV4Text('form_min_value', 'Value must be at least {min}.').replace('{min}', control.min));
  }
  if (control.validity?.rangeOverflow) {
    return formV4SetError(control, formV4Text('form_max_value', 'Value must be no more than {max}.').replace('{max}', control.max));
  }
  return true;
}

function formV4Validate(container, customRules = []) {
  if (!container) return true;
  formV4Enhance(container);
  let firstInvalid = null;
  container.querySelectorAll(FORM_V4_CONTROL_SELECTOR).forEach(control => {
    if (!formV4ValidateControl(control) && !firstInvalid) firstInvalid = control;
  });
  customRules.forEach(rule => {
    const result = typeof rule === 'function' ? rule() : rule;
    if (!result || result.valid !== false) return;
    formV4SetError(result.control, result.message);
    if (!firstInvalid) firstInvalid = result.control;
  });
  if (firstInvalid) {
    firstInvalid.focus({ preventScroll: true });
    firstInvalid.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return false;
  }
  return true;
}

function formV4FriendlyError(error) {
  if (error?.code === 'AUTH_FORBIDDEN') return formV4Text('auth_forbidden', 'You do not have permission to perform this action.');
  if (error?.code === 'AUTH_EXPIRED') return formV4Text('auth_session_expired', 'Your session expired. Reconnecting...');
  if (!navigator.onLine) return formV4Text('form_offline_error', 'You are offline. Reconnect and try again.');
  return formV4Text('form_save_failed', 'Unable to save your changes. Please try again.');
}

function formV4Enhance(root = document) {
  const scope = root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE ? root : document;
  scope.querySelectorAll('.form-group, .form-field').forEach(group => {
    group.classList.add('form-field');
    const control = group.querySelector(FORM_V4_CONTROL_SELECTOR);
    const label = group.querySelector('label');
    if (!control) return;
    control.classList.add('form-control');
    if (!control.id) control.id = `form-v4-${Math.random().toString(36).slice(2, 10)}`;
    if (label && !label.htmlFor && !control.closest('label')) label.htmlFor = control.id;
    const visuallyRequired = Boolean(label?.querySelector('.req')) || /\*\s*$/.test(String(label?.textContent || '').trim());
    if (visuallyRequired) control.required = true;
    if (control.required && control.getAttribute('aria-required') !== 'true') control.setAttribute('aria-required', 'true');
    if (control.type === 'email') control.autocomplete ||= 'email';
    if (control.type === 'tel') { control.autocomplete ||= 'tel'; control.inputMode ||= 'tel'; }
    if (control.type === 'url') { control.autocomplete ||= 'url'; control.inputMode ||= 'url'; }
    const key = `${control.id} ${control.name}`.toLowerCase();
    if (control.type === 'number' || /(amount|price|value|budget|score)/.test(key)) control.inputMode ||= 'decimal';
    if (/(quantity|qty|percent|pct|year|day|hours)/.test(key)) control.inputMode = 'numeric';
    if (control.tagName === 'TEXTAREA') control.maxLength ||= 5000;
    else if (control.type === 'url') control.maxLength ||= 2048;
    else if (['text', 'email', 'tel', 'search'].includes(control.type)) control.maxLength ||= 500;
  });
  scope.querySelectorAll('.form-row, .form-grid').forEach(row => row.classList.add('form-grid'));
  formV4EnhanceDialogs(scope);
}

function formV4EnhanceDialogs(root = document) {
  const overlays = [];
  if (root.matches?.('.modal-overlay, [id$="-modal-overlay"], #modal-overlay')) overlays.push(root);
  root.querySelectorAll?.('.modal-overlay, [id$="-modal-overlay"], #modal-overlay').forEach(item => overlays.push(item));
  overlays.forEach(overlay => {
    const surface = overlay.matches('#modal') ? overlay : overlay.querySelector(':scope > div, #modal');
    if (!surface) return;
    surface.classList.add('form-modal-surface');
    if (surface.getAttribute('role') !== 'dialog') surface.setAttribute('role', 'dialog');
    if (surface.getAttribute('aria-modal') !== 'true') surface.setAttribute('aria-modal', 'true');
    if (!surface.hasAttribute('tabindex')) surface.tabIndex = -1;
    const children = Array.from(surface.children);
    const footer = children.reverse().find(child => child.querySelectorAll?.('button').length >= 2);
    if (footer) footer.classList.add('form-modal-footer');
  });
  formV4SyncModalState();
}

function formV4VisibleModal() {
  return Array.from(document.querySelectorAll('.form-modal-surface')).reverse().find(surface => {
    const overlay = surface.closest('.modal-overlay, [id$="-modal-overlay"], #modal-overlay') || surface;
    return !overlay.classList.contains('hidden') && getComputedStyle(overlay).display !== 'none';
  });
}

let formV4ActiveModal = null;
let formV4ModalOpener = null;
function formV4SyncModalState() {
  const visibleModal = formV4VisibleModal();
  document.body?.classList.toggle('form-modal-open', Boolean(visibleModal));
  if (visibleModal && visibleModal !== formV4ActiveModal) {
    formV4ModalOpener = document.activeElement;
    formV4ActiveModal = visibleModal;
    const firstControl = visibleModal.querySelector('input:not([type="hidden"]), select, textarea')
      || visibleModal.querySelector('button');
    requestAnimationFrame(() => (firstControl || visibleModal).focus({ preventScroll: true }));
  } else if (!visibleModal && formV4ActiveModal) {
    formV4ActiveModal = null;
    if (formV4ModalOpener?.isConnected) formV4ModalOpener.focus({ preventScroll: true });
    formV4ModalOpener = null;
  }
}

function formV4TrapModalFocus(event) {
  const modal = formV4VisibleModal();
  if (!modal) return;
  if (event.key === 'Escape') {
    const close = modal.querySelector('[aria-label*="close" i], [title*="close" i], button[onclick*="close" i]');
    if (close) { event.preventDefault(); close.click(); }
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = Array.from(modal.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'))
    .filter(element => getComputedStyle(element).display !== 'none');
  if (!focusable.length) { event.preventDefault(); modal.focus(); return; }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

let formV4EnhanceFrame = null;
function formV4ScheduleEnhance() {
  if (formV4EnhanceFrame) return;
  formV4EnhanceFrame = requestAnimationFrame(() => {
    formV4EnhanceFrame = null;
    formV4Enhance(document);
  });
}

function initFormsV4() {
  formV4Enhance(document);
  const observer = new MutationObserver(formV4ScheduleEnhance);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', formV4ScheduleEnhance, true);
  document.addEventListener('input', event => {
    if (event.target.matches?.(FORM_V4_CONTROL_SELECTOR)) formV4ClearError(event.target);
  });
  document.addEventListener('change', event => {
    if (event.target.matches?.(FORM_V4_CONTROL_SELECTOR)) formV4ValidateControl(event.target);
  });
  document.addEventListener('keydown', formV4TrapModalFocus, true);
}

window.formV4SafeUrl = formV4SafeUrl;
window.formV4ValidEmail = formV4ValidEmail;
window.formV4SetError = formV4SetError;
window.formV4Validate = formV4Validate;
window.formV4FriendlyError = formV4FriendlyError;
window.formV4Enhance = formV4Enhance;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initFormsV4, { once: true });
else initFormsV4();
