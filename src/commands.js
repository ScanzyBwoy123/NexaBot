'use strict';
const plannedCommands = [
  ['autoview', 'Automatically view eligible contact statuses.', 'deployer'],
  ['autolike', 'Automatically react to eligible statuses.', 'deployer'],
  ['autoreact', 'Automatically react to configured messages.', 'deployer'],
  ['vv', 'Handle eligible View Once media.', 'deployer'],
  ['antidelete', 'Preserve locally received messages where supported.', 'deployer'],
  ['abuse', 'Configure abusive-message filtering.', 'deployer'],
  ['block', 'Block a contact.', 'deployer'],
  ['unblock', 'Unblock a contact.', 'deployer'],
  ['bot', 'Show NexaBot information.', 'deployer'],
  ['pair', 'Pair a WhatsApp account.', 'deployer'],
  ['restart', 'Restart the bot service.', 'deployer'],
  ['settings', 'Show account settings.', 'deployer'],
  ['mission', 'Show the NexaBot mission.', 'deployer'],
  ['owner', 'Show owner information.', 'deployer'],
  ['menu', 'Display available commands.', 'deployer'],
  ['ping', 'Check command-engine responsiveness.', 'deployer'],
  ['alive', 'Check whether NexaBot is online.', 'deployer'],
  ['uptime', 'Show service uptime.', 'deployer'],
  ['help', 'Explain command usage.', 'deployer'],
  ['groupinfo', 'Show group information.', 'deployer'],
  ['admins', 'List group administrators.', 'deployer'],
  ['tagall', 'Mention group members.', 'deployer'],
  ['clear', 'Clear temporary command data.', 'deployer'],
  ['report', 'Submit a bot report.', 'deployer'],
  ['setprefix', 'Change the command prefix.', 'deployer'],
  ['ownerinfo', 'Show owner contact information.', 'deployer']
];

function createCommands() {
  return plannedCommands.map(([name, description, permission]) => ({
    name,
    description,
    permission,
    aliases: [],
    execute: async () => ({
      message: `${name}: This feature is not connected yet.`
    })
  }));
}

module.exports = {
  plannedCommands,
  createCommands,
  buildCommands: createCommands
};
