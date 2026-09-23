import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeLocale } from '../src/shared/locale.js';

test('Accept-Language handles priorities, regional variants, and old clients', () => {
  assert.equal(normalizeLocale(), 'ru');
  assert.equal(normalizeLocale('fr-FR, kk-KZ;q=0.9, en-US;q=0.8'), 'kk');
  assert.equal(normalizeLocale('en-GB;q=0.4, ru-RU;q=0.9'), 'ru');
  assert.equal(normalizeLocale('de-DE'), 'ru');
});

test('recommendation, external search and error envelopes follow the request locale', async () => {
  const temp = mkdtempSync(join(tmpdir(), 'cq-locale-'));
  process.env.DATABASE_PATH = join(temp, 'test.sqlite');
  process.env.AI_MODE = 'offline';
  delete process.env.OPENAI_API_KEY;
  const { app, errorHandler } = await import('../src/server/app.js');
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  let cookie = '';
  const call = async (path: string, method = 'GET', body?: unknown, language?: string) => {
    const response = await fetch(base + path, {
      method,
      headers: { ...(cookie ? { cookie } : {}), ...(language ? { 'Accept-Language': language } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    cookie = response.headers.get('set-cookie')?.split(';')[0] || cookie;
    return { status: response.status, data: await response.json() as any };
  };
  try {
    const session = await call('/api/session');
    const employeeId = session.data.identity.employee_id;
    for (const [header, locale, warning] of [
      [undefined, 'ru', /расчётный/],
      ['kk-KZ', 'kk', /есептеу/],
      ['en-US', 'en', /rules-based/],
      ['xx-XX', 'ru', /расчётный/],
    ] as const) {
      const result = await call(`/api/employees/${employeeId}/recommendations`, 'POST', {}, header);
      assert.equal(result.status, 200);
      assert.equal(result.data.locale, locale);
      assert.match(result.data.warnings.join(' '), warning);
      assert.ok(result.data.recommendations[0]?.facts?.length === 4);
    }
    const search = await call('/api/external/search', 'POST', { skill_id: 'not-found', desired_level: 2, language: 'ru' }, 'en-GB');
    assert.equal(search.status, 400);
    assert.equal(search.data.message_key, 'error.skill_not_found');
    assert.match(search.data.user_message, /Skill not found/);
    const missing = await call('/api/no-such-route', 'GET', undefined, 'kk-KZ');
    assert.equal(missing.status, 404);
    assert.equal(missing.data.message_key, 'error.not_found');
    assert.match(missing.data.user_message, /табылмады/);
    assert.ok(missing.data.request_id);
    const switched = await call('/api/session/switch', 'POST', { identity_id: 'hr' }, 'kk-KZ');
    assert.equal(switched.status, 200);
    const preview = await call('/api/import/preview', 'POST', { employees: [{ employee_id: 'invalid/id' }], history: [] }, 'kk-KZ');
    assert.equal(preview.status, 200);
    assert.equal(preview.data.valid, false);
    assert.ok(preview.data.errors[0].code);
    assert.match(preview.data.errors[0].message_key, /^import\./);
    const previewRu = await call('/api/import/preview', 'POST', { employees: [{ employee_id: 'invalid/id' }], history: [] }, 'ru-RU');
    assert.equal(previewRu.status, 200);
    assert.notEqual(preview.data.errors[0].message, previewRu.data.errors[0].message);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    rmSync(temp, { recursive: true, force: true });
  }
});
