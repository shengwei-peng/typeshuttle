import { test } from 'node:test';
import assert from 'node:assert/strict';
import { originPatternFromUrl, scriptIdForPattern, isSitePattern } from '../../src/core/sites.js';

test('originPatternFromUrl builds a host match pattern for http and https pages', () => {
  assert.equal(originPatternFromUrl('https://remote.example.com/Citrix/StoreWeb/clients/HTML5Client/src/SessionWindow.html?launchid=1'), 'https://remote.example.com/*');
  assert.equal(originPatternFromUrl('http://127.0.0.1:8123/fake-citrix.html'), 'http://127.0.0.1/*');
});

test('originPatternFromUrl rejects browser pages, files and invalid URLs', () => {
  for (const url of ['chrome://extensions', 'file:///tmp/a.html', 'about:blank', 'not a url', undefined]) {
    assert.equal(originPatternFromUrl(url), null, String(url));
  }
});

test('scriptIdForPattern is stable, distinct per pattern and uses the TypeShuttle prefix', () => {
  const a = scriptIdForPattern('https://a.example.com/*');
  assert.equal(a, scriptIdForPattern('https://a.example.com/*'));
  assert.notEqual(a, scriptIdForPattern('https://b.example.com/*'));
  assert.match(a, /^typeshuttle-site-[0-9a-f]{8}$/);
});

test('isSitePattern accepts only single-host http(s) patterns', () => {
  assert.equal(isSitePattern('https://a.example.com/*'), true);
  assert.equal(isSitePattern('https://*/*'), false);
  assert.equal(isSitePattern('<all_urls>'), false);
  assert.equal(isSitePattern('https://a.example.com/path/*'), false);
});
