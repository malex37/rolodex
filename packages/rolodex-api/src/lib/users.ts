import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type { GroceryListMember } from "@rolodex/models";

const cognito = new CognitoIdentityProviderClient({});

function userPoolId(): string {
  const id = process.env.USER_POOL_ID;
  if (!id) throw new Error("USER_POOL_ID environment variable is not set");
  return id;
}

// `filter` is a ListUsers filter such as `email = "a@b.c"`; callers must only
// pass validated values (see parseEmail).
async function findUser(filter: string): Promise<GroceryListMember | undefined> {
  const { Users } = await cognito.send(
    new ListUsersCommand({ UserPoolId: userPoolId(), Filter: filter, Limit: 1 }),
  );
  const attributes = Users?.[0]?.Attributes ?? [];
  const value = (name: string) => attributes.find((a) => a.Name === name)?.Value;
  const id = value("sub");
  const email = value("email");
  return id && email ? { id, email } : undefined;
}

export const findUserByEmail = (email: string) => findUser(`email = "${email}"`);

/** The caller as a list member; non-user callers (admins) are named by their id. */
export async function getMember(userId: string): Promise<GroceryListMember> {
  const isSub = /^[0-9a-f-]+$/i.test(userId);
  return (isSub && (await findUser(`sub = "${userId}"`))) || { id: userId, email: userId };
}
