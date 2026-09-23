import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dictionaries, translate, formatDateFor, formatNumberFor, pluralFor } from '../src/client/i18n.js';
import { LOCALES } from '../src/shared/locale.js';

test('all UI locales have identical keys and interpolation parameters', () => {
  const keys = Object.keys(dictionaries.ru).sort();
  const parameters = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const locale of LOCALES) {
    assert.deepEqual(Object.keys(dictionaries[locale]).sort(), keys);
    for (const key of keys) {
      const value = dictionaries[locale][key as keyof typeof dictionaries.ru];
      assert.ok(value.trim(), `${locale}:${key}`);
      assert.deepEqual(parameters(value), parameters(dictionaries.ru[key as keyof typeof dictionaries.ru]), `${locale}:${key}`);
    }
  }
});

test('literal UI translation calls resolve instead of displaying technical keys', () => {
  const files = ['src/client/main.tsx','src/client/ui.tsx', ...readdirSync('src/client/screens').filter(f => f.endsWith('.tsx')).map(f => `src/client/screens/${f}`)];
  for (const file of files) {
    const source = readFileSync(file,'utf8');
    for (const match of source.matchAll(/\bt\(["']([^"']+)["']/g)) {
      assert.ok(match[1] in dictionaries.ru, `${file}: missing ${match[1]}`);
    }
  }
});

test('calendar dates, unknown numbers and plural forms are localized predictably', () => {
  for (const locale of LOCALES) {
    assert.equal(formatNumberFor(locale, null),'—');
    assert.equal(formatNumberFor(locale, Number.NaN),'—');
    assert.equal(formatDateFor(locale,'invalid'),'—');
    const old = process.env.TZ;
    try {
      process.env.TZ='Pacific/Honolulu'; const west = formatDateFor(locale,'2026-10-01');
      process.env.TZ='Pacific/Kiritimati'; assert.equal(formatDateFor(locale,'2026-10-01'), west);
    } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ=old; }
    assert.equal(translate(locale,'common.close').includes('{'),false);
  }
  assert.equal(pluralFor('ru',2,{one:'{count} запись',few:'{count} записи',many:'{count} записей',other:'{count} записи'}),'2 записи');
  assert.equal(pluralFor('en',1,{one:'{count} record',other:'{count} records'}),'1 record');
  assert.equal(pluralFor('kk',5,{one:'{count} жазба',other:'{count} жазба'}),'5 жазба');
});
