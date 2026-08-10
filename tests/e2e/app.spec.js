import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const CLIENT_ID = '536004951636-66ltg9ksnvts6m90mftcl6fd99avbdcv.apps.googleusercontent.com';
const PROFILE = {
  email: 'muatazthaaer@gmail.com',
  name: 'Test User',
  picture: '',
  sub: 'test-user-1',
};

function createTestToken(expiryOffsetSeconds = 3600) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    ...PROFILE,
    aud: CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + expiryOffsetSeconds,
  })}.test-signature`;
}

test.beforeEach(async ({ page }) => {
  page.runtimeErrors = [];
  page.on('pageerror', error => page.runtimeErrors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(page.runtimeErrors).toEqual([]);
});

const populatedData = {
  tasks: [
    { id: 'task-late', title: 'Late task', status: 'open', due_date: '2020-01-01', priority: 'high', assignee: 'Amina Hassan', project: 'Office renewal' },
    { id: 'task-soon', title: 'Upcoming task', status: 'open', due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), priority: 'medium', assignee: 'Omar Ali', project: 'Equipment' },
    { id: 'task-progress', title: 'Review supplier quotations', status: 'in_progress', priority: 'medium', assignee: 'Test User', project: 'Procurement' },
    { id: 'task-done', title: 'Approve facilities scope', status: 'done', priority: 'low', assignee: 'Sara Karim', project: 'Facilities' },
  ],
  pos: [
    { id: 'po-late', po_number: 'PO-100', supplier: 'Vendor One', item_description: 'Office equipment', status: 'submitted', expected_delivery: '2020-01-02', total_value: 1200, currency: 'IQD', created_at: new Date().toISOString() },
    { id: 'po-received', po_number: 'PO-101', supplier: 'Technology Partner', item_description: 'Network equipment', status: 'received', expected_delivery: new Date().toISOString().slice(0, 10), total_value: 2850, currency: 'USD', created_at: new Date().toISOString() },
  ],
  milestones: [
    { id: 'mile-soon', name: 'Delivery milestone', status: 'in_progress', target_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), completion_pct: 60 },
  ],
  prs: [
    { id: 'pr-pending', pr_number: 'PR-200', description: 'Office supplies', status: 'Pending', created_at: new Date().toISOString() },
    { id: 'pr-approved', pr_number: 'PR-201', description: 'Ergonomic chairs', department: 'Facilities', status: 'Approved', total_estimated: 2450, currency: 'USD', created_at: new Date().toISOString() },
    { id: 'pr-draft', pr_number: 'PR-202', description: 'Printer toner supply', department: 'Operations', status: 'Draft', total_estimated: 780000, currency: 'IQD', created_at: new Date().toISOString() },
  ],
  vendors: [
    { id: 'vendor-one', vendor_name: 'Vendor One', category: 'Supplier', location: 'Baghdad', contact_person: 'Lina Abbas', email: 'vendor@example.test', status: 'Active', performance_score: 4.6 },
    { id: 'vendor-tech', vendor_name: 'Technology Partner', category: 'IT', location: 'Erbil', phone: '+000000000', status: 'Active', performance_score: 4.8 },
  ],
};

async function installMocks(page, {
  authenticated = false,
  empty = false,
  apiDelay = 0,
  failAllData = false,
  storedProfile = undefined,
  autoAuthAvailable = true,
  tokenExpiryOffset = 3600,
  authPromptDelay = 0,
} = {}) {
  const token = createTestToken(tokenExpiryOffset);
  const data = empty ? { tasks: [], pos: [], milestones: [], prs: [], vendors: [] } : populatedData;

  await page.addInitScript(({ profile, credential, shouldAuthenticate, profileValue, canAutoAuthenticate, promptDelay }) => {
    window.Chart = class ChartMock {
      destroy() {}
      resize() {}
      update() {}
    };
    window.twemoji = { parse: () => {} };
    window.__authMock = { initializeCount: 0, promptCount: 0, disableCount: 0 };
    window.google = {
      accounts: {
        id: {
          initialize(options) {
            window.__authMock.initializeCount += 1;
            window.__authMock.callback = options.callback;
          },
          renderButton(container) {
            if (container.querySelector('button')) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Sign in with Google';
            button.addEventListener('click', () => window.__authMock.callback({ credential }));
            container.append(button);
          },
          prompt(momentCallback) {
            window.__authMock.promptCount += 1;
            setTimeout(() => {
              if (canAutoAuthenticate && localStorage.getItem('tt_user_profile')) {
                window.__authMock.callback({ credential });
              } else {
                momentCallback?.({
                  isNotDisplayed: () => true,
                  isSkippedMoment: () => false,
                  isDismissedMoment: () => false,
                });
              }
            }, promptDelay);
          },
          cancel() {},
          disableAutoSelect() { window.__authMock.disableCount += 1; },
        },
      },
    };
    if (profileValue !== undefined) {
      localStorage.setItem('tt_user_profile', profileValue);
    } else if (shouldAuthenticate) {
      localStorage.setItem('tt_user_profile', JSON.stringify(profile));
    }
  }, {
    profile: PROFILE,
    credential: token,
    shouldAuthenticate: authenticated,
    profileValue: storedProfile,
    canAutoAuthenticate: autoAuthAvailable,
    promptDelay: authPromptDelay,
  });

  await page.route('https://accounts.google.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: '',
  }));
  await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({
    status: 200,
    contentType: route.request().url().endsWith('.css') ? 'text/css' : 'text/javascript',
    body: '',
  }));
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/css',
    body: '',
  }));
  await page.route('**/exec', async route => {
    if (apiDelay) await new Promise(resolve => setTimeout(resolve, apiDelay));
    let request = {};
    try { request = JSON.parse(route.request().postData() || '{}'); } catch {}
    if (failAllData && !(request.action === 'getAll' && request.sheet === 'Users')) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Test failure' }) });
      return;
    }
    let response = { success: true };
    if (request.action === 'getDashboard') {
      response = {
        tasks: data.tasks,
        pos: data.pos,
        milestones: data.milestones,
        expenses: [],
        taskSummary: { total: data.tasks.length, open: data.tasks.length, in_progress: 0, done: 0, overdue: data.tasks.filter(item => item.due_date < '2021-01-01').length },
        poSummary: { total: data.pos.length, draft: 0, submitted: data.pos.length, received: 0, cancelled: 0 },
        totalSpend: data.pos.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      };
    } else if (request.action === 'getAll') {
      const rowsBySheet = {
        Users: [{ ...PROFILE, role: 'admin', permissions: JSON.stringify({ can_edit: true, can_delete: true, can_manage_team: true }) }],
        Tasks: data.tasks,
        POs: data.pos,
        Milestones: data.milestones,
        Expenses: [],
        Vendors: data.vendors,
        Comparisons: [],
        ComparisonVendors: [],
      };
      response = { rows: rowsBySheet[request.sheet] || [] };
    } else if (request.action === 'getNotifications') {
      response = { rows: [] };
    } else if (request.action === 'getPRs') {
      response = { rows: data.prs };
    } else if (request.action === 'getVendors') {
      response = { rows: data.vendors };
    } else if (request.action === 'getInvoices' || request.action === 'getBudgets') {
      response = { rows: [] };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(response),
    });
  });
}

async function openAuthenticatedApp(page, options = {}) {
  await installMocks(page, { authenticated: true, ...options });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-auth-state', 'authenticated');
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
}

async function readMobileGeometry(page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const nav = document.getElementById('mobile-primary-nav');
    const main = document.getElementById('main');
    const topbar = document.getElementById('topbar');
    const dashboard = document.getElementById('dashboard-v2-root');
    const welcome = document.querySelector('.dash-welcome');
    const rightRail = document.querySelector('.dash-right-rail');
    const activeView = document.querySelector('.view.active');
    const navRect = nav.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    const topbarRect = topbar.getBoundingClientRect();
    const dashboardRect = dashboard.getBoundingClientRect();
    const welcomeRect = welcome.getBoundingClientRect();
    const rightRailRect = rightRail.getBoundingClientRect();
    const activeViewRect = activeView.getBoundingClientRect();
    const excluded = [
      '#sidebar', '.table-wrap *', '.table-scroll *', '#global-search-results',
      '#profile-dropdown', '.chat-panel', '#notif-panel', '#notif-backdrop',
    ].join(',');
    const offenders = Array.from(document.querySelectorAll('#app-right *'))
      .filter(element => element.getClientRects().length && !element.matches(excluded) && !element.closest(excluded))
      .map(element => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 1 && (rect.left < -1 || rect.right > viewportWidth + 1))
      .slice(0, 12)
      .map(({ element, rect }) => ({
        tag: element.tagName,
        id: element.id,
        className: String(element.className).slice(0, 80),
        parentClass: String(element.parentElement?.className || '').slice(0, 80),
        text: String(element.textContent || '').trim().slice(0, 40),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
      }));

    return {
      viewportWidth,
      viewportHeight,
      documentScrollWidth: document.documentElement.scrollWidth,
      nav: {
        position: window.getComputedStyle(nav).position,
        top: navRect.top,
        bottom: navRect.bottom,
        height: navRect.height,
      },
      main: {
        left: mainRect.left,
        right: mainRect.right,
        width: mainRect.width,
        paddingBottom: parseFloat(window.getComputedStyle(main).paddingBottom),
      },
      topbar: { bottom: topbarRect.bottom, height: topbarRect.height },
      activeView: { left: activeViewRect.left, right: activeViewRect.right, width: activeViewRect.width },
      dashboard: { left: dashboardRect.left, right: dashboardRect.right, width: dashboardRect.width },
      welcome: { left: welcomeRect.left, right: welcomeRect.right, width: welcomeRect.width, height: welcomeRect.height },
      rightRail: { left: rightRailRect.left, right: rightRailRect.right, width: rightRailRect.width },
      offenders,
    };
  });
}

test('unauthenticated startup resolves to the login screen without persisting a token', async ({ page }) => {
  await installMocks(page);
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toHaveClass(/hidden/);
  await expect(page.locator('#login-screen')).not.toHaveClass(/hidden/);
  await expect(page.locator('#app')).toHaveClass(/hidden/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tt_session'))).toBeNull();
  expect(await page.evaluate(() => window.__authMock.initializeCount)).toBe(1);

  await page.locator('#g-signin-btn button').click();
  await expect(page.locator('html')).toHaveAttribute('data-auth-state', 'authenticated');
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  expect(await page.evaluate(() => localStorage.getItem('tt_session'))).toBeNull();
});

test('mobile tabs keep their explicit order, route state, history, and safe layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedApp(page);

  const tabs = page.locator('#mobile-primary-nav [data-mobile-view]');
  await expect(tabs).toHaveCount(5);
  expect(await tabs.evaluateAll(nodes => nodes.map(node => node.dataset.mobileView))).toEqual([
    'pos', 'purchasereqs', 'dashboard', 'tasks', 'vendors',
  ]);
  await expect(tabs.nth(2)).toHaveAttribute('aria-current', 'page');

  for (const view of ['pos', 'purchasereqs', 'dashboard', 'tasks', 'vendors']) {
    await page.locator(`[data-mobile-view="${view}"]`).click();
    await expect(page.locator(`#view-${view}`)).toHaveClass(/active/);
    await expect(page.locator(`[data-mobile-view="${view}"]`)).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }

  await page.goBack();
  await expect(page.locator('#view-tasks')).toHaveClass(/active/);
  await page.evaluate(() => window.navigateTo('settings'));
  await expect(page.locator('#mobile-primary-nav [aria-current="page"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__authMock.initializeCount)).toBe(1);

  await page.locator('#mobile-menu-btn').click();
  await expect(page.locator('#mobile-menu-btn')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('body')).toHaveClass(/sidebar-open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-menu-btn')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
});

test('mobile layouts have no page overflow at all required viewport sizes in LTR and RTL', async ({ page }) => {
  test.setTimeout(90000);
  await openAuthenticatedApp(page);
  const sizes = [
    [360, 800], [375, 812], [390, 844], [393, 852], [414, 896], [428, 926], [430, 932], [768, 1024],
  ];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const view of ['vendors', 'tasks', 'dashboard', 'purchasereqs', 'pos']) {
      await page.locator(`[data-mobile-view="${view}"]`).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
    await page.locator('[data-mobile-view="dashboard"]').click();
    const metrics = await readMobileGeometry(page);
    expect(metrics.nav.position, `${width}x${height} nav positioning`).toBe('fixed');
    expect(Math.abs(metrics.viewportHeight - metrics.nav.bottom), `${width}x${height} nav bottom`).toBeLessThan(2);
    expect(metrics.nav.top, `${width}x${height} nav must remain at the bottom`).toBeGreaterThan(height / 2);
    expect(metrics.main.width, `${width}x${height} main width`).toBeLessThanOrEqual(width + 1);
    expect(metrics.main.paddingBottom, `${width}x${height} main bottom safe space`).toBeGreaterThanOrEqual(80);
    expect(metrics.dashboard.width, `${width}x${height} dashboard width`).toBeGreaterThanOrEqual(metrics.main.width - 25);
    expect(metrics.welcome.width, `${width}x${height} welcome width`).toBeGreaterThanOrEqual(metrics.dashboard.width - 1);
    expect(metrics.welcome.height, `${width}x${height} welcome height`).toBeLessThanOrEqual(220);
    expect(metrics.rightRail.right, `${width}x${height} right rail edge`).toBeLessThanOrEqual(width + 1);
    expect(metrics.documentScrollWidth, `${width}x${height} document width`).toBeLessThanOrEqual(width + 1);
    expect(metrics.offenders, `${width}x${height} unintended overflow: ${JSON.stringify(metrics.offenders)}`).toEqual([]);
  }

  await page.evaluate(() => window.toggleTheme());
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  for (const view of ['vendors', 'tasks', 'dashboard', 'purchasereqs', 'pos']) {
    await page.locator(`[data-mobile-view="${view}"]`).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }

  await page.evaluate(() => localStorage.setItem('tt_lang', 'ar'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-auth-state', 'authenticated');
  await expect(page.locator('#mobile-primary-nav')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/rtl/);
  const positions = await page.locator('#mobile-primary-nav [data-mobile-view]').evaluateAll(nodes =>
    nodes.map(node => ({ view: node.dataset.mobileView, left: node.getBoundingClientRect().left })),
  );
  expect(positions.map(item => item.view)).toEqual(['pos', 'purchasereqs', 'dashboard', 'tasks', 'vendors']);
  expect(positions[0].left).toBeLessThan(positions[4].left);
  for (const view of ['vendors', 'tasks', 'dashboard', 'purchasereqs', 'pos']) {
    await page.locator(`[data-mobile-view="${view}"]`).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test('notification bell opens on first click, renders actionable data, and routes to its record', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedApp(page, { apiDelay: 150 });
  await page.locator('#notif-bell-btn').click();
  await expect(page.locator('#notif-panel')).toBeVisible();
  await expect(page.locator('.notif-item')).toHaveCount(5);
  await expect(page.locator('#notif-badge')).toBeVisible();
  const notificationGeometry = await page.evaluate(() => {
    const panel = document.getElementById('notif-panel').getBoundingClientRect();
    const nav = document.getElementById('mobile-primary-nav').getBoundingClientRect();
    const topbar = document.getElementById('topbar').getBoundingClientRect();
    return { panelTop: panel.top, panelBottom: panel.bottom, navTop: nav.top, topbarBottom: topbar.bottom };
  });
  expect(notificationGeometry.panelBottom).toBeLessThanOrEqual(notificationGeometry.navTop + 1);
  expect(notificationGeometry.panelTop).toBeGreaterThanOrEqual(notificationGeometry.topbarBottom - 1);
  await expect(page.locator('#ai-chat-fab')).toBeHidden();
  await page.locator('.notif-item').filter({ hasText: 'Late task' }).click();
  await expect(page.locator('#view-tasks')).toHaveClass(/active/);
  await expect(page.locator('[data-record-id="task-late"]:visible')).toBeFocused();
});

test('notification empty state and desktop visibility are intentional', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openAuthenticatedApp(page, { empty: true });
  await expect(page.locator('#mobile-primary-nav')).toBeHidden();
  await page.locator('#notif-bell-btn').click();
  await expect(page.locator('#notif-panel')).toBeVisible();
  await expect(page.locator('#notif-list')).toContainText("You're all caught up");
});

test('notification error state exposes a retry action without a blank panel', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openAuthenticatedApp(page, { failAllData: true });
  await page.locator('#notif-bell-btn').click();
  await expect(page.locator('#notif-list')).toContainText('Notifications could not be loaded.');
  await expect(page.locator('.notif-retry-btn')).toBeVisible();
});

test('notification mark-all, close, and focus behavior remain wired', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedApp(page);
  await page.locator('#notif-bell-btn').click();
  await expect(page.locator('#notif-panel')).toBeVisible();
  await expect(page.locator('#notif-mark-all')).toBeVisible();
  await page.locator('#notif-mark-all').click();
  await expect(page.locator('#notif-badge')).toBeHidden();
  await expect(page.locator('#notif-mark-all')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#notif-panel')).toBeHidden();
  await expect(page.locator('#notif-bell-btn')).toBeFocused();
});

test('session restoration survives navigation and rapid reloads without duplicate initialization', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openAuthenticatedApp(page);
  await page.evaluate(() => window.navigateTo('vendors'));
  await page.reload();
  await expect(page.locator('#view-vendors')).toHaveClass(/active/);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-auth-state', 'authenticated');
  expect(await page.evaluate(() => window.__authMock.initializeCount)).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('tt_session'))).toBeNull();

  const restoredProfile = await page.evaluate(() => {
    localStorage.setItem('tt_session', 'legacy-session-placeholder');
    const profile = window.tryRestoreSession();
    return { email: profile?.email, legacySession: localStorage.getItem('tt_session') };
  });
  expect(restoredProfile.email).toBe(PROFILE.email);
  expect(restoredProfile.legacySession).toBe('legacy-session-placeholder');

  const aiCredentialStorage = await page.evaluate(() => {
    window._saveAISettingsToStorage({ provider: 'openai', model: 'test-model', apiKey: 'test-session-key' });
    return {
      persisted: JSON.parse(localStorage.getItem('tt_ai_settings') || '{}'),
      sessionKey: sessionStorage.getItem('tt_ai_session_key'),
    };
  });
  expect(aiCredentialStorage.persisted).toEqual({ provider: 'openai', model: 'test-model' });
  expect(aiCredentialStorage.sessionKey).toBe('test-session-key');

  const initialTheme = await page.locator('html').getAttribute('data-theme');
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', initialTheme);

  await page.locator('#signout-btn').click();
  await expect(page.locator('#login-screen')).toBeVisible();
  await expect(page.locator('#app')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => localStorage.getItem('tt_user_profile'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('tt_session'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('tt_ai_session_key'))).toBeNull();
});

test('slow, invalid, expired, and unavailable automatic authentication resolve safely', async ({ page }) => {
  await installMocks(page, { authenticated: true, apiDelay: 500 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login-screen')).toHaveClass(/hidden/);
  await expect(page.locator('#loading-screen')).not.toHaveClass(/hidden/);
  await expect(page.locator('html')).toHaveAttribute('data-auth-state', 'authenticated');

  const invalidContext = await page.context().browser().newContext();
  const invalidPage = await invalidContext.newPage();
  await installMocks(invalidPage, { storedProfile: '{invalid', autoAuthAvailable: false });
  await invalidPage.goto('http://127.0.0.1:4174/');
  await expect(invalidPage.locator('#login-screen')).toBeVisible();
  expect(await invalidPage.evaluate(() => localStorage.getItem('tt_user_profile'))).toBeNull();
  await invalidContext.close();

  const expiredContext = await page.context().browser().newContext();
  const expiredPage = await expiredContext.newPage();
  await installMocks(expiredPage, { authenticated: true, tokenExpiryOffset: -60 });
  await expiredPage.goto('http://127.0.0.1:4174/');
  await expect(expiredPage.locator('#login-screen')).toBeVisible();
  await expect(expiredPage.locator('html')).toHaveAttribute('data-auth-state', 'unauthenticated');
  await expiredContext.close();
});

test('desktop layouts remain full width and mobile navigation stays hidden', async ({ page }) => {
  await openAuthenticatedApp(page);
  for (const [width, height] of [[1024, 768], [1366, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('#mobile-primary-nav')).toBeHidden();
    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      dashboardRight: document.getElementById('dashboard-v2-root').getBoundingClientRect().right,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.dashboardRight).toBeLessThanOrEqual(width + 1);
  }
});

test('all routable modules, mobile global search, and the AI sheet open without runtime errors', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await openAuthenticatedApp(page);
  const views = ['dashboard', 'tasks', 'pos', 'quotations', 'invoices', 'vendors', 'purchasereqs', 'analytics', 'budget', 'milestones', 'expenses', 'permissions', 'settings'];
  for (const view of views) {
    await page.evaluate(target => window.navigateTo(target, { forceReload: true }), view);
    await expect(page.locator(`#view-${view}`)).toHaveClass(/active/);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.navigateTo('dashboard', { forceReload: true }));
  await page.locator('#global-search-input').fill('late');
  await expect(page.locator('.dash-search-result').first()).toBeVisible();
  await page.locator('.dash-search-result').first().click();
  await expect(page.locator('#view-tasks')).toHaveClass(/active/);

  await page.locator('#ai-chat-fab').click();
  await expect(page.locator('#ai-chat-panel')).toBeVisible();
  await expect(page.locator('#ai-chat-fab')).toBeHidden();
  await page.evaluate(() => window.toggleAIChat());
  await expect(page.locator('#ai-chat-panel')).toBeHidden();
});

test('mobile V3 filters, live cards, and create actions are wired to existing workflows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedApp(page);

  for (const view of ['pos', 'purchasereqs', 'dashboard', 'tasks', 'vendors']) {
    await page.locator(`[data-mobile-view="${view}"]`).click();
    const topbar = await page.evaluate(() => {
      const bar = document.getElementById('topbar');
      const menu = document.getElementById('mobile-menu-btn').getBoundingClientRect();
      const title = document.getElementById('topbar-title').getBoundingClientRect();
      const actions = document.getElementById('topbar-right').getBoundingClientRect();
      return { clientWidth: bar.clientWidth, scrollWidth: bar.scrollWidth, menuRight: menu.right, titleLeft: title.left, titleRight: title.right, actionsLeft: actions.left };
    });
    expect(topbar.scrollWidth, `${view} topbar width`).toBeLessThanOrEqual(topbar.clientWidth + 1);
    expect(topbar.titleLeft, `${view} title/menu overlap`).toBeGreaterThanOrEqual(topbar.menuRight - 1);
    expect(topbar.titleRight, `${view} title/action overlap`).toBeLessThanOrEqual(topbar.actionsLeft + 1);
  }

  await page.locator('[data-mobile-view="tasks"]').click();
  await expect(page.locator('#mobile-v3-tasks')).toBeVisible();
  await expect(page.locator('#mobile-v3-task-summary .mobile-v3-summary-item')).toHaveCount(4);
  await expect(page.locator('#mobile-v3-task-list .mobile-v3-record')).toHaveCount(4);
  await page.locator('[data-mobile-task-filter="overdue"]').click();
  await expect(page.locator('#mobile-v3-task-list .mobile-v3-record')).toHaveCount(1);
  await expect(page.locator('#mobile-v3-task-list')).toContainText('Late task');
  await page.locator('[data-mobile-task-filter="all"]').click();
  await page.locator('#mobile-v3-task-search').fill('supplier');
  await expect(page.locator('#mobile-v3-task-list')).toContainText('Review supplier quotations');
  await page.locator('#mobile-v3-task-search').fill('');
  await page.locator('[data-mobile-create="Tasks"]').click();
  await expect(page.locator('#modal-overlay')).not.toHaveClass(/hidden/);
  await page.locator('#modal-cancel').click();

  await page.locator('[data-mobile-view="pos"]').click();
  await expect(page.locator('#mobile-v3-po-list .mobile-v3-record')).toHaveCount(2);
  await page.locator('[data-mobile-create="POs"]').click();
  await expect(page.locator('#modal-overlay')).not.toHaveClass(/hidden/);
  await page.locator('#modal-cancel').click();

  await page.locator('[data-mobile-view="purchasereqs"]').click();
  await expect(page.locator('#mobile-v3-pr-list .mobile-v3-record')).toHaveCount(3);
  await page.locator('[data-mobile-pr-filter="approved"]').click();
  await expect(page.locator('#mobile-v3-pr-list')).toContainText('Ergonomic chairs');
  await page.locator('[data-mobile-create="PRs"]').click();
  await expect(page.locator('#pr-modal-overlay')).toBeVisible();
  await page.evaluate(() => window.closePRModal());

  await page.locator('[data-mobile-view="vendors"]').click();
  await expect(page.locator('#mobile-v3-vendor-list .mobile-v3-record')).toHaveCount(2);
  await page.locator('#mobile-v3-vendor-search').fill('technology');
  await expect(page.locator('#mobile-v3-vendor-list .mobile-v3-record')).toHaveCount(1);
  await page.locator('[data-mobile-create="Vendors"]').click();
  await expect(page.locator('#vnd-modal-overlay')).toBeVisible();
  await page.evaluate(() => window.closeVendorModal());
});

test('captures the required Mobile V3 visual regression screens', async ({ page }) => {
  test.setTimeout(90000);
  mkdirSync('artifacts/mobile-v3', { recursive: true });
  await openAuthenticatedApp(page);
  const views = [
    ['dashboard', '.dash-kpi-card'],
    ['tasks', '#mobile-v3-task-list .mobile-v3-record'],
    ['purchasereqs', '#mobile-v3-pr-list .mobile-v3-record'],
    ['pos', '#mobile-v3-po-list .mobile-v3-record'],
    ['vendors', '#mobile-v3-vendor-list .mobile-v3-record'],
  ];
  for (const [width, height] of [[390, 844], [430, 932]]) {
    await page.setViewportSize({ width, height });
    for (const [view, readySelector] of views) {
      await page.evaluate(target => window.navigateTo(target, { forceReload: true }), view);
      await expect(page.locator(readySelector).first()).toBeVisible();
      await page.screenshot({ path: `artifacts/mobile-v3/${view}-${width}x${height}.png` });
    }
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate(() => window.navigateTo('dashboard', { forceReload: true }));
  await expect(page.locator('.dash-kpi-card')).toHaveCount(4);
  await page.screenshot({ path: 'artifacts/mobile-v3/dashboard-1366x768.png' });
});

test('an API authorization failure is recovered through one supported Google session prompt', async ({ page }) => {
  await openAuthenticatedApp(page);
  const promptsBefore = await page.evaluate(() => window.__authMock.promptCount);
  await page.route('**/exec', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Unauthorized' }),
  }), { times: 1 });

  const recovered = await page.evaluate(() => window.callAPI('getAll', { sheet: 'Tasks' }));
  expect(recovered.rows).toHaveLength(populatedData.tasks.length);
  await expect(page.locator('html')).toHaveAttribute('data-auth-state', 'authenticated');
  await expect.poll(() => page.evaluate(() => window.__authMock.promptCount)).toBe(promptsBefore + 1);
  expect(await page.evaluate(() => localStorage.getItem('tt_session'))).toBeNull();
});

test('concurrent authorization failures share one refresh and retry once', async ({ page }) => {
  await openAuthenticatedApp(page, { authPromptDelay: 60 });
  const promptsBefore = await page.evaluate(() => window.__authMock.promptCount);
  let probeRequests = 0;
  await page.route('**/exec', async route => {
    let payload = {};
    try { payload = JSON.parse(route.request().postData() || '{}'); } catch {}
    if (payload.action !== 'authProbe') {
      await route.fallback();
      return;
    }
    probeRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(probeRequests <= 2 ? { error: 'Unauthorized' } : { success: true, attempt: probeRequests }),
    });
  });

  const results = await page.evaluate(() => Promise.all([
    window.callAPI('authProbe'),
    window.callAPI('authProbe'),
  ]));

  expect(results).toHaveLength(2);
  expect(probeRequests).toBe(4);
  expect(await page.evaluate(() => window.__authMock.promptCount)).toBe(promptsBefore + 1);
  await expect(page.locator('html')).toHaveAttribute('data-auth-state', 'authenticated');
});

test('PWA metadata and iPhone install assets load from repository-relative paths', async ({ page }) => {
  await installMocks(page);
  await page.goto('/');

  const metadata = await page.evaluate(() => ({
    manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
    appleIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
    appTitle: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
    capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
    statusBar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content,
    themeColor: document.querySelector('meta[name="theme-color"]')?.content,
  }));
  expect(metadata).toEqual({
    manifest: './manifest.webmanifest?v=1',
    appleIcon: './assets/icons/apple-touch-icon.png?v=1',
    appTitle: 'Task Tracker',
    capable: 'yes',
    statusBar: 'black-translucent',
    themeColor: '#060812',
  });

  const manifestResponse = await page.request.get(new URL('manifest.webmanifest', page.url()).href);
  expect(manifestResponse.status()).toBe(200);
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    name: 'Task Tracker',
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'portrait-primary',
  });
  expect(manifest.icons.map(icon => `${icon.sizes}:${icon.purpose}`)).toEqual([
    '192x192:any', '192x192:maskable', '512x512:any', '512x512:maskable',
  ]);

  const expectedAssets = [
    ['assets/icons/apple-touch-icon.png', 180],
    ['assets/icons/icon-192.png', 192],
    ['assets/icons/icon-512.png', 512],
    ['assets/icons/icon-maskable-192.png', 192],
    ['assets/icons/icon-maskable-512.png', 512],
  ];
  for (const [path, expectedSize] of expectedAssets) {
    const response = await page.request.get(new URL(path, page.url()).href);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toContain('image/png');
    const dimensions = await page.evaluate(async ({ src, expected }) => {
      const image = document.createElement('img');
      image.src = src;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight, expected };
    }, { src: new URL(path, page.url()).href, expected: expectedSize });
    expect(dimensions.width, path).toBe(dimensions.expected);
    expect(dimensions.height, path).toBe(dimensions.expected);
  }

  const swResponse = await page.request.get(new URL('sw.js', page.url()).href);
  expect(swResponse.status()).toBe(200);
  const serviceWorker = await swResponse.text();
  expect(serviceWorker).toContain("tasktracker-shell-v6");
  expect(serviceWorker).not.toContain('tt_user_profile');
  expect(serviceWorker).not.toContain('API_URL');
});
