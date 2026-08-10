# Task Tracker AI gateway

The GitHub Pages app never receives provider credentials. It sends the existing Task Tracker ID token to this Worker, which validates the session through the Apps Script backend before invoking a provider adapter.

Cloudflare Workers AI is the default and needs no provider API key:

```powershell
npm run gateway:check
npm run gateway:deploy
```

Optional external adapters are selected with `AI_PROVIDER` and use Worker secrets such as `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`, `TOGETHER_API_KEY`, or `OPENAI_API_KEY`. OpenAI is optional. Custom OpenAI-compatible endpoints additionally require `OPENAI_COMPATIBLE_BASE_URL` and an explicit `OPENAI_COMPATIBLE_ALLOWED_HOSTS` allowlist; the client can never choose an arbitrary upstream URL.

The Apps Script source must include the V5 `verifySession` action before the deployed Worker can authenticate production users.

After deployment, inject the public Worker URL into the static build (it is not a secret):

```powershell
$env:TASK_TRACKER_AI_GATEWAY_URL='https://task-tracker-ai-gateway.<account-subdomain>.workers.dev'
npm run build
```
