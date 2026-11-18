'use strict';

const plannedCommands = [
  ['autoview', 'Automatically view eligible contact statuses.', 'owner'],
  ['autolike', 'Automatically react to eligible statuses.', 'owner'],
  ['autoreact', 'Automatically react to configured messages.', 'owner'],
  ['vv', 'Handle eligible View Once media.', 'owner'],
  ['antidelete', 'Preserve locally received messages where supported.', 'owner'],
  ['abuse', 'Configure abusive-message filtering.', 'owner'],
  ['block', 'Block a contact.', 'owner'],
  ['unblock', 'Unblock a contact.', 'owner'],
  ['bot', 'Show NexaBot information.', 'public'],
  ['pair', 'Pair a WhatsApp account.', 'owner'],
  ['restart', 'Restart the bot service.', 'owner'],
  ['settings', 'Show account settings.', 'owner'],
  ['mission', 'Show the NexaBot mission.', 'public'],
  ['owner', 'Show owner information.', 'public'],
  ['menu', 'Display available commands.', 'public'],
  ['ping', 'Check command-engine responsiveness.', 'public'],
  ['alive', 'Check whether NexaBot is online.', 'public'],
  ['uptime', 'Show service uptime.', 'public'],
  ['help', 'Explain command usage.', 'public'],
  ['groupinfo', 'Show group information.', 'public'],
  ['admins', 'List group administrators.', 'public'],
  ['tagall', 'Mention group members.', 'admin'],
  ['clear', 'Clear temporary command data.', 'owner'],
  ['report', 'Submit a bot report.', 'public'],
  ['setprefix', 'Change the command prefix.', 'owner'],
  ['ownerinfo', 'Show owner contact information.', 'public']
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
