'use strict';

class CommandEngine {
  constructor(options = {}) {
    this.prefix = options.prefix ?? '.';

if (
  typeof this.prefix !== 'string' ||
  this.prefix.length === 0 ||
  /\s/.test(this.prefix)
) {
  throw new Error('Invalid command prefix.');
}
        this.developerIds = new Set(
      (options.developerIds || []).map(id => this.normalizeId(id))
    );
    this.deployerId = this.normalizeId(options.deployerId); 
    this.logger = options.logger || console;
    this.commands = new Map();
     this.cooldowns = new Map();
this.now = options.now || Date.now;
    for (const command of options.commands || []) {
      this.register(command);
    }
  }

      normalizeId(id) {
    const value = String(id ?? '').trim().toLowerCase();

    if (!value) {
      return '';
    }

    const match = value.match(/^([^@]+)@([a-z0-9.-]+)$/);

    if (match) {
      const identifier = match[1].replace(/\D/g, '');
      const server = match[2];

      if (server === 'c.us') {
        return identifier;
      }

      return identifier ? `${identifier}@${server}` : '';
    }

    return value.replace(/\D/g, '');
  }

  register(command) {
    if (!command || !command.name || typeof command.execute !== 'function') {
      throw new Error('Invalid command registration.');
    }

    if (
  typeof command.name !== 'string' ||
  !/^[a-z0-9][a-z0-9_-]*$/i.test(command.name)
) {
  throw new Error('Invalid command name.');
}

const name = command.name.toLowerCase();
if (
  command.cooldownMs !== undefined &&
  (
    typeof command.cooldownMs !== 'number' ||
    !Number.isFinite(command.cooldownMs) ||
    command.cooldownMs < 0
  )
) {
  throw new Error('Invalid cooldown value.');
}
    if (!['developer', 'deployer'].includes(command.permission)) {
      throw new Error(`Invalid permission for ${name}.`);
    }

    const aliases = command.aliases || [];

if (
  !Array.isArray(aliases) ||
  aliases.some(alias =>
    typeof alias !== 'string' ||
    !/^[a-z0-9][a-z0-9_-]*$/i.test(alias)
  )
) {
  throw new Error('Invalid command alias.');
}

const names = [name, ...aliases]
  .map(value => value.toLowerCase());

if (new Set(names).size !== names.length) {
  throw new Error('Duplicate command or alias.');
}
    for (const item of names) {
      if (this.commands.has(item)) {
        throw new Error(`Duplicate command or alias: ${item}`);
      }
    }

    for (const item of names) {
      this.commands.set(item, { ...command, name });
    }
  }

  parse(text) {
  if (typeof text !== 'string') {
    return null;
  }

  const inputText = text.trim();

  if (!inputText.startsWith(this.prefix)) {
    return null;
  }

  const input = inputText.slice(this.prefix.length).trim();

  if (!input) {
    return null;
  }

  const parts = [];
  let i = 0;

  while (i < input.length) {
    while (i < input.length && /\s/.test(input[i])) {
      i++;
    }

    if (i >= input.length) break;

    const quote = input[i];

    if (quote === '"' || quote === "'") {
      i++;
      let value = '';

      while (i < input.length && input[i] !== quote) {
        if (
          input[i] === '\\' &&
          i + 1 < input.length &&
          (input[i + 1] === quote || input[i + 1] === '\\')
        ) {
          value += input[i + 1];
          i += 2;
        } else {
          value += input[i];
          i++;
        }
      }

      if (i >= input.length) {
        return null;
      }

      parts.push(value);
      i++;

      if (i < input.length && !/\s/.test(input[i])) {
        return null;
      }
    } else {
      const start = i;

      while (i < input.length && !/\s/.test(input[i])) {
        i++;
      }

      parts.push(input.slice(start, i));
    }
  }

  if (parts.length === 0) {
    return null;
  }

  const name = parts.shift().toLowerCase();

  return { name, args: parts };
}
  async handle(context = {}) {
    const { text, senderId, reply } = context;

    const parsed = this.parse(text);

    if (!parsed) {
      return { handled: false };
    }

    const command = this.commands.get(parsed.name);

    const send = async message => {
      if (typeof reply === 'function') {
        await reply(message);
      }
    };

    if (!command) {
      await send(`Unknown command: ${parsed.name}`);
      return {
        handled: true,
        ok: false,
        code: 'COMMAND_NOT_FOUND'
      };
    }

    const sender = this.normalizeId(senderId);
const isDeveloper = Boolean(
  sender && this.developerIds.has(sender)
);

// Developer has full access to every command.
if (command.permission === 'developer' && !isDeveloper) {
  await send('This command is restricted to the NexaBot developer.');

  return {
    handled: true,
    ok: false,
    code: 'DEVELOPER_ONLY'
  };
}

// Deployers can use deployer commands.
// Developers can also use these commands.
if (
  command.permission === 'deployer' &&
  !isDeveloper &&
  (!sender || !this.deployerIds.has(sender))
) {
  await send('This command is restricted to the bot deployer.');

  return {
    handled: true,
    ok: false,
    code: 'DEPLOYER_ONLY'
  };
}
const cooldownMs = command.cooldownMs || 0;
const cooldownKey = `${sender}:${command.name}`;
const lastUsed = this.cooldowns.get(cooldownKey);
const remaining = lastUsed === undefined
  ? 0
  : cooldownMs - (this.now() - lastUsed);
if (remaining > 0) {
  const seconds = Math.ceil(remaining / 1000);
  await send(`Please wait ${seconds} seconds before using this command again.`);
  return {
    handled: true,
    ok: false,
    code: 'COOLDOWN',
    remainingMs: remaining
  };
}
try {
  const result = await command.execute({
    ...context,
    args: parsed.args,
    command: command.name,
    senderId: senderId
  });
  if (cooldownMs > 0) {
    this.cooldowns.set(cooldownKey, this.now());
  }
  if (typeof result === 'string') {
    await send(result);
  } else if (result && result.message) {
    await send(result.message);
  }
  return {
    handled: true,
    ok: true,
    command: command.name,
    result
  };
} catch (error) {
  this.logger.error('Command execution failed:', error);
  await send('An error occurred while executing this command.');
  return {
    handled: true,
    ok: false,
    code: 'COMMAND_ERROR'
  };
}

}
  list() {
    return [...new Set(this.commands.values())].map(command => ({
      name: command.name,
      description: command.description,
      permission: command.permission,
      aliases: command.aliases || []
    }));
  }
}

module.exports = { CommandEngine };
