'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
function createMockCommandEngine(handle) {
  return {
    normalizeId(id) {
      const value = String(id ?? '').trim().toLowerCase();

      if (value.endsWith('@c.us')) {
        return value.split('@')[0].replace(/\D/g, '');
      }

      if (value.endsWith('@lid')) {
        return value;
      }

      return value.replace(/\D/g, '');
    },

    developerIds: new Set([
      '233241234567',
      '123456789012345@lid',
      '987654321098765@lid'
    ]),

    deployerIds: new Set(),

    handle
  };
}
test('WhatsApp client uses a separate NexaBot authentication directory', () => {
  const originalLoad = Module._load;
  let capturedOptions;

  class MockLocalAuth {
    constructor(options) {
      this.options = options;
    }
  }

  class MockClient {
    constructor(options) {
      capturedOptions = options;
    }
  }

  try {
    Module._load = function (request, parent, isMain) {
      if (request === 'whatsapp-web.js') {
        return {
          Client: MockClient,
          LocalAuth: MockLocalAuth
        };
      }

      return originalLoad.call(this, request, parent, isMain);
    };

    const modulePath = require.resolve('../src/whatsapp');
    delete require.cache[modulePath];

    const { createWhatsAppClient } = require('../src/whatsapp');

    const client = createWhatsAppClient({
      authDir: '.test-nexabot-auth',
      clientId: 'nexabot-test'
    });

    assert.ok(client instanceof MockClient);

    assert.equal(
      capturedOptions.authStrategy.options.clientId,
      'nexabot-test'
    );

    assert.equal(
      capturedOptions.authStrategy.options.dataPath,
      path.resolve('.test-nexabot-auth')
    );

    assert.equal(capturedOptions.puppeteer.headless, true);
  } finally {
    Module._load = originalLoad;
    delete require.cache[require.resolve('../src/whatsapp')];
  }
});
test('WhatsApp event handlers respond to all five connection events', () => {
  const { EventEmitter } = require('node:events');
  const { registerWhatsAppEvents } = require('../src/whatsapp');

  const client = new EventEmitter();
  const received = {};

  registerWhatsAppEvents(client, {
    onQR: qr => received.qr = qr,
    onAuthenticated: () => received.authenticated = true,
    onReady: () => received.ready = true,
    onAuthFailure: message => received.authFailure = message,
    onDisconnected: reason => received.disconnected = reason
  });

  client.emit('qr', 'test-qr-code');
  client.emit('authenticated');
  client.emit('ready');
  client.emit('auth_failure', 'test authentication error');
  client.emit('disconnected', 'test disconnection');

  assert.deepEqual(received, {
    qr: 'test-qr-code',
    authenticated: true,
    ready: true,
    authFailure: 'test authentication error',
    disconnected: 'test disconnection'
  });
});
test('WhatsApp message handler forwards valid messages and ignores invalid ones', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  const client = new EventEmitter();
  const received = [];

  const commandEngine = createMockCommandEngine(async data => {
  received.push(data);
});

  registerMessageHandler(client, commandEngine);

  const handler = client.listeners('message')[0];

  const message = {
    fromMe: false,
    author: '233241234567@c.us',
    from: '120363000000000000@g.us',
    body: '.ping',
    reply: async response => response
  };

  await handler(message);

  assert.equal(received.length, 1);
  assert.equal(received[0].text, '.ping');
  assert.equal(received[0].senderId, '233241234567@c.us');
  assert.equal(received[0].chatId, '120363000000000000@g.us');
  assert.equal(typeof received[0].reply, 'function');

  await handler({ ...message, fromMe: true });
  await handler({ ...message, author: '', from: '' });
  await handler({ ...message, body: 123 });

  assert.equal(received.length, 1);
});
test('WhatsApp message handler uses message.from when message.author is missing', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  const client = new EventEmitter();
  let received;

  const commandEngine = createMockCommandEngine(async data => {
  received = data;
});

  registerMessageHandler(client, commandEngine);

  const handler = client.listeners('message')[0];

  await handler({
    fromMe: false,
    from: '233241234567@c.us',
    body: '.ping',
    reply: async response => response
  });

  assert.ok(received);
  assert.equal(received.senderId, '233241234567@c.us');
  assert.equal(received.text, '.ping');
});
test('WhatsApp message handler sends replies through the original message', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  const client = new EventEmitter();
  let received;

  const commandEngine = createMockCommandEngine(async data => {
  received = data;
});

  registerMessageHandler(client, commandEngine);

  let replyText;

  const message = {
    fromMe: false,
    from: '233241234567@c.us',
    body: '.ping',
    reply: async response => {
      replyText = response;
      return 'reply-sent';
    }
  };

  const handler = client.listeners('message')[0];

  await handler(message);

  const result = await received.reply('Pong!');

  assert.equal(replyText, 'Pong!');
  assert.equal(result, 'reply-sent');
});
test('WhatsApp message handler propagates reply failures', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  const client = new EventEmitter();
  let received;

  const commandEngine = createMockCommandEngine(async data => {
  received = data;
});
  registerMessageHandler(client, commandEngine);

  const message = {
    fromMe: false,
    from: '233241234567@c.us',
    body: '.ping',
    reply: async () => {
      throw new Error('WhatsApp reply failed');
    }
  };

  const handler = client.listeners('message')[0];

  await handler(message);

  await assert.rejects(
    received.reply('Pong!'),
    {
      message: 'WhatsApp reply failed'
    }
  );
});
test('WhatsApp message handler reports command-processing errors', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  const client = new EventEmitter();
  const expectedError = new Error('Command processing failed');

  let receivedError;
  let receivedMessage;

  const commandEngine = createMockCommandEngine(async () => {
  throw expectedError;
});

  registerMessageHandler(client, commandEngine, {
    onError: (error, message) => {
      receivedError = error;
      receivedMessage = message;
    }
  });

  const message = {
    fromMe: false,
    from: '233241234567@c.us',
    body: '.ping',
    reply: async response => response
  };

  const handler = client.listeners('message')[0];

  await handler(message);

  assert.equal(receivedError, expectedError);
  assert.equal(receivedMessage, message);
});
test('WhatsApp message handler contains errors thrown by the error callback', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  const client = new EventEmitter();

  const commandEngine = createMockCommandEngine(async () => {
  throw new Error('Command processing failed');
});

  let callbackCalled = false;

  registerMessageHandler(client, commandEngine, {
    onError: () => {
      callbackCalled = true;
      throw new Error('Error callback failed');
    }
  });

  const message = {
    fromMe: false,
    from: '233241234567@c.us',
    body: '.ping',
    reply: async response => response
  };

  const handler = client.listeners('message')[0];

  await assert.doesNotReject(handler(message));

  assert.equal(callbackCalled, true);
});
test('WhatsApp message handler preserves LID sender identities', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  const client = new EventEmitter();
  const received = [];

  const commandEngine = {
    handle: async data => {
      received.push(data);
    }
  };

  registerMessageHandler(client, commandEngine);

  const handler = client.listeners('message')[0];

  await handler({
    fromMe: false,
    author: '123456789012345@lid',
    from: '120363000000000000@g.us',
    body: '.ping'
  });

  await handler({
    fromMe: false,
    from: '987654321098765@lid',
    body: '.ping'
  });

  assert.equal(received.length, 2);
  assert.equal(received[0].senderId, '123456789012345@lid');
  assert.equal(received[1].senderId, '987654321098765@lid');
});
test('WhatsApp message handler resolves a valid LID to its phone identity', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  const client = new EventEmitter();

  client.getContactLidAndPhone = async ids => {
    assert.deepEqual(ids, ['123456789012345@lid']);

    return [{
      lid: '123456789012345@lid',
      pn: '233241234567@c.us'
    }];
  };

  let received;

  registerMessageHandler(client, {
    handle: async data => {
      received = data;
    }
  });

  await client.listeners('message')[0]({
    fromMe: false,
    author: '123456789012345@lid',
    from: '120363000000000000@g.us',
    body: '.ping'
  });

  assert.equal(received.senderId, '233241234567@c.us');
  assert.equal(received.originalSenderId, '123456789012345@lid');
});

test('WhatsApp message handler preserves LID when identity lookup fails', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  const client = new EventEmitter();

  client.getContactLidAndPhone = async () => {
    throw new Error('Lookup failed');
  };

  let received;

  registerMessageHandler(client, {
    handle: async data => {
      received = data;
    }
  });

  await client.listeners('message')[0]({
    fromMe: false,
    author: '123456789012345@lid',
    from: '120363000000000000@g.us',
    body: '.ping'
  });

  assert.equal(received.senderId, '123456789012345@lid');
  assert.equal(received.originalSenderId, '123456789012345@lid');
});

test('WhatsApp message handler rejects an unrelated identity mapping', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  const client = new EventEmitter();

  client.getContactLidAndPhone = async () => [{
    lid: '999999999999999@lid',
    pn: '233241234567@c.us'
  }];

  let received;

  registerMessageHandler(client, {
    handle: async data => {
      received = data;
    }
  });

  await client.listeners('message')[0]({
    fromMe: false,
    author: '123456789012345@lid',
    from: '120363000000000000@g.us',
    body: '.ping'
  });

  assert.equal(received.senderId, '123456789012345@lid');
  assert.notEqual(received.senderId, '233241234567@c.us');
});
