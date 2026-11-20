'use strict';

const http = require('node:http');
const { createNexaBot } = require('./index');

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

  if (!deployerId) {
    throw new Error('DEPLOYER_ID must be configured.');
  }

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('Invalid server port.');
  }

  return { developerIds, deployerId, port };
}

function createRequestHandler() {
  return (req, res) => {
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

      res.writeHead(404, {
        'Content-Type': 'application/json'
      });

      res.end(JSON.stringify({
        success: false,
        error: 'Not found'
      }));
    } catch (error) {
      console.error('NexaBot request error:', error.message);

      if (!res.headersSent) {
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        });

        res.end(JSON.stringify({
          success: false,
          error: 'Internal server error'
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

  const server = http.createServer(createRequestHandler());

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
