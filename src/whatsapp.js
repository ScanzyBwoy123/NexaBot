'use strict';

const path = require('node:path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { createIdentityResolver } = require('./core/identityResolver');
function createWhatsAppClient(options = {}) {
  const authDir = path.resolve(
    options.authDir ||
    process.env.NEXABOT_AUTH_DIR ||
    '.nexabot-auth'
  );

  const clientId = options.clientId || 'nexabot';

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId,
      dataPath: authDir
    }),

    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    }
  });

  return client;
}

function registerWhatsAppEvents(client, handlers = {}) {
  client.on('qr', qr => {
    handlers.onQR?.(qr);
  });

  client.on('authenticated', () => {
    handlers.onAuthenticated?.();
  });

  client.on('ready', () => {
    handlers.onReady?.();
  });

  client.on('auth_failure', message => {
    handlers.onAuthFailure?.(message);
  });

  client.on('disconnected', reason => {
    handlers.onDisconnected?.(reason);
  });

  return client;
}
function registerMessageHandler(client, commandEngine, handlers = {}) {
  if (!client || typeof client.on !== 'function') {
    throw new Error('Invalid WhatsApp client.');
  }

  if (!commandEngine || typeof commandEngine.handle !== 'function') {
    throw new Error('Invalid command engine.');
  }

  const identityResolver =
    typeof client.getContactLidAndPhone === 'function'
      ? createIdentityResolver(client)
      : null;

  client.on('message', async message => {
    if (!message || message.fromMe) {
      return;
    }

    const senderId = message.author || message.from;

    if (!senderId || typeof message.body !== 'string') {
      return;
    }

    try {
      let commandSenderId = senderId;

      if (
        typeof senderId === 'string' &&
        senderId.toLowerCase().endsWith('@lid') &&
        identityResolver
      ) {
        const resolved = await identityResolver.resolve(senderId);

        if (resolved) {
          commandSenderId = resolved.pn;
        }
      }
            const normalizedSender = commandEngine.normalizeId(commandSenderId);

      const isDeveloper =
        normalizedSender &&
        commandEngine.developerIds.has(normalizedSender);

      const isDeployer =
  normalizedSender &&
  normalizedSender === commandEngine.deployerId;
      // Reject all interactions from unauthorized users.
      if (!isDeveloper && !isDeployer) {
        return;
      }
      await commandEngine.handle({
        text: message.body,
        senderId: commandSenderId,
        originalSenderId: senderId,
        chatId: message.from,
        message,
        reply: async response => message.reply(response)
      });
    } catch (error) {
      if (typeof handlers.onError === 'function') {
        try {
          handlers.onError(error, message);
        } catch {
          // Prevent error-handler failures from escaping.
        }
      }
    }
  });

  return client;
}
module.exports = {
  createWhatsAppClient,
  registerWhatsAppEvents,
  registerMessageHandler
};
