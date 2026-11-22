'use strict';

const http = require('node:http');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createNexaBot } = require('./index');
const {
  createSupabaseClient,
  verifySupabaseConnection
} = require('./supabase');
const { createAccountService } = require('./accounts');
const { createSupabaseAuth } = require('./supabase-auth');
function safeTokenMatch(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') {
    return false;
  }

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}
const { startWhatsApp, requestPairingCode } = require('./whatsapp');
const { createSessionManager } = require('./session-manager');
async function verifyPersistentStorage() {
  const storageDir = process.env.NEXABOT_AUTH_DIR || '.nexabot-auth';
  const markerPath = `${storageDir}/.nexabot-volume-check`;
  const markerContent = 'NexaBot persistent storage verified';

  await fs.promises.mkdir(storageDir, { recursive: true });

  try {
    const existing = await fs.promises.readFile(markerPath, 'utf8');

    if (existing !== markerContent) {
      throw new Error('Storage marker content does not match.');
    }

    return 'verified';
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }

    await fs.promises.writeFile(markerPath, markerContent, {
      flag: 'wx'
    });

    return 'created';
  }
}
function validateConfiguration(options = {}) {
  const developerIds = (process.env.DEVELOPER_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  const deployerId = (process.env.DEPLOYER_ID || '').trim();
  const port = options.port ?? Number(process.env.PORT || 3000);

  if (developerIds.length === 0) {
    throw new Error('DEVELOPER_IDS must be configured.');
  }

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('Invalid server port.');
  }

  return { developerIds, deployerId, port };
}
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk;

      if (body.length > 1024) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });

    req.on('error', reject);
  });
}

function createRequestHandler(options = {}) {
      const supabaseAuth =
    options.supabase?.auth &&
    typeof options.supabase.auth.getUser === 'function'
      ? createSupabaseAuth(options.supabase)
      : null;
  const pairingAttempts = new Map();
  const failedPairingCooldowns = new Map();
  const failedPairingCooldownMs = 60 * 1000;
  const pairingWindowMs = 10 * 60 * 1000;
  const maxPairingAttempts = 3;
    const allowedOrigin = 'https://scanzybwoy123.github.io';

  function applyCors(req, res) {
    const origin = req.headers.origin;

    if (origin === allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type'
      );
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(origin === allowedOrigin ? 204 : 403);
      res.end();
      return true;
    }

    return false;
  }
  return async (req, res) => {
   try {
     if (applyCors(req, res)) return;
     const requestPath = new URL(req.url, 'http://localhost').pathname.replace(/\/+$/, '') || '/';

      if (req.method === 'GET' && requestPath === '/health') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        });

        res.end(JSON.stringify({
          success: true,
          status: 'healthy',
          service: 'NexaBot'
        }));

        return;
      }
      if (req.method === 'POST' && requestPath === '/session/start') {
  const sendJson = (status, data) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(data));
  };

  if (!supabaseAuth || !options.supabase) {
    sendJson(503, {
      success: false,
      error: 'Authentication service is unavailable.'
    });
    return;
  }

  if (!options.sessionManager || !options.commandEngine) {
    sendJson(503, {
      success: false,
      error: 'Session service is unavailable.'
    });
    return;
  }

  const authorization = req.headers.authorization || '';
  const accessToken = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';

  const user = await supabaseAuth.verifyAccessToken(accessToken);

  if (!user) {
    sendJson(401, {
      success: false,
      error: 'Unauthorized'
    });
    return;
  }

  const accountService = createAccountService(options.supabase);
  const account = await accountService.getAccountForUser(user.id);

  if (!account) {
    sendJson(404, {
      success: false,
      error: 'NexaBot account not found.'
    });
    return;
  }

  const existingSession = options.sessionManager.getSession(account.id);

  if (existingSession) {
    sendJson(200, {
      success: true,
      session: existingSession
    });
    return;
  }

  const session = await options.sessionManager.startSession({
    accountId: account.id,
    phoneNumber: account.phoneNumber,
    commandEngine: options.commandEngine
  });

  sendJson(202, {
    success: true,
    session
  });
  return;
}
            if (req.method === 'POST' && requestPath === '/accounts/register') {
        const sendJson = (status, data) => {
          res.writeHead(status, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          });
          res.end(JSON.stringify(data));
        };

        if (process.env.ENABLE_PUBLIC_REGISTRATION !== 'true') {
          sendJson(503, {
            success: false,
            error: 'Registration is temporarily unavailable.'
          });
          return;
        }

        if (!options.supabase) {
          sendJson(503, {
            success: false,
            error: 'Account service is unavailable.'
          });
          return;
        }
                if (!supabaseAuth) {
          sendJson(503, {
            success: false,
            error: 'Authentication service is unavailable.'
          });
          return;
        }

        const authorization = req.headers.authorization || '';
        const accessToken = authorization.startsWith('Bearer ')
          ? authorization.slice(7).trim()
          : '';

        const user = await supabaseAuth.verifyAccessToken(accessToken);

        if (!user) {
          sendJson(401, {
            success: false,
            error: 'Unauthorized'
          });
          return;
        }
        const body = await readJsonBody(req);
        const accountService = createAccountService(options.supabase);

           const result = await accountService.registerPendingAccount(
          body.phoneNumber,
          user.id
        );

        if (!result.success) {
          sendJson(409, {
            success: false,
            error: result.error
          });
          return;
        }

        sendJson(201, {
          success: true,
          account: result.account
        });
        return;
      }
          if (req.method === 'POST' && req.url === '/pairing/request') {
                const authorization = req.headers.authorization || '';
        const accessToken = authorization.startsWith('Bearer ')
          ? authorization.slice(7)
          : '';

        const user = supabaseAuth
          ? await supabaseAuth.verifyAccessToken(accessToken)
          : null;

        if (!user) {
          res.writeHead(401, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          });

          res.end(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }));

          return;
        }

                const accountService = options.supabase
          ? createAccountService(options.supabase)
          : null;

        const account = accountService
          ? await accountService.getAccountForUser(user.id)
          : null;

        if (!account) {
          res.writeHead(404, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          });

          res.end(JSON.stringify({
            success: false,
            error: 'NexaBot account not found.'
          }));

          return;
        }

        const client = options.sessionManager?.getClient(account.id);

        if (!client) {
          res.writeHead(503, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          });

          res.end(JSON.stringify({
            success: false,
            error: 'Your WhatsApp session is not ready.'
          }));

          return;
        }
        const normalizedPhoneNumber = account.phoneNumber;
        const now = Date.now();
        const previousAttempt = pairingAttempts.get(normalizedPhoneNumber);

        if (previousAttempt && now - previousAttempt.startedAt >= pairingWindowMs) {
          pairingAttempts.delete(normalizedPhoneNumber);
        }

        const attempt = pairingAttempts.get(normalizedPhoneNumber);

        if (attempt && attempt.count >= maxPairingAttempts) {
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Retry-After': String(
              Math.ceil((pairingWindowMs - (now - attempt.startedAt)) / 1000)
            )
          });

          res.end(JSON.stringify({
            success: false,
            error: 'Too many pairing requests. Try again later.'
          }));

          return;
        }

        if (attempt) {
          attempt.count += 1;
        } else {
          pairingAttempts.set(normalizedPhoneNumber, {
            count: 1,
            startedAt: now
          });
        }

        
        const cooldownUntil = failedPairingCooldowns.get(normalizedPhoneNumber);

        if (cooldownUntil && Date.now() < cooldownUntil) {
          const retryAfter = Math.ceil(
            (cooldownUntil - Date.now()) / 1000
          );

          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Retry-After': String(retryAfter)
          });

          res.end(JSON.stringify({
            success: false,
            error: 'Pairing failed recently. Wait before trying again.'
          }));

          return;
        }

        if (cooldownUntil) {
          failedPairingCooldowns.delete(normalizedPhoneNumber);
        }

        let code;

        try {
          code = await requestPairingCode(client, account.phoneNumber);
          failedPairingCooldowns.delete(normalizedPhoneNumber);
        } catch (error) {
          failedPairingCooldowns.set(
            normalizedPhoneNumber,
            Date.now() + failedPairingCooldownMs
          );

          throw error;
        }



        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        });

        res.end(JSON.stringify({
          success: true,
          code
        }));

        return;
      }
      res.writeHead(404, {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
});

      res.end(JSON.stringify({
        success: false,
        error: 'Not found'
      }));
    } catch (error) {
      console.error('NexaBot request error: Pairing request failed.');

      
      if (!res.headersSent) {
        const isBadRequest =
  error.message === 'Invalid international phone number.' ||
  error.message === 'Invalid JSON body.';

res.writeHead(isBadRequest ? 400 : 500, {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
});

res.end(JSON.stringify({
  success: false,
  error: isBadRequest
    ? error.message
    : 'Internal server error'
}));

      } else {
        res.destroy();
      }
    }
  };
}

function startServer(options = {}) {
  const supabase = options.supabase || (
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseClient()
    : null
);
  const config = validateConfiguration(options);

  const bot = createNexaBot({
    developerIds: config.developerIds,
    deployerId: config.deployerId
  });

const sessionManager = createSessionManager({
  startWhatsApp: options.startWhatsApp || startWhatsApp,
  authRootDir: process.env.NEXABOT_AUTH_DIR
});

const server = http.createServer(createRequestHandler({
  sessionManager,
  supabase,
  commandEngine: bot
}));

    server.on('error', error => {
    console.error('NexaBot server error:', error.message);

    if (require.main === module) {
      process.exitCode = 1;
    }

    if (typeof options.onError === 'function') {
      options.onError(error);
    }
  });

  verifyPersistentStorage()
.then(async storageStatus => {
    console.log(`NexaBot persistent storage marker: ${storageStatus}`);
    if (supabase) {
  await verifySupabaseConnection(supabase);
  console.log('NexaBot Supabase connectivity check 
    } else if (require.main === module) {
  throw new Error('Supabase client is not configured.');
  }
    server.listen(config.port, () => {
      console.log(
        `NexaBot server listening on port ${server.address().port}`
      );
      console.log(`Registered commands: ${bot.list().length}`);
      console.log('NexaBot persistent storage check passed.');
    });
  })
  .catch(error => {
    console.error('NexaBot persistent storage check failed:', error.message);
    process.exitCode = 1;

    if (typeof options.onError === 'function') {
      options.onError(error);
    }
  });
    return { server, bot, sessionManager };
}

if (require.main === module) {
  try {
    startServer();
  } catch (error) {
    console.error('NexaBot startup failed:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  startServer,
  validateConfiguration,
  createRequestHandler
};
