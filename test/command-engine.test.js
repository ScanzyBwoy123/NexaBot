'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { CommandEngine } = require('../src/index');
const { createCommands, plannedCommands } = require('../src/commands');

const OWNER_ID = '233241234567';

function createEngine() {
  return new CommandEngine({
    prefix: '.',
    ownerIds: [OWNER_ID],
    commands: createCommands()
  });
}

test('NexaBot registers all 26 planned commands', () => {
  const engine = createEngine();

  assert.equal(engine.list().length, 26);
  assert.equal(plannedCommands.length, 26);
});

test('Command parser reads commands and arguments', () => {
  const engine = createEngine();

  const result = engine.parse('.help "hello world"');

  assert.deepEqual(result, {
    name: 'help',
    args: ['hello world']
  });
});

test('Public commands can be used by anyone', async () => {
  const engine = createEngine();
  const replies = [];

  const result = await engine.handle({
    text: '.ping',
    senderId: '233501234567',
    reply: async message => replies.push(message)
  });

  assert.equal(result.ok, true);
  assert.equal(result.command, 'ping');
  assert.equal(replies.length, 1);
});

test('Owner commands reject unauthorized users', async () => {
  const engine = createEngine();
  const replies = [];

  const result = await engine.handle({
    text: '.settings',
    senderId: '233501234567',
    reply: async message => replies.push(message)
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'OWNER_ONLY');
  assert.match(replies[0], /owner/i);
});

test('Owner can execute owner-only commands', async () => {
  const engine = createEngine();
  const replies = [];

  const result = await engine.handle({
    text: '.settings',
    senderId: OWNER_ID,
    reply: async message => replies.push(message)
  });

  assert.equal(result.ok, true);
  assert.equal(result.command, 'settings');
  assert.equal(replies.length, 1);
});

test('Unknown commands receive an error reply', async () => {
  const engine = createEngine();
  const replies = [];

  const result = await engine.handle({
    text: '.unknown',
    senderId: OWNER_ID,
    reply: async message => replies.push(message)
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'COMMAND_NOT_FOUND');
  assert.match(replies[0], /unknown command/i);
});

test('Commands without the prefix are ignored', async () => {
  const engine = createEngine();

  const result = await engine.handle({
    text: 'hello',
    senderId: OWNER_ID
  });

  assert.equal(result.handled, false);
});
test('Command aliases execute the original command', async () => {
  const engine = createEngine();
  const replies = [];

  engine.register({
    name: 'greet',
    aliases: ['hello'],
    permission: 'public',
    execute: async () => 'Hello from NexaBot!'
  });

  const result = await engine.handle({
    text: '.hello',
    senderId: '233501234567',
    reply: async message => replies.push(message)
  });

  assert.equal(result.ok, true);
  assert.equal(result.command, 'greet');
  assert.equal(replies[0], 'Hello from NexaBot!');
});
test('Command cooldown blocks repeated execution', async () => {
  let now = 1000;
  let executions = 0;
  const replies = [];

  const engine = new CommandEngine({
    prefix: '.',
    now: () => now
  });

  engine.register({
    name: 'slow',
    permission: 'public',
    cooldownMs: 3000,
    execute: async () => {
      executions++;
      return 'Executed!';
    }
  });

  const context = {
    text: '.slow',
    senderId: '233501234567',
    reply: async message => replies.push(message)
  };

  const first = await engine.handle(context);
  const second = await engine.handle(context);

  assert.equal(first.ok, true);
  assert.equal(second.code, 'COOLDOWN');
  assert.equal(executions, 1);

  now += 3000;

  const third = await engine.handle(context);

  assert.equal(third.ok, true);
  assert.equal(executions, 2);
});
test('Owner commands reject missing sender IDs', async () => {
  const engine = createEngine();

  const result = await engine.handle({
    text: '.settings'
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'OWNER_ONLY');
});

test('Admin commands reject ordinary group members', async () => {
  const engine = new CommandEngine({
    prefix: '.',
    isGroupAdmin: async () => false
  });

  let executions = 0;

  engine.register({
    name: 'admincmd',
    permission: 'admin',
    execute: async () => {
      executions++;
      return 'Allowed';
    }
  });

  const result = await engine.handle({
    text: '.admincmd',
    senderId: '233501234567'
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'ADMIN_ONLY');
  assert.equal(executions, 0);
});

test('Verified group admins can execute admin commands', async () => {
  const engine = new CommandEngine({
    prefix: '.',
    isGroupAdmin: async () => true
  });

  engine.register({
    name: 'admincmd',
    permission: 'admin',
    execute: async () => 'Admin access granted'
  });

  const result = await engine.handle({
    text: '.admincmd',
    senderId: '233501234567'
  });

  assert.equal(result.ok, true);
});
test('Admin commands reject access when admin verification fails', async () => {
  const engine = new CommandEngine({
    prefix: '.',
    isGroupAdmin: async () => {
      throw new Error('Verification failed');
    }
  });

  let executions = 0;

  engine.register({
    name: 'secure',
    permission: 'admin',
    execute: async () => {
      executions++;
      return 'Allowed';
    }
  });

  const result = await engine.handle({
    text: '.secure',
    senderId: '233501234567'
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'ADMIN_ONLY');
  assert.equal(executions, 0);
});
test('Aliases cannot bypass owner-only permissions', async () => {
  const engine = new CommandEngine({
    prefix: '.',
    ownerIds: [OWNER_ID]
  });

  let executions = 0;

  engine.register({
    name: 'secret',
    aliases: ['unlock'],
    permission: 'owner',
    execute: async () => {
      executions++;
      return 'Access granted';
    }
  });

  const result = await engine.handle({
    text: '.unlock',
    senderId: '233501234567'
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'OWNER_ONLY');
  assert.equal(executions, 0);
});
test('Duplicate aliases cannot overwrite existing commands', () => {
  const engine = createEngine();

  assert.throws(() => {
    engine.register({
      name: 'anothercommand',
      aliases: ['ping'],
      permission: 'public',
      execute: async () => 'Hijacked!'
    });
  }, /Duplicate command or alias/);
});
test('Command registration rejects invalid command names', () => {
  const engine = createEngine();

  assert.throws(() => {
    engine.register({
      name: '',
      permission: 'public',
      execute: async () => 'Invalid'
    });
  }, /Invalid command registration/);
});
test('Command registration rejects invalid permission levels', () => {
  const engine = createEngine();

  assert.throws(() => {
    engine.register({
      name: 'dangerous',
      permission: 'everyone',
      execute: async () => 'Executed'
    });
  }, /Invalid permission/);
});
test('Command registration rejects names containing spaces', () => {
  const engine = createEngine();

  assert.throws(() => {
    engine.register({
      name: 'bad name',
      permission: 'public',
      execute: async () => 'Invalid'
    });
  }, /Invalid command name/);
});
test('Command registration rejects aliases containing spaces', () => {
  const engine = createEngine();

  assert.throws(() => {
    engine.register({
      name: 'greet',
      aliases: ['bad alias'],
      permission: 'public',
      execute: async () => 'Hello'
    });
  }, /Invalid command alias/);
});
test('Command registration rejects duplicate aliases within the same command', () => {
  const engine = createEngine();

  assert.throws(
    () => engine.register({
      name: 'sample',
      aliases: ['test', 'test'],
      permission: 'public',
      execute: async () => ({ message: 'OK' })
    }),
    /Duplicate command or alias/
  );
});
test('Command registration rejects aliases that are not an array', () => {
  const engine = createEngine();

  assert.throws(
    () => engine.register({
      name: 'sample',
      aliases: 'hello',
      permission: 'public',
      execute: async () => 'OK'
    }),
    /Invalid command alias/
  );
});
test('Command engine rejects an empty prefix', () => {
  assert.throws(
    () => new CommandEngine({ prefix: '' }),
    /Invalid command prefix/
  );
});
test('Command engine rejects non-string prefixes', () => {
  assert.throws(
    () => new CommandEngine({ prefix: 123 }),
    /Invalid command prefix/
  );
});
test('Command registration rejects negative cooldown values', () => {
  assert.throws(
    () => new CommandEngine({
      commands: [{
        name: 'test',
        permission: 'public',
        cooldownMs: -1,
        execute: async () => 'OK'
      }]
    }),
    /Invalid cooldown/
  );
});
test('Command registration rejects non-numeric cooldown values', () => {
  assert.throws(
    () => new CommandEngine({
      commands: [{
        name: 'test',
        permission: 'public',
        cooldownMs: '1000',
        execute: async () => 'OK'
      }]
    }),
    /Invalid cooldown/
  );
});
test('Command registration rejects infinite cooldown values', () => {
  assert.throws(
    () => new CommandEngine({
      commands: [{
        name: 'test',
        permission: 'public',
        cooldownMs: Infinity,
        execute: async () => 'OK'
      }]
    }),
    /Invalid cooldown/
  );
});
test('Command registration rejects NaN cooldown values', () => {
  assert.throws(
    () => new CommandEngine({
      commands: [{
        name: 'test',
        permission: 'public',
        cooldownMs: NaN,
        execute: async () => 'OK'
      }]
    }),
    /Invalid cooldown/
  );
});
test('Command registration accepts zero cooldown values', () => {
  assert.doesNotThrow(() => new CommandEngine({
    commands: [{
      name: 'test',
      permission: 'public',
      cooldownMs: 0,
      execute: async () => 'OK'
    }]
  }));
});
test('Failed commands do not trigger cooldowns', async () => {
  let executions = 0;

  const engine = new CommandEngine({
    prefix: '.',
    logger: { error: () => {} }
  });

  engine.register({
    name: 'retry',
    permission: 'public',
    cooldownMs: 5000,
    execute: async () => {
      executions++;

      if (executions === 1) {
        throw new Error('Temporary failure');
      }

      return 'Success';
    }
  });

  const context = {
    text: '.retry',
    senderId: '233501234567'
  };

  const first = await engine.handle(context);
  const second = await engine.handle(context);

  assert.equal(first.code, 'COMMAND_ERROR');
  assert.equal(second.ok, true);
  assert.equal(executions, 2);
});
test('Command registration rejects duplicate names regardless of case', () => {
  const engine = createEngine();

  engine.register({
    name: 'greeting',
    permission: 'public',
    execute: async () => 'First'
  });

  assert.throws(
    () => engine.register({
      name: 'GREETING',
      permission: 'public',
      execute: async () => 'Second'
    }),
    /Duplicate command or alias/
  );
});
test('Command registration rejects duplicate aliases regardless of case', () => {
  const engine = createEngine();

  engine.register({
    name: 'first',
    aliases: ['hello'],
    permission: 'public',
    execute: async () => 'First'
  });

  assert.throws(
    () => engine.register({
      name: 'HELLO',
      permission: 'public',
      execute: async () => 'Second'
    }),
    /Duplicate command or alias/
  );
});
test('Command registration rejects invalid aliases', () => {
  const engine = createEngine();

  assert.throws(
    () => engine.register({
      name: 'greeting',
      aliases: ['hello world'],
      permission: 'public',
      execute: async () => 'Hello'
    }),
    /Invalid command alias/
  );
});
test('Command aliases are registered case-insensitively', async () => {
  const engine = createEngine();
  let executed = false;

  engine.register({
    name: 'greeting',
    aliases: ['HELLO'],
    permission: 'public',
    execute: async () => {
      executed = true;
      return 'Hello!';
    }
  });

  const result = await engine.handle({
    text: '.hello',
    senderId: '233123456789'
  });

  assert.equal(result.ok, true);
  assert.equal(result.command, 'greeting');
  assert.equal(executed, true);
});
test('Command arguments are separated and passed correctly', async () => {
  const engine = createEngine();
  let receivedArgs;

  engine.register({
    name: 'greet',
    permission: 'public',
    execute: async ({ args }) => {
      receivedArgs = args;
      return 'Hello!';
    }
  });

  const result = await engine.handle({
    text: '.greet John 25 Ghana',
    senderId: '233123456789'
  });

  assert.equal(result.ok, true);
  assert.deepEqual(receivedArgs, ['John', '25', 'Ghana']);
});
test('Command parser keeps quoted arguments together', async () => {
  const engine = createEngine();
  let receivedArgs;

  engine.register({
    name: 'greet',
    permission: 'public',
    execute: async ({ args }) => {
      receivedArgs = args;
      return 'Hello!';
    }
  });

  const result = await engine.handle({
    text: '.greet "John Doe" "Accra Ghana"',
    senderId: '233123456789'
  });

  assert.equal(result.ok, true);
  assert.deepEqual(receivedArgs, ['John Doe', 'Accra Ghana']);
});
test('Command parser preserves empty quoted arguments', () => {
  const engine = createEngine();

  const result = engine.parse('.test "" hello');

  assert.deepEqual(result, {
    name: 'test',
    args: ['', 'hello']
  });
});
test('Command parser handles single-quoted arguments', () => {
  const engine = createEngine();

  const result = engine.parse(".test 'John Doe'");

  assert.deepEqual(result, {
    name: 'test',
    args: ['John Doe']
  });
});
test('Command parser handles mixed quoted and unquoted arguments', () => {
  const engine = createEngine();

  const result = engine.parse(`.test hello "John Doe" 'Ghana'`);

  assert.deepEqual(result, {
    name: 'test',
    args: ['hello', 'John Doe', 'Ghana']
  });
});
test('Command parser handles command names case-insensitively', () => {
  const engine = createEngine();

  const result = engine.parse('.PING');

  assert.deepEqual(result, {
    name: 'ping',
    args: []
  });
});
test('Command parser handles mixed-case command names', () => {
  const engine = createEngine();

  const result = engine.parse('.PiNg');

  assert.deepEqual(result, {
    name: 'ping',
    args: []
  });
});
test('Command execution handles uppercase command names', async () => {
  const engine = createEngine();

  const result = await engine.handle({
    text: '.PING',
    senderId: '233501234567'
  });

  assert.equal(result.ok, true);
  assert.equal(result.command, 'ping');
});
test('Command execution handles mixed-case command names', async () => {
  const engine = createEngine();

  const result = await engine.handle({
    text: '.PiNg',
    senderId: '233501234567'
  });

  assert.equal(result.ok, true);
  assert.equal(result.command, 'ping');
});
test('Command parser handles extra spaces after the prefix', () => {
  const engine = createEngine();

  const result = engine.parse('.   ping');

  assert.deepEqual(result, {
    name: 'ping',
    args: []
  });
});
test('Command parser handles leading and trailing spaces', () => {
  const engine = createEngine();

  const result = engine.parse('   .ping   ');

  assert.deepEqual(result, {
    name: 'ping',
    args: []
  });
});
test('Command parser rejects unfinished double quotes', () => {
  const engine = createEngine();

  const result = engine.parse('.greet "John Doe');

  assert.equal(result, null);
});
test('Command parser preserves quotation marks inside unquoted arguments', () => {
  const engine = createEngine();

  const result = engine.parse('.greet John"Doe');

  assert.deepEqual(result, {
    name: 'greet',
    args: ['John"Doe']
  });
});
test('Command parser supports escaped quotation marks inside quoted arguments', () => {
  const engine = createEngine();

  const result = engine.parse('.greet "John \\"JD\\" Doe"');

  assert.deepEqual(result, {
    name: 'greet',
    args: ['John "JD" Doe']
  });
});
test('Command parser supports escaped backslashes inside quoted arguments', () => {
  const engine = createEngine();

  const result = engine.parse('.greet "C:\\\\Users\\\\John"');

  assert.deepEqual(result, {
    name: 'greet',
    args: ['C:\\Users\\John']
  });
});
test('Command parser supports escaped single quotes inside single-quoted arguments', () => {
  const engine = createEngine();

  const result = engine.parse(".greet 'John\\'s phone'");

  assert.deepEqual(result, {
    name: 'greet',
    args: ["John's phone"]
  });
});
test('Command parser supports escaped double quotes inside double-quoted arguments', () => {
  const engine = createEngine();

  const result = engine.parse('.greet "He said \\"hello\\""');

  assert.deepEqual(result, {
    name: 'greet',
    args: ['He said "hello"']
  });
});
test('Command parser preserves backslashes in unquoted arguments', () => {
  const engine = createEngine();

  const result = engine.parse('.greet C:\\Users\\John');

  assert.deepEqual(result, {
    name: 'greet',
    args: ['C:\\Users\\John']
  });
});
test('Command parser handles multiple spaces between arguments', () => {
  const engine = createEngine();

  const result = engine.parse('.greet    John      Doe');

  assert.deepEqual(result, {
    name: 'greet',
    args: ['John', 'Doe']
  });
});
test('Command parser handles tabs between arguments', () => {
  const engine = createEngine();

  const result = engine.parse('.greet\tJohn\tDoe');

  assert.deepEqual(result, {
    name: 'greet',
    args: ['John', 'Doe']
  });
});
test('Command parser handles newlines between arguments', () => {
  const engine = createEngine();

  const result = engine.parse('.greet\nJohn\nDoe');

  assert.deepEqual(result, {
    name: 'greet',
    args: ['John', 'Doe']
  });
});
test('Command parser handles mixed whitespace between arguments', () => {
  const engine = createEngine();

  const result = engine.parse('.greet \t\n John \n\t Doe');

  assert.deepEqual(result, {
    name: 'greet',
    args: ['John', 'Doe']
  });
});
test('Command parser handles whitespace around the command', () => {
  const engine = createEngine();

  const result = engine.parse('   .greet   John   Doe   ');

  assert.deepEqual(result, {
    name: 'greet',
    args: ['John', 'Doe']
  });
});
test('Command parser rejects prefix followed only by whitespace', () => {
  const engine = createEngine();

  assert.equal(engine.parse('.   '), null);
  assert.equal(engine.parse('.\t\n  '), null);
});
test('Command registration rejects names containing special characters', () => {
  const engine = createEngine();

  assert.throws(
    () => engine.register({
      name: 'hello@world',
      permission: 'public',
      execute: async () => 'Invalid'
    }),
    /Invalid command name/
  );
});
test('Command registration rejects names containing special characters', () => {
  const engine = createEngine();

  assert.throws(
    () => engine.register({
      name: 'hello@world',
      permission: 'public',
      execute: async () => 'Invalid'
    }),
    /Invalid command name/
  );
});
test('Command registration accepts hyphens and underscores in names', () => {
  const engine = createEngine();

  assert.doesNotThrow(() => {
    engine.register({
      name: 'hello_world-2',
      permission: 'public',
      execute: async () => 'Valid'
    });
  });
});
test('Command registration rejects aliases containing special characters', () => {
  const engine = createEngine();

  assert.throws(
    () => engine.register({
      name: 'greet',
      aliases: ['hello@world'],
      permission: 'public',
      execute: async () => 'Invalid'
    }),
    /Invalid command alias/
  );
});
test('Command registration accepts aliases with hyphens and underscores', () => {
  const engine = createEngine();

  assert.doesNotThrow(() => {
    engine.register({
      name: 'greet',
      aliases: ['hello-world', 'hello_world'],
      permission: 'public',
      execute: async () => 'Hello'
    });
  });
});
test('Command registration rejects duplicate aliases', () => {
  const engine = createEngine();

  engine.register({
    name: 'greet',
    aliases: ['hello'],
    permission: 'public',
    execute: async () => 'Hello'
  });

  assert.throws(
    () => engine.register({
      name: 'welcome',
      aliases: ['hello'],
      permission: 'public',
      execute: async () => 'Welcome'
    }),
 /Duplicate command or alias/i
  );
});
test('Command registration rejects missing execution functions', () => {
  const engine = createEngine();

  assert.throws(
    () => engine.register({
      name: 'broken',
      permission: 'public'
    }),
    /Invalid command registration/
  );
});
