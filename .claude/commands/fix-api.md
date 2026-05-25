# API Debugging Checklist

Use this when the frontend fails to reach the backend or returns unexpected errors.

## Architecture quick-reference

- **Backend**: Google Apps Script (GAS) web app, deployed as "Execute as: Me", "Who has access: Anyone"
- **Endpoint**: defined in `frontend/config.js` → `const API_URL = '...'` — **never** change this from the frontend
- **Auth**: Google Identity Services JWT passed as `token` in every request body
- **Content-Type**: must be `text/plain` — `application/json` triggers a CORS preflight that GAS rejects
- **Method**: always POST — GAS `doGet` is not used

## Step 1 — Is the token valid?

Open browser DevTools → Application → Local Storage → `tt_session`.

- `token`: a base64url JWT — paste into jwt.io to inspect
- `exp`: Unix timestamp — compare with `Math.floor(Date.now()/1000)`
- If expired or missing → sign out and sign back in

## Step 2 — Is API_URL correct?

```javascript
// In browser console:
console.log(API_URL);
```

Must be a `https://script.google.com/macros/s/.../exec` URL.  
If it says `undefined`: `config.js` is not loaded or has a syntax error.  
**Never** set `API_URL` from localStorage or user input — fix it in `config.js` only.

## Step 3 — Check the raw response

```javascript
// In browser console (after signing in):
fetch(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({ token: idToken, action: 'getDashboard' })
}).then(r => r.json()).then(console.log).catch(console.error);
```

### Common error responses

| `data.error` | Cause | Fix |
|---|---|---|
| `Unauthorized` | JWT rejected by GAS | Re-sign in; check CLIENT_ID in config.js matches GAS project |
| `Not authenticated` | No token in request body | Check `idToken` is set before call |
| `Sheet not found` | Sheet name mismatch | Verify sheet tab names in the Google Spreadsheet |
| `Row not found` | ID mismatch on update/delete | Redeploy GAS — UUID fix may not be live |
| `TypeError: ...` | GAS crash | Check Apps Script execution logs |

## Step 4 — Check Apps Script logs

1. Open [script.google.com](https://script.google.com) → select the project
2. Run menu → **Executions** — find the failed call
3. Click the execution to see the stack trace

## Step 5 — CORS errors

If DevTools shows a CORS error:
- Confirm `Content-Type: text/plain` (not `application/json`)
- Confirm the GAS deployment is set to **"Anyone"** access, not "Anyone with Google account"
- Confirm you are posting to the `/exec` URL, not the `/dev` URL (dev requires auth headers)

## Step 6 — After changing Code.gs

Every change to `backend/Code.gs` **requires a new deployment**:

1. Apps Script editor → Deploy → **New deployment** (do NOT use "Manage deployments" → edit existing)
2. Type: Web app
3. Execute as: Me
4. Who has access: Anyone
5. Copy the new `/exec` URL → update `API_URL` in `frontend/config.js`

## Golden rules

- `API_URL` lives only in `config.js` — never in localStorage, never in a prompt
- `idToken` is the GIS JWT — it expires after 1 hour; silent refresh runs every 45 min
- On `Unauthorized` error the app auto-redirects to login — this is intentional
- Retry logic in `callAPI()` retries once on network failure, but not on auth errors
