import meow from "meow";
import { Commands } from "./commands.ts";

async function main() {
  // With `commands` set, meow stops parsing at the command name, so everything
  // after it (operation and flags) is left unparsed in cli.input. The
  // operation's own flags are parsed by a second meow call below.
  const cli = meow(
    `
    Usage
      $ rolo <command> <operation> [flags]

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
  const [operation, ...rest] = cli.input;
  const command = Commands.command(arg_command);
  if (!command) {
    throw new Error(`Unknown command ${arg_command}`);
  }
  if (!operation) {
    throw new Error(`Command ${arg_command} requires an operation`);
  }
  const sub_command = Commands.commandOperation(arg_command, operation);
  if (!sub_command) {
    throw new Error(
      `Command ${arg_command} does not have an operation ${operation}`,
    );
  }
  const sub_cli = meow(
    `
    Usage
      $ rolo ${arg_command} ${operation} [flags]

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
