const test = require('node:test');
const assert = require('node:assert/strict');
const { securityHeadersMiddleware } = require('./securityHeaders');

test('sets required security headers on response object', () => {
  const headers = {};
  const res = {
    setHeader(name, value) {
      headers[name] = value;
    }
  };
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  securityHeadersMiddleware({}, res, next);

  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'SAMEORIGIN');
  assert.equal(headers['X-XSS-Protection'], '1; mode=block');
  assert.equal(headers['Strict-Transport-Security'], 'max-age=31536000; includeSubDomains');
  assert.equal(nextCalled, true);
});
