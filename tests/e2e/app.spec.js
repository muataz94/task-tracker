import { expect, test } from '@playwright/test';

const CLIENT_ID = '536004951636-66ltg9ksnvts6m90mftcl6fd99avbdcv.apps.googleusercontent.com';
const PROFILE = {
  email: 'muatazthaaer@gmail.com',
  name: 'Test User',
  picture: '',
  sub: 'test-user-1',
};

function createTestToken() {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    ...PROFILE,
    aud: CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 3600,
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
    { id: 'task-late', title: 'Late task', status: 'open', due_date: '2020-01-01', priority: 'high' },
    { id: 'task-soon', title: 'Upcoming task', status: 'open', due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), priority: 'medium' },
  ],
  pos: [
    { id: 'po-late', po_number: 'PO-100', supplier: 'Vendor One', status: 'submitted', expected_delivery: '2020-01-02', amount: 1200, currency: 'IQD' },
  ],
  milestones: [
    { id: 'mile-soon', name: 'Delivery milestone', status: 'in_progress', target_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), completion_pct: 60 },
  ],
  prs: [
    { id: 'pr-pending', pr_number: 'PR-200', description: 'Office supplies', status: 'Pending', created_at: new Date().toISOString() },
  ],
};

async function installMocks(page, { authenticated = false, empty = false, apiDelay = 0, failAllData = false } = {}) {
  const token = createTestToken();
  const data = empty ? { tasks: [], pos: [], milestones: [], prs: [] } : populatedData;

  await page.addInitScript(({ profile, credential, shouldAuthenticate }) => {
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
              if (localStorage.getItem('tt_user_profile')) {
                window.__authMock.callback({ credential });
              } else {
                momentCallback?.({
                  isNotDisplayed: () => true,
                  isSkippedMoment: () => false,
                  isDismissedMoment: () => false,
                });
              }
            }, 0);
          },
          cancel() {},
          disableAutoSelect() { window.__authMock.disableCount += 1; },
        },
      },
    };
    if (shouldAuthenticate) {
      localStorage.setItem('tt_user_profile', JSON.stringify(profile));
    }
  }, { profile: PROFILE, credential: token, shouldAuthenticate: authenticated });

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
        Vendors: [],
        Comparisons: [],
        ComparisonVendors: [],
      };
      response = { rows: rowsBySheet[request.sheet] || [] };
    } else if (request.action === 'getNotifications') {
      response = { rows: [] };
    } else if (request.action === 'getPRs') {
      response = { rows: data.prs };
    } else if (request.action === 'getVendors' || request.action === 'getInvoices' || request.action === 'getBudgets') {
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
});

test('mobile layouts have no page overflow at all required viewport sizes in LTR and RTL', async ({ page }) => {
  await openAuthenticatedApp(page);
  const sizes = [
    [430, 932], [428, 926], [414, 896], [390, 844], [375, 812], [360, 800],
  ];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const view of ['vendors', 'tasks', 'dashboard', 'purchasereqs', 'pos']) {
      await page.locator(`[data-mobile-view="${view}"]`).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
  }

  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

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
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('notification bell opens on first click, renders actionable data, and routes to its record', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedApp(page, { apiDelay: 150 });
  await page.locator('#notif-bell-btn').click();
  await expect(page.locator('#notif-panel')).toBeVisible();
  await expect(page.locator('.notif-item')).toHaveCount(5);
  await expect(page.locator('#notif-badge')).toBeVisible();
  await page.locator('.notif-item').filter({ hasText: 'Late task' }).click();
  await expect(page.locator('#view-tasks')).toHaveClass(/active/);
  await expect(page.locator('[data-record-id="task-late"]')).toBeFocused();
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

  const initialTheme = await page.locator('html').getAttribute('data-theme');
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', initialTheme);

  await page.locator('#signout-btn').click();
  await expect(page.locator('#login-screen')).toBeVisible();
  await expect(page.locator('#app')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => localStorage.getItem('tt_user_profile'))).toBeNull();
});

test('an API authorization failure is recovered through one supported Google session prompt', async ({ page }) => {
  await openAuthenticatedApp(page);
  const promptsBefore = await page.evaluate(() => window.__authMock.promptCount);
  await page.route('**/exec', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Unauthorized' }),
  }), { times: 1 });

  await page.evaluate(() => window.callAPI('getAll', { sheet: 'Tasks' }).catch(() => {}));
  await expect(page.locator('html')).toHaveAttribute('data-auth-state', 'authenticated');
  await expect.poll(() => page.evaluate(() => window.__authMock.promptCount)).toBe(promptsBefore + 1);
  expect(await page.evaluate(() => localStorage.getItem('tt_session'))).toBeNull();
});
