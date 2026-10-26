export class ValidationError extends Error {
  override name = "ValidationError";
}

export function asObject(input: unknown, what: string): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ValidationError(`${what} must be an object`);
  }
  return input as Record<string, unknown>;
}

export function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
