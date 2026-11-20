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

  const pendingBotReplies = new Map();

  async function processMessage(message, isOutgoing = false) {
    if (!message || typeof message.body !== 'string') {
      return;
    }

    if (isOutgoing && !message.fromMe) {
      return;
    }

    if (!isOutgoing && message.fromMe) {
      return;
    }

    const chatId = message.from;

    const senderId = isOutgoing
      ? client.info?.wid?._serialized
      : message.author || message.from;

    if (!senderId) {
      return;
    }

    const replyKey = `${chatId}:${message.body}`;

    if (isOutgoing && pendingBotReplies.has(replyKey)) {
      const timer = pendingBotReplies.get(replyKey);
      clearTimeout(timer);
      pendingBotReplies.delete(replyKey);
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

      const access = commandEngine.authorizer?.authorize(commandSenderId);

      if (!access || !access.allowed) {
        return;
      }

      await commandEngine.handle({
        text: message.body,
        senderId: commandSenderId,
        originalSenderId: senderId,
        chatId,
        message,
        reply: async response => {
          const key = `${chatId}:${response}`;

          const timer = setTimeout(() => {
            pendingBotReplies.delete(key);
          }, 15000);

          pendingBotReplies.set(key, timer);

          try {
            return await message.reply(response);
          } catch (error) {
            clearTimeout(timer);
            pendingBotReplies.delete(key);
            throw error;
          }
        }
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
  }

  client.on('message', message => {
    void processMessage(message, false);
  });

  client.on('message_create', message => {
    void processMessage(message, true);
  });

  return client;
}
async function startWhatsApp(options = {}) {
  const commandEngine = options.commandEngine;

  if (!commandEngine || typeof commandEngine.handle !== 'function') {
    throw new Error('Invalid command engine.');
  }

  const client = createWhatsAppClient(options);

  registerWhatsAppEvents(client, options);
  registerMessageHandler(client, commandEngine, options);

  try {
    await client.initialize();
  } catch (error) {
    if (typeof options.onError === 'function') {
      try {
        options.onError(error);
      } catch {
        // Prevent error-handler failures from escaping.
      }
    }

    throw error;
  }

  return client;
}
module.exports = {
  createWhatsAppClient,
  registerWhatsAppEvents,
    registerMessageHandler,
  startWhatsApp
};
