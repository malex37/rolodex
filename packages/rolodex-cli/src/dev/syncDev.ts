import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AnyFlags, TypedFlags } from "meow";
import { getStackOutputs } from "../stack.ts";

// The Vite dev server reads this (see packages/rolodex-ui/src/config.js).
const DEFAULT_ENV_FILE = fileURLToPath(
  new URL("../../../rolodex-ui/.env.local", import.meta.url),
);

// UI env var <- Rolodex stack output.
const ENV_FROM_OUTPUT = {
  VITE_REGION: "Region",
  VITE_API_URL: "ApiUrl",
  VITE_USER_POOL_ID: "UserPoolId",
  VITE_USER_POOL_CLIENT_ID: "UserPoolClientId",
  VITE_IDENTITY_POOL_ID: "IdentityPoolId",
} as const;

export const SyncDevFlags = {
  file: { type: "string", default: DEFAULT_ENV_FILE },
} satisfies AnyFlags;

export type SyncDevInput = TypedFlags<typeof SyncDevFlags>;

/**@abstract Writes the deployed stack's values into the UI's .env.local so
 * `npm run dev` talks to the deployed API and user pool. Only the VITE_* keys
 * above are set; any other lines in the file are kept.
 */
export async function syncDev(input: SyncDevInput) {
  const file = resolve(input.file);
  const outputs = await getStackOutputs();
  const values = Object.fromEntries(
    Object.entries(ENV_FROM_OUTPUT).map(([env, output]) => {
      const value = outputs[output];
      if (!value) throw new Error(`Stack output ${output} is missing`);
      return [env, value];
    }),
  );

  const lines = existsSync(file) ? readFileSync(file, "utf8").split("\n") : [];
  const changed: string[] = [];
  const remaining = new Map(Object.entries(values));
  const updated = lines.map((line) => {
    const key = line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1];
    if (!key || !remaining.has(key)) return line;
    const value = remaining.get(key)!;
    remaining.delete(key);
    const next = `${key}=${value}`;
    if (line !== next) changed.push(key);
    return next;
  });
  // Append keys the file doesn't have yet, before any trailing blank line.
  while (updated.length && updated.at(-1) === "") updated.pop();
  for (const [key, value] of remaining) {
    updated.push(`${key}=${value}`);
    changed.push(key);
  }
  writeFileSync(file, `${updated.join("\n")}\n`);

  const rel = relative(process.cwd(), file);
  const where = rel && !rel.startsWith("..") ? rel : file;
  console.log(
    changed.length
      ? `Updated ${where}: ${changed.join(", ")}`
      : `${where} is already up to date`,
  );
}
