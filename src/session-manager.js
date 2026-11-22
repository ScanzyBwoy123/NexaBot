'use strict';

const path = require('node:path');

function createSessionManager(options = {}) {
  const startWhatsApp = options.startWhatsApp;

  if (typeof startWhatsApp !== 'function') {
    throw new Error('startWhatsApp function is required.');
  }

  const authRootDir = path.resolve(
    options.authRootDir ||
    process.env.NEXABOT_AUTH_DIR ||
    '.nexabot-auth'
  );

  const sessions = new Map();

  function validateAccountId(accountId) {
    if (
      typeof accountId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountId)
    ) {
      throw new Error('Invalid account ID.');
    }
  }

  async function startSession(options = {}) {
    const { accountId, phoneNumber } = options;

    validateAccountId(accountId);

    if (sessions.has(accountId)) {
      throw new Error('Session already exists.');
    }

    const session = {
  accountId,
  client: null,
  startPromise: null,
  status: 'starting',
    createdAt: new Date().toISOString(),
  stopping: false
};

    sessions.set(accountId, session);

    try {
      session.startPromise = startWhatsApp({
        commandEngine: options.commandEngine,
        clientId: `nexabot-${accountId}`,
        authDir: path.join(authRootDir, accountId),

               onQR: () => {
          if (!session.stopping) {
            session.status = 'waiting_for_pairing';
          }
        },

        onCode: () => {
          if (!session.stopping) {
            session.status = 'waiting_for_pairing';
          }
        },

        onAuthenticated: () => {
          if (!session.stopping) {
            session.status = 'authenticated';
          }
        },

        onReady: () => {
          if (!session.stopping) {
            session.status = 'connected';
          }
        },
       });
        onAuthFailure: () => {
          if (!session.stopping) {
            session.status = 'auth_failed';
          }
        },

        onDisconnected: () => {
          if (!session.stopping) {
            session.status = 'disconnected';
          }
        } 
      const client = await session.startPromise;
      session.client = client;

      return {
        accountId,
        status: session.status
      };
    } catch (error) {
      sessions.delete(accountId);
      throw error;
    }
  }

  function getSession(accountId) {
    validateAccountId(accountId);

    const session = sessions.get(accountId);

    if (!session) {
      return null;
    }

    return {
      accountId: session.accountId,
      status: session.status,
      createdAt: session.createdAt
    };
  }

  function getClient(accountId) {
    validateAccountId(accountId);

    return sessions.get(accountId)?.client || null;
  }

  
async function stopSession(accountId) {
  validateAccountId(accountId);

  const session = sessions.get(accountId);

  if (!session) {
    return false;
  }

  // Reuse an ongoing shutdown instead of destroying the client twice.
  if (session.stopPromise) {
    return session.stopPromise;
  }

  session.stopPromise = (async () => {
    if (session.startPromise) {
      try {
        session.client = await session.startPromise;
      } catch {
        sessions.delete(accountId);
        return true;
      }
    }

    try {
      if (session.client && typeof session.client.destroy === 'function') {
        await session.client.destroy();
      }
    } finally {
      sessions.delete(accountId);
    }

    return true;
  })();

  return session.stopPromise;
}
  return {
    startSession,
    getSession,
    getClient,
    stopSession
  };
}

module.exports = { createSessionManager };
