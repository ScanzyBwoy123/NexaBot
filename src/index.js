'use strict';

class CommandEngine {
  constructor(options = {}) {
    this.prefix = options.prefix || '.';
    this.ownerIds = new Set(
      (options.ownerIds || []).map(CommandEngine.normalizeId)
    );

    this.commands = new Map();
    this.aliases = new Map();
    this.isGroupAdmin = options.isGroupAdmin || null;

    if (typeof this.prefix !== 'string' || !this.prefix.trim()) {
      throw new Error('Invalid command prefix');
    }

    for (const command of options.commands || []) {
      this.register(command);
    }
  }

  static normalizeId(value) {
    return String(value || '').replace(/\D/g, '');
  }

  register(command) {
    if (
      !command ||
      typeof command.name !== 'string' ||
      !/^[a-z][a-z0-9_-]*$/i.test(command.name)
    ) {
      throw new Error('Invalid command name');
    }

    if (typeof command.execute !== 'function') {
      throw new Error('Command needs an execute function');
    }

    const name = command.name.toLowerCase();

    if (this.commands.has(name) || this.aliases.has(name)) {
      throw new Error(`Duplicate command: ${name}`);
    }

    const aliases = command.aliases || [];
    const permission = command.permission || 'public';
    const checkedAliases = new Set();

    if (!['public', 'owner', 'admin'].includes(permission)) {
      throw new Error('Invalid permission level');
    }

    for (const item of aliases) {
      const alias = String(item).toLowerCase();

      if (
        !/^[a-z][a-z0-9_-]*$/i.test(alias) ||
        alias === name ||
        this.commands.has(alias) ||
        this.aliases.has(alias) ||
        checkedAliases.has(alias)
      ) {
        throw new Error(`Invalid alias: ${alias}`);
      }

      checkedAliases.add(alias);
    }

    const definition = Object.freeze({
      name,
      aliases: [...checkedAliases],
      description: command.description || '',
      permission,
      execute: command.execute
    });

    this.commands.set(name, definition);

    for (const alias of checkedAliases) {
      this.aliases.set(alias, name);
    }

    return definition;
  }

  parse(text) {
    if (
      typeof text !== 'string' ||
      !text.startsWith(this.prefix)
    ) {
      return null;
    }

    const input = text.slice(this.prefix.length).trim();

    if (!input) return null;

    const parts =
      input.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];

    const name = (parts.shift() || '').toLowerCase();

    const args = parts.map(value => {
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        return value.slice(1, -1);
      }

      return value;
    });

    return { name, args };
  }

  resolve(name) {
    const canonical = this.aliases.get(name) || name;
    return this.commands.get(canonical) || null;
  }

  async sendReply(reply, text) {
    try {
      await reply(text);
    } catch {
      // A failed reply must not crash the engine.
    }
  }

  async handle({
    text,
    senderId,
    chatId,
    isGroup = false,
    reply = async () => {},
    client = null,
    message = null,
    accountId = null
  } = {}) {
    const parsed = this.parse(text);

    if (!parsed) {
      return { handled: false };
    }

    const command = this.resolve(parsed.name);

    if (!command) {
      await this.sendReply(
        reply,
        `Unknown command: ${this.prefix}${parsed.name}`
      );

      return {
        handled: true,
        ok: false,
        code: 'COMMAND_NOT_FOUND'
      };
    }

    const sender = CommandEngine.normalizeId(senderId);

    const isOwner =
      sender.length >= 7 && this.ownerIds.has(sender);

    if (command.permission === 'owner' && !isOwner) {
      await this.sendReply(
        reply,
        'This command is restricted to the bot owner.'
      );

      return {
        handled: true,
        ok: false,
        code: 'OWNER_ONLY'
      };
    }

    if (command.permission === 'admin' && !isOwner) {
      let authorized = false;

      if (isGroup && typeof this.isGroupAdmin === 'function') {
        try {
          authorized = await this.isGroupAdmin({
            senderId,
            chatId,
            client,
            message
          });
        } catch {
          authorized = false;
        }
      }

      if (!authorized) {
        await this.sendReply(
          reply,
          'Group administrator permission required.'
        );

        return {
          handled: true,
          ok: false,
          code: 'ADMIN_ONLY'
        };
      }
    }

    const context = {
      senderId,
      chatId,
      isGroup,
      isOwner,
      client,
      message,
      accountId,
      reply,
      prefix: this.prefix
    };

    try {
      const result = await command.execute(context, parsed.args);

      const response =
        typeof result === 'string'
          ? result
          : result?.message;

      if (response) {
        await this.sendReply(reply, response);
      }

      return {
        handled: true,
        ok: true,
        command: command.name,
        result: result ?? null
      };

    } catch (error) {
      await this.sendReply(
        reply,
        'The command failed. Please try again.'
      );

      return {
        handled: true,
        ok: false,
        code: 'COMMAND_FAILED',
        error: error.message
      };
    }
  }

  list() {
    return [...this.commands.values()].map(command => ({
      name: command.name,
      aliases: [...command.aliases],
      description: command.description,
      permission: command.permission
    }));
  }
}

module.exports = { CommandEngine };
