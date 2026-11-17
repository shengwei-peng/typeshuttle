import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES, UI_LANGUAGES, resolveLocale, createTranslator, htmlLangFor, localizedError, errorText } from '../../src/core/i18n.js';

const placeholders = (message) => [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test('every locale has the same messages with the same placeholders', () => {
  const [base, ...others] = Object.keys(LOCALES);
  const baseKeys = Object.keys(LOCALES[base]).sort();
  for (const locale of others) {
    assert.deepEqual(Object.keys(LOCALES[locale]).sort(), baseKeys, `${locale} keys differ from ${base}`);
    for (const key of baseKeys) {
      assert.deepEqual(placeholders(LOCALES[locale][key].message), placeholders(LOCALES[base][key].message), `${locale}.${key}`);
    }
  }
});

test('every Traditional Chinese message is translated and no English message contains Chinese', () => {
  const cjk = /[\u3400-\u9fff\uff00-\uffef\u3000-\u303f]/;
  const productNameKeys = ['extName', 'actionTitle'];
  for (const [key, { message }] of Object.entries(LOCALES.zh_TW)) {
    if (productNameKeys.includes(key)) assert.equal(message, LOCALES.en[key].message, key);
    else assert.match(message, cjk, `zh_TW.${key} is not translated`);
  }
  for (const [key, { message }] of Object.entries(LOCALES.en)) assert.doesNotMatch(message, cjk, `en.${key}`);
});

test('messages are valid for Chrome _locales: safe names, a message string, and no $ placeholders', () => {
  for (const [locale, table] of Object.entries(LOCALES)) {
    for (const [key, entry] of Object.entries(table)) {
      assert.match(key, /^[A-Za-z0-9_]+$/, `${locale}.${key}`);
      assert.equal(typeof entry.message, 'string', `${locale}.${key}`);
      assert.ok(entry.message.length > 0, `${locale}.${key}`);
      assert.ok(!entry.message.includes('$'), `${locale}.${key} must not contain $`);
    }
  }
});

test('resolveLocale honours an explicit choice and otherwise follows the browser language', () => {
  assert.equal(resolveLocale('en', 'zh-TW'), 'en');
  assert.equal(resolveLocale('zh_TW', 'en-US'), 'zh_TW');
  assert.equal(resolveLocale('auto', 'zh-TW'), 'zh_TW');
  assert.equal(resolveLocale('auto', 'zh-CN'), 'zh_TW');
  assert.equal(resolveLocale('auto', 'zh'), 'zh_TW');
  assert.equal(resolveLocale('auto', 'en-GB'), 'en');
  assert.equal(resolveLocale('auto', 'ja'), 'en');
  assert.equal(resolveLocale('auto', undefined), 'en');
  assert.equal(resolveLocale('xx', 'zh-TW'), 'zh_TW');
  assert.deepEqual(UI_LANGUAGES, ['auto', 'en', 'zh_TW']);
});

test('createTranslator fills placeholders and picks the singular form for a count of 1', () => {
  const t = createTranslator('en');
  assert.equal(t('lineCount', { count: 3 }), '3 lines');
  assert.equal(t('lineCount', { count: 1 }), '1 line');
  assert.equal(t('stoppedTitle', { line: '12' }), 'Stopped at line 12');
  assert.equal(createTranslator('zh_TW')('lineCount', { count: 1 }), '1 行');
});

test('createTranslator leaves unknown placeholders, falls back to English, and rejects unknown keys', () => {
  const t = createTranslator('zh_TW');
  assert.equal(t('stoppedTitle'), '已中止：停在第 {line} 行');
  assert.equal(createTranslator('fr')('doneTitle'), 'Sent');
  assert.throws(() => t('noSuchMessage'), /Missing message: noSuchMessage/);
});

test('htmlLangFor maps locales to HTML lang values', () => {
  assert.equal(htmlLangFor('zh_TW'), 'zh-Hant');
  assert.equal(htmlLangFor('en'), 'en');
  assert.equal(htmlLangFor('fr'), 'en');
});

test('localizedError keeps an English message and carries a message key for the interface', () => {
  const error = localizedError('errorUnsafeDir', { dir: '../x' }, 'Unsafe directory: ../x');
  assert.equal(error.message, 'Unsafe directory: ../x');
  assert.equal(errorText(error, createTranslator('zh_TW')), '遠端存檔目錄「../x」不允許使用，只能用英數字與 . _ - /，且資料夾名稱不能以 - 開頭。');
  assert.equal(errorText(new Error('plain'), createTranslator('en')), 'plain');
  assert.equal(errorText('text', createTranslator('en')), 'text');
});
