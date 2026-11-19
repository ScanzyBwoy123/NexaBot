'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createIdentityResolver } = require('../src/core/identityResolver');

test('creates resolver with a valid WhatsApp client', () => {
  const client = {
    getContactLidAndPhone: async () => []
  };

  assert.doesNotThrow(() => createIdentityResolver(client));
});

test('rejects an invalid WhatsApp client', () => {
  assert.throws(
    () => createIdentityResolver({}),
    /Invalid WhatsApp client/
  );
});

test('resolves a valid LID and phone mapping', async () => {
  const client = {
    getContactLidAndPhone: async () => [
      {
        lid: '123456789012345@lid',
        pn: '233241234567@c.us'
      }
    ]
  };

  const resolver = createIdentityResolver(client);
  const result = await resolver.resolve('123456789012345@lid');

  assert.deepEqual(result, {
    lid: '123456789012345@lid',
    pn: '233241234567@c.us'
  });
});

test('normalizes whitespace and letter case in returned identities', async () => {
  const client = {
    getContactLidAndPhone: async () => [
      {
        lid: '  123456789012345@LID  ',
        pn: '  233241234567@C.US  '
      }
    ]
  };

  const resolver = createIdentityResolver(client);
  const result = await resolver.resolve('123456789012345@lid');

  assert.deepEqual(result, {
    lid: '123456789012345@lid',
    pn: '233241234567@c.us'
  });
});

test('returns null when the mapping is missing', async () => {
  const client = {
    getContactLidAndPhone: async () => []
  };

  const resolver = createIdentityResolver(client);

  assert.equal(
    await resolver.resolve('123456789012345@lid'),
    null
  );
});

test('returns null when the mapping is incomplete', async () => {
  const client = {
    getContactLidAndPhone: async () => [
      {
        lid: '123456789012345@lid'
      }
    ]
  };

  const resolver = createIdentityResolver(client);

  assert.equal(
    await resolver.resolve('123456789012345@lid'),
    null
  );
});

test('returns null when WhatsApp identity lookup fails', async () => {
  const client = {
    getContactLidAndPhone: async () => {
      throw new Error('Lookup failed');
    }
  };

  const resolver = createIdentityResolver(client);

  assert.equal(
    await resolver.resolve('123456789012345@lid'),
    null
  );
});

test('rejects empty or invalid sender IDs safely', async () => {
  const client = {
    getContactLidAndPhone: async () => []
  };

  const resolver = createIdentityResolver(client);

  assert.equal(await resolver.resolve(''), null);
  assert.equal(await resolver.resolve('   '), null);
  assert.equal(await resolver.resolve(null), null);
});
