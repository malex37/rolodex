import { randomUUID } from "node:crypto";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  type BatchWriteCommandInput,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { GroceryItem } from "@rolodex/models";
import { GROCERY_PK, db, tableName } from "../lib/db.ts";
import { NotFoundError, operation } from "../lib/http.ts";

// DynamoDB BatchWrite accepts at most 25 items per request.
const BATCH_SIZE = 25;

function fromItem({ pk: _pk, sk: _sk, ...item }: Record<string, unknown>): GroceryItem {
  return item as unknown as GroceryItem;
}

export const ListGroceries = operation("ListGroceries", async () => {
  const result = await db.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": GROCERY_PK },
    }),
  );
  return { items: (result.Items ?? []).map(fromItem) };
});

// Takes a list so a recipe's ingredients can be added in one call.
export const AddGroceries = operation("AddGroceries", async (input) => {
  const items: GroceryItem[] = input.items.map((item) => ({
    id: randomUUID(),
    ...item,
    done: false,
  }));

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    let requests: NonNullable<BatchWriteCommandInput["RequestItems"]>[string] = items
      .slice(i, i + BATCH_SIZE)
      .map((item) => ({ PutRequest: { Item: { pk: GROCERY_PK, sk: item.id, ...item } } }));
    while (requests.length > 0) {
      const result = await db.send(
        new BatchWriteCommand({ RequestItems: { [tableName()]: requests } }),
      );
      requests = result.UnprocessedItems?.[tableName()] ?? [];
    }
  }

  return { items };
});

export const UpdateGrocery = operation("UpdateGrocery", async ({ id, changes }) => {
  const entries = Object.entries(changes);
  try {
    const result = await db.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { pk: GROCERY_PK, sk: id },
        UpdateExpression: `SET ${entries.map(([key]) => `#${key} = :${key}`).join(", ")}`,
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeNames: Object.fromEntries(entries.map(([key]) => [`#${key}`, key])),
        ExpressionAttributeValues: Object.fromEntries(
          entries.map(([key, value]) => [`:${key}`, value]),
        ),
        ReturnValues: "ALL_NEW",
      }),
    );
    return { item: fromItem(result.Attributes ?? {}) };
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      throw new NotFoundError("Grocery item not found");
    }
    throw error;
  }
});

export const DeleteGrocery = operation("DeleteGrocery", async ({ id }) => {
  await db.send(
    new DeleteCommand({ TableName: tableName(), Key: { pk: GROCERY_PK, sk: id } }),
  );
  return {};
});
