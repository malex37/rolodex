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
  impl: (input: OperationInput<N>) => Promise<OperationOutput<N>>,
): Handler {
  return async (event) => {
    try {
      const input = inputParsers[name](readBody(event));
      return json(200, await impl(input));
    } catch (err) {
      if (err instanceof ApiError) return error(err.statusCode, err.code, err.message);
      if (err instanceof ValidationError) return error(400, "ValidationError", err.message);
      console.error(`${name} failed`, err);
      return error(500, "InternalError", "Internal server error");
    }
  };
}
