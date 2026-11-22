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
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
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
  client.on('code', code => {
    handlers.onCode?.(code);
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

  const suppressedMessageIds = new Set();
  const suppressedTimers = new Map();

  let pendingReplyCount = 0;
  const bufferedOutgoingMessages = [];

  function rememberSuppressedMessage(messageId) {
    if (!messageId) {
      return;
    }

    suppressedMessageIds.add(messageId);

    const timer = setTimeout(() => {
      suppressedMessageIds.delete(messageId);
      suppressedTimers.delete(messageId);
    }, 60000);

    suppressedTimers.set(messageId, timer);
  }

  function isSuppressedMessage(message) {
    const messageId = message?.id?._serialized;

    if (!messageId || !suppressedMessageIds.has(messageId)) {
      return false;
    }

    suppressedMessageIds.delete(messageId);

    const timer = suppressedTimers.get(messageId);

    if (timer) {
      clearTimeout(timer);
      suppressedTimers.delete(messageId);
    }

    return true;
  }

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
          pendingReplyCount++;

          try {
            const sentMessage = await message.reply(response);

            const sentMessageId = sentMessage?.id?._serialized;

            if (sentMessageId) {
              rememberSuppressedMessage(sentMessageId);
            }

            return sentMessage;
          } finally {
            pendingReplyCount--;

            if (pendingReplyCount === 0) {
              const buffered = bufferedOutgoingMessages.splice(0);

              for (const outgoingMessage of buffered) {
                if (!isSuppressedMessage(outgoingMessage)) {
                  void processMessage(outgoingMessage, true);
                }
              }
            }
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
    return processMessage(message, false);
  });

  client.on('message_create', message => {
    if (!message || !message.fromMe) {
      return;
    }

    if (pendingReplyCount > 0) {
      bufferedOutgoingMessages.push(message);
      return;
    }

    if (isSuppressedMessage(message)) {
      return;
    }

    return processMessage(message, true);
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
    try {
      if (typeof client.destroy === 'function') {
        await client.destroy();
      }
    } catch (cleanupError) {
      if (typeof options.onCleanupError === 'function') {
        try {
          options.onCleanupError(cleanupError);
        } catch {
          // Prevent cleanup-handler failures from escaping.
        }
      }
    }

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
async function requestPairingCode(client, phoneNumber) {
  if (!client || typeof client.requestPairingCode !== 'function') {
    throw new Error('WhatsApp client is not ready.');
  }

  const normalizedNumber = String(phoneNumber || '').replace(/\D/g, '');

  if (!/^[1-9]\d{7,14}$/.test(normalizedNumber)) {
    throw new Error('Invalid international phone number.');
  }

  return client.requestPairingCode(normalizedNumber, true);
}
module.exports = {
  createWhatsAppClient,
  registerWhatsAppEvents,
  registerMessageHandler,
  startWhatsApp,
  requestPairingCode
};
