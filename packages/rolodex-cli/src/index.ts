import meow from "meow";
import { Commands, isOperation, type Operation } from "./commands.ts";

async function main() {
  // With `commands` set, meow stops parsing at the command name, so everything
  // after it (operation and flags) is left unparsed in cli.input. The
  // operation's own flags are parsed by a second meow call below.
  const cli = meow(
    `
    Usage
      $ rolo <command> [operation] [flags]

    Commands:
      ${Commands.commands.reduce((acc, v) => `${acc}\n\t\t\t${v}`)}
`,
    {
      importMeta: import.meta,
      commands: Commands.commands,
    },
  );
  const arg_command = cli.command;
  if (!arg_command) {
    cli.showHelp();
    return;
  }
  const command = Commands.command(arg_command);
  if (!command) {
    throw new Error(`Unknown command ${arg_command}`);
  }
  // A single-operation command (`rolo sync-dev`) takes its flags directly;
  // otherwise the first input names the operation (`rolo users create`).
  let operation: string;
  let sub_command: Operation | undefined;
  let rest: string[];
  if (isOperation(command)) {
    operation = arg_command;
    sub_command = command;
    rest = cli.input;
  } else {
    const [name, ...args] = cli.input;
    if (!name) {
      throw new Error(`Command ${arg_command} requires an operation`);
    }
    operation = name;
    sub_command = Commands.commandOperation(arg_command, name);
    rest = args;
  }
  if (!sub_command) {
    throw new Error(
      `Command ${arg_command} does not have an operation ${operation}`,
    );
  }
  const usage = isOperation(command) ? arg_command : `${arg_command} ${operation}`;
  const sub_cli = meow(
    `
    Usage
      $ rolo ${usage} [flags]

    ${sub_command.help}
`,
    {
      importMeta: import.meta,
      argv: rest,
      flags: sub_command.flags,
    },
  );
  try {
    await sub_command.handler(sub_cli.flags);
  } catch (e) {
    console.error(`Failed to execute operation ${operation}`);
    console.error(e);
    process.exitCode = 1;
  }
}
// aws cognito-idp admin-create-user --user-pool-id us-west-2_hNzHo3owj --username you@example.com \
//  --user-attributes Name=email,Value=you@example.com Name=email_verified,Value=true
void main();
