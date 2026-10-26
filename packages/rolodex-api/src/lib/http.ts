import {
  type ErrorCode,
  type ErrorOutput,
  type OperationInput,
  type OperationName,
  type OperationOutput,
  ValidationError,
  inputParsers,
} from "@rolodex/models";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

export type Handler = (
  event: APIGatewayProxyEventV2,
) => Promise<APIGatewayProxyStructuredResultV2>;

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(404, "NotFound", message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string) {
    super(403, "Forbidden", message);
  }
}

/** Who is calling: their user id (Cognito user pool sub). */
export interface Caller {
  id: string;
  /**
   * Their identity pool id, which recipes created before user ids were used
   * stored as ownerId (see ownedBy in handlers/recipes.ts).
   */
  identityId?: string;
}

// The IAM authorizer's context. For identity pool credentials it includes the
// caller's Cognito identity (aws-lambda's types leave this out). Its `amr`
// lists how they signed in, including
// "cognito-idp.{region}.amazonaws.com/{userPoolId}:CognitoSignIn:{sub}".
interface IamAuthorizer {
  iam?: {
    userArn?: string;
    cognitoIdentity?: { amr?: string[]; identityId?: string } | null;
  };
}

function getCaller(event: APIGatewayProxyEventV2): Caller {
  const authorizer = (event.requestContext as { authorizer?: IamAuthorizer } | undefined)
    ?.authorizer;
  // The user pool sub identifies a signed-in user across sessions and lets us
  // look up their email. Any other IAM principal (e.g. an admin invoking
  // directly) is identified by its ARN.
  const sub = authorizer?.iam?.cognitoIdentity?.amr
    ?.map((entry) => entry.match(/:CognitoSignIn:(.+)$/)?.[1])
    .find(Boolean);
  const id = sub ?? authorizer?.iam?.userArn;
  if (!id) throw new ForbiddenError("Caller identity is missing");
  return { id, identityId: authorizer?.iam?.cognitoIdentity?.identityId };
}

function json(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function error(statusCode: number, code: ErrorCode, message: string) {
  return json(statusCode, { code, message } satisfies ErrorOutput);
}

function readBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}

// Builds the Lambda handler for `POST /{name}`: parses and validates the body
// as `{name}Input`, runs the operation and returns its `{name}Output`.
export function operation<N extends OperationName>(
  name: N,
  impl: (input: OperationInput<N>, caller: Caller) => Promise<OperationOutput<N>>,
): Handler {
  return async (event) => {
    try {
      const caller = getCaller(event);
      const input = inputParsers[name](readBody(event));
      return json(200, await impl(input, caller));
    } catch (err) {
      if (err instanceof ApiError) return error(err.statusCode, err.code, err.message);
      if (err instanceof ValidationError) return error(400, "ValidationError", err.message);
      console.error(`${name} failed`, err);
      return error(500, "InternalError", "Internal server error");
    }
  };
}
