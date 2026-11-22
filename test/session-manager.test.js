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
  handlers.onCode('12345678');
assert.equal(manager.getSession(ACCOUNT_A).status, 'waiting_for_pairing');

handlers.onAuthFailure();
assert.equal(manager.getSession(ACCOUNT_A).status, 'auth_failed');
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

test('prevents simultaneous duplicate session startup for the same account', async () => {
  let finishStartup;
  const calls = [];

  const manager = createSessionManager({
    startWhatsApp: async (options) => {
      calls.push(options);

      return new Promise((resolve) => {
        finishStartup = () => resolve(createMockClient());
      });
    }
  });

  const firstStart = manager.startSession({
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

  assert.equal(calls.length, 1);

  finishStartup();
  await firstStart;

  assert.ok(manager.getSession(ACCOUNT_A));
});

test('waits for WhatsApp startup before stopping a session', async () => {
  let finishStartup;
  const client = createMockClient();

  const manager = createSessionManager({
    startWhatsApp: async () => {
      return new Promise((resolve) => {
        finishStartup = () => resolve(client);
      });
    }
  });

  const startPromise = manager.startSession({
    accountId: ACCOUNT_A,
    commandEngine: { handle: async () => {} }
  });

  const stopPromise = manager.stopSession(ACCOUNT_A);

  assert.equal(client.destroyed, false);

  finishStartup();

  await startPromise;
  const stopped = await stopPromise;

  assert.equal(stopped, true);
  assert.equal(client.destroyed, true);
  assert.equal(manager.getSession(ACCOUNT_A), null);
});
test('cleans up when WhatsApp startup fails during a stop request', async () => {
  let failStartup;

  const manager = createSessionManager({
    startWhatsApp: async () => {
      return new Promise((resolve, reject) => {
        failStartup = () => reject(new Error('Initialization failed'));
      });
    }
  });

  const startPromise = manager.startSession({
    accountId: ACCOUNT_A,
    commandEngine: { handle: async () => {} }
  });

  const stopPromise = manager.stopSession(ACCOUNT_A);

  failStartup();

  await assert.rejects(
    startPromise,
    { message: 'Initialization failed' }
  );

  assert.equal(await stopPromise, true);
  assert.equal(manager.getSession(ACCOUNT_A), null);
});
test('stopping one account does not affect another account still starting', async () => {
  let finishSecondStartup;
  const firstClient = createMockClient();
  const secondClient = createMockClient();
  let startupCount = 0;

  const manager = createSessionManager({
    startWhatsApp: async () => {
      startupCount++;

      if (startupCount === 1) {
        return firstClient;
      }

      return new Promise((resolve) => {
        finishSecondStartup = () => resolve(secondClient);
      });
    }
  });

  await manager.startSession({
    accountId: ACCOUNT_A,
    commandEngine: { handle: async () => {} }
  });

  const secondStart = manager.startSession({
    accountId: ACCOUNT_B,
    commandEngine: { handle: async () => {} }
  });

  await manager.stopSession(ACCOUNT_A);

  assert.equal(firstClient.destroyed, true);
  assert.equal(secondClient.destroyed, false);

  finishSecondStartup();
  await secondStart;

  assert.ok(manager.getSession(ACCOUNT_B));
  assert.equal(manager.getClient(ACCOUNT_B), secondClient);
  assert.equal(secondClient.destroyed, false);
});
test('removes a session when WhatsApp client shutdown fails', async () => {
  const client = {
    async destroy() {
      throw new Error('Shutdown failed');
    }
  };

  const manager = createSessionManager({
    startWhatsApp: async () => client
  });

  await manager.startSession({
    accountId: ACCOUNT_A,
    commandEngine: { handle: async () => {} }
  });

  await assert.rejects(
    manager.stopSession(ACCOUNT_A),
    { message: 'Shutdown failed' }
  );

  assert.equal(manager.getSession(ACCOUNT_A), null);
});
test('does not destroy a client twice when stopping the same session', async () => {
  let destroyCount = 0;

  const client = {
    async destroy() {
      destroyCount++;
    }
  };

  const manager = createSessionManager({
    startWhatsApp: async () => client
  });

  await manager.startSession({
    accountId: ACCOUNT_A,
    commandEngine: { handle: async () => {} }
  });

  assert.equal(await manager.stopSession(ACCOUNT_A), true);
  assert.equal(await manager.stopSession(ACCOUNT_A), false);

  assert.equal(destroyCount, 1);
  assert.equal(manager.getSession(ACCOUNT_A), null);
});
test('handles simultaneous shutdown requests without destroying the client twice', async () => {
  let destroyCount = 0;

  const client = {
    async destroy() {
      destroyCount++;
      await new Promise((resolve) => setImmediate(resolve));
    }
  };

  const manager = createSessionManager({
    startWhatsApp: async () => client
  });

  await manager.startSession({
    accountId: ACCOUNT_A,
    commandEngine: { handle: async () => {} }
  });

  const results = await Promise.all([
    manager.stopSession(ACCOUNT_A),
    manager.stopSession(ACCOUNT_A)
  ]);

  assert.deepEqual(results, [true, true]);
  assert.equal(destroyCount, 1);
  assert.equal(manager.getSession(ACCOUNT_A), null);
});
