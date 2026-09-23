import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLocale, LOCALES } from '../src/shared/locale.js';
import { importMessages, localizeImportResult } from '../src/shared/import-i18n.js';
import { loadSourceDataset, validateImport } from '../src/domain/index.js';

test('Accept-Language negotiates supported regional tags, quality and safe default', () => {
  assert.equal(normalizeLocale('kk-KZ,ru;q=0.8'), 'kk');
  assert.equal(normalizeLocale('de-DE,en-GB;q=0.9,ru;q=0.5'), 'en');
  assert.equal(normalizeLocale('ru;q=0,kk;q=0.6'), 'kk');
  assert.equal(normalizeLocale('en;q=garbage,kk;q=0.8'), 'kk');
  assert.equal(normalizeLocale('en;q=2,ru;q=0.4'), 'ru');
  assert.equal(normalizeLocale('xx'), 'ru');
  assert.equal(normalizeLocale(), 'ru');
});

test('import translations preserve placeholders in every supported language', () => {
  for (const [code, translations] of Object.entries(importMessages)) {
    const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
    for (const locale of LOCALES) {
      assert.ok(translations[locale].trim(), `${code}:${locale}`);
      assert.deepEqual(placeholders(translations[locale]), placeholders(translations.en), `${code}:${locale}`);
    }
  }
});

test('import reports stable row codes and translates presentation without changing accepted data', () => {
  const source = loadSourceDataset();
  const invalid = validateImport(source, {employees: [{...source.employees[0], employee_id:'NEW_LANG', grade:'Unknown'}]});
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some(e => e.code === 'grade' && e.row === 1 && e.field === 'grade'));
  const before = structuredClone(invalid);
  for (const locale of LOCALES) {
    const result = localizeImportResult(invalid, locale);
    assert.equal(result.errors.find(e => e.code === 'grade')?.message, importMessages.grade[locale]);
    assert.deepEqual(result.employees, invalid.employees);
    assert.deepEqual(result.counts, invalid.counts);
  }
  assert.deepEqual(invalid, before);
  const existing = validateImport(source, {employees:[source.employees[0]]});
  assert.equal(existing.valid, true);
  assert.equal(existing.warning_details[0].code, 'employee_exists');
  assert.ok(localizeImportResult(existing,'kk').warnings[0].includes('бұрыннан бар'));
  assert.equal(existing.counts.employees,0);
});
