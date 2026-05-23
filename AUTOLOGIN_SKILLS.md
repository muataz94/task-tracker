# Task Tracker — Auto-Login Fix + Design Skills Installation
# Paste this ENTIRE file into Claude Code chat in VS Code

Read ALL files in E:\task-tracker\ before making any changes.
List every file you read before starting.
After all changes, list every file modified or created.

---

## PART 1 — AUTO-LOGIN (Never show login screen to returning users)

### The Problem
Every page refresh shows the login screen even if the user signed in minutes ago.
Google ID tokens live in memory only — they die on refresh.

### The Solution
Store user PROFILE (not the token) in localStorage after sign-in.
On page load: if profile exists → show a loading screen → attempt silent GIS re-auth → if success, skip login screen entirely. If silent auth fails after 4 seconds → show login screen.

### Step 1 — Update handleCredentialResponse() in the inline script

Find `handleCredentialResponse()` and replace it with:

```javascript
function handleCredentialResponse(response) {
  idToken = response.credential;

  // Decode JWT payload (no verification needed — Apps Script verifies server-side)
  const payload = JSON.parse(atob(idToken.split('.')[1]));

  // Store profile in localStorage (NOT the token — profile only)
  const profile = {
    email:   payload.email,
    name:    payload.name    || payload.email.split('@')[0],
    picture: payload.picture || '',
    sub:     payload.sub      // Google user ID for re-auth hint
  };
  localStorage.setItem('tt_user_profile', JSON.stringify(profile));

  // Apply profile to UI
  applyUserProfile(profile);

  // Save to recent users
  saveRecentUser(profile.email, profile.name, profile.picture);

  // Setup token refresh every 45 minutes
  setupTokenRefresh();

  // Setup notifications
  setupNotifications();

  // Hide login, show app
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  // Prefetch all data
  prefetchAll();

  // Set greeting and navigate
  setGreeting();
  navigateTo('dashboard');
  applyLanguage();
}

function applyUserProfile(profile) {
  // Topbar profile
  const profileImg  = document.getElementById('profile-img');
  const profileName = document.getElementById('profile-name');
  if (profileImg)  {
    profileImg.src = profile.picture || '';
    profileImg.onerror = () => { profileImg.style.display = 'none'; };
  }
  if (profileName) profileName.textContent = profile.name || profile.email.split('@')[0];

  // Profile dropdown
  const ddAvatar = document.getElementById('dropdown-avatar');
  const ddName   = document.getElementById('dropdown-name');
  const ddEmail  = document.getElementById('dropdown-email');
  if (ddAvatar) ddAvatar.src = profile.picture || '';
  if (ddName)   ddName.textContent  = profile.name  || '';
  if (ddEmail)  ddEmail.textContent = profile.email || '';

  // Sidebar user info
  const sidebarAvatar = document.getElementById('sidebar-user-avatar');
  const sidebarName   = document.getElementById('sidebar-user-name');
  const sidebarEmail  = document.getElementById('sidebar-user-email');
  if (sidebarAvatar) {
    if (profile.picture) {
      sidebarAvatar.innerHTML = `<img src="${profile.picture}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    } else {
      sidebarAvatar.textContent = profile.name.charAt(0).toUpperCase();
    }
  }
  if (sidebarName)  sidebarName.textContent  = profile.name  || '';
  if (sidebarEmail) sidebarEmail.textContent = profile.email || '';

  // Chat avatar
  const chatAvatar = document.getElementById('chat-avatar');
  if (chatAvatar) chatAvatar.src = profile.picture || '';
}
```

### Step 2 — Add loading screen HTML to index.html

Add this AFTER the login-screen div and BEFORE the app div:

```html
<!-- Loading screen — shown during silent re-auth attempt -->
<div id="loading-screen" class="hidden">
  <div class="loading-card">
    <img id="loading-avatar" src="" class="loading-avatar" alt="" />
    <div class="loading-name" id="loading-name">Welcome back</div>
    <div class="loading-email" id="loading-email"></div>
    <div class="loading-spinner">
      <div class="spinner-ring"></div>
    </div>
    <p class="loading-sub">Signing you in...</p>
  </div>
</div>
```

Add CSS to style.css:
```css
#loading-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  background: var(--bg-root);
  position: fixed;
  inset: 0;
  z-index: 999;
}

#loading-screen::before {
  content: '';
  position: fixed; inset: 0;
  background:
    radial-gradient(ellipse 60% 50% at 20% 30%, var(--blob-1) 0%, transparent 60%),
    radial-gradient(ellipse 50% 60% at 80% 70%, var(--blob-2) 0%, transparent 60%);
  pointer-events: none;
}

.loading-card {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  position: relative;
  z-index: 1;
}

.loading-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(99,102,241,0.3);
  box-shadow: 0 0 0 6px rgba(99,102,241,0.08);
  animation: avatarPop 0.4s cubic-bezier(0.34,1.56,0.64,1);
}

@keyframes avatarPop {
  from { transform: scale(0.5); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}

.loading-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: -0.03em;
}

.loading-email {
  font-size: 13px;
  color: var(--text-3);
  margin-top: -6px;
}

.loading-spinner {
  margin: 8px 0 4px;
}

.spinner-ring {
  width: 32px;
  height: 32px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-sub {
  font-size: 12px;
  color: var(--text-3);
}
```

### Step 3 — Add attemptSilentLogin() function to inline script

Add this function and call it in window.onload:

```javascript
function attemptSilentLogin() {
  const stored = localStorage.getItem('tt_user_profile');
  if (!stored) {
    // No stored profile — show login screen normally
    showLoginScreen();
    return;
  }

  // Profile found — show loading screen with user info
  const profile = JSON.parse(stored);
  const loadingScreen = document.getElementById('loading-screen');
  const loginScreen   = document.getElementById('login-screen');

  // Populate loading screen with stored profile
  const loadAvatar = document.getElementById('loading-avatar');
  const loadName   = document.getElementById('loading-name');
  const loadEmail  = document.getElementById('loading-email');
  if (loadAvatar) loadAvatar.src = profile.picture || '';
  if (loadName)   loadName.textContent  = 'Welcome back, ' + (profile.name || profile.email.split('@')[0]);
  if (loadEmail)  loadEmail.textContent = profile.email;

  // Show loading, hide login
  loginScreen.classList.add('hidden');
  loadingScreen.classList.remove('hidden');

  // Attempt silent re-auth with GIS
  let authResolved = false;

  google.accounts.id.initialize({
    client_id:              CLIENT_ID,
    callback:               (response) => {
      authResolved = true;
      handleCredentialResponse(response);
    },
    auto_select:            true,
    hint:                   profile.email,
    use_fedcm_for_prompt:   false,
    cancel_on_tap_outside:  false
  });

  // Attempt silent prompt
  google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      // Silent auth not possible — show login screen
      if (!authResolved) {
        authResolved = true;
        showLoginScreen();
      }
    }
  });

  // Fallback timeout — if no response in 4 seconds, show login
  setTimeout(() => {
    if (!authResolved) {
      authResolved = true;
      showLoginScreen();
    }
  }, 4000);
}

function showLoginScreen() {
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  // Load recent users
  loadRecentUsers();
}
```

### Step 4 — Update window.onload

Replace the current `window.onload` function with:

```javascript
window.onload = function() {
  // Initialize theme and language FIRST
  initTheme();
  initLanguage();

  // Initialize Google Auth
  google.accounts.id.initialize({
    client_id:            CLIENT_ID,
    callback:             handleCredentialResponse,
    auto_select:          false,
    use_fedcm_for_prompt: false
  });

  // Render sign-in button (needed even if we try silent auth)
  google.accounts.id.renderButton(
    document.getElementById('g-signin-btn'),
    { theme: 'outline', size: 'large', type: 'standard' }
  );

  // Try silent login first
  attemptSilentLogin();

  // Check for app updates
  checkForUpdates();
};
```

### Step 5 — Update sign-out to clear stored profile

Find the sign-out handler and add:
```javascript
// In sign-out logic, add:
localStorage.removeItem('tt_user_profile');
// Then redirect to login:
google.accounts.id.disableAutoSelect();
idToken = null;
document.getElementById('app').classList.add('hidden');
showLoginScreen();
```

---

## PART 2 — INSTALL DESIGN SKILLS

Create these files exactly as specified.

### File 1: E:\task-tracker\.claude\CLAUDE.md

Create this file (the .claude folder may not exist — create it):

```markdown
# Task Tracker — Claude Code Project Instructions

## Project Overview
Vanilla JS task tracker app. Google Sheets backend via Apps Script.
Files: E:\task-tracker\frontend\ (index.html, style.css, config.js, api.js, cache.js, i18n.js, tables.js, dashboard.js, kanban.js, chat.js)

## ALWAYS follow these design skills when making UI changes:
Use /impeccable and /taste principles on every UI modification.

## Tech Stack
- Vanilla JS (no framework)
- CSS custom properties for theming
- Google Identity Services for auth
- Chart.js for charts
- Inter font (Google Fonts)
- Liquid glass aesthetic

## Critical Rules
1. NEVER hardcode colors — always use CSS variables (--text-1, --accent, etc.)
2. NEVER use localStorage for tokens — profile only
3. Script load order: i18n.js → config.js → cache.js → api.js → tables.js → dashboard.js → kanban.js → chat.js → inline
4. ALL user-facing text must use t('key') from i18n.js
5. Content-Type must be 'text/plain' for Apps Script fetch calls
6. Always test both dark AND light mode after CSS changes
7. Always test both LTR (English) AND RTL (Arabic) after layout changes

## File Ownership
- config.js: DO NOT MODIFY content
- api.js: Only modify callAPI() error handling
- i18n.js: Add translations here for new text
- cache.js: Manage caching here
```

### File 2: E:\task-tracker\.claude\commands\impeccable.md

```markdown
# Impeccable Design Skill
# Based on Emil Kowalski's principles of refined micro-interactions

When applying this skill to any UI component:

## Spring Animation System
Use these exact cubic-bezier curves — never use linear or ease:
- Entrance/pop: cubic-bezier(0.34, 1.56, 0.64, 1)    — spring overshoot
- Exit/collapse: cubic-bezier(0.4, 0, 0.2, 1)          — smooth ease-out
- Hover lift:    cubic-bezier(0.2, 0, 0, 1)             — snappy settle
- Slide in:      cubic-bezier(0.32, 0.72, 0, 1)         — iOS-style decelerate

Duration scale:
- Micro (icon hover):     150ms
- Small (button press):   200ms
- Medium (modal open):    280ms
- Large (page transition): 350ms
- Never exceed 500ms for UI animations

## Spacing System (8px base)
- 4px  — gap between inline elements (badge + text)
- 8px  — gap between related items (icon + label)
- 12px — internal card padding (compact)
- 16px — standard padding
- 20px — section gaps
- 24px — between card groups
- 32px — major section breaks
- Never use odd numbers. Never use 5px, 7px, 11px, 15px.

## Typography Precision
- Page titles:   700 weight, -0.04em tracking, 20-24px
- Section heads: 600 weight, -0.02em tracking, 14-16px
- Body text:     400 weight, 0em tracking, 13-14px
- Labels/caps:   500-600 weight, +0.06em tracking, 10-11px, UPPERCASE
- Values/numbers: 700-800 weight, -0.05em tracking (tighter = more premium)
- Never mix more than 2 font weights in one component

## Interaction States (every interactive element needs ALL of these)
```css
/* Template for every button/card/item */
.element {
  transition: transform 200ms cubic-bezier(0.2,0,0,1),
              box-shadow 200ms cubic-bezier(0.2,0,0,1),
              background 150ms ease,
              border-color 150ms ease;
}
.element:hover  { transform: translateY(-1px); }
.element:active { transform: translateY(0px) scale(0.98); transition-duration: 100ms; }
.element:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

## Impeccable Details Checklist
Before finalizing any component, verify:
- [ ] Hover state is visually distinct but subtle
- [ ] Active/press state gives tactile feedback (scale down slightly)
- [ ] Focus state is visible for keyboard navigation
- [ ] Loading state is handled (skeleton or spinner)
- [ ] Empty state is designed (not just blank space)
- [ ] Error state is designed
- [ ] Transitions are consistent — same curve family throughout
- [ ] Border radius is consistent with design system (var(--r-sm/md/lg/xl))
- [ ] Shadows use rgba, never solid colors
- [ ] Text never overflows without ellipsis or wrapping strategy

## Micro-interaction Patterns
Icon hover: scale(1.15) + unique animation per icon type
Button hover: translateY(-1px) + shadow increase
Card hover: translateY(-2px) + border-color lightens
Input focus: border-color → accent + box-shadow glow ring
Modal open: scale(0.94)→scale(1) + translateY(8px)→translateY(0)
Dropdown: scale(0.96)→scale(1) + translateY(-6px)→translateY(0)
Toast/notification: translateY(100%)→translateY(0) from bottom

## What NOT to do (impeccable = restraint)
- No bounce animations on text
- No color transitions that are jarring
- No animations that last over 400ms for UI elements
- No rotation animations unless it means something (settings gear = rotate)
- No scale animations over 1.3x
- No shadows that are too dark (max rgba(0,0,0,0.4))
```

### File 3: E:\task-tracker\.claude\commands\taste.md

```markdown
# Taste Skill
# High-taste UI principles — restraint, intentionality, hierarchy

## The Core Principle
Good taste = knowing what to leave out.
Every element must earn its place. If you cannot explain why it's there, remove it.

## Visual Hierarchy Rules
1. ONE primary action per screen — everything else is secondary or tertiary
2. The eye should travel: Title → Key stat → Action → Supporting info
3. White space IS a design element — emptiness creates emphasis
4. Maximum 3 levels of visual hierarchy per section

## Color Usage Rules (taste = restraint)
- Use accent color (--accent) sparingly — max 3 elements per view
- When everything is colorful, nothing is colorful
- Background colors should recede, not compete
- Reserve red (--accent-red) for errors and genuine urgency only
- Reserve green (--accent-green) for success states only
- Gray scale does most of the work — color punctuates

## Typography Taste
- Hierarchy through weight and size, not color alone
- Body text should be comfortable to read — 13-14px, line-height 1.5-1.6
- Headlines need breathing room — margin-bottom at least 0.5em
- Never center-align body text (only headlines/cards)
- Avoid ALL CAPS except for micro-labels (10-11px)
- Numbers in data contexts: tabular-nums, monospace feel

## Component Taste Principles
### Cards
- Internal padding: consistent, generous (not cramped)
- Border radius: consistent across all cards (use --r-md)
- Shadow: one consistent shadow level per elevation tier
- Content: max 3-4 pieces of info per card (more = noise)

### Tables
- Alternating row colors: NO (subtle hover is enough)
- Column alignment: numbers right-align, text left-align
- Header: lighter than body, uppercase, slightly smaller
- Row height: generous — 44-48px feels premium, 32px feels cramped

### Forms
- One column layouts feel more intentional than two columns
- Label above input (never inline placeholder as label)
- Input padding: 10-12px vertical (not 6px — cramped)
- Error messages: below the field, red, small, immediate

### Empty States
- Never leave a blank container — design the empty state
- Empty state = illustration/icon + message + call-to-action
- Tone should be encouraging, not apologetic

## What High-Taste Looks Like
- Consistent: same pattern repeated = trust
- Intentional: every spacing choice has a reason
- Restrained: fewer things, each done better
- Alive: subtle animations that feel physical
- Readable: clear hierarchy guides the eye effortlessly

## What Low-Taste Looks Like (avoid)
- Inconsistent border-radius across components
- Shadows that are too dark or too many
- Too many colors competing for attention
- Cramped spacing (padding < 12px in cards)
- Animations that feel random or excessive
- Modal with no clear visual hierarchy
- Buttons that all look the same weight/importance

## Taste Checklist Before Finishing Any UI Change
- [ ] Is every element intentional? (remove anything decorative-only)
- [ ] Is the hierarchy clear at a glance? (1-second test)
- [ ] Is the spacing consistent with the 8px grid?
- [ ] Are there max 2 accent-colored elements visible at once?
- [ ] Does the empty state look designed?
- [ ] Does it work in both dark AND light mode?
- [ ] Does it work in both LTR AND RTL?
- [ ] Would you be proud to show this to a senior designer?
```

### File 4: E:\task-tracker\.claude\commands\glass.md

```markdown
# Liquid Glass Design Skill
# Apple iOS 26 / visionOS inspired glass morphism

## Glass Layer System
Three levels of glass — use consistently:

### Level 1 — Background glass (large areas, sidebar)
background: rgba(255,255,255,0.04);
backdrop-filter: blur(40px) saturate(200%);
border: 1px solid rgba(255,255,255,0.06);

### Level 2 — Card glass (default for all cards)
background: rgba(255,255,255,0.06);
backdrop-filter: blur(20px) saturate(180%);
border: 1px solid rgba(255,255,255,0.08);
box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12);

### Level 3 — Elevated glass (modals, dropdowns)
background: rgba(255,255,255,0.10);
backdrop-filter: blur(24px) saturate(200%);
border: 1px solid rgba(255,255,255,0.12);
box-shadow: 0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.18);

## Specular Highlight (the signature glass edge)
Every glass card gets a top highlight:
```css
.glass-card::after {
  content: '';
  position: absolute;
  top: 0; left: 12%; right: 12%;
  height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(255,255,255,0.25) 50%,
    transparent 100%
  );
}
```

## Background Mesh (required for glass to work)
Glass only looks good against a colorful blurred background.
The animated blobs in body::before are essential — never remove them.

## Glass Rules
- Never use glass on plain white/black backgrounds — needs color behind it
- Never stack more than 3 glass layers (blur compounds and gets heavy)
- Light mode glass uses higher opacity (0.55-0.80) vs dark mode (0.04-0.12)
- Always add the specular highlight (::after) to glass cards
- Glass borders are rgba white in dark mode, rgba purple/blue in light mode
```

---

## PART 3 — HOW TO CALL THESE SKILLS

After creating the files above, here is how to use them in Claude Code:

### Method 1 — Reference in prompt directly:
```
Apply /impeccable and /taste principles to redesign the stat cards in index.html
```

### Method 2 — Use in a full request:
```
Following the /impeccable animation system and /taste visual hierarchy rules,
redesign the dashboard panels to be more refined. Read the skill files first.
```

### Method 3 — Call for a review:
```
Review the current style.css against /taste checklist and /impeccable
micro-interaction standards. List every violation and fix them.
```

### Method 4 — Combined with glass:
```
Apply /glass Level 2 to all cards and /impeccable hover states.
Make sure it passes the /taste checklist.
```

Claude Code reads the .claude/ folder automatically for every session in this project.
CLAUDE.md instructions apply to ALL prompts automatically.
The /commands/*.md files are called explicitly by mentioning their name.

---

## PART 4 — VERIFY SKILLS INSTALLATION

After creating all files, verify this structure exists:
```
E:\task-tracker\
├── .claude\
│   ├── CLAUDE.md
│   └── commands\
│       ├── impeccable.md
│       ├── taste.md
│       └── glass.md
├── frontend\
│   └── ... (all existing files)
└── backend\
    └── Code.gs
```

---

## FINAL RULES

1. Read ALL existing files first
2. Implement Part 1 (auto-login) completely before Part 2
3. Test the sign-in flow mentally: first visit → login screen. Return visit → loading screen → app (no login)
4. Create .claude/ folder and all 4 files exactly as specified
5. Do NOT modify config.js, api.js content
6. After all changes list every file created or modified
7. Remind user to run: git add . && git commit -m "auto-login + design skills" && git push
