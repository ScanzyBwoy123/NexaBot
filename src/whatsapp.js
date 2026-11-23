'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const puppeteer = require('puppeteer');
const { execFileSync, execSync } = require('node:child_process');

try {
  const processes = fs.readdirSync('/proc')
    .filter(name => /^\d+$/.test(name))
    .map(pid => {
      try {
        return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8')
          .replace(/\0/g, ' ')
          .trim();
      } catch {
        return '';
      }
    })
    .filter(command => /chromium|chrome/i.test(command));

  console.log('[Diagnostics] Chromium processes:', processes);
} catch (error) {
  console.log('[Diagnostics] Process check failed:', error.message);
}
try {
  console.log(
    '[Diagnostics] Chromium version:',
    execFileSync(
      process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/lib/chromium/chromium',
      ['--version'],
      { encoding: 'utf8' }
    ).trim()
  );
} catch (error) {
  console.error('[Diagnostics] Chromium version check failed:', error.message);
}
const { createIdentityResolver } = require('./core/identityResolver');
function createWhatsAppClient(options = {}) {
  const authDir = path.resolve(
    options.authDir ||
    process.env.NEXABOT_AUTH_DIR ||
    '.nexabot-auth'
  );
const clientId = options.clientId || 'nexabot';

const profileDir = path.join(authDir, `session-${clientId}`);

const lockFiles = [
  'SingletonLock',
  'SingletonSocket',
  'SingletonCookie'
];

console.log('[Diagnostics] Auth directory:', authDir);
console.log('[Diagnostics] Client ID:', clientId);
console.log('[Diagnostics] Expected Chromium profile:', profileDir);

for (const file of lockFiles) {
  console.log(
    `[Diagnostics] ${file}:`,
    fs.existsSync(path.join(profileDir, file)) ? 'EXISTS' : 'NOT FOUND'
  );
}
for (const file of lockFiles) {
  console.log(
    `[Diagnostics] ${file}:`,
    fs.existsSync(path.join(profileDir, file)) ? 'EXISTS' : 'NOT FOUND'
  );
}
  const client = new Client({
    authTimeoutMs: 120000,
    authStrategy: new LocalAuth({
      clientId,
      dataPath: authDir
    }),
    puppeteer: {
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  headless: true,
    dumpio: true,
      args: [
  '--headless=new',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu'
]
    }
  });

  return client;
}

function registerWhatsAppEvents(client, handlers = {}) {
   client.on('loading_screen', (percent, message) => {
    console.log('[WhatsApp] Loading screen:', {
      percent,
      message
    });
  });

  client.on('change_state', state => {
    console.log('[WhatsApp] Connection state changed:', state);
  }); 
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
const authDir = path.resolve(
  options.authDir ||
  process.env.NEXABOT_AUTH_DIR ||
  '.nexabot-auth'
);
const clientId = options.clientId || 'nexabot';
const profileDir = path.join(authDir, `session-${clientId}`);

  registerWhatsAppEvents(client, options);
  registerMessageHandler(client, commandEngine, options);
  client.on('remote_session_saved', () => {
    console.log('[WhatsApp] Remote session saved');
  });

  client.on('loading_screen', (percent, message) => {
    console.log('[WhatsApp] Page loading:', percent, message);
  });

  client.on('error', error => {
    console.error('[WhatsApp] Client error:', error);
  });
      console.log('[WhatsApp] Starting client.initialize()');

  try {
    await client.initialize();
    console.log('[WhatsApp] client.initialize() completed');
  } catch (error) {
    console.log('[Diagnostics] Profile directory exists:', fs.existsSync(profileDir));
console.log('[Diagnostics] Profile directory contents:',
  fs.existsSync(profileDir) ? fs.readdirSync(profileDir) : 'Directory missing'
);

try {
  const processes = fs.readdirSync('/proc')
    .filter(name => /^\d+$/.test(name))
    .map(pid => {
      try {
        return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8')
          .replace(/\0/g, ' ')
          .trim();
      } catch {
        return '';
      }
    })
    .filter(command => /chromium|chrome/i.test(command));

  console.log(
  '[Diagnostics] Chromium process count:',
  processes.length,
  'Details:',
  JSON.stringify(processes).slice(0, 3000)
);
} catch (processError) {
  console.log('[Diagnostics] Process check failed:', processError.message);
}
    console.error('[WhatsApp] client.initialize() failed:', {
      errorType: typeof error,
      errorValue: error,
      errorMessage: error?.message,
      errorStack: error?.stack
    });
    try {
      if (typeof client.destroy === 'function') {
        await Promise.race([
  client.destroy(),
  new Promise(resolve => setTimeout(resolve, 10000))
]);
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
