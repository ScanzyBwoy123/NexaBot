'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateConfiguration } = require('../src/server');

test('server requires at least one developer ID', () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  try {
    process.env.DEVELOPER_IDS = '';
    process.env.DEPLOYER_ID = '233240000888';

    assert.throws(
      () => validateConfiguration(),
      /DEVELOPER_IDS must be configured/
    );
  } finally {
    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerId === undefined) {
      delete process.env.DEPLOYER_ID;
    } else {
      process.env.DEPLOYER_ID = previousDeployerId;
    }
  }
});

test('server requires a deployer ID', () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  try {
    process.env.DEVELOPER_IDS = '233241234567';
    process.env.DEPLOYER_ID = '';

    assert.throws(
      () => validateConfiguration(),
      /DEPLOYER_ID must be configured/
    );
  } finally {
    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerId === undefined) {
      delete process.env.DEPLOYER_ID;
    } else {
      process.env.DEPLOYER_ID = previousDeployerId;
    }
  }
});

test('server accepts valid developer and deployer IDs', () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  try {
    process.env.DEVELOPER_IDS = '233241234567,233241234568';
    process.env.DEPLOYER_ID = '233240000888';

    const config = validateConfiguration();

    assert.deepEqual(config.developerIds, [
      '233241234567',
      '233241234568'
    ]);

    assert.equal(config.deployerId, '233240000888');
  } finally {
    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerId === undefined) {
      delete process.env.DEPLOYER_ID;
    } else {
      process.env.DEPLOYER_ID = previousDeployerId;
    }
  }
});
const { once } = require('node:events');
const { startServer } = require('../src/server');

test('health endpoint returns a healthy response', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';

  let server;

  try {
    ({ server } = startServer({ port: 0 }));

    await once(server, 'listening');

    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/health`
    );

    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.status, 'healthy');
    assert.equal(data.service, 'NexaBot');
  } finally {
    if (server?.listening) {
      const closed = once(server, 'close');
      server.close();
      await closed;
    }

    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerId === undefined) {
      delete process.env.DEPLOYER_ID;
    } else {
      process.env.DEPLOYER_ID = previousDeployerId;
    }
  }
});
test('unknown routes return a 404 response', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';

  let server;

  try {
    ({ server } = startServer({ port: 0 }));

    await once(server, 'listening');

    const address = server.address();

    const response = await fetch(
      `http://127.0.0.1:${address.port}/unknown`
    );

    const data = await response.json();

    assert.equal(response.status, 404);
    assert.equal(data.success, false);
    assert.equal(data.error, 'Not found');
  } finally {
    if (server?.listening) {
      const closed = once(server, 'close');
      server.close();
      await closed;
    }

    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerId === undefined) {
      delete process.env.DEPLOYER_ID;
    } else {
      process.env.DEPLOYER_ID = previousDeployerId;
    }
  }
});
test('health endpoint rejects unsupported HTTP methods', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';

  let server;

  try {
    ({ server } = startServer({ port: 0 }));

    await once(server, 'listening');

    const address = server.address();

    const response = await fetch(
      `http://127.0.0.1:${address.port}/health`,
      { method: 'POST' }
    );

    const data = await response.json();

    assert.equal(response.status, 404);
    assert.equal(data.success, false);
    assert.equal(data.error, 'Not found');
  } finally {
    if (server?.listening) {
      const closed = once(server, 'close');
      server.close();
      await closed;
    }

    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerId === undefined) {
      delete process.env.DEPLOYER_ID;
    } else {
      process.env.DEPLOYER_ID = previousDeployerId;
    }
  }
});
const { createRequestHandler } = require('../src/server');

test('unexpected request errors return a safe 500 response', () => {
  const handler = createRequestHandler();

  const req = {
    get method() {
      throw new Error('Simulated internal failure');
    }
  };

  let statusCode;
  let responseBody;
  let loggedError;

  const res = {
    headersSent: false,

    writeHead(status) {
      statusCode = status;
      this.headersSent = true;
    },

    end(body) {
      responseBody = body;
    },

    destroy() {
      throw new Error('Response should not be destroyed');
    }
  };

  const originalConsoleError = console.error;

  try {
    console.error = (...args) => {
      loggedError = args.join(' ');
    };

    handler(req, res);
  } finally {
    console.error = originalConsoleError;
  }

  const data = JSON.parse(responseBody);

  assert.equal(statusCode, 500);
  assert.equal(data.success, false);
  assert.equal(data.error, 'Internal server error');
  assert.ok(loggedError.includes('Simulated internal failure'));
  assert.ok(!responseBody.includes('Simulated internal failure'));
});
test('server rejects invalid port configurations', () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';

  try {
    for (const port of [-1, 65536, 3.5, 'invalid']) {
      assert.throws(
        () => validateConfiguration({ port }),
        /Invalid server port/
      );
    }
  } finally {
    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerId === undefined) {
      delete process.env.DEPLOYER_ID;
    } else {
      process.env.DEPLOYER_ID = previousDeployerId;
    }
  }
});
test('server uses configured port and supports port overrides', () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;
  const previousPort = process.env.PORT;

  try {
    process.env.DEVELOPER_IDS = '233241234567';
    process.env.DEPLOYER_ID = '233240000888';
    process.env.PORT = '4100';

    assert.equal(validateConfiguration().port, 4100);

    assert.equal(
      validateConfiguration({ port: 4200 }).port,
      4200
    );
  } finally {
    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerId === undefined) {
      delete process.env.DEPLOYER_ID;
    } else {
      process.env.DEPLOYER_ID = previousDeployerId;
    }

    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }
  }
});
test('server refuses to start without a deployer identity', () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  try {
    process.env.DEVELOPER_IDS = '233241234567';
    process.env.DEPLOYER_ID = '';

    assert.throws(
      () => startServer({ port: 0 }),
      /DEPLOYER_ID must be configured/
    );
  } finally {
    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerId === undefined) {
      delete process.env.DEPLOYER_ID;
    } else {
      process.env.DEPLOYER_ID = previousDeployerId;
    }
  }
});
test('server refuses to start without a developer identity', () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  try {
    process.env.DEVELOPER_IDS = '';
    process.env.DEPLOYER_ID = '233240000888';

    assert.throws(
      () => startServer({ port: 0 }),
      /DEVELOPER_IDS must be configured/
    );
  } finally {
    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerId === undefined) {
      delete process.env.DEPLOYER_ID;
    } else {
      process.env.DEPLOYER_ID = previousDeployerId;
    }
  }
});
test('server starts successfully with valid configuration', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';

  let server;

  try {
    const result = startServer({ port: 0 });

    server = result.server;

    await once(server, 'listening');

    assert.equal(server.listening, true);
    const address = firstServer.address();

const response = await fetch(
  `http://127.0.0.1:${address.port}/health`
);

const data = await response.json();

assert.equal(response.status, 200);
assert.equal(data.status, 'healthy');
assert.equal(data.service, 'NexaBot');
    assert.ok(server.address().port > 0);
    assert.ok(result.bot.list().length > 0);
  } finally {
    if (server?.listening) {
      const closed = once(server, 'close');
      server.close();
      await closed;
    }

    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerId === undefined) {
      delete process.env.DEPLOYER_ID;
    } else {
      process.env.DEPLOYER_ID = previousDeployerId;
    }
  }
});
test('server shuts down gracefully', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';

  let server;

  try {
    ({ server } = startServer({ port: 0 }));

    await once(server, 'listening');

    assert.equal(server.listening, true);

    const closed = once(server, 'close');
    server.close();
    await closed;

    assert.equal(server.listening, false);
  } finally {
    if (server?.listening) {
      const closed = once(server, 'close');
      server.close();
      await closed;
    }

    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerId === undefined) {
      delete process.env.DEPLOYER_ID;
    } else {
      process.env.DEPLOYER_ID = previousDeployerId;
    }
  }
});
test('server reports a port conflict safely', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';

  let firstServer;
  let secondServer;

  try {
    ({ server: firstServer } = startServer({ port: 0 }));

    await once(firstServer, 'listening');

    const occupiedPort = firstServer.address().port;

    let reportError;

    const errorPromise = new Promise(resolve => {
      reportError = resolve;
    });

    ({ server: secondServer } = startServer({
      port: occupiedPort,
      onError: reportError
    }));

    const error = await errorPromise;

    assert.equal(error.code, 'EADDRINUSE');
    assert.equal(firstServer.listening, true);
  } finally {
    for (const server of [secondServer, firstServer]) {
      if (server?.listening) {
        const closed = once(server, 'close');
        server.close();
        await closed;
      }
    }

    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerId === undefined) {
      delete process.env.DEPLOYER_ID;
    } else {
      process.env.DEPLOYER_ID = previousDeployerId;
    }
  }
});
