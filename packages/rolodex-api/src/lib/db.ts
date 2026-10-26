import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export function tableName(): string {
  const name = process.env.TABLE_NAME;
  if (!name) throw new Error("TABLE_NAME environment variable is not set");
  return name;
}

// Single-table layout: pk is the entity type, sk is the item id.
export const RECIPE_PK = "RECIPE";
export const GROCERY_PK = "GROCERY";
