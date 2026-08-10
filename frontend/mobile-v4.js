/* global currentView, tableData */
/* Mobile UI/UX V4 orchestration.
   Business data and mutations remain owned by the existing feature modules. */
(function mobileV4Module() {
  const BREAKPOINT = 768;
  const SECONDARY_VIEWS = new Set(['analytics', 'ai', 'settings', 'integrations', 'permissions']);
  let mobileV4Ready = false;
  let mobileV4LastRoute = 'dashboard';
  let mobileV4MutationTimer = 0;

  function isMobileV4() {
    return window.innerWidth <= BREAKPOINT;
  }

  function translate(key) {
    return typeof window.t === 'function' ? window.t(key) : key;
  }

  function icon(name, size = 20) {
    return typeof window.taskTrackerIcon === 'function'
      ? window.taskTrackerIcon(name, { size })
      : '';
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  }

  function sheetRows(sheet) {
    return typeof tableData !== 'undefined' && Array.isArray(tableData[sheet])
      ? tableData[sheet]
      : [];
  }

  function isCompleted(row) {
    return ['done', 'completed', 'closed', 'received'].includes(normalize(row.status));
  }

  function isOverdue(row) {
    if (isCompleted(row)) return false;
    const raw = row.due_date || row.expected_delivery || row.required_by_date || row.target_date;
    if (!raw) return normalize(row.status) === 'overdue';
    const date = new Date(raw);
    return !Number.isNaN(date.getTime()) && date < new Date();
  }

  function formatCompact(value) {
    return new Intl.NumberFormat(document.documentElement.lang || 'en', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(Number(value) || 0);
  }

  function metricMarkup(metrics) {
    return metrics.map(metric => `
      <article class="mobile-v4-kpi mobile-v4-kpi-${metric.tone || 'accent'}">
        <span class="mobile-v4-kpi-icon" aria-hidden="true">${icon(metric.icon, 19)}</span>
        <span class="mobile-v4-kpi-copy">
          <span>${translate(metric.label)}</span>
          <strong>${metric.formatted || Number(metric.value || 0).toLocaleString(document.documentElement.lang || 'en')}</strong>
          <small>${translate(metric.context)}</small>
        </span>
      </article>`).join('');
  }

  function ensureMetricRail(view, metrics) {
    const root = document.getElementById(`view-${view}`);
    if (!root || !isMobileV4()) return;
    let rail = root.querySelector(':scope > .mobile-v4-kpi-rail');
    if (!rail) {
      rail = document.createElement('section');
      rail.className = 'mobile-v4-kpi-rail';
      rail.setAttribute('aria-label', translate('workspace_insights'));
      const header = root.querySelector(':scope > .tab-header, :scope > .settings-page-hd, :scope > .desktop-page-header');
      if (header) header.insertAdjacentElement('afterend', rail);
      else root.prepend(rail);
    }
    rail.innerHTML = metricMarkup(metrics);
  }

  function renderAnalyticsMetrics() {
    const tasks = sheetRows('Tasks');
    const orders = sheetRows('POs');
    const spend = orders.reduce((sum, row) => {
      const total = Number(row.total_value ?? row.amount);
      return sum + (Number.isFinite(total) ? total : (Number(row.quantity) || 0) * (Number(row.unit_price) || 0));
    }, 0);
    const activeVendors = [...document.querySelectorAll('#mobile-v3-vendor-list .mobile-v3-status.is-success')].length;
    ensureMetricRail('analytics', [
      { label: 'total_spend', value: spend, formatted: formatCompact(spend), context: 'purchase_orders', icon: 'receipt', tone: 'accent' },
      { label: 'completed', value: tasks.filter(isCompleted).length, context: 'tasks', icon: 'square-check', tone: 'success' },
      { label: 'overdue', value: [...tasks, ...orders].filter(isOverdue).length, context: 'overdue_items', icon: 'clock', tone: 'danger' },
      { label: 'active_vendors', value: activeVendors, context: 'vendors', icon: 'building', tone: 'warning' },
    ]);
  }

  function renderPermissionMetrics() {
    const cards = [...document.querySelectorAll('#perms-view-wrap .perm-user-card')];
    const roles = cards.map(card => card.querySelector('select')?.value || 'viewer');
    ensureMetricRail('permissions', [
      { label: 'team_members', value: cards.length + 1, context: 'total_records', icon: 'user', tone: 'accent' },
      { label: 'active', value: cards.length + 1, context: 'users_roles', icon: 'square-check', tone: 'success' },
      { label: 'admin', value: roles.filter(role => role === 'admin').length + 1, context: 'users_roles', icon: 'settings', tone: 'warning' },
      { label: 'viewer', value: roles.filter(role => role === 'viewer').length, context: 'users_roles', icon: 'search', tone: 'neutral' },
    ]);
  }

  function renderSettingsAppearance() {
    const grid = document.querySelector('#view-settings .settings-bento');
    if (!grid || grid.querySelector('.mobile-v4-appearance')) return;
    const card = document.createElement('section');
    card.className = 'settings-card glass mobile-v4-appearance';
    card.innerHTML = `
      <div class="settings-card-hd">
        <span class="settings-card-icon" aria-hidden="true">${icon('sun', 19)}</span>
        <div>
          <div class="settings-card-title" data-i18n="appearance">${translate('appearance')}</div>
          <div class="settings-card-sub" data-i18n="appearance_subtitle">${translate('appearance_subtitle')}</div>
        </div>
      </div>
      <div class="mobile-v4-theme-options" role="group" aria-label="${translate('appearance')}">
        <button type="button" data-mobile-theme="light">${icon('sun', 20)}<span data-i18n="theme_light">${translate('theme_light')}</span></button>
        <button type="button" data-mobile-theme="dark">${icon('moon', 20)}<span data-i18n="theme_dark">${translate('theme_dark')}</span></button>
      </div>`;
    grid.prepend(card);
    card.addEventListener('click', event => {
      const button = event.target.closest('[data-mobile-theme]');
      if (!button) return;
      const desired = button.dataset.mobileTheme;
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      if (current !== desired && typeof window.toggleTheme === 'function') window.toggleTheme();
      syncThemeOptions();
    });
    syncThemeOptions();
  }

  function syncThemeOptions() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    document.querySelectorAll('[data-mobile-theme]').forEach(button => {
      const active = button.dataset.mobileTheme === current;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function createMobileSearchButton() {
    const right = document.getElementById('topbar-right');
    const search = right?.querySelector('.dash-global-search');
    if (!right || !search || document.getElementById('mobile-search-toggle')) return;
    const button = document.createElement('button');
    button.id = 'mobile-search-toggle';
    button.type = 'button';
    button.className = 'mobile-v4-topbar-button';
    button.setAttribute('aria-controls', 'global-search-input');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', translate('mobile_search'));
    button.innerHTML = icon('search', 20);
    search.insertAdjacentElement('beforebegin', button);
    button.addEventListener('click', () => {
      const open = !document.body.classList.contains('mobile-search-open');
      document.body.classList.toggle('mobile-search-open', open);
      button.setAttribute('aria-expanded', String(open));
      if (open) window.setTimeout(() => document.getElementById('global-search-input')?.focus(), 40);
    });
  }

  function closeMobileSearch() {
    document.body.classList.remove('mobile-search-open');
    const button = document.getElementById('mobile-search-toggle');
    button?.setAttribute('aria-expanded', 'false');
  }

  function markDrawerDestinations() {
    document.querySelectorAll('#sidebar .nav-item').forEach(item => {
      const isSecondary = SECONDARY_VIEWS.has(item.dataset.view);
      item.classList.toggle('mobile-v4-secondary-destination', isSecondary);
    });
    const sidebar = document.getElementById('sidebar');
    sidebar?.setAttribute('aria-label', translate('mobile_secondary_navigation'));
  }

  function focusableDrawerItems() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return [];
    return [...sidebar.querySelectorAll('button, [href], [data-view], input, select, [tabindex]:not([tabindex="-1"])')]
      .filter(element => element.getClientRects().length && !element.disabled);
  }

  function trapDrawerFocus(event) {
    const sidebar = document.getElementById('sidebar');
    if (!isMobileV4() || !sidebar?.classList.contains('open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      window.closeSidebar?.();
      document.getElementById('mobile-menu-btn')?.focus();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = focusableDrawerItems();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function enhanceDrawerFunctions() {
    const originalToggle = window.toggleSidebar;
    const originalClose = window.closeSidebar;
    if (typeof originalToggle === 'function' && !originalToggle.mobileV4Wrapped) {
      const wrappedToggle = function wrappedMobileV4Toggle() {
        originalToggle();
        if (document.getElementById('sidebar')?.classList.contains('open')) {
          window.setTimeout(() => focusableDrawerItems()[0]?.focus(), 40);
        }
      };
      wrappedToggle.mobileV4Wrapped = true;
      window.toggleSidebar = wrappedToggle;
    }
    if (typeof originalClose === 'function' && !originalClose.mobileV4Wrapped) {
      const wrappedClose = function wrappedMobileV4Close() {
        const wasOpen = document.getElementById('sidebar')?.classList.contains('open');
        originalClose();
        if (wasOpen) document.getElementById('mobile-menu-btn')?.focus();
      };
      wrappedClose.mobileV4Wrapped = true;
      window.closeSidebar = wrappedClose;
    }
  }

  function dockMobileAI(view) {
    const panel = document.getElementById('ai-chat-panel');
    const host = document.getElementById('desktop-ai-chat-host');
    if (!panel || !host || !isMobileV4()) return;
    if (view === 'ai') {
      if (panel.parentElement !== host) host.append(panel);
      if (typeof window.toggleAIChat === 'function') window.toggleAIChat(true);
    } else if (panel.parentElement === host) {
      document.body.append(panel);
      if (typeof window.toggleAIChat === 'function') window.toggleAIChat(false);
    }
  }

  function syncRoute(view) {
    mobileV4LastRoute = view || 'dashboard';
    document.documentElement.dataset.mobileRoute = mobileV4LastRoute;
    if (!isMobileV4()) return;
    closeMobileSearch();
    dockMobileAI(mobileV4LastRoute);
    if (mobileV4LastRoute === 'analytics') renderAnalyticsMetrics();
    if (mobileV4LastRoute === 'permissions') renderPermissionMetrics();
    if (mobileV4LastRoute === 'settings') renderSettingsAppearance();
    document.getElementById('main')?.scrollTo({ top: 0, behavior: 'instant' });
  }

  function wrapRouteSync() {
    const original = window.syncDesktopV1Route;
    if (typeof original !== 'function' || original.mobileV4Wrapped) return;
    const wrapped = function wrappedRouteSync(view) {
      original(view);
      syncRoute(view);
    };
    wrapped.mobileV4Wrapped = true;
    window.syncDesktopV1Route = wrapped;
  }

  function scheduleLiveRefresh() {
    window.clearTimeout(mobileV4MutationTimer);
    mobileV4MutationTimer = window.setTimeout(() => {
      if (!isMobileV4()) return;
      if (mobileV4LastRoute === 'analytics') renderAnalyticsMetrics();
      if (mobileV4LastRoute === 'permissions') renderPermissionMetrics();
    }, 100);
  }

  function initMobileV4() {
    if (mobileV4Ready) return;
    mobileV4Ready = true;
    createMobileSearchButton();
    markDrawerDestinations();
    enhanceDrawerFunctions();
    wrapRouteSync();
    renderSettingsAppearance();
    syncRoute(typeof currentView === 'string' ? currentView : 'dashboard');
    document.addEventListener('keydown', event => {
      trapDrawerFocus(event);
      if (event.key === 'Escape' && document.body.classList.contains('mobile-search-open')) {
        closeMobileSearch();
        document.getElementById('mobile-search-toggle')?.focus();
      }
    });
    document.addEventListener('pointerdown', event => {
      if (!document.body.classList.contains('mobile-search-open')) return;
      if (event.target.closest('.dash-global-search, #mobile-search-toggle')) return;
      closeMobileSearch();
    });
    new MutationObserver(scheduleLiveRefresh).observe(document.getElementById('main'), {
      childList: true,
      subtree: true,
    });
    new MutationObserver(() => {
      syncThemeOptions();
      markDrawerDestinations();
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang', 'dir', 'data-theme'],
    });
    window.addEventListener('resize', () => syncRoute(mobileV4LastRoute), { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileV4, { once: true });
  } else {
    initMobileV4();
  }
}());
