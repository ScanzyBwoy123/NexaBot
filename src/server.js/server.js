'use strict';

const http = require('node:http');
const { createNexaBot } = require('./index');

const PORT = Number(process.env.PORT || 3000);

function validateConfiguration() {
  const developerIds = (process.env.DEVELOPER_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  const deployerId = (process.env.DEPLOYER_ID || '').trim();

  if (developerIds.length === 0) {
    throw new Error('DEVELOPER_IDS must be configured.');
  }

  if (!deployerId) {
    throw new Error('DEPLOYER_ID must be configured.');
  }

  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('Invalid server port.');
  }

  return { developerIds, deployerId };
}

function startServer() {
  const config = validateConfiguration();

  const bot = createNexaBot({
    developerIds: config.developerIds,
    deployerId: config.deployerId
  });

  const server = http.createServer((req, res) => {
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
  });

  server.listen(PORT, () => {
    console.log(`NexaBot server listening on port ${PORT}`);
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
  validateConfiguration
};
