import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, normalizeProviderError, validateChatRequest } from '../../worker/ai-gateway/src/index.js';

const ORIGIN = 'https://muataz94.github.io';
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

function authenticatedEnv(overrides = {}) {
  return {
    TASK_TRACKER_API_URL: 'https://example.test/exec',
    ALLOWED_ORIGINS: ORIGIN,
    AI_PROVIDER: 'cloudflare-workers-ai',
    AI_MODEL: MODEL,
    AI_ALLOWED_MODELS: MODEL,
    AI: { run: async () => ({ response: 'Safe assistant response' }) },
    AI_RATE_LIMITER: { limit: async () => ({ success: true }) },
    __TEST_FETCH: async () => Response.json({ authenticated: true, email: 'user@example.test' }),
    ...overrides,
  };
}

function request(path, body = {}, token = 'valid-token', origin = ORIGIN) {
  return new Request(`https://gateway.example${path}`, {
    method: 'POST',
    headers: { origin, authorization: token ? `Bearer ${token}` : '', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('Cloudflare Workers AI is detected and exposed without a browser credential', async () => {
  const response = await handleRequest(request('/v1/config'), authenticatedEnv());
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.provider.id, 'cloudflare-workers-ai');
  assert.equal(result.provider.model, MODEL);
  assert.equal(result.credentialState, 'managed');
  assert.equal(JSON.stringify(result).includes('key'), false);
});

test('authenticated chat uses the Cloudflare binding and reports provider provenance', async () => {
  let invocation;
  const env = authenticatedEnv({ AI: { run: async (model, input) => { invocation = { model, input }; return { response: 'Summary' }; } } });
  const response = await handleRequest(request('/v1/chat', { messages: [{ role: 'user', content: 'Summarize overdue tasks' }], model: MODEL }), env);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.message.content, 'Summary');
  assert.equal(result.provider.id, 'cloudflare-workers-ai');
  assert.equal(invocation.model, MODEL);
  assert.equal(invocation.input.messages[0].role, 'system');
});

test('an unauthenticated Task Tracker user cannot access AI', async () => {
  const env = authenticatedEnv({ __TEST_FETCH: async () => Response.json({ error: 'Unauthorized' }) });
  const response = await handleRequest(request('/v1/chat', { messages: [{ role: 'user', content: 'hello' }] }), env);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'SESSION_REQUIRED');
});

test('origin and per-user rate limits are enforced', async () => {
  const denied = await handleRequest(request('/v1/config', {}, 'token', 'https://evil.example'), authenticatedEnv());
  assert.equal(denied.status, 403);
  const limited = await handleRequest(request('/v1/chat', { messages: [{ role: 'user', content: 'hello' }] }), authenticatedEnv({ AI_RATE_LIMITER: { limit: async () => ({ success: false }) } }));
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, 'AI_RATE_LIMITED');
});

test('invalid models, malformed input, and oversized messages are rejected', async () => {
  const invalidModel = await handleRequest(request('/v1/chat', { messages: [{ role: 'user', content: 'hello' }], model: 'unapproved-model' }), authenticatedEnv());
  assert.equal(invalidModel.status, 400);
  assert.equal((await invalidModel.json()).error.code, 'AI_MODEL_NOT_FOUND');
  assert.throws(() => validateChatRequest({ messages: [{ role: 'system', content: 'not allowed' }] }));
  assert.throws(() => validateChatRequest({ messages: [{ role: 'user', content: 'x'.repeat(6001) }] }));
});

test('raw upstream authentication and malformed-response errors are normalized', async () => {
  const authFailure = await handleRequest(request('/v1/chat', { messages: [{ role: 'user', content: 'hello' }], model: MODEL }), authenticatedEnv({ AI: { run: async () => { throw Object.assign(new Error('missing Authorization header: secret'), { status: 401 }); } } }));
  assert.equal(authFailure.status, 502);
  const authBody = await authFailure.json();
  assert.equal(authBody.error.code, 'AI_AUTH_FAILED');
  assert.equal(JSON.stringify(authBody).includes('Authorization'), false);

  const malformed = await handleRequest(request('/v1/chat', { messages: [{ role: 'user', content: 'hello' }], model: MODEL }), authenticatedEnv({ AI: { run: async () => ({ unexpected: true }) } }));
  assert.equal((await malformed.json()).error.code, 'AI_PROVIDER_ERROR');
});

test('optional OpenAI-compatible providers remain server-side and host-fixed', async () => {
  let upstreamUrl = '';
  const env = authenticatedEnv({
    AI: undefined,
    AI_PROVIDER: 'openrouter',
    AI_MODEL: 'approved/model',
    AI_ALLOWED_MODELS: 'approved/model',
    OPENROUTER_API_KEY: 'server-secret',
    __TEST_PROVIDER_FETCH: async (url, options) => {
      upstreamUrl = url;
      assert.equal(options.headers.authorization, 'Bearer server-secret');
      return Response.json({ choices: [{ message: { content: 'External result' } }] });
    },
  });
  const response = await handleRequest(request('/v1/chat', { messages: [{ role: 'user', content: 'hello' }], model: 'approved/model' }), env);
  assert.equal(response.status, 200);
  assert.equal(upstreamUrl, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal((await response.json()).provider.id, 'openrouter');
});

test('fallback runs only for retryable failures and is disclosed', async () => {
  const env = authenticatedEnv({
    AI_FALLBACK_PROVIDER: 'groq',
    GROQ_API_KEY: 'server-secret',
    AI: { run: async () => { throw Object.assign(new Error('busy'), { status: 503 }); } },
    __TEST_PROVIDER_FETCH: async () => Response.json({ choices: [{ message: { content: 'Fallback result' } }] }),
  });
  const response = await handleRequest(request('/v1/chat', { messages: [{ role: 'user', content: 'hello' }], model: MODEL }), env);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.provider.id, 'groq');
  assert.equal(result.fallback.from.id, 'cloudflare-workers-ai');
  assert.equal(result.fallback.to.id, 'groq');
});

test('timeout and provider errors have stable public codes', () => {
  assert.equal(normalizeProviderError({ name: 'TimeoutError' }).error.code, 'AI_TIMEOUT');
  assert.equal(normalizeProviderError({ status: 429 }).error.code, 'AI_PROVIDER_BUSY');
  assert.equal(normalizeProviderError({ status: 404 }).error.code, 'AI_MODEL_NOT_FOUND');
});
