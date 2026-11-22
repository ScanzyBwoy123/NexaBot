
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizePhoneNumber,
  createAccountService
} = require('../src/accounts');

test('normalizes an international phone number', () => {
  assert.equal(
    normalizePhoneNumber('+233 24 123 4567'),
    '233241234567'
  );
});

test('accepts an international number without a plus sign', () => {
  assert.equal(
    normalizePhoneNumber('233241234567'),
    '233241234567'
  );
});

test('rejects a number that is too short', () => {
  assert.throws(
    () => normalizePhoneNumber('12345'),
    /Invalid international phone number/
  );
});

test('rejects a number that is too long', () => {
  assert.throws(
    () => normalizePhoneNumber('1234567890123456'),
    /Invalid international phone number/
  );
});

test('rejects numbers beginning with zero', () => {
  assert.throws(
    () => normalizePhoneNumber('0241234567'),
    /Invalid international phone number/
  );
});

test('rejects letters and invalid characters', () => {
  assert.throws(
    () => normalizePhoneNumber('23324ABC4567'),
    /Invalid international phone number/
  );
});

test('requires a Supabase client', () => {
  assert.throws(
    () => createAccountService(null),
    /Supabase client is required/
  );
});

test('registers a pending account successfully', async () => {
  let insertedAccount;

  const supabase = {
    schema(schemaName) {
      assert.equal(schemaName, 'nexabot');
      return this;
    },
    from(tableName) {
      assert.equal(tableName, 'accounts');
      return this;
    },
    insert(values) {
      insertedAccount = values;
      return this;
    },
    select() {
      return this;
    },
    single: async () => ({
      data: {
        id: 'account-test-id',
        phone_e164: '233241234567',
        account_status: 'pairing_pending',
        created_at: '2026-11-22T00:00:00.000Z'
      },
      error: null
    })
  };

  const service = createAccountService(supabase);
    const result = await service.registerPendingAccount(
    '+233 24 123 4567',
    '11111111-1111-4111-8111-111111111111'
  );
    assert.equal(
    insertedAccount.auth_user_id,
    '11111111-1111-4111-8111-111111111111'
  );
  assert.equal(insertedAccount.phone_e164, '233241234567');
  assert.equal(insertedAccount.account_status, 'pairing_pending');
  assert.equal(result.success, true);
  assert.equal(result.account.id, 'account-test-id');
  assert.equal(result.account.status, 'pairing_pending');
});

test('prevents duplicate account registration', async () => {
  const supabase = {
    schema() {
      return this;
    },
    from() {
      return this;
    },
    insert() {
      return this;
    },
    select() {
      return this;
    },
      const result = await service.registerPendingAccount(
    '233241234567',
    '11111111-1111-4111-8111-111111111111'
  );
      data: null,
      error: { code: '23505' }
    })
  };

  const service = createAccountService(supabase);
  const result = await service.registerPendingAccount('233241234567');

  assert.deepEqual(result, {
    success: false,
    error: 'ACCOUNT_ALREADY_EXISTS'
  });
});

test('hides database errors from callers', async () => {
  const supabase = {
    schema() {
      return this;
    },
    from() {
      return this;
    },
    insert() {
      return this;
    },
    select() {
      return this;
    },
        () => service.registerPendingAccount(
      '233241234567',
      '11111111-1111-4111-8111-111111111111'
    ),
      data: null,
      error: { code: 'DATABASE_ERROR', message: 'Private database details' }
    })
  };

  const service = createAccountService(supabase);

  await assert.rejects(
    () => service.registerPendingAccount('233241234567'),
    {
      message: 'Account registration failed.'
    }
  );
});
