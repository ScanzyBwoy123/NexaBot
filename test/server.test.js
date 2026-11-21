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

test('server allows developer configuration without a deployer ID', () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  try {
    process.env.DEVELOPER_IDS = '233241234567';
    process.env.DEPLOYER_ID = '';

    const config = validateConfiguration();

    assert.deepEqual(config.developerIds, ['233241234567']);
    assert.equal(config.deployerId, '');
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

assert.equal(response.headers.get('cache-control'), 'no-store');
assert.match(
  response.headers.get('content-type'),
  /application\/json/
);
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
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(
  response.headers.get('content-type'),
  /application\/json/
);  
    assert.equal(response.headers.get('cache-control'), 'no-store');
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
    assert.match(
  response.headers.get('content-type'),
  /application\/json/
);
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

    writeHead(status, headers) {
  statusCode = status;
  this.headers = headers;
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
 assert.equal(res.headers['Content-Type'], 'application/json');
  assert.equal(res.headers['Cache-Control'], 'no-store');
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
test('server starts without a separate deployer identity', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '';

  let server;

  try {
    ({ server } = startServer({ port: 0 }));

    await once(server, 'listening');

    assert.equal(server.listening, true);
    assert.ok(server.address().port > 0);
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
    assert.ok(server.address().port > 0);
    assert.equal(server.address().address, '::');
assert.equal(server.address().family, 'IPv6');
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
    let closeEventCount = 0;

server.on('close', () => {
  closeEventCount += 1;
});
    server.close();
    await closed;

    assert.equal(server.listening, false);
    assert.equal(closeEventCount, 1);
    ({ server } = startServer({ port: 0 }));

await once(server, 'listening');
const address = server.address();
const response = await fetch(
  `http://127.0.0.1:${address.port}/health`
);

const data = await response.json();
assert.equal(response.headers.get('cache-control'), 'no-store');
assert.match(
  response.headers.get('content-type'),
  /application\/json/
);
assert.equal(response.status, 200);
assert.equal(data.success, true);
assert.equal(data.status, 'healthy');
assert.equal(data.service, 'NexaBot');
assert.equal(server.listening, true);
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
    assert.equal(secondServer.listening, false);
    assert.equal(secondServer.address(), null);
    const address = firstServer.address();

const response = await fetch(
  `http://127.0.0.1:${address.port}/health`
);

const data = await response.json();

assert.equal(response.headers.get('cache-control'), 'no-store'); 
assert.match(
  response.headers.get('content-type'),
  /application\/json/
);
assert.equal(response.status, 200);
assert.equal(data.success, true);
assert.equal(data.status, 'healthy');
assert.equal(data.service, 'NexaBot');
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
test('server reports unexpected errors through its error callback', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';

  let reportError;

  const errorPromise = new Promise(resolve => {
    reportError = resolve;
  });

  let server;

  try {
    ({ server } = startServer({
      port: 0,
      onError: reportError
    }));

    await once(server, 'listening');

    const expectedError = new Error('Unexpected server error');
    server.emit('error', expectedError);

    const receivedError = await errorPromise;

    assert.equal(receivedError, expectedError);
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
test('server handles unexpected errors without an error callback', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';

  let server;

  try {
    ({ server } = startServer({ port: 0 }));

    await once(server, 'listening');

    assert.doesNotThrow(() => {
      server.emit('error', new Error('Unexpected server error'));
    });

    assert.equal(server.listening, true);
    assert.equal(process.exitCode, undefined);
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
test('server does not start WhatsApp when it is disabled', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;
  const previousEnableWhatsApp = process.env.ENABLE_WHATSAPP;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';
  process.env.ENABLE_WHATSAPP = 'false';

  let whatsappStartCount = 0;
  let server;

  try {
    ({ server } = startServer({
      port: 0,
      startWhatsApp: () => {
        whatsappStartCount++;
        return Promise.resolve();
      }
    }));

    await once(server, 'listening');

    assert.equal(whatsappStartCount, 0);
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

    if (previousEnableWhatsApp === undefined) {
      delete process.env.ENABLE_WHATSAPP;
    } else {
      process.env.ENABLE_WHATSAPP = previousEnableWhatsApp;
    }
  }
});
test('server starts WhatsApp when it is enabled', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;
  const previousEnableWhatsApp = process.env.ENABLE_WHATSAPP;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';
  process.env.ENABLE_WHATSAPP = 'true';

  let whatsappStartCount = 0;
  let receivedOptions;
  let server;

  try {
    ({ server } = startServer({
      port: 0,
      startWhatsApp: options => {
        whatsappStartCount++;
        receivedOptions = options;
        return Promise.resolve();
      }
    }));

    await once(server, 'listening');

    assert.equal(whatsappStartCount, 1);
    assert.ok(receivedOptions.commandEngine);
    assert.equal(typeof receivedOptions.onCode, 'function');
    assert.equal(typeof receivedOptions.onReady, 'function');
    assert.equal(typeof receivedOptions.onError, 'function');
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

    if (previousEnableWhatsApp === undefined) {
      delete process.env.ENABLE_WHATSAPP;
    } else {
      process.env.ENABLE_WHATSAPP = previousEnableWhatsApp;
    }
  }
});
test('pairing code is never logged or exposed by the health endpoint', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;
  const previousEnableWhatsApp = process.env.ENABLE_WHATSAPP;
  const originalLog = console.log;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';
  process.env.ENABLE_WHATSAPP = 'true';

  const logs = [];
  let receivedOptions;
  let server;

  try {
    console.log = (...args) => logs.push(args.join(' '));

    ({ server } = startServer({
      port: 0,
      startWhatsApp: options => {
        receivedOptions = options;
        return Promise.resolve();
      }
    }));

    await once(server, 'listening');

    receivedOptions.onCode('12345678');

    assert.equal(
  logs.some(line => line.includes('12345678')),
  false
);

    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/health`
    );

    const healthBody = await response.text();

    assert.equal(response.status, 200);
    assert.equal(healthBody.includes('12345678'), false);
    assert.equal(healthBody.includes('pairing'), false);
  } finally {
    console.log = originalLog;

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

    if (previousEnableWhatsApp === undefined) {
      delete process.env.ENABLE_WHATSAPP;
    } else {
      process.env.ENABLE_WHATSAPP = previousEnableWhatsApp;
    }
  }
});

test('pairing endpoint rejects requests without the secret token', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;
  const previousEnableWhatsApp = process.env.ENABLE_WHATSAPP;
  const previousPairingToken = process.env.PAIRING_API_TOKEN;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';
  process.env.ENABLE_WHATSAPP = 'false';
  process.env.PAIRING_API_TOKEN = 'test-secret-token';

  let server;

  try {
    ({ server } = startServer({ port: 0 }));

    await once(server, 'listening');

    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/pairing/request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: '233241234567'
        })
      }
    );

    const result = await response.json();

    assert.equal(response.status, 401);
    assert.equal(result.success, false);
    assert.equal(result.error, 'Unauthorized');
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

    if (previousEnableWhatsApp === undefined) {
      delete process.env.ENABLE_WHATSAPP;
    } else {
      process.env.ENABLE_WHATSAPP = previousEnableWhatsApp;
    }

    if (previousPairingToken === undefined) {
      delete process.env.PAIRING_API_TOKEN;
    } else {
      process.env.PAIRING_API_TOKEN = previousPairingToken;
    }
  }
});

test('pairing endpoint rejects an incorrect secret token', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;
  const previousEnableWhatsApp = process.env.ENABLE_WHATSAPP;
  const previousPairingToken = process.env.PAIRING_API_TOKEN;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';
  process.env.ENABLE_WHATSAPP = 'false';
  process.env.PAIRING_API_TOKEN = 'correct-secret-token';

  let server;

  try {
    ({ server } = startServer({ port: 0 }));

    await once(server, 'listening');

    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/pairing/request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer wrong-secret-token'
        },
        body: JSON.stringify({
          phoneNumber: '233241234567'
        })
      }
    );

    const result = await response.json();

    assert.equal(response.status, 401);
    assert.equal(result.success, false);
    assert.equal(result.error, 'Unauthorized');
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

    if (previousEnableWhatsApp === undefined) {
      delete process.env.ENABLE_WHATSAPP;
    } else {
      process.env.ENABLE_WHATSAPP = previousEnableWhatsApp;
    }

    if (previousPairingToken === undefined) {
      delete process.env.PAIRING_API_TOKEN;
    } else {
      process.env.PAIRING_API_TOKEN = previousPairingToken;
    }
  }
});

test('pairing endpoint accepts the correct secret token', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;
  const previousEnableWhatsApp = process.env.ENABLE_WHATSAPP;
  const previousPairingToken = process.env.PAIRING_API_TOKEN;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';
  process.env.ENABLE_WHATSAPP = 'true';
  process.env.PAIRING_API_TOKEN = 'correct-secret-token';

  let server;

  try {
    ({ server } = startServer({
      port: 0,
      startWhatsApp: async () => ({
        async requestPairingCode(phoneNumber, isMobile) {
          assert.equal(phoneNumber, '233241234567');
          assert.equal(isMobile, true);
          return '87654321';
        }
      })
    }));

    await once(server, 'listening');
    await new Promise(resolve => setImmediate(resolve));

    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/pairing/request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer correct-secret-token'
        },
        body: JSON.stringify({
          phoneNumber: '233 24 123 4567'
        })
      }
    );

    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.success, true);
    assert.equal(result.code, '87654321');
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

    if (previousEnableWhatsApp === undefined) {
      delete process.env.ENABLE_WHATSAPP;
    } else {
      process.env.ENABLE_WHATSAPP = previousEnableWhatsApp;
    }

    if (previousPairingToken === undefined) {
      delete process.env.PAIRING_API_TOKEN;
    } else {
      process.env.PAIRING_API_TOKEN = previousPairingToken;
    }
  }
});

test('pairing endpoint returns 503 when WhatsApp is not ready', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;
  const previousEnableWhatsApp = process.env.ENABLE_WHATSAPP;
  const previousPairingToken = process.env.PAIRING_API_TOKEN;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';
  process.env.ENABLE_WHATSAPP = 'false';
  process.env.PAIRING_API_TOKEN = 'correct-secret-token';

  let server;

  try {
    ({ server } = startServer({ port: 0 }));

    await once(server, 'listening');

    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/pairing/request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer correct-secret-token'
        },
        body: JSON.stringify({
          phoneNumber: '233241234567'
        })
      }
    );

    const result = await response.json();

    assert.equal(response.status, 503);
    assert.equal(result.success, false);
    assert.equal(result.error, 'WhatsApp is not ready.');
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

    if (previousEnableWhatsApp === undefined) {
      delete process.env.ENABLE_WHATSAPP;
    } else {
      process.env.ENABLE_WHATSAPP = previousEnableWhatsApp;
    }

    if (previousPairingToken === undefined) {
      delete process.env.PAIRING_API_TOKEN;
    } else {
      process.env.PAIRING_API_TOKEN = previousPairingToken;
    }
  }
});

test('pairing endpoint rejects invalid phone numbers without requesting a code', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;
  const previousEnableWhatsApp = process.env.ENABLE_WHATSAPP;
  const previousPairingToken = process.env.PAIRING_API_TOKEN;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';
  process.env.ENABLE_WHATSAPP = 'true';
  process.env.PAIRING_API_TOKEN = 'correct-secret-token';

  let server;
  let pairingCodeRequested = false;

  try {
    ({ server } = startServer({
      port: 0,
      startWhatsApp: async () => ({
        async requestPairingCode() {
          pairingCodeRequested = true;
          return '87654321';
        }
      })
    }));

    await once(server, 'listening');
    await new Promise(resolve => setImmediate(resolve));

    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/pairing/request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer correct-secret-token'
        },
        body: JSON.stringify({
          phoneNumber: '123'
        })
      }
    );

    const result = await response.json();

    assert.equal(response.status, 400);
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid international phone number.');
    assert.equal(pairingCodeRequested, false);
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

    if (previousEnableWhatsApp === undefined) {
      delete process.env.ENABLE_WHATSAPP;
    } else {
      process.env.ENABLE_WHATSAPP = previousEnableWhatsApp;
    }

    if (previousPairingToken === undefined) {
      delete process.env.PAIRING_API_TOKEN;
    } else {
      process.env.PAIRING_API_TOKEN = previousPairingToken;
    }
  }
});

test('pairing endpoint blocks the fourth request within ten minutes', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;
  const previousEnableWhatsApp = process.env.ENABLE_WHATSAPP;
  const previousPairingToken = process.env.PAIRING_API_TOKEN;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';
  process.env.ENABLE_WHATSAPP = 'true';
  process.env.PAIRING_API_TOKEN = 'correct-secret-token';

  let server;
  let pairingCodeRequests = 0;

  try {
    ({ server } = startServer({
      port: 0,
      startWhatsApp: async () => ({
        async requestPairingCode() {
          pairingCodeRequests += 1;
          return '87654321';
        }
      })
    }));

    await once(server, 'listening');
    await new Promise(resolve => setImmediate(resolve));

    const makeRequest = () => fetch(
      `http://127.0.0.1:${server.address().port}/pairing/request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer correct-secret-token'
        },
        body: JSON.stringify({
          phoneNumber: '233241234567'
        })
      }
    );

    for (let i = 0; i < 3; i += 1) {
      const response = await makeRequest();
      assert.equal(response.status, 200);
    }

    const fourthResponse = await makeRequest();
    const result = await fourthResponse.json();

    assert.equal(fourthResponse.status, 429);
    assert.equal(result.success, false);
    assert.equal(
      result.error,
      'Too many pairing requests. Try again later.'
    );
    assert.equal(pairingCodeRequests, 3);
    assert.ok(Number(fourthResponse.headers.get('retry-after')) > 0);
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

    if (previousEnableWhatsApp === undefined) {
      delete process.env.ENABLE_WHATSAPP;
    } else {
      process.env.ENABLE_WHATSAPP = previousEnableWhatsApp;
    }

    if (previousPairingToken === undefined) {
      delete process.env.PAIRING_API_TOKEN;
    } else {
      process.env.PAIRING_API_TOKEN = previousPairingToken;
    }
  }
});

test('pairing endpoint blocks retries for 60 seconds after a failed request', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;
  const previousEnableWhatsApp = process.env.ENABLE_WHATSAPP;
  const previousPairingToken = process.env.PAIRING_API_TOKEN;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';
  process.env.ENABLE_WHATSAPP = 'true';
  process.env.PAIRING_API_TOKEN = 'correct-secret-token';

  let server;
  let pairingCodeRequests = 0;

  try {
    ({ server } = startServer({
      port: 0,
      startWhatsApp: async () => ({
        async requestPairingCode() {
          pairingCodeRequests += 1;
          throw new Error('WhatsApp pairing request failed.');
        }
      })
    }));

    await once(server, 'listening');
    await new Promise(resolve => setImmediate(resolve));

    const makeRequest = () => fetch(
      `http://127.0.0.1:${server.address().port}/pairing/request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer correct-secret-token'
        },
        body: JSON.stringify({
          phoneNumber: '233241234567'
        })
      }
    );

    const firstResponse = await makeRequest();
    assert.equal(firstResponse.status, 500);

    const secondResponse = await makeRequest();
    const result = await secondResponse.json();

    assert.equal(secondResponse.status, 429);
    assert.equal(result.success, false);
    assert.equal(
      result.error,
      'Pairing failed recently. Wait before trying again.'
    );
    assert.equal(pairingCodeRequests, 1);
    assert.ok(Number(secondResponse.headers.get('retry-after')) > 0);
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

    if (previousEnableWhatsApp === undefined) {
      delete process.env.ENABLE_WHATSAPP;
    } else {
      process.env.ENABLE_WHATSAPP = previousEnableWhatsApp;
    }

    if (previousPairingToken === undefined) {
      delete process.env.PAIRING_API_TOKEN;
    } else {
      process.env.PAIRING_API_TOKEN = previousPairingToken;
    }
  }
});

test('pairing endpoint allows a successful retry after cooldown expires', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;
  const previousEnableWhatsApp = process.env.ENABLE_WHATSAPP;
  const previousPairingToken = process.env.PAIRING_API_TOKEN;
  const originalDateNow = Date.now;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.DEPLOYER_ID = '233240000888';
  process.env.ENABLE_WHATSAPP = 'true';
  process.env.PAIRING_API_TOKEN = 'correct-secret-token';

  let server;
  let pairingCodeRequests = 0;
  let fakeNow = originalDateNow();

  try {
    Date.now = () => fakeNow;

    ({ server } = startServer({
      port: 0,
      startWhatsApp: async () => ({
        async requestPairingCode() {
          pairingCodeRequests += 1;

          if (pairingCodeRequests === 1) {
            throw new Error('WhatsApp pairing request failed.');
          }

          return 'ABCD-1234';
        }
      })
    }));

    await once(server, 'listening');
    await new Promise(resolve => setImmediate(resolve));

    const makeRequest = () => fetch(
      `http://127.0.0.1:${server.address().port}/pairing/request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer correct-secret-token'
        },
        body: JSON.stringify({
          phoneNumber: '233241234567'
        })
      }
    );

    const firstResponse = await makeRequest();
    assert.equal(firstResponse.status, 500);

    fakeNow += 60 * 1000 + 1000;

    const secondResponse = await makeRequest();
    const result = await secondResponse.json();

    assert.equal(secondResponse.status, 200);
    assert.equal(result.success, true);
    assert.equal(result.code, 'ABCD-1234');
    assert.equal(pairingCodeRequests, 2);
  } finally {
    Date.now = originalDateNow;

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

    if (previousEnableWhatsApp === undefined) {
      delete process.env.ENABLE_WHATSAPP;
    } else {
      process.env.ENABLE_WHATSAPP = previousEnableWhatsApp;
    }

    if (previousPairingToken === undefined) {
      delete process.env.PAIRING_API_TOKEN;
    } else {
      process.env.PAIRING_API_TOKEN = previousPairingToken;
    }
  }
});
test('pairing endpoint rejects GET requests', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousEnableWhatsApp = process.env.ENABLE_WHATSAPP;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.ENABLE_WHATSAPP = 'false';

  let server;

  try {
    ({ server } = startServer({ port: 0 }));
    await once(server, 'listening');

    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/pairing/request`,
      { method: 'GET' }
    );

    const result = await response.json();

    assert.equal(response.status, 404);
    assert.equal(result.success, false);
    assert.equal(result.error, 'Not found');
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

    if (previousEnableWhatsApp === undefined) {
      delete process.env.ENABLE_WHATSAPP;
    } else {
      process.env.ENABLE_WHATSAPP = previousEnableWhatsApp;
    }
  }
});
test('pairing endpoint rejects requests when no API token is configured', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousEnableWhatsApp = process.env.ENABLE_WHATSAPP;
  const previousPairingToken = process.env.PAIRING_API_TOKEN;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.ENABLE_WHATSAPP = 'false';
  delete process.env.PAIRING_API_TOKEN;

  let server;

  try {
    ({ server } = startServer({ port: 0 }));
    await once(server, 'listening');

    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/pairing/request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer some-token'
        },
        body: JSON.stringify({
          phoneNumber: '233241234567'
        })
      }
    );

    const result = await response.json();

    assert.equal(response.status, 401);
    assert.equal(result.success, false);
    assert.equal(result.error, 'Unauthorized');
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

    if (previousEnableWhatsApp === undefined) {
      delete process.env.ENABLE_WHATSAPP;
    } else {
      process.env.ENABLE_WHATSAPP = previousEnableWhatsApp;
    }

    if (previousPairingToken === undefined) {
      delete process.env.PAIRING_API_TOKEN;
    } else {
      process.env.PAIRING_API_TOKEN = previousPairingToken;
    }
  }
});
test('pairing endpoint handles malformed JSON without crashing the server', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousEnableWhatsApp = process.env.ENABLE_WHATSAPP;
  const previousPairingToken = process.env.PAIRING_API_TOKEN;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.ENABLE_WHATSAPP = 'false';
  process.env.PAIRING_API_TOKEN = 'test-secret-token';

  let server;

  try {
    ({ server } = startServer({ port: 0 }));
    await once(server, 'listening');

    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const response = await fetch(`${baseUrl}/pairing/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-secret-token'
      },
      body: '{"phoneNumber":'
    });

    const result = await response.json();

    assert.equal(response.status, 500);
    assert.equal(result.success, false);
    assert.equal(result.error, 'Internal server error');

    const healthResponse = await fetch(`${baseUrl}/health`);
    const healthResult = await healthResponse.json();

    assert.equal(healthResponse.status, 200);
    assert.equal(healthResult.status, 'healthy');
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

    if (previousEnableWhatsApp === undefined) {
      delete process.env.ENABLE_WHATSAPP;
    } else {
      process.env.ENABLE_WHATSAPP = previousEnableWhatsApp;
    }

    if (previousPairingToken === undefined) {
      delete process.env.PAIRING_API_TOKEN;
    } else {
      process.env.PAIRING_API_TOKEN = previousPairingToken;
    }
  }
});
test('pairing endpoint rejects oversized JSON without crashing the server', async () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousEnableWhatsApp = process.env.ENABLE_WHATSAPP;
  const previousPairingToken = process.env.PAIRING_API_TOKEN;

  process.env.DEVELOPER_IDS = '233241234567';
  process.env.ENABLE_WHATSAPP = 'false';
  process.env.PAIRING_API_TOKEN = 'test-secret-token';

  let server;

  try {
    ({ server } = startServer({ port: 0 }));
    await once(server, 'listening');

    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    await assert.rejects(
      fetch(`${baseUrl}/pairing/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-secret-token'
        },
        body: JSON.stringify({
          phoneNumber: '233241234567',
          extra: 'A'.repeat(2000)
        })
      })
    );

    const healthResponse = await fetch(`${baseUrl}/health`);
    const healthResult = await healthResponse.json();

    assert.equal(healthResponse.status, 200);
    assert.equal(healthResult.status, 'healthy');
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

    if (previousEnableWhatsApp === undefined) {
      delete process.env.ENABLE_WHATSAPP;
    } else {
      process.env.ENABLE_WHATSAPP = previousEnableWhatsApp;
    }

    if (previousPairingToken === undefined) {
      delete process.env.PAIRING_API_TOKEN;
    } else {
      process.env.PAIRING_API_TOKEN = previousPairingToken;
    }
  }
});
