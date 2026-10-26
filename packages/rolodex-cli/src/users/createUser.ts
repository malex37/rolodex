import {
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";
import type { AnyFlags, TypedFlags } from "meow";
import { getStackOutput } from "../stack.ts";

export const CreateUserFlags = {
  email: { type: "string", isRequired: true },
  // Defaults to the deployed Rolodex stack's UserPoolId output.
  userPoolId: { type: "string" },
} satisfies AnyFlags;

export type CreateUserInput = TypedFlags<typeof CreateUserFlags>;

/**@abstract Creats a user, it is the equivalent of using aws cli call:
 * aws cognito-idp admin-create-user --user-pool-id us-west-2_hNzHo3owj --username you@example.com \
 *   --user-attributes Name=email,Value=you@example.com Name=email_verified,Value=true
 *
 * The pool signs in by email, so the email is the username. Cognito emails the
 * user a temporary password, which they must change on first sign-in.
 */
export async function createUser(input: CreateUserInput) {
  const { email } = input;
  const userPoolId = input.userPoolId ?? (await getStackOutput("UserPoolId"));
  // Pool ids are "{region}_{id}".
  const region = userPoolId.split("_")[0];
  const client = new CognitoIdentityProviderClient({ region });

  try {
    const { User } = await client.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
        ],
        DesiredDeliveryMediums: ["EMAIL"],
      }),
    );
    console.log(
      `Created ${email} (${User?.UserStatus}). A temporary password was emailed to them.`,
    );
  } catch (e) {
    if (e instanceof UsernameExistsException) {
      throw new Error(`A user with email ${email} already exists`);
    }
    throw e;
  }
}
