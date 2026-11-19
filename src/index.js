'use strict';

const { CommandEngine } = require('./core/commandEngine');
const { buildCommands } = require('./commands');

function createNexaBot(options = {}) {
  const developerIds =
    options.developerIds ??
    (process.env.DEVELOPER_IDS ?? '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);
    const deployerId =
    options.deployerId ??
    process.env.DEPLOYER_ID ??
    '';

  const engine = new CommandEngine({
    prefix: options.prefix ?? process.env.COMMAND_PREFIX ?? '.',
    developerIds,
    deployerId,
    logger: options.logger
  });

  for (const command of buildCommands()) {
    engine.register(command);
  }

  return engine;
}

module.exports = {
  CommandEngine,
  createNexaBot,
  buildCommands
};
