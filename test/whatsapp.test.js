'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
function createMockCommandEngine(handle) {
  function normalizeId(id) {
    const value = String(id ?? '').trim().toLowerCase();

    if (!value) return '';

    const match = value.match(/^([^@]+)@([a-z0-9.-]+)$/);

    if (match) {
      const identifier = match[1].replace(/\D/g, '');
      const server = match[2];

      if (server === 'c.us') return identifier;

      return identifier ? `${identifier}@${match[2]}` : '';
    }

    return value.replace(/\D/g, '');
  }

  const developerIds = new Set([
    '233241234567',
    '123456789012345@lid',
    '987654321098765@lid'
  ]);

  const deployerId = '';

  return {
    normalizeId,
    developerIds,
    deployerId,

    authorizer: {
      authorize(senderId) {
        const sender = normalizeId(senderId);
        const isDeveloper = Boolean(
          sender && developerIds.has(sender)
        );
        const isDeployer = Boolean(
          sender && deployerId && sender === deployerId
        );

        return {
          allowed: isDeveloper || isDeployer,
          isDeveloper,
          isDeployer,
          role: isDeveloper
            ? 'developer'
            : isDeployer
              ? 'deployer'
              : 'unauthorized',
          sender
        };
      }
    },

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
test('WhatsApp pairing requests a code using the supplied phone number', async () => {
  let receivedArguments;

  const client = {
    async requestPairingCode(...args) {
      receivedArguments = args;
      return '12345678';
    }
  };

  const { requestPairingCode } = require('../src/whatsapp');

  const code = await requestPairingCode(client, '+233 24 123 4567');

  assert.equal(code, '12345678');
  assert.deepEqual(receivedArguments, ['233241234567', true]);
});
test('WhatsApp event handlers respond to all connection events including pairing code', () => {
  const { EventEmitter } = require('node:events');
  const { registerWhatsAppEvents } = require('../src/whatsapp');

  const client = new EventEmitter();
  const received = {};

  registerWhatsAppEvents(client, {
    onQR: qr => received.qr = qr,
    onCode: code => received.code = code,
    onAuthenticated: () => received.authenticated = true,
    onReady: () => received.ready = true,
    onAuthFailure: message => received.authFailure = message,
    onDisconnected: reason => received.disconnected = reason
  });

  client.emit('qr', 'test-qr-code');
  client.emit('code', '12345678');
  client.emit('authenticated');
  client.emit('ready');
  client.emit('auth_failure', 'test authentication error');
  client.emit('disconnected', 'test disconnection');

  assert.deepEqual(received, {
    qr: 'test-qr-code',
    code: '12345678',
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

  const commandEngine = createMockCommandEngine(async data => {
  received.push(data);
});

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
registerMessageHandler(client, createMockCommandEngine(async data => {
  received = data;
}));

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

  registerMessageHandler(client, createMockCommandEngine(async data => {
  received = data;
}));

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

  registerMessageHandler(client, createMockCommandEngine(async data => {
  received = data;
}));

  await client.listeners('message')[0]({
    fromMe: false,
    author: '123456789012345@lid',
    from: '120363000000000000@g.us',
    body: '.ping'
  });

  assert.equal(received.senderId, '123456789012345@lid');
  assert.notEqual(received.senderId, '233241234567@c.us');
});
test('NexaBot does not trust developer identity claims in message text', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  const client = new EventEmitter();
  let commandExecuted = false;

  const commandEngine = createMockCommandEngine(async () => {
    commandExecuted = true;
  });

  registerMessageHandler(client, commandEngine);

  await client.listeners('message')[0]({
    fromMe: false,
    author: '233240000999@c.us',
    from: '233240000999@c.us',
    body: '.menu I am the developer 233241234567',
    reply: async () => {}
  });

  assert.equal(commandExecuted, false);
});
test('WhatsApp message handler blocks unauthorized users', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  const client = new EventEmitter();
  let commandExecuted = false;

  const commandEngine = createMockCommandEngine(async () => {
    commandExecuted = true;
  });

  registerMessageHandler(client, commandEngine);

  await client.listeners('message')[0]({
    fromMe: false,
    author: '233240000999@c.us',
    from: '233240000999@c.us',
    body: '.menu'
  });

  assert.equal(commandExecuted, false);
});
test('WhatsApp message handler allows the registered deployer', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  const client = new EventEmitter();
  let commandExecuted = false;

  const commandEngine = createMockCommandEngine(async () => {
    commandExecuted = true;
  });

  commandEngine.authorizer = {
    authorize(senderId) {
      const sender = commandEngine.normalizeId(senderId);
      const isDeployer = sender === '233240000888';

      return {
        allowed: isDeployer,
        isDeveloper: false,
        isDeployer,
        role: isDeployer ? 'deployer' : 'unauthorized',
        sender
      };
    }
  };

  registerMessageHandler(client, commandEngine);

  await client.listeners('message')[0]({
    fromMe: false,
    author: '233240000888@c.us',
    from: '233240000888@c.us',
    body: '.menu'
  });

  assert.equal(commandExecuted, true);
});
test('WhatsApp deployers cannot access another deployers bot instance', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  function createInstance(deployerId) {
    const client = new EventEmitter();
    let commandExecuted = false;

    const commandEngine = createMockCommandEngine(async () => {
      commandExecuted = true;
    });

    commandEngine.authorizer = {
      authorize(senderId) {
        const sender = commandEngine.normalizeId(senderId);
        const isDeployer = sender === deployerId;

        return {
          allowed: isDeployer,
          isDeveloper: false,
          isDeployer,
          role: isDeployer ? 'deployer' : 'unauthorized',
          sender
        };
      }
    };

    registerMessageHandler(client, commandEngine);

    return { client, wasExecuted: () => commandExecuted };
  }

  const botA = createInstance('233240000888');
  const botB = createInstance('233240000777');

  await botA.client.listeners('message')[0]({
    fromMe: false,
    author: '233240000777@c.us',
    from: '233240000777@c.us',
    body: '.menu'
  });

  await botB.client.listeners('message')[0]({
    fromMe: false,
    author: '233240000777@c.us',
    from: '233240000777@c.us',
    body: '.menu'
  });

  assert.equal(botA.wasExecuted(), false);
  assert.equal(botB.wasExecuted(), true);
});
test('real NexaBot instances enforce separate deployer identities', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');
  const { createNexaBot } = require('../src');

  function createInstance(deployerId) {
    const client = new EventEmitter();
    const replies = [];

    const commandEngine = createNexaBot({
      developerIds: [],
      deployerId
    });

    registerMessageHandler(client, commandEngine);

    return {
      client,
      replies
    };
  }

  const botA = createInstance('233240000888');
  const botB = createInstance('233240000777');

  const message = {
    fromMe: false,
    author: '233240000777@c.us',
    from: '233240000777@c.us',
    body: '.menu',
    reply: async response => {
      botB.replies.push(response);
    }
  };

  await botA.client.listeners('message')[0]({
    ...message,
    reply: async response => {
      botA.replies.push(response);
    }
  });

  await botB.client.listeners('message')[0](message);

  assert.equal(botA.replies.length, 0);
  assert.equal(botB.replies.length, 1);
  assert.match(botB.replies[0], /menu: This feature is not connected yet/i);
});
test('NexaBot prevents one deployer from using another bot own inbox', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');
  const { createNexaBot } = require('../src');

  const client = new EventEmitter();

  client.info = {
    wid: {
      _serialized: '233240000777@c.us'
    }
  };

  let commandExecuted = false;

  const commandEngine = createNexaBot({
    developerIds: [],
    deployerId: '233240000888'
  });

  const originalHandle = commandEngine.handle.bind(commandEngine);

  commandEngine.handle = async context => {
    commandExecuted = true;
    return originalHandle(context);
  };

  registerMessageHandler(client, commandEngine);

  client.emit('message_create', {
    fromMe: true,
    from: '233240000777@c.us',
    body: '.menu',
    reply: async () => {}
  });

  await new Promise(resolve => setImmediate(resolve));

  assert.equal(commandExecuted, false);
});
test('NexaBot developer has access to every bot instance', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');
  const { createNexaBot } = require('../src');

  function createInstance(deployerId) {
    const client = new EventEmitter();
    const replies = [];

    const commandEngine = createNexaBot({
      developerIds: ['233241234567'],
      deployerId
    });

    registerMessageHandler(client, commandEngine);

    return { client, replies };
  }

  const botA = createInstance('233240000888');
  const botB = createInstance('233240000777');

  const developerMessage = {
    fromMe: false,
    author: '233241234567@c.us',
    from: '233241234567@c.us',
    body: '.menu'
  };

  await botA.client.listeners('message')[0]({
    ...developerMessage,
    reply: async response => botA.replies.push(response)
  });

  await botB.client.listeners('message')[0]({
    ...developerMessage,
    reply: async response => botB.replies.push(response)
  });

  assert.equal(botA.replies.length, 1);
  assert.equal(botB.replies.length, 1);
  assert.match(botA.replies[0], /menu: This feature is not connected yet/i);
  assert.match(botB.replies[0], /menu: This feature is not connected yet/i);
});
test('NexaBot deployer inbox commands stay isolated to their own bot instance', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');
  const { createNexaBot } = require('../src');

  function createInstance(deployerId) {
    const client = new EventEmitter();
    client.info = {
      wid: {
        _serialized: `${deployerId}@c.us`
      }
    };

    const replies = [];
    const commandEngine = createNexaBot({
      developerIds: [],
      deployerId
    });

    registerMessageHandler(client, commandEngine);

    return { client, replies };
  }

  const botA = createInstance('233240000888');
  const botB = createInstance('233240000777');

  botA.client.emit('message_create', {
    fromMe: true,
    from: '233240000888@c.us',
    body: '.menu',
    reply: async response => botA.replies.push(response)
  });

  await new Promise(resolve => setImmediate(resolve));

  assert.equal(botA.replies.length, 1);
  assert.equal(botB.replies.length, 0);
  assert.match(botA.replies[0], /menu: This feature is not connected yet/i);
});
test('NexaBot processes a WhatsApp message through to its final reply', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');
  const { createNexaBot } = require('../src');

  const client = new EventEmitter();
  const replies = [];

  const commandEngine = createNexaBot({
    developerIds: ['233241234567'],
    deployerId: '233240000888'
  });

  registerMessageHandler(client, commandEngine);

  client.emit('message', {
    fromMe: false,
    author: '233241234567@c.us',
    from: '233241234567@c.us',
    body: '.menu',
    reply: async response => replies.push(response)
  });

  await new Promise(resolve => setImmediate(resolve));

  assert.equal(replies.length, 1);
  assert.match(replies[0], /menu: This feature is not connected yet/i);
});
test('NexaBot developer can use commands from their own WhatsApp inbox', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');
  const { createNexaBot } = require('../src');

  const client = new EventEmitter();

  client.info = {
    wid: {
      user: '233241234567',
      _serialized: '233241234567@c.us'
    }
  };

  const replies = [];

  const commandEngine = createNexaBot({
    developerIds: ['233241234567'],
    deployerId: '233240000888'
  });

  registerMessageHandler(client, commandEngine);

  client.emit('message_create', {
    id: { _serialized: 'developer-test-message' },
    fromMe: true,
    from: '233241234567@c.us',
    to: '233241234567@c.us',
    body: '.menu',
    reply: async response => replies.push(response)
  });

  await new Promise(resolve => setImmediate(resolve));

  assert.equal(replies.length, 1);
  assert.match(replies[0], /menu: This feature is not connected yet/i);
});
test('NexaBot deployer can use commands from their own WhatsApp inbox', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');
  const { createNexaBot } = require('../src');

  const client = new EventEmitter();

  client.info = {
    wid: {
      user: '233240000888',
      _serialized: '233240000888@c.us'
    }
  };

  const replies = [];

  const commandEngine = createNexaBot({
    developerIds: [],
    deployerId: '233240000888'
  });

  registerMessageHandler(client, commandEngine);

  client.emit('message_create', {
    id: { _serialized: 'deployer-test-message' },
    fromMe: true,
    from: '233240000888@c.us',
    to: '233240000888@c.us',
    body: '.menu',
    reply: async response => replies.push(response)
  });

  await new Promise(resolve => setImmediate(resolve));

  assert.equal(replies.length, 1);
  assert.match(replies[0], /menu: This feature is not connected yet/i);
});
test('NexaBot rejects spoofed deployer identity in an unauthorized inbox', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');
  const { createNexaBot } = require('../src');

  const client = new EventEmitter();

  client.info = {
    wid: {
      _serialized: '233240000999@c.us'
    }
  };

  let commandExecuted = false;

  const commandEngine = createNexaBot({
    developerIds: [],
    deployerId: '233240000888'
  });

  const originalHandle = commandEngine.handle.bind(commandEngine);

  commandEngine.handle = async context => {
    commandExecuted = true;
    return originalHandle(context);
  };

  registerMessageHandler(client, commandEngine);

  client.emit('message_create', {
    fromMe: true,
    from: '233240000999@c.us',
    author: '233240000888@c.us',
    body: '.menu',
    reply: async () => {}
  });

  await new Promise(resolve => setImmediate(resolve));

  assert.equal(commandExecuted, false);
});
test('NexaBot ignores spoofed developer metadata in an unauthorized inbox', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  const client = new EventEmitter();

  client.info = {
    wid: {
      _serialized: '233240000999@c.us'
    }
  };

  let commandExecuted = false;

  const commandEngine = createMockCommandEngine(async () => {
    commandExecuted = true;
  });

  registerMessageHandler(client, commandEngine);

  client.emit('message_create', {
    fromMe: true,
    from: '233240000999@c.us',
    author: '233241234567@c.us',
    body: '.menu',
    reply: async () => {}
  });

  await new Promise(resolve => setImmediate(resolve));

  assert.equal(commandExecuted, false);
});
test('NexaBot blocks unauthorized users from executing commands in their own inbox', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  const client = new EventEmitter();

  client.info = {
    wid: {
      _serialized: '233240000999@c.us'
    }
  };

  let commandExecuted = false;

  const commandEngine = createMockCommandEngine(async () => {
    commandExecuted = true;
  });

  registerMessageHandler(client, commandEngine);

  client.emit('message_create', {
    id: { _serialized: 'unauthorized-inbox-test' },
    fromMe: true,
    from: '233240000999@c.us',
    body: '.menu',
    reply: async () => {}
  });

  await new Promise(resolve => setImmediate(resolve));

  assert.equal(commandExecuted, false);
});
test('NexaBot ignores its own generated replies to prevent infinite loops', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  const client = new EventEmitter();

  client.info = {
    wid: {
      _serialized: '233240000888@c.us'
    }
  };

  let commandCalls = 0;

  const commandEngine = {
    authorizer: {
      authorize: () => ({ allowed: true })
    },
    handle: async context => {
      commandCalls++;
      await context.reply('Bot response');
    }
  };

  registerMessageHandler(client, commandEngine);

  client.emit('message_create', {
    id: { _serialized: 'loop-test-message' },
    fromMe: true,
    from: '233240000888@c.us',
    body: '.test',
    reply: async response => {
      const sentMessage = {
        id: { _serialized: 'bot-generated-reply' },
        fromMe: true,
        from: '233240000888@c.us',
        body: response,
        reply: async () => {}
      };

      client.emit('message_create', sentMessage);

      return sentMessage;
    }
  });

  await new Promise(resolve => setImmediate(resolve));

  assert.equal(commandCalls, 1);
});

test('NexaBot does not suppress a genuine message matching a pending bot reply', async () => {
  const { EventEmitter } = require('node:events');
  const { registerMessageHandler } = require('../src/whatsapp');

  const client = new EventEmitter();

  client.info = {
    wid: {
      _serialized: '233240000888@c.us'
    }
  };

  const handledMessages = [];
  let resolveReply;

  const commandEngine = {
    authorizer: {
      authorize: () => ({ allowed: true })
    },
    handle: async context => {
      handledMessages.push(context.message.id._serialized);

      if (context.text === '.test') {
        await context.reply('Bot response');
      }
    }
  };

  registerMessageHandler(client, commandEngine);

  client.emit('message_create', {
    id: { _serialized: 'original-command' },
    fromMe: true,
    from: '233240000888@c.us',
    body: '.test',
    reply: () => new Promise(resolve => {
      resolveReply = resolve;
    })
  });

  await new Promise(resolve => setImmediate(resolve));

  client.emit('message_create', {
    id: { _serialized: 'genuine-message' },
    fromMe: true,
    from: '233240000888@c.us',
    body: 'Bot response',
    reply: async () => {}
  });

  client.emit('message_create', {
    id: { _serialized: 'bot-generated-reply' },
    fromMe: true,
    from: '233240000888@c.us',
    body: 'Bot response',
    reply: async () => {}
  });

  resolveReply({
    id: { _serialized: 'bot-generated-reply' }
  });

  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(handledMessages, [
    'original-command',
    'genuine-message'
  ]);
});
test('startWhatsApp initializes the client and registers handlers', async () => {
  const { EventEmitter } = require('node:events');
  const Module = require('node:module');

  let initialized = false;

  class MockClient extends EventEmitter {
    async initialize() {
      initialized = true;
    }
  }

  class MockLocalAuth {
    constructor(options) {
      this.options = options;
    }
  }

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return {
        Client: MockClient,
        LocalAuth: MockLocalAuth
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  const client = await startWhatsApp({
    commandEngine: {
      handle: async () => {},
      authorizer: {
        authorize: () => ({ allowed: true })
      }
    }
  });

  assert.ok(client instanceof MockClient);
  assert.equal(initialized, true);
  assert.equal(client.listenerCount('qr'), 1);
  assert.equal(client.listenerCount('ready'), 1);
  assert.equal(client.listenerCount('message'), 1);
});
test('startWhatsApp reports initialization errors and rethrows them', async () => {
  const { EventEmitter } = require('node:events');
  const Module = require('node:module');

  const startupError = new Error('WhatsApp initialization failed');

  class MockClient extends EventEmitter {
    async initialize() {
      throw startupError;
    }
  }

  class MockLocalAuth {}

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return {
        Client: MockClient,
        LocalAuth: MockLocalAuth
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  let reportedError;

  await assert.rejects(
    startWhatsApp({
      commandEngine: {
        handle: async () => {},
        authorizer: {
          authorize: () => ({ allowed: true })
        }
      },
      onError: error => {
        reportedError = error;
      }
    }),
    error => error === startupError
  );

  assert.equal(reportedError, startupError);
});
test('startWhatsApp preserves startup errors when onError throws', async () => {
  const { EventEmitter } = require('node:events');
  const Module = require('node:module');

  const startupError = new Error('WhatsApp initialization failed');

  class MockClient extends EventEmitter {
    async initialize() {
      throw startupError;
    }
  }

  class MockLocalAuth {}

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return {
        Client: MockClient,
        LocalAuth: MockLocalAuth
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  await assert.rejects(
    startWhatsApp({
      commandEngine: {
        handle: async () => {},
        authorizer: {
          authorize: () => ({ allowed: true })
        }
      },
      onError: () => {
        throw new Error('Error callback failed');
      }
    }),
    error => error === startupError
  );
});
test('startWhatsApp rejects an invalid command engine', async () => {
  const Module = require('node:module');

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  let clientCreated = false;

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return {
        Client: class {
          constructor() {
            clientCreated = true;
          }
        },
        LocalAuth: class {}
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  await assert.rejects(
    startWhatsApp({ commandEngine: {} }),
    /Invalid command engine/
  );

  assert.equal(clientCreated, false);
});
test('startWhatsApp rejects a missing command engine', async () => {
  const Module = require('node:module');

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  let clientCreated = false;

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return {
        Client: class {
          constructor() {
            clientCreated = true;
          }
        },
        LocalAuth: class {}
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  await assert.rejects(
    startWhatsApp(),
    /Invalid command engine/
  );

  assert.equal(clientCreated, false);
});
test('startWhatsApp rejects a command engine without a handle function', async () => {
  const Module = require('node:module');

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  let clientCreated = false;

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return {
        Client: class {
          constructor() {
            clientCreated = true;
          }
        },
        LocalAuth: class {}
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  await assert.rejects(
    startWhatsApp({ commandEngine: { handle: null } }),
    /Invalid command engine/
  );

  assert.equal(clientCreated, false);
});
test('startWhatsApp calls onReady when WhatsApp becomes ready', async () => {
  const { EventEmitter } = require('node:events');
  const Module = require('node:module');

  class MockClient extends EventEmitter {
    async initialize() {}
  }

  class MockLocalAuth {}

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return {
        Client: MockClient,
        LocalAuth: MockLocalAuth
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  let readyCalled = false;

  const client = await startWhatsApp({
    commandEngine: {
      handle: async () => {},
      authorizer: {
        authorize: () => ({ allowed: true })
      }
    },
    onReady: () => {
      readyCalled = true;
    }
  });

  assert.equal(readyCalled, false);

  client.emit('ready');

  assert.equal(readyCalled, true);
});
test('startWhatsApp forwards QR codes to the onQR callback', async () => {
  const { EventEmitter } = require('node:events');
  const Module = require('node:module');

  class MockClient extends EventEmitter {
    async initialize() {}
  }

  class MockLocalAuth {}

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return {
        Client: MockClient,
        LocalAuth: MockLocalAuth
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  let receivedQR = null;

  const client = await startWhatsApp({
    commandEngine: {
      handle: async () => {},
      authorizer: {
        authorize: () => ({ allowed: true })
      }
    },
    onQR: qr => {
      receivedQR = qr;
    }
  });

  const testQR = 'NEXABOT-TEST-QR-CODE';

  client.emit('qr', testQR);

  assert.equal(receivedQR, testQR);
});
test('startWhatsApp calls onAuthenticated when WhatsApp authenticates', async () => {
  const { EventEmitter } = require('node:events');
  const Module = require('node:module');

  class MockClient extends EventEmitter {
    async initialize() {}
  }

  class MockLocalAuth {}

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return {
        Client: MockClient,
        LocalAuth: MockLocalAuth
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  let authenticated = false;

  const client = await startWhatsApp({
    commandEngine: {
      handle: async () => {},
      authorizer: {
        authorize: () => ({ allowed: true })
      }
    },
    onAuthenticated: () => {
      authenticated = true;
    }
  });

  assert.equal(authenticated, false);

  client.emit('authenticated');

  assert.equal(authenticated, true);
});
test('startWhatsApp calls onAuthFailure when authentication fails', async () => {
  const { EventEmitter } = require('node:events');
  const Module = require('node:module');

  class MockClient extends EventEmitter {
    async initialize() {}
  }

  class MockLocalAuth {}

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return {
        Client: MockClient,
        LocalAuth: MockLocalAuth
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  let receivedFailure = null;

  const client = await startWhatsApp({
    commandEngine: {
      handle: async () => {},
      authorizer: {
        authorize: () => ({ allowed: true })
      }
    },
    onAuthFailure: message => {
      receivedFailure = message;
    }
  });

  const testMessage = 'Authentication failed';

  client.emit('auth_failure', testMessage);

  assert.equal(receivedFailure, testMessage);
});
test('startWhatsApp calls onDisconnected when WhatsApp disconnects', async () => {
  const { EventEmitter } = require('node:events');
  const Module = require('node:module');

  class MockClient extends EventEmitter {
    async initialize() {}
  }

  class MockLocalAuth {}

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return {
        Client: MockClient,
        LocalAuth: MockLocalAuth
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  let receivedReason = null;

  const client = await startWhatsApp({
    commandEngine: {
      handle: async () => {},
      authorizer: {
        authorize: () => ({ allowed: true })
      }
    },
    onDisconnected: reason => {
      receivedReason = reason;
    }
  });

  const testReason = 'Connection closed';

  client.emit('disconnected', testReason);

  assert.equal(receivedReason, testReason);
});
test('startWhatsApp handles lifecycle events in the correct order', async () => {
  const { EventEmitter } = require('node:events');
  const Module = require('node:module');

  class MockClient extends EventEmitter {
    async initialize() {}
  }

  class MockLocalAuth {}

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return {
        Client: MockClient,
        LocalAuth: MockLocalAuth
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  const events = [];

  const client = await startWhatsApp({
    commandEngine: {
      handle: async () => {},
      authorizer: {
        authorize: () => ({ allowed: true })
      }
    },
    onQR: () => events.push('qr'),
    onAuthenticated: () => events.push('authenticated'),
    onReady: () => events.push('ready'),
    onDisconnected: () => events.push('disconnected')
  });

  client.emit('qr', 'test-qr-code');
  client.emit('authenticated');
  client.emit('ready');
  client.emit('disconnected', 'Connection closed');

  assert.deepEqual(events, [
    'qr',
    'authenticated',
    'ready',
    'disconnected'
  ]);
});
test('startWhatsApp keeps the message handler active after ready', async () => {
  const { EventEmitter } = require('node:events');
  const Module = require('node:module');

  class MockClient extends EventEmitter {
    async initialize() {}
  }

  class MockLocalAuth {}

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return {
        Client: MockClient,
        LocalAuth: MockLocalAuth
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  const receivedMessages = [];

  const client = await startWhatsApp({
    commandEngine: {
    handle: async input => {
  receivedMessages.push(input.text);
},  
      
      authorizer: {
        authorize: () => ({ allowed: true })
      }
    }
  });

  client.emit('ready');

  const message = {
    from: '233241234567@c.us',
    body: 'Hello NexaBot',
    fromMe: false,
    reply: async () => {}
  };

  client.emit('message', message);

  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(receivedMessages, ['Hello NexaBot']);
});
test('startWhatsApp handles messages received before ready', async () => {
  const { EventEmitter } = require('node:events');
  const Module = require('node:module');

  class MockClient extends EventEmitter {
    async initialize() {}
  }

  class MockLocalAuth {}

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return {
        Client: MockClient,
        LocalAuth: MockLocalAuth
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  const receivedMessages = [];

  const client = await startWhatsApp({
    commandEngine: {
      handle: async input => {
        receivedMessages.push(input.text);
      },
      authorizer: {
        authorize: () => ({ allowed: true })
      }
    }
  });

  client.emit('message', {
    from: '233241234567@c.us',
    body: 'Message before ready',
    fromMe: false,
    reply: async () => {}
  });

  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(receivedMessages, ['Message before ready']);
});
test('startWhatsApp processes multiple incoming messages in quick succession', async () => {
  const { EventEmitter } = require('node:events');
  const Module = require('node:module');

  class MockClient extends EventEmitter {
    async initialize() {}
  }

  class MockLocalAuth {}

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return {
        Client: MockClient,
        LocalAuth: MockLocalAuth
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  const receivedMessages = [];

  const client = await startWhatsApp({
    commandEngine: {
      handle: async input => {
        receivedMessages.push(input.text);
      },
      authorizer: {
        authorize: () => ({ allowed: true })
      }
    }
  });

  for (const body of ['First message', 'Second message', 'Third message']) {
    client.emit('message', {
      from: '233241234567@c.us',
      body,
      fromMe: false,
      reply: async () => {}
    });
  }

  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(receivedMessages, [
    'First message',
    'Second message',
    'Third message'
  ]);
});
test('startWhatsApp destroys the client when initialization fails', async () => {
  const { EventEmitter } = require('node:events');
  const Module = require('node:module');

  let destroyCount = 0;

  class MockClient extends EventEmitter {
    async initialize() {
      throw new Error('Initialization failed');
    }

    async destroy() {
      destroyCount++;
    }
  }

  class MockLocalAuth {}

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return {
        Client: MockClient,
        LocalAuth: MockLocalAuth
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  await assert.rejects(
    startWhatsApp({
      commandEngine: {
        handle: async () => {},
        authorizer: {
          authorize: () => ({ allowed: true })
        }
      }
    }),
    { message: 'Initialization failed' }
  );

  assert.equal(destroyCount, 1);
});
test('startWhatsApp preserves the initialization error when client cleanup fails', async () => {
  const { EventEmitter } = require('node:events');
  const Module = require('node:module');

  class MockClient extends EventEmitter {
    async initialize() {
      throw new Error('Initialization failed');
    }

    async destroy() {
      throw new Error('Cleanup failed');
    }
  }

  class MockLocalAuth {}

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return {
        Client: MockClient,
        LocalAuth: MockLocalAuth
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  let cleanupError;
  let reportedError;

  await assert.rejects(
    startWhatsApp({
      commandEngine: {
        handle: async () => {},
        authorizer: {
          authorize: () => ({ allowed: true })
        }
      },
      onCleanupError: error => {
        cleanupError = error;
      },
      onError: error => {
        reportedError = error;
      }
    }),
    { message: 'Initialization failed' }
  );

  assert.equal(cleanupError?.message, 'Cleanup failed');
  assert.equal(reportedError?.message, 'Initialization failed');
});
test('startWhatsApp preserves initialization error when onError callback fails', async () => {
  const { EventEmitter } = require('node:events');
  const Module = require('node:module');

  class MockClient extends EventEmitter {
    async initialize() {
      throw new Error('Initialization failed');
    }

    async destroy() {}
  }

  class MockLocalAuth {}

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return { Client: MockClient, LocalAuth: MockLocalAuth };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  await assert.rejects(
    startWhatsApp({
      commandEngine: {
        handle: async () => {},
        authorizer: {
          authorize: () => ({ allowed: true })
        }
      },
      onError: () => {
        throw new Error('Error handler failed');
      }
    }),
    { message: 'Initialization failed' }
  );
});
test('startWhatsApp handles initialization failure when destroy is unavailable', async () => {
  const { EventEmitter } = require('node:events');
  const Module = require('node:module');

  class MockClient extends EventEmitter {
    async initialize() {
      throw new Error('Initialization failed');
    }
  }

  class MockLocalAuth {}

  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/whatsapp');

  delete require.cache[modulePath];

  Module._load = function (request, parent, isMain) {
    if (request === 'whatsapp-web.js') {
      return { Client: MockClient, LocalAuth: MockLocalAuth };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let startWhatsApp;

  try {
    ({ startWhatsApp } = require('../src/whatsapp'));
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }

  await assert.rejects(
    startWhatsApp({
      commandEngine: {
        handle: async () => {},
        authorizer: {
          authorize: () => ({ allowed: true })
        }
      }
    }),
    { message: 'Initialization failed' }
  );
});
