'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSupabaseAuth } = require('../src/supabase-auth');

test('Supabase auth requires a client with getUser', () => {
  assert.throws(
    () => createSupabaseAuth(),
    /Supabase Auth client is required/
  );

  assert.throws(
    () => createSupabaseAuth({ auth: {} }),
    /Supabase Auth client is required/
  );
});

test('missing access token is rejected without calling Supabase Auth', async () => {
  let calls = 0;

  const auth = createSupabaseAuth({
    auth: {
      async getUser() {
        calls += 1;
        return { data: { user: null }, error: null };
      }
    }
  });

  assert.equal(await auth.verifyAccessToken(''), null);
  assert.equal(await auth.verifyAccessToken(null), null);
  assert.equal(calls, 0);
});

test('invalid access token is rejected', async () => {
  const auth = createSupabaseAuth({
    auth: {
      async getUser() {
        return {
          data: { user: null },
          error: new Error('Invalid token')
        };
      }
    }
  });

  assert.equal(
    await auth.verifyAccessToken('invalid-token'),
    null
  );
});

test('valid access token returns the verified Supabase user', async () => {
  const expectedUser = {
    id: 'user-123',
    email: 'student@example.com'
  };

  let receivedToken;

  const auth = createSupabaseAuth({
    auth: {
      async getUser(token) {
        receivedToken = token;

        return {
          data: { user: expectedUser },
          error: null
        };
      }
    }
  });

  const user = await auth.verifyAccessToken('valid-access-token');

  assert.equal(receivedToken, 'valid-access-token');
  assert.equal(user, expectedUser);
});
