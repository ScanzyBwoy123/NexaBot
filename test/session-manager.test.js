'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  createSessionManager
} = require('../src/session-manager');

const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_B = '22222222-2222-4222-8222-222222222222';

function createMockClient() {
  return {
    destroyed: false,

    async destroy() {
      this.destroyed = true;
    }
  };
}

function createMockStartWhatsApp() {
  const calls = [];

  async function startWhatsApp(options) {
    const client = createMockClient();

    calls.push({
      options,
      client
    });

    return client;
  }

  return { startWhatsApp, calls };
}

test('creates isolated sessions for different accounts', async () => {
  const mock = createMockStartWhatsApp();

  const manager = createSessionManager({
    startWhatsApp: mock.startWhatsApp,
    authRootDir: '.test-auth'
  });

  await manager.startSession({
    accountId: ACCOUNT_A,
    commandEngine: { handle: async () => {} }
  });

  await manager.startSession({
    accountId: ACCOUNT_B,
    commandEngine: { handle: async () => {} }
  });

  assert.equal(mock.calls.length, 2);

  assert.notEqual(
    mock.calls[0].options.authDir,
    mock.calls[1].options.authDir
  );

  assert.notEqual(
    mock.calls[0].options.clientId,
    mock.calls[1].options.clientId
  );

  assert.equal(manager.getSession(ACCOUNT_A).status, 'starting');
  assert.equal(manager.getSession(ACCOUNT_B).status, 'starting');
});

test('rejects duplicate sessions for the same account', async () => {
  const mock = createMockStartWhatsApp();

  const manager = createSessionManager({
    startWhatsApp: mock.startWhatsApp
  });

  await manager.startSession({
    accountId: ACCOUNT_A,
    commandEngine: { handle: async () => {} }
  });

  await assert.rejects(
    manager.startSession({
      accountId: ACCOUNT_A,
      commandEngine: { handle: async () => {} }
    }),
    { message: 'Session already exists.' }
  );

  assert.equal(mock.calls.length, 1);
});

test('rejects invalid account IDs', async () => {
  const mock = createMockStartWhatsApp();

  const manager = createSessionManager({
    startWhatsApp: mock.startWhatsApp
  });

  await assert.rejects(
    manager.startSession({
      accountId: '../other-account',
      commandEngine: { handle: async () => {} }
    }),
    { message: 'Invalid account ID.' }
  );

  assert.equal(mock.calls.length, 0);
});

test('returns null when an account has no session', () => {
  const mock = createMockStartWhatsApp();

  const manager = createSessionManager({
    startWhatsApp: mock.startWhatsApp
  });

  assert.equal(manager.getSession(ACCOUNT_A), null);
  assert.equal(manager.getClient(ACCOUNT_A), null);
});

test('returns the correct client for each account', async () => {
  const mock = createMockStartWhatsApp();

  const manager = createSessionManager({
    startWhatsApp: mock.startWhatsApp
  });

  await manager.startSession({
    accountId: ACCOUNT_A,
    commandEngine: { handle: async () => {} }
  });

  await manager.startSession({
    accountId: ACCOUNT_B,
    commandEngine: { handle: async () => {} }
  });

  assert.equal(
    manager.getClient(ACCOUNT_A),
    mock.calls[0].client
  );

  assert.equal(
    manager.getClient(ACCOUNT_B),
    mock.calls[1].client
  );
});

test('stops a session and destroys its client', async () => {
  const mock = createMockStartWhatsApp();

  const manager = createSessionManager({
    startWhatsApp: mock.startWhatsApp
  });

  await manager.startSession({
    accountId: ACCOUNT_A,
    commandEngine: { handle: async () => {} }
  });

  const result = await manager.stopSession(ACCOUNT_A);

  assert.equal(result, true);
  assert.equal(mock.calls[0].client.destroyed, true);
  assert.equal(manager.getSession(ACCOUNT_A), null);
});

test('does not stop another account when one session is stopped', async () => {
  const mock = createMockStartWhatsApp();

  const manager = createSessionManager({
    startWhatsApp: mock.startWhatsApp
  });

  await manager.startSession({
    accountId: ACCOUNT_A,
    commandEngine: { handle: async () => {} }
  });

  await manager.startSession({
    accountId: ACCOUNT_B,
    commandEngine: { handle: async () => {} }
  });

  await manager.stopSession(ACCOUNT_A);

  assert.equal(manager.getSession(ACCOUNT_A), null);
  assert.ok(manager.getSession(ACCOUNT_B));
  assert.equal(mock.calls[1].client.destroyed, false);
});

test('returns false when stopping a nonexistent session', async () => {
  const mock = createMockStartWhatsApp();

  const manager = createSessionManager({
    startWhatsApp: mock.startWhatsApp
  });

  assert.equal(
    await manager.stopSession(ACCOUNT_A),
    false
  );
});

test('removes a session when WhatsApp initialization fails', async () => {
  const manager = createSessionManager({
    startWhatsApp: async () => {
      throw new Error('Initialization failed');
    }
  });

  await assert.rejects(
    manager.startSession({
      accountId: ACCOUNT_A,
      commandEngine: { handle: async () => {} }
    }),
    { message: 'Initialization failed' }
  );

  assert.equal(manager.getSession(ACCOUNT_A), null);
});

test('updates session status when connection events occur', async () => {
  const mock = createMockStartWhatsApp();

  const manager = createSessionManager({
    startWhatsApp: mock.startWhatsApp
  });

  await manager.startSession({
    accountId: ACCOUNT_A,
    commandEngine: { handle: async () => {} }
  });

  const handlers = mock.calls[0].options;

  handlers.onQR('test-qr');
  assert.equal(manager.getSession(ACCOUNT_A).status, 'waiting_for_pairing');

  handlers.onAuthenticated();
  assert.equal(manager.getSession(ACCOUNT_A).status, 'authenticated');

  handlers.onReady();
  assert.equal(manager.getSession(ACCOUNT_A).status, 'connected');

  handlers.onDisconnected('test');
  assert.equal(manager.getSession(ACCOUNT_A).status, 'disconnected');
});

test('uses an account-specific authentication directory', async () => {
  const mock = createMockStartWhatsApp();

  const manager = createSessionManager({
    startWhatsApp: mock.startWhatsApp,
    authRootDir: '.test-auth'
  });

  await manager.startSession({
    accountId: ACCOUNT_A,
    commandEngine: { handle: async () => {} }
  });

  assert.equal(
    mock.calls[0].options.authDir,
    path.join(path.resolve('.test-auth'), ACCOUNT_A)
  );
});
