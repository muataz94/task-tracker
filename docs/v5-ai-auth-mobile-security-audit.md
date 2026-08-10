# V5 AI, authentication, mobile, and security audit

## Outcome

V5 removes every provider credential and provider-specific request from the GitHub Pages client. Cloudflare Workers AI is the gateway's default provider through the native `AI` binding. OpenAI and other OpenAI-compatible services are optional server-side adapters; no `OPENAI_API_KEY` is needed to install, lint, build, test, dry-run, publish Pages, or run the Cloudflare adapter.

## Root causes addressed

- Authentication: the V4 single auth-state owner and tab-scoped ID-token restoration remain intact. The app restores a valid token before invoking the supported Google returning-user flow, initializes GIS once, shares one refresh promise, retries 401 once, and treats 403 as authorization failure. Explicit logout is the only normal path that disables auto-select.
- AI routing: the old client selected from four providers, inferred providers from key prefixes, sent keys from the browser, and displayed raw upstream errors. The V5 client detects only gateway-validated provider metadata and sends the Task Tracker session token to one fixed gateway origin.
- Mobile assistant: legacy inline desktop geometry and duplicate AI search/composer controls made the launcher and sheet inconsistent. V5 has a safe-area-aware launcher, one composer, an intentional sheet-above-navigation layout, and gateway-managed settings.
- Icons: task/PO/PR/vendor cards still used text glyphs. A reusable `currentColor` SVG registry now supplies dynamic icons; all five primary tabs and required AI/mobile controls render SVGs.

## AI trust boundary

```text
GitHub Pages client
  -> fixed HTTPS gateway URL
  -> allowed-origin check
  -> Task Tracker session validation through Apps Script
  -> per-user Cloudflare rate limiter
  -> request/model/token/size validation
  -> configured provider adapter
```

The gateway does not accept a provider, API key, account ID, or upstream URL from the browser. The custom OpenAI-compatible adapter requires a deploy-time HTTPS base URL plus an explicit hostname allowlist. Fallback is off by default, must be configured server-side, never runs for authentication failures, and is disclosed in the response.

AI output is inserted with `textContent`; it is never trusted as HTML. Mutation requests are prompt-constrained to proposals and the gateway has no record-mutation API. The normal application permission and form layer remains the only mutation path.

## Security findings

- Critical: none found.
- High: fixed. Browser-held AI keys and direct provider calls were removed.
- Medium: fixed. Raw provider messages, arbitrary model selection, unbounded input, missing gateway origin validation, and undisclosed fallback were replaced with stable public errors and gateway controls.
- Low: GitHub Pages cannot set custom HTTP response headers. Existing meta/PWA controls remain, but CSP/HSTS/frame policy should be applied at a custom-domain edge if the hosting architecture changes.
- Informational: the repository still contains established escaped-template `innerHTML` renderers outside the V5 AI boundary. V4 reviewed those sinks; the new assistant does not add an untrusted HTML renderer.

`npm audit` reported zero vulnerabilities. Semgrep was not installed in the environment, so its scan is recorded as not run; targeted secret, credential-reference, and XSS-sink searches were reviewed instead.

## Performance

- AI configuration and network detection are lazy: no gateway request occurs until the assistant opens.
- The four browser provider SDK paths and legacy AI result-card CSS were removed.
- The service-worker shell moved to `tasktracker-shell-v9` and includes the versioned V5 icon/AI assets.
- Provider credentials are not migrated into another browser store; legacy AI keys are deleted on authenticated startup.

## Deployment requirements

1. Deploy the Apps Script source containing `verifySession`.
2. Authenticate Wrangler and run `npm run gateway:deploy`.
3. Build Pages with `TASK_TRACKER_AI_GATEWAY_URL=https://<worker-host>` and publish the verified `dist` directory.

Cloudflare Workers AI itself needs no API key secret. Optional external provider secrets are set only with Wrangler/Dashboard secrets. The checked-in Wrangler configuration contains public bindings, model allowlists, allowed origins, and the public Apps Script URL only.

## Manual test limitations

- Real iPhone Safari/Add to Home Screen returning-account behavior: not tested on physical hardware.
- Cloudflare production inference: requires an authenticated Cloudflare deployment and was tested locally with mocked bindings.
- Embedded Codex browser: unavailable in this session; visual checks ran in local Chrome through Playwright.
