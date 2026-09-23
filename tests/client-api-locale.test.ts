import test from 'node:test';
import assert from 'node:assert/strict';
import { api, ApiError, setApiLocale } from '../src/client/api.js';

test('client sends chosen locale and keeps server error metadata', async () => {
  const original = globalThis.fetch;
  try {
    setApiLocale('kk');
    globalThis.fetch = async (_url, init) => {
      assert.equal((init?.headers as Record<string,string>)['Accept-Language'], 'kk');
      return new Response(JSON.stringify({code:'FORBIDDEN',user_message:'Рұқсат жоқ.',message_key:'access_denied',params:{},request_id:'test-request'}), {status:403});
    };
    await assert.rejects(api('/api/test'), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.message, 'Рұқсат жоқ.');
      assert.equal(error.code, 'FORBIDDEN');
      assert.equal(error.requestId, 'test-request');
      return true;
    });
  } finally { globalThis.fetch = original; setApiLocale('ru'); }
});

test('network and non-JSON errors use the language captured when request starts', async () => {
  const original = globalThis.fetch;
  try {
    setApiLocale('en');
    globalThis.fetch = async () => { setApiLocale('kk'); throw new TypeError('fetch failed'); };
    await assert.rejects(api('/api/test'), /Unable to connect/);
    globalThis.fetch = async () => new Response('<html>Bad Gateway</html>',{status:502});
    await assert.rejects(api('/api/test'), /Сұрау орындалмады/);
  } finally { globalThis.fetch = original; setApiLocale('ru'); }
});
