import type { AnyFlags, TypedFlags } from "meow";
import { syncDev, SyncDevFlags } from "./dev/syncDev.ts";
import { createUser, CreateUserFlags } from "./users/createUser.ts";

export interface Operation<F extends AnyFlags = AnyFlags> {
  help: string;
  // meow flag definitions; meow parses, type-checks and enforces isRequired.
  flags: F;
  handler(input: TypedFlags<F>): void | Promise<void>;
}

export interface CommandOperations {
  [key: string]: Operation;
}

export type Command = Record<string, Operation | CommandOperations>;

/** A command is either a single operation (`rolo sync-dev`) or a group of them (`rolo users create`). */
export function isOperation(value: Operation | CommandOperations): value is Operation {
  return typeof value.handler === "function";
}

export const CommandRegistryMap = {
  users: {
    create: {
      help: "Create a user with password reset at sign in required",
      handler: createUser,
      flags: CreateUserFlags,
    },
  },
  "sync-dev": {
    help: "Write the deployed stack's values to packages/rolodex-ui/.env.local for npm run dev",
    handler: syncDev,
    flags: SyncDevFlags,
  },
} satisfies Command;

export class CommandRegistry {
  private commandMap: Record<string, CommandOperations | Operation>;
  constructor(commands: Record<string, CommandOperations | Operation>) {
    this.commandMap = commands;
  }

  get commands() {
    return Object.keys(this.commandMap);
  }

  command(name: string) {
    if (this.commandMap[name]) {
      return this.commandMap[name];
    }
    return undefined;
  }

  commandOperations(command: string, operation: string) {
    if (this.commandMap[command] && !this.commandMap[command].handler) {
      return Object.keys(
        (this.commandMap[command] as CommandOperations)[operation],
      );
    }
    return undefined;
  }

  commandOperation(command: string, operation: string) {
    const commandOps = this.command(command);
    if (operation in (commandOps as CommandOperations)) {
      return (commandOps as CommandOperations)[operation];
    }
  }
}

export const Commands = new CommandRegistry(CommandRegistryMap);
