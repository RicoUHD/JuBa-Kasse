const test = require('node:test');
const assert = require('node:assert/strict');
const { isSafeSvg } = require('./svgValidation');

test('accepts normal svg content', () => {
  const svg = '<?xml version="1.0" encoding="utf-8"?><svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>';
  assert.equal(isSafeSvg(svg), true);
});

test('accepts attributes that include "on" in the middle of words', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><g data-configuration="default"></g></svg>';
  assert.equal(isSafeSvg(svg), true);
});

test('rejects script tags', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
  assert.equal(isSafeSvg(svg), false);
});

test('rejects inline event handlers', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>';
  assert.equal(isSafeSvg(svg), false);
});
