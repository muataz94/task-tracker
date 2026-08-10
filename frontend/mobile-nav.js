// Mobile primary navigation: explicit left-to-right DOM order keeps the
// required visible order stable in both LTR and RTL languages.
const MOBILE_PRIMARY_VIEWS = Object.freeze([
  'pos',
  'purchasereqs',
  'dashboard',
  'tasks',
  'vendors',
]);

let mobileNavInitialized = false;

function initMobileNav() {
  if (mobileNavInitialized) return;
  const nav = document.getElementById('mobile-primary-nav');
  if (!nav) return;

  mobileNavInitialized = true;
  nav.addEventListener('click', event => {
    const tab = event.target.closest('[data-mobile-view]');
    if (!tab || !nav.contains(tab)) return;
    const view = tab.dataset.mobileView;
    if (!MOBILE_PRIMARY_VIEWS.includes(view) || typeof navigateTo !== 'function') return;
    navigateTo(view);
  });

  syncMobileNavActiveState(typeof currentView === 'string' ? currentView : 'dashboard');
}

function syncMobileNavActiveState(view) {
  document.querySelectorAll('#mobile-primary-nav [data-mobile-view]').forEach(tab => {
    const isActive = tab.dataset.mobileView === view;
    tab.classList.toggle('active', isActive);
    if (isActive) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
}

function focusNavigationRecord(recordId) {
  if (!recordId) return;
  let attempts = 0;
  const focusTimer = window.setInterval(() => {
    attempts += 1;
    const escapedId = typeof CSS !== 'undefined' && CSS.escape
      ? CSS.escape(String(recordId))
      : String(recordId).replace(/["\\]/g, '\\$&');
    const row = Array.from(document.querySelectorAll(`[data-record-id="${escapedId}"]`))
      .find(element => element.getClientRects().length > 0);
    if (row) {
      window.clearInterval(focusTimer);
      row.classList.add('record-focus-target');
      row.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      if (!row.hasAttribute('tabindex')) row.setAttribute('tabindex', '-1');
      row.focus({ preventScroll: true });
      window.setTimeout(() => row.classList.remove('record-focus-target'), 2400);
    } else if (attempts >= 12) {
      window.clearInterval(focusTimer);
    }
  }, 200);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileNav, { once: true });
} else {
  initMobileNav();
}
