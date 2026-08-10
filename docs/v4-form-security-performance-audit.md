# V4 form, storage, security, and performance audit

## Form inventory

| Form | Module | Mode | Main fields | Required / current validation | Mobile or consistency issue |
| --- | --- | --- | --- | --- | --- |
| Task | `tables.js` | Create/edit | title, status, priority, assignee, dates, progress, project, category, hours, recurrence, notes, subtasks | title, status, priority, project | Required state is visual only; number ranges and accessible field errors are incomplete. |
| Purchase order | `tables.js` | Create/edit | PO number, supplier, description, quantities, prices, currency, status, delivery dates, requester, approver, PR/comparison links | PO number, supplier | No dependent date/range validation; long form needs one responsive sheet system. |
| Milestone | `tables.js` | Create/edit | project, name, owner, dates, progress, status | project, milestone | Progress/date validation and accessible errors are incomplete. |
| Expense | `tables.js` | Create/edit | category, description, amount, currency, date, budget line, approver | category, amount | Amount constraints and consistent input modes are missing. |
| Custom field | inline `index.html` | Create | label, type, select options | label | Uses a separate compact style and lacks shared error presentation. |
| Purchase request | `purchasereqs.js` | Create/edit | PR number, description, requester, department, priority, required date, currency, budget, location, approvals, notes, attachment, line items | PR number, description, requester; line item required | Required attributes, URL validation, line-item errors, and consistent field sizing are incomplete. |
| Vendor | `vendors.js` | Create/edit/rate | name, category, contact, phone, email, website, address, currency, terms, status, logo, blacklist reason, contract date, notes; score inputs | name | URL/format validation, conditional blocked reason, and shared error UI are incomplete. |
| Invoice | `invoices.js` | Create/edit | invoice number, vendor, amount/currency, dates, status, PO, payment data, attachment, recurrence, notes | number, vendor, amount | Invoice/due-date dependency, amount-paid range, URL validation, and required attributes are incomplete. |
| Budget | `budget.js` | Create/edit | department, fiscal year, cost center, total, currency | department, year, total | Fiscal-year and amount ranges use toast-only errors. |
| Quotation comparison | `quotations.js` | Create/edit | description, PR, department, dates, value/currency, terms, PO, status, weights, vendor scores | description, PR, vendor | Weight/range/date validation and shared field errors are incomplete. |
| Message compose | `messaging.js` | WhatsApp/email | phone or recipient, subject, message | phone; email and subject | Format validation and shared errors are incomplete; outbound URL construction needs protocol safety. |
| Team member | inline `index.html` | Create/edit | email, role, permission switches | email | Email is toast-validated; server ownership checks exist only for permission updates. |
| Settings/preferences | inline `index.html` | Edit | company, defaults, currency, date format, language, refresh, budget, Sheet URL, automation toggles | optional | Several controls rely on placeholders rather than a unified field component. |
| AI settings | `ai-chat.js` / inline `index.html` | Edit | provider, model, API key | API key | Key is correctly session-only after migration; sizing/error UI differs from other forms. |
| Search and filters | inline / module views | Filter | global search, module search, dates, project/status filters | optional | Labels are sometimes screen-reader-only or title-only; mobile filter presentation varies. |
| Profile/avatar | inline `index.html` | Edit | avatar URL / profile display | optional | Remote image URLs require protocol validation and safe fallback. |
| Chat edit/upload | `chat.js` | Edit/upload | message, image file | non-empty message / image type | Uses a separate control style; file size and error semantics need review. |
| Quick Add | dashboard/mobile actions | Create launcher | routes to Task/PO/PR/Vendor forms | inherits target form | Must remain permission-aware and use the upgraded target form. |
| Analytics | `analytics.js` | Read/filter only | chart/report selectors | n/a | No record create/edit form; shared select sizing still applies. |

## Browser storage inventory

| Key | Storage | Purpose | Lifetime | Sensitivity / decision |
| --- | --- | --- | --- | --- |
| `tt_user_profile` | local | Returning-user email/name/picture/sub hint | Until logout/invalid profile | Personal profile only; no credential. Retained for GIS returning-user hint. |
| `tt_recent_users` | local | Recent profile choices/hint | Until cleared by browser | Personal profile metadata; no token. |
| `tt_theme`, `tt_lang`, `tt_prefs` | local | Display and workflow preferences | Persistent | Low sensitivity. |
| `tt_ai_settings` | local | AI provider/model only | Persistent | Must never contain an API key; migration removes legacy keys. |
| `tt_ai_session_key` | session | User-supplied AI provider key | Current tab session | Sensitive; session-only and cleared on logout. |
| `tt_offline_queue` | local | Pending user write payloads | Until synchronized/cleared | May contain business data; never cached by the service worker and should be cleared on logout. |
| `tt_notif_*` | local | Notification read/permission UI state | Persistent | Low sensitivity; browser permission is not requested automatically. |
| `tt_cf_*` | local | Custom field definitions | Persistent | Workspace configuration, not authorization. |
| `tt_session`, `tt_auth_ok` | local | Legacy keys only | Removed on validated replacement/logout/expiry | Never trusted for authorization and never populated by current code. |
| `tt_session_id_token` | session | Short-lived Google ID token sent to Apps Script | Current tab session / token expiry | Sensitive; scoped to session storage so refreshes restore without a chooser; removed on logout, expiry, or failed validation and never placed in local storage. |

## Security findings before V4 changes

- High: most Apps Script write/delete actions authenticate the user but do not enforce the per-user permission model server-side.
- Medium: user-controlled external URLs are placed into `href`, image sources, or `window.open` paths without one centralized protocol allowlist.
- Medium: many dynamic forms use toast-only validation without `aria-invalid`/`aria-describedby`.
- Medium: Apps Script error responses can expose raw exception messages to the frontend.
- Low: multiple `innerHTML` sites are necessary for templating; most data paths escape values, but they require regression review.
- Informational: GitHub Pages cannot configure arbitrary response headers such as HSTS, `X-Content-Type-Options`, or a response-header CSP from this repository. A CSP meta tag is not equivalent and is intentionally not added without a full Google/CDN compatibility rollout.

## Performance baseline before V4 changes

- Auth success immediately starts current-view navigation, broad cache prefetching, notification aggregation/polling, chat polling, AI initialization, particles, and global interaction effects in one task.
- `prefetchAll()` claims two calls but eagerly starts Dashboard, POs, comparisons, comparison vendors, invoices, and vendors (six requests).
- Dashboard and notification startup can request purchase requests through different cache paths.
- Particles animate continuously on phone-sized screens even though they are decorative.
- Existing cache/in-flight deduplication and chart destroy/recreate guards are good foundations and should be retained.

## V4 implementation result

- Authentication now restores a still-valid tab-scoped ID token before invoking GIS, shares one refresh promise across concurrent 401 responses, distinguishes 403 permission failures, and initializes GIS only once. Current GIS options use `use_fedcm_for_button` and `button_auto_select`; the deprecated prompt option is absent.
- `forms-v4.js` supplies the shared field/grid/error/dialog behavior for every inventoried form. Representative record forms also add required, range, URL, email, dependent-date, paid-amount, blocked-reason, and evaluation validation at their save boundaries.
- User-controlled avatar, attachment, website, logo, chat-image, and file URLs pass through an HTTP/HTTPS (or narrowly allowed raster data-image) protocol allowlist before being assigned to navigation or media sinks.
- Apps Script source now applies per-action authorization, owner-only administration/audit/setup access, read/write rate limits, record shape limits, upload type/size limits, chat message ownership, authenticated audit identity, and generic external error responses.
- The critical render path is shell → authentication → current view. Secondary prefetch, notifications, AI, polling, and desktop-only particles start during idle time. Prefetch dropped from six eager data groups to Dashboard plus POs; notifications share the PR and notification caches.
- The final production build processes 1,080.3 KB of source HTML/CSS/JS into 779.2 KB (28% smaller). Automated startup instrumentation observes one Dashboard request, one PR request, and no eager comparison, invoice, or vendor request.
- Static app-shell cache version is `tasktracker-shell-v8`; it contains only same-origin GET assets and never API POST responses or browser profile/session data.

## Security classification after V4

- Critical: none found by dependency audit or repository secret-pattern review.
- High: server-side broken access control is fixed in `backend/Code.gs` source. This protection becomes live only when the Apps Script web app is redeployed; GitHub Pages publishing does not deploy Apps Script.
- Medium: chat uploads remain shared by Google Drive as “anyone with the link” because that is the existing delivery model. Type and size limits reduce abuse, but a private authenticated download proxy would be stronger.
- Medium: user-supplied AI keys are necessarily readable by page JavaScript while used. They remain session-only, are removed from legacy local settings, and are cleared on logout.
- Low: the application still uses audited templating `innerHTML` sites. Dynamic values on reviewed URL/profile/chat/form paths are escaped or assigned through DOM APIs; continued review is required when new sinks are added.
- Informational: GitHub Pages cannot set repository-controlled response headers such as HSTS, `X-Content-Type-Options`, `Permissions-Policy`, or a response-header CSP. No untested meta CSP was added because GIS and the current CDN asset set require an explicit compatibility rollout.

## Verification limits

- Chrome/Edge-compatible Chromium is covered by Playwright using the installed Chrome channel. The in-app browser, iPhone Safari, physical Android, and iPhone Home Screen runtime were unavailable in this environment.
- Semgrep was not installed, so its scan was not claimed. ESLint, build/minification, Playwright, `npm audit`, `git diff --check`, and a targeted repository secret-pattern review were run.
