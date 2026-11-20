'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { CommandEngine } = require('../src/index');
const { createCommands, plannedCommands } = require('../src/commands');

const OWNER_ID = '233241234567';

function createEngine() {
  return new CommandEngine({
    prefix: '.',
    deployerId: OWNER_ID,
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

test('Deployer commands reject unauthorized users', async () => {
  const engine = createEngine();
  const replies = [];

  const result = await engine.handle({
    text: '.ping',
    senderId: '233501234567',
    reply: async message => replies.push(message)
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'DEPLOYER_ONLY');
  assert.equal(replies.length, 1);
});

test('Deployer commands reject unauthorized users', async () => {
  const engine = createEngine();
  const replies = [];

  const result = await engine.handle({
    text: '.settings',
    senderId: '233501234567',
    reply: async message => replies.push(message)
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'DEPLOYER_ONLY');
  assert.match(replies[0], /deployer/i);
});

test('Configured deployer can execute deployer-only commands', async () => {
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
    permission: 'deployer',
    execute: async () => 'Hello from NexaBot!'
  });

  const result = await engine.handle({
    text: '.hello',
    senderId: OWNER_ID,
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
   deployerId: OWNER_ID,
    now: () => now
  });

  engine.register({
    name: 'slow',
    permission: 'deployer',
    cooldownMs: 3000,
    execute: async () => {
      executions++;
      return 'Executed!';
    }
  });

  const context = {
    text: '.slow',
    senderId: OWNER_ID,
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
test('Deployer commands reject missing sender IDs', async () => {
  const engine = createEngine();

  const result = await engine.handle({
    text: '.settings'
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'DEPLOYER_ONLY');
});

test('Deployer commands reject unauthorized users', async () => {
  const engine = new CommandEngine({
    prefix: '.',
  });

  let executions = 0;

  engine.register({
    name: 'admincmd',
    permission: 'deployer',
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
  assert.equal(result.code, 'DEPLOYER_ONLY');
  assert.equal(executions, 0);
});

test('Non-deployers cannot execute deployer commands', async () => {
  const engine = new CommandEngine({
    prefix: '.',
  });

  engine.register({
    name: 'admincmd',
    permission: 'deployer',
    execute: async () => 'Admin access granted'
  });

  const result = await engine.handle({
    text: '.admincmd',
    senderId: '233501234567'
  });

  assert.equal(result.ok, false);
assert.equal(result.code, 'DEPLOYER_ONLY');
});
test('Deployer commands reject unauthorized users', async () => {
const engine = new CommandEngine({
  prefix: '.'
});
  let executions = 0;

  engine.register({
    name: 'secure',
    permission: 'deployer',
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
  assert.equal(result.code, 'DEPLOYER_ONLY');
  assert.equal(executions, 0);
});
test('Aliases cannot bypass deployer-only permissions', async () => {
  const engine = new CommandEngine({
    prefix: '.',
    deployerId: OWNER_ID
  });

  let executions = 0;

  engine.register({
    name: 'secret',
    aliases: ['unlock'],
    permission: 'deployer',
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
  assert.equal(result.code, 'DEPLOYER_ONLY');
  assert.equal(executions, 0);
});
test('Duplicate aliases cannot overwrite existing commands', () => {
  const engine = createEngine();

  assert.throws(() => {
    engine.register({
      name: 'anothercommand',
      aliases: ['ping'],
      permission: 'deployer',
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
      permission: 'deployer',
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
      permission: 'deployer',
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
      permission: 'deployer',
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
      permission: 'deployer',
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
        permission: 'deployer',
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
        permission: 'deployer',
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
        permission: 'deployer',
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
        permission: 'deployer',
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
      permission: 'deployer',
      cooldownMs: 0,
      execute: async () => 'OK'
    }]
  }));
});
test('Failed commands do not trigger cooldowns', async () => {
  let executions = 0;

  const engine = new CommandEngine({
    prefix: '.',
    deployerId: OWNER_ID,
    logger: { error: () => {} }
  });

  engine.register({
    name: 'retry',
    permission: 'deployer',
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
    senderId: OWNER_ID
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
    permission: 'deployer',
    execute: async () => 'First'
  });

  assert.throws(
    () => engine.register({
      name: 'GREETING',
      permission: 'deployer',
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
    permission: 'deployer',
    execute: async () => 'First'
  });

  assert.throws(
    () => engine.register({
      name: 'HELLO',
      permission: 'deployer',
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
      permission: 'deployer',
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
    permission: 'deployer',
    execute: async () => {
      executed = true;
      return 'Hello!';
    }
  });

  const result = await engine.handle({
    text: '.hello',
    senderId: OWNER_ID
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
    permission: 'deployer',
    execute: async ({ args }) => {
      receivedArgs = args;
      return 'Hello!';
    }
  });

  const result = await engine.handle({
    text: '.greet John 25 Ghana',
    senderId: OWNER_ID
  });

  assert.equal(result.ok, true);
  assert.deepEqual(receivedArgs, ['John', '25', 'Ghana']);
});
test('Command parser keeps quoted arguments together', async () => {
  const engine = createEngine();
  let receivedArgs;

  engine.register({
    name: 'greet',
    permission: 'deployer',
    execute: async ({ args }) => {
      receivedArgs = args;
      return 'Hello!';
    }
  });

  const result = await engine.handle({
    text: '.greet "John Doe" "Accra Ghana"',
    senderId: OWNER_ID
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
    senderId: OWNER_ID
  });

  assert.equal(result.ok, true);
  assert.equal(result.command, 'ping');
});
test('Command execution handles mixed-case command names', async () => {
  const engine = createEngine();

  const result = await engine.handle({
    text: '.PiNg',
    senderId: OWNER_ID
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
      permission: 'deployer',
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
      permission: 'deployer',
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
      permission: 'deployer',
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
      permission: 'deployer',
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
      permission: 'deployer',
      execute: async () => 'Hello'
    });
  });
});
test('Command registration rejects duplicate aliases', () => {
  const engine = createEngine();

  engine.register({
    name: 'greet',
    aliases: ['hello'],
    permission: 'deployer',
    execute: async () => 'Hello'
  });

  assert.throws(
    () => engine.register({
      name: 'welcome',
      aliases: ['hello'],
      permission: 'deployer',
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
      permission: 'deployer',
    }),
    /Invalid command registration/
  );
});
test('Command registration rejects invalid permission levels', () => {
  const engine = createEngine();

  assert.throws(
    () => engine.register({
      name: 'invalidpermission',
      permission: 'superadmin',
      execute: async () => 'OK'
    }),
    /Invalid permission/
  );
});
test('Command registration rejects non-string command names', () => {
  const engine = createEngine();

  assert.throws(
    () => engine.register({
      name: 123,
      permission: 'public',
      execute: async () => 'Invalid'
    }),
    /Invalid command name/
  );
});
test('Command registration rejects non-string aliases', () => {
  const engine = createEngine();

  assert.throws(
    () => engine.register({
      name: 'greet',
      aliases: [123],
      permission: 'deployer',
      execute: async () => 'Invalid'
    }),
    /Invalid command alias/
  );
});
test('Command registration rejects non-array aliases', () => {
  const engine = createEngine();

  assert.throws(
    () => engine.register({
      name: 'greet',
      aliases: 'hello',
      permission: 'deployer',
      execute: async () => 'Invalid'
    }),
    /Invalid command alias/
  );
});
test('Command registration rejects empty aliases', () => {
  const engine = createEngine();

  assert.throws(
    () => engine.register({
      name: 'greet',
      aliases: [''],
      permission: 'deployer',
      execute: async () => 'Invalid'
    }),
    /Invalid command alias/
  );
});
test('Command registration rejects duplicate aliases within the same command', () => {
  const engine = createEngine();

  assert.throws(
    () => engine.register({
      name: 'greet',
      aliases: ['hello', 'HELLO'],
      permission: 'deployer',
      execute: async () => 'Invalid'
    }),
    /Duplicate command or alias/
  );
});
test('Command registration rejects names that duplicate existing aliases', () => {
  const engine = createEngine();

  engine.register({
    name: 'greet',
    aliases: ['hello'],
    permission: 'deployer',
    execute: async () => 'Hello'
  });

  assert.throws(
    () => engine.register({
      name: 'hello',
      permission: 'deployer',
      execute: async () => 'Duplicate'
    }),
    /Duplicate command or alias/
  );
});
test('Command registration rejects aliases that duplicate existing command names', () => {
  const engine = createEngine();

  engine.register({
    name: 'greet',
    permission: 'deployer',
    execute: async () => 'Hello'
  });

  assert.throws(
    () => engine.register({
      name: 'welcome',
      aliases: ['GREET'],
      permission: 'deployer',
      execute: async () => 'Welcome'
    }),
    /Duplicate command or alias/
  );
});
test('Command registration rejects owner permission', () => {
  const engine = createEngine();

  assert.throws(
    () => engine.register({
      name: 'ownercheck',
      permission: 'owner',
      execute: async () => 'Not allowed'
    }),
    /Invalid permission/
  );
});

test('Command registration rejects admin permission', () => {
  const engine = createEngine();

  assert.throws(
    () => engine.register({
      name: 'admincheck',
      permission: 'admin',
      execute: async () => 'Not allowed'
    }),
    /Invalid permission/
  );
});
test('Developer-only commands reject non-developers', async () => {
  const engine = new CommandEngine({
    prefix: '.',
    developerIds: ['233200000001'],
  });

  let executions = 0;

  engine.register({
    name: 'devdiagnostics',
    permission: 'developer',
    execute: async () => {
      executions++;
      return 'Developer access granted';
    }
  });

  const deployerResult = await engine.handle({
    text: '.devdiagnostics',
    senderId: '233200000002'
  });

  assert.equal(deployerResult.ok, false);
  assert.equal(deployerResult.code, 'DEVELOPER_ONLY');
  assert.equal(executions, 0);

  const developerResult = await engine.handle({
    text: '.devdiagnostics',
    senderId: '233200000001'
  });

  assert.equal(developerResult.ok, true);
  assert.equal(executions, 1);
});
test('Only the configured deployer can use deployer commands', async () => {
  const DEPLOYER_ID = '233200000002';
  const GROUP_ADMIN_ID = '233501234567';

  const engine = new CommandEngine({
  prefix: '.',
  deployerId: DEPLOYER_ID
});

  let executions = 0;

  engine.register({
    name: 'deployersettings',
    permission: 'deployer',
    execute: async () => {
      executions++;
      return 'Deployer access granted';
    }
  });

  const adminResult = await engine.handle({
    text: '.deployersettings',
    senderId: GROUP_ADMIN_ID,
    isGroup: true
  });

  assert.equal(adminResult.ok, false);
  assert.equal(adminResult.code, 'DEPLOYER_ONLY');
  assert.equal(executions, 0);

  const deployerResult = await engine.handle({
    text: '.deployersettings',
    senderId: DEPLOYER_ID
  });

  assert.equal(deployerResult.ok, true);
  assert.equal(executions, 1);
});
test('Developers can use deployer commands without being deployers', async () => {
  const engine = new CommandEngine({
    prefix: '.',
    developerIds: ['233200000001'],
    deployerId: '233200000002'
  });

  let executions = 0;

  engine.register({
    name: 'deployersettings',
    permission: 'deployer',
    execute: async () => {
      executions++;
      return 'Deployer access granted';
    }
  });

  const result = await engine.handle({
    text: '.deployersettings',
    senderId: '233200000001'
  });

  assert.equal(result.ok, true);
  assert.equal(result.command, 'deployersettings');
  assert.equal(executions, 1);
});
test('Deployers cannot execute developer-only commands', async () => {
  const engine = new CommandEngine({
    prefix: '.',
    developerIds: ['233200000001'],
    deployerId: '233200000002'
  });

  let executions = 0;

  engine.register({
    name: 'devmaintenance',
    permission: 'developer',
    execute: async () => {
      executions++;
      return 'Developer access granted';
    }
  });

  const result = await engine.handle({
    text: '.devmaintenance',
    senderId: '233200000002'
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'DEVELOPER_ONLY');
  assert.equal(executions, 0);
});
test('createNexaBot gives developers full access to all command permissions', async () => {
  const { createNexaBot } = require('../src/index');

  const DEVELOPER_ID = '233200000001';
  const DEPLOYER_ID = '233200000002';

  const engine = createNexaBot({
    prefix: '.',
    developerIds: [DEVELOPER_ID],
    deployerIds: [DEPLOYER_ID]
  });

  engine.register({
    name: 'devcheck',
    permission: 'developer',
    execute: async () => 'Developer access granted'
  });

  assert.equal(engine.list().length, 27);

  const developerDeployerCommand = await engine.handle({
    text: '.ping',
    senderId: DEVELOPER_ID
  });

  assert.equal(developerDeployerCommand.ok, true);

  const developerOnlyCommand = await engine.handle({
    text: '.devcheck',
    senderId: DEVELOPER_ID
  });

  assert.equal(developerOnlyCommand.ok, true);

  const deployerCommand = await engine.handle({
    text: '.ping',
    senderId: DEPLOYER_ID
  });

  assert.equal(deployerCommand.ok, true);

  const deployerDenied = await engine.handle({
    text: '.devcheck',
    senderId: DEPLOYER_ID
  });

  assert.equal(deployerDenied.ok, false);
  assert.equal(deployerDenied.code, 'DEVELOPER_ONLY');
});
test('WhatsApp phone IDs and LID IDs remain distinguishable', () => {
  const engine = createEngine();

  assert.equal(
    engine.normalizeId('233241234567@c.us'),
    '233241234567'
  );

  assert.equal(
    engine.normalizeId('123456789012345@lid'),
    '123456789012345@lid'
  );

  assert.notEqual(
    engine.normalizeId('123456789012345@lid'),
    engine.normalizeId('123456789012345@c.us')
  );
});
test('LID identity cannot inherit matching phone-number deployer permissions', async () => {
  const engine = createEngine();

  const phoneResult = await engine.handle({
    text: '.ping',
    senderId: `${OWNER_ID}@c.us`
  });

  assert.equal(phoneResult.ok, true);

  const lidResult = await engine.handle({
    text: '.ping',
    senderId: `${OWNER_ID}@lid`
  });

  assert.equal(lidResult.ok, false);
  assert.equal(lidResult.code, 'DEPLOYER_ONLY');
});
test('LID identity cannot inherit matching phone-number developer permissions', async () => {
  const engine = new CommandEngine({
    prefix: '.',
    developerIds: ['233241234567']
  });

  let executions = 0;

  engine.register({
    name: 'devcheck',
    permission: 'developer',
    execute: async () => {
      executions++;
      return 'Developer access granted';
    }
  });

  const phoneResult = await engine.handle({
    text: '.devcheck',
    senderId: '233241234567@c.us'
  });

  assert.equal(phoneResult.ok, true);

  const lidResult = await engine.handle({
    text: '.devcheck',
    senderId: '233241234567@lid'
  });

  assert.equal(lidResult.ok, false);
  assert.equal(lidResult.code, 'DEVELOPER_ONLY');
  assert.equal(executions, 1);
});
test('createNexaBot reads developer and deployer IDs from environment variables', async () => {
  const { createNexaBot } = require('../src/index');

  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerIds = process.env.DEPLOYER_IDS;

  try {
    process.env.DEVELOPER_IDS = '233200000001';
    process.env.DEPLOYER_IDS = '233200000002';

    const engine = createNexaBot({ prefix: '.' });

    let developerExecutions = 0;

    engine.register({
      name: 'devcheck',
      permission: 'developer',
      execute: async () => {
        developerExecutions++;
        return 'Developer access granted';
      }
    });

    const developerResult = await engine.handle({
      text: '.devcheck',
      senderId: '233200000001@c.us'
    });

    const deployerResult = await engine.handle({
      text: '.ping',
      senderId: '233200000002@c.us'
    });

    assert.equal(developerResult.ok, true);
    assert.equal(developerExecutions, 1);
    assert.equal(deployerResult.ok, true);

    const unauthorizedResult = await engine.handle({
      text: '.devcheck',
      senderId: '233200000002'
    });

    assert.equal(unauthorizedResult.code, 'DEVELOPER_ONLY');
  } finally {
    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerIds === undefined) {
      delete process.env.DEPLOYER_IDS;
    } else {
      process.env.DEPLOYER_IDS = previousDeployerIds;
    }
  }
});
test('createNexaBot supports multiple comma-separated developer and deployer IDs', async () => {
  const { createNexaBot } = require('../src/index');

  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerIds = process.env.DEPLOYER_IDS;

  try {
    process.env.DEVELOPER_IDS = '233200000011, 233200000012';
    process.env.DEPLOYER_IDS = '233200000021, 233200000022';

    const engine = createNexaBot({ prefix: '.' });

    let executions = 0;

    engine.register({
      name: 'devcheck',
      permission: 'developer',
      execute: async () => {
        executions++;
        return 'Developer access granted';
      }
    });

    for (const senderId of [
      '233200000011@c.us',
      '233200000012@c.us'
    ]) {
      const result = await engine.handle({
        text: '.devcheck',
        senderId
      });

      assert.equal(result.ok, true);
    }

    for (const senderId of [
      '233200000021@c.us',
      '233200000022@c.us'
    ]) {
      const result = await engine.handle({
        text: '.ping',
        senderId
      });

      assert.equal(result.ok, true);
    }

    assert.equal(executions, 2);
  } finally {
    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerIds === undefined) {
      delete process.env.DEPLOYER_IDS;
    } else {
      process.env.DEPLOYER_IDS = previousDeployerIds;
    }
  }
});
test('WhatsApp group administrators without deployer permission are denied commands', async () => {
  const engine = new CommandEngine({
    prefix: '.',
    deployerIds: ['233200000001']
  });

  let executions = 0;

  engine.register({
    name: 'admincheck',
    permission: 'deployer',
    execute: async () => {
      executions++;
      return 'Access granted';
    }
  });

  const result = await engine.handle({
    text: '.admincheck',
    senderId: '233200000099',
    isGroupAdmin: true
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'DEPLOYER_ONLY');
  assert.equal(executions, 0);
});
test('Normal WhatsApp group members cannot execute deployer commands', async () => {
  const engine = new CommandEngine({
    prefix: '.',
    deployerIds: ['233200000001']
  });

  let executions = 0;

  engine.register({
    name: 'membercheck',
    permission: 'deployer',
    execute: async () => {
      executions++;
      return 'Access granted';
    }
  });

  const result = await engine.handle({
    text: '.membercheck',
    senderId: '233200000099',
    isGroupAdmin: false
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'DEPLOYER_ONLY');
  assert.equal(executions, 0);
});
