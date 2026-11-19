'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

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
