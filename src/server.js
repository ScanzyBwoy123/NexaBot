'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const { createNexaBot } = require('./index');
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
    const pairingAttempts = new Map();
  const pairingWindowMs = 10 * 60 * 1000;
  const maxPairingAttempts = 3;
  return async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
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
          if (req.method === 'POST' && req.url === '/pairing/request') {
        const expectedToken = (process.env.PAIRING_API_TOKEN || '').trim();
        const authorization = req.headers.authorization || '';
        const providedToken = authorization.startsWith('Bearer ')
          ? authorization.slice(7)
          : '';

        if (!expectedToken || !safeTokenMatch(providedToken, expectedToken)) {
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

        const body = await readJsonBody(req);
        const client = options.getWhatsAppClient?.();

        if (!client) {
          res.writeHead(503, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          });

          res.end(JSON.stringify({
            success: false,
            error: 'WhatsApp is not ready.'
          }));

          return;
        }

        
        const normalizedPhoneNumber = String(body.phoneNumber || '').replace(/\D/g, '');
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

        const code = await requestPairingCode(client, body.phoneNumber);


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
      console.error('NexaBot request error:', error.message);

      
      if (!res.headersSent) {
        const isInvalidPhoneNumber =
          error.message === 'Invalid international phone number.';

        res.writeHead(isInvalidPhoneNumber ? 400 : 500, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        });

        res.end(JSON.stringify({
          success: false,
          error: isInvalidPhoneNumber
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
  const config = validateConfiguration(options);

  const bot = createNexaBot({
    developerIds: config.developerIds,
    deployerId: config.deployerId
  });

  let whatsappClient = null;

const server = http.createServer(createRequestHandler({
  getWhatsAppClient: () => whatsappClient
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

  server.listen(config.port, () => {
    console.log(
      `NexaBot server listening on port ${server.address().port}`
    );
    console.log(`Registered commands: ${bot.list().length}`);
  });
   if (process.env.ENABLE_WHATSAPP === 'true') {
        const whatsappStarter = options.startWhatsApp || startWhatsApp;

    void whatsappStarter({
      commandEngine: bot,
      onCode: () => {},
      onReady: () => {
        console.log('NexaBot WhatsApp connection is ready.');
      },
      onError: error => {
        console.error('WhatsApp startup error:', error.message);
      }
       }).then(client => {
      whatsappClient = client;
    }).catch(error => {
      console.error('WhatsApp initialization failed:', error.message);
    });
  }
    return { server, bot };
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
