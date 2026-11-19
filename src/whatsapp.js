'use strict';

const path = require('node:path');
const { Client, LocalAuth } = require('whatsapp-web.js');

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

module.exports = {
  createWhatsAppClient,
  registerWhatsAppEvents
};
