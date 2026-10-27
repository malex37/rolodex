import { randomUUID } from "node:crypto";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  type BatchWriteCommandInput,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { GroceryItem, GroceryList, GroceryListView } from "@rolodex/models";
import { GROCERY_LIST_PK, db, groceryItemsPk, tableName } from "../lib/db.ts";
import { type Caller, ForbiddenError, NotFoundError, operation } from "../lib/http.ts";
import { findUserByEmail, getMember } from "../lib/users.ts";

// DynamoDB BatchWrite accepts at most 25 items per request.
const BATCH_SIZE = 25;

type BatchRequests = NonNullable<BatchWriteCommandInput["RequestItems"]>[string];

async function batchWrite(requests: BatchRequests) {
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    let pending = requests.slice(i, i + BATCH_SIZE);
    while (pending.length > 0) {
      const result = await db.send(
        new BatchWriteCommand({ RequestItems: { [tableName()]: pending } }),
      );
      pending = result.UnprocessedItems?.[tableName()] ?? [];
    }
  }
}

async function queryAll(pk: string, filter?: { expression: string; values: Record<string, unknown> }) {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: "pk = :pk",
        FilterExpression: filter?.expression,
        ExpressionAttributeValues: { ":pk": pk, ...filter?.values },
        ExclusiveStartKey,
      }),
    );
    items.push(...(result.Items ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

// Lists are stored with a flat memberIds attribute alongside members so
// queries can filter on membership with contains().
function listFromItem({ pk: _pk, sk: _sk, memberIds: _ids, ...item }: Record<string, unknown>) {
  return item as unknown as GroceryList;
}

function listItem(list: GroceryList) {
  return {
    pk: GROCERY_LIST_PK,
    sk: list.id,
    ...list,
    memberIds: list.members.map((m) => m.id),
  };
}

function view(list: GroceryList, caller: Caller): GroceryListView {
  return { ...list, mine: list.ownerId === caller.id };
}

// Item rows also store a position; ListGroceries returns them sorted by it.
function itemFromRow(row: Record<string, unknown>): GroceryItem {
  const { pk: _pk, sk: _sk, position: _position, ...item } = row;
  return item as unknown as GroceryItem;
}

// Items saved before positions existed sort first, in key order.
function byPosition(a: Record<string, unknown>, b: Record<string, unknown>) {
  return Number(a.position ?? 0) - Number(b.position ?? 0);
}

/** The list if the caller is a member; anyone else gets NotFound. */
async function getList(id: string, caller: Caller): Promise<GroceryList> {
  const result = await db.send(
    new GetCommand({ TableName: tableName(), Key: { pk: GROCERY_LIST_PK, sk: id } }),
  );
  const list = result.Item && listFromItem(result.Item);
  if (!list || !list.members.some((m) => m.id === caller.id)) {
    throw new NotFoundError("Shopping list not found");
  }
  return list;
}

async function getOwnedList(id: string, caller: Caller): Promise<GroceryList> {
  const list = await getList(id, caller);
  if (list.ownerId !== caller.id) {
    throw new ForbiddenError("Only the list's owner can do that");
  }
  return list;
}

// Lists

export const ListGroceryLists = operation("ListGroceryLists", async (_input, caller) => {
  const rows = await queryAll(GROCERY_LIST_PK, {
    expression: "contains(memberIds, :me)",
    values: { ":me": caller.id },
  });
  return { lists: rows.map((row) => view(listFromItem(row), caller)) };
});

export const CreateGroceryList = operation("CreateGroceryList", async ({ name }, caller) => {
  const list: GroceryList = {
    id: randomUUID(),
    name,
    ownerId: caller.id,
    members: [await getMember(caller.id)],
  };
  await db.send(new PutCommand({ TableName: tableName(), Item: listItem(list) }));
  return { list: view(list, caller) };
});

export const DeleteGroceryList = operation("DeleteGroceryList", async ({ id }, caller) => {
  await getOwnedList(id, caller);
  // Items first, so a failure part way never leaves items without a list.
  const items = await queryAll(groceryItemsPk(id));
  await batchWrite(items.map(({ pk, sk }) => ({ DeleteRequest: { Key: { pk, sk } } })));
  await db.send(
    new DeleteCommand({ TableName: tableName(), Key: { pk: GROCERY_LIST_PK, sk: id } }),
  );
  return {};
});

export const ShareGroceryList = operation("ShareGroceryList", async ({ id, email }, caller) => {
  const list = await getOwnedList(id, caller);
  const user = await findUserByEmail(email);
  if (!user) throw new NotFoundError(`No Rolodex user has the email ${email}`);
  if (list.members.some((m) => m.id === user.id)) return { list: view(list, caller) };

  const shared: GroceryList = { ...list, members: [...list.members, user] };
  await db.send(new PutCommand({ TableName: tableName(), Item: listItem(shared) }));
  return { list: view(shared, caller) };
});

export const UnshareGroceryList = operation(
  "UnshareGroceryList",
  async ({ id, userId }, caller) => {
    const list = await getList(id, caller);
    if (userId === list.ownerId) {
      throw new ForbiddenError("The owner can't leave their list; delete it instead");
    }
    if (caller.id !== list.ownerId && caller.id !== userId) {
      throw new ForbiddenError("Only the list's owner can remove other members");
    }
    const members = list.members.filter((m) => m.id !== userId);
    await db.send(
      new PutCommand({ TableName: tableName(), Item: listItem({ ...list, members }) }),
    );
    return {};
  },
);

// Items

export const ListGroceries = operation("ListGroceries", async ({ listId }, caller) => {
  await getList(listId, caller);
  const rows = await queryAll(groceryItemsPk(listId));
  return { items: rows.sort(byPosition).map(itemFromRow) };
});

// Takes several items so a recipe's ingredients can be added in one call.
export const AddGroceries = operation("AddGroceries", async ({ listId, items }, caller) => {
  await getList(listId, caller);
  const added: GroceryItem[] = items.map((item) => ({
    id: randomUUID(),
    ...item,
    done: false,
  }));
  // Timestamps sort after the small positions ReorderGroceries assigns, so
  // new items go to the end of the list.
  const now = Date.now();
  await batchWrite(
    added.map((item, i) => ({
      PutRequest: {
        Item: { pk: groceryItemsPk(listId), sk: item.id, ...item, position: now + i },
      },
    })),
  );
  return { items: added };
});

export const UpdateGrocery = operation(
  "UpdateGrocery",
  async ({ listId, id, changes }, caller) => {
    await getList(listId, caller);
    const entries = Object.entries(changes);
    try {
      const result = await db.send(
        new UpdateCommand({
          TableName: tableName(),
          Key: { pk: groceryItemsPk(listId), sk: id },
          UpdateExpression: `SET ${entries.map(([key]) => `#${key} = :${key}`).join(", ")}`,
          ConditionExpression: "attribute_exists(pk)",
          ExpressionAttributeNames: Object.fromEntries(entries.map(([key]) => [`#${key}`, key])),
          ExpressionAttributeValues: Object.fromEntries(
            entries.map(([key, value]) => [`:${key}`, value]),
          ),
          ReturnValues: "ALL_NEW",
        }),
      );
      return { item: itemFromRow(result.Attributes ?? {}) };
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw new NotFoundError("Grocery item not found");
      }
      throw error;
    }
  },
);

export const DeleteGrocery = operation("DeleteGrocery", async ({ listId, id }, caller) => {
  await getList(listId, caller);
  await db.send(
    new DeleteCommand({ TableName: tableName(), Key: { pk: groceryItemsPk(listId), sk: id } }),
  );
  return {};
});

export const ReorderGroceries = operation("ReorderGroceries", async ({ listId, ids }, caller) => {
  await getList(listId, caller);
  const rows = (await queryAll(groceryItemsPk(listId))).sort(byPosition);
  const rank = new Map(ids.map((id, i) => [id, i]));
  // The given ids first, in their order; the rest after them, as they were.
  const ordered = [
    ...rows.filter((row) => rank.has(row.sk as string)).sort(
      (a, b) => rank.get(a.sk as string)! - rank.get(b.sk as string)!,
    ),
    ...rows.filter((row) => !rank.has(row.sk as string)),
  ];
  const moved = ordered
    .map((row, position) => ({ row, position }))
    .filter(({ row, position }) => row.position !== position);
  await Promise.all(
    moved.map(({ row, position }) =>
      db
        .send(
          new UpdateCommand({
            TableName: tableName(),
            Key: { pk: row.pk, sk: row.sk },
            UpdateExpression: "SET #position = :position",
            ConditionExpression: "attribute_exists(pk)",
            ExpressionAttributeNames: { "#position": "position" },
            ExpressionAttributeValues: { ":position": position },
          }),
        )
        // Deleted meanwhile; nothing to place.
        .catch((error) => {
          if (!(error instanceof ConditionalCheckFailedException)) throw error;
        }),
    ),
  );
  return {};
});
