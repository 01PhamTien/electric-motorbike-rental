import assert = require('node:assert/strict');
import test = require('node:test');
import { ApiSecurityMiddleware } from '../src/common/security/api-security.middleware';

function request(path: string, email = 'person@example.com') {
  return {
    method: 'POST',
    path,
    ip: '203.0.113.10',
    secure: false,
    socket: { remoteAddress: '203.0.113.10' },
    body: { email },
  } as any;
}

function response() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body: unknown;
  return {
    headers,
    get statusCode() { return statusCode; },
    get body() { return body; },
    setHeader(name: string, value: string) { headers[name] = value; },
    status(value: number) { statusCode = value; return this; },
    json(value: unknown) { body = value; return this; },
  } as any;
}

test('auth requests receive security headers', () => {
  const middleware = new ApiSecurityMiddleware();
  const res = response();
  let continued = false;
  middleware.use(request('/api/auth/login'), res, () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res.headers['X-Frame-Options'], 'SAMEORIGIN');
  assert.equal(res.headers['Referrer-Policy'], 'no-referrer');
});

test('login is throttled by email after repeated attempts', () => {
  const middleware = new ApiSecurityMiddleware();
  for (let i = 0; i < 8; i++) {
    let continued = false;
    middleware.use(request('/api/auth/login'), response(), () => { continued = true; });
    assert.equal(continued, true);
  }
  const res = response();
  let continued = false;
  middleware.use(request('/api/auth/login'), res, () => { continued = true; });
  assert.equal(continued, false);
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers['Retry-After'] !== undefined, true);
});

test('registration has an independent per-email limit', () => {
  const middleware = new ApiSecurityMiddleware();
  for (let i = 0; i < 3; i++) {
    let continued = false;
    middleware.use(request('/api/auth/register'), response(), () => { continued = true; });
    assert.equal(continued, true);
  }
  const res = response();
  let continued = false;
  middleware.use(request('/api/auth/register'), res, () => { continued = true; });
  assert.equal(continued, false);
  assert.equal(res.statusCode, 429);
});

test('non-auth endpoints are not throttled by the auth limiter', () => {
  const middleware = new ApiSecurityMiddleware();
  for (let i = 0; i < 30; i++) {
    let continued = false;
    middleware.use(request('/api/bookings'), response(), () => { continued = true; });
    assert.equal(continued, true);
  }
});
