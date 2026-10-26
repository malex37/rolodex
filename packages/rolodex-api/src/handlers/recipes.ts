import { randomUUID } from "node:crypto";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import type { Recipe, RecipeView } from "@rolodex/models";
import { RECIPE_PK, db, tableName } from "../lib/db.ts";
import { type Caller, ForbiddenError, NotFoundError, operation } from "../lib/http.ts";

// Recipes saved before ownership existed have no ownerId or private flag;
// they read as public and owned by nobody.
function fromItem({ pk: _pk, sk: _sk, ...item }: Record<string, unknown>): Recipe {
  return { ownerId: "", private: false, ...item } as unknown as Recipe;
}

// Recipes created before user ids were used store the owner's identity pool
// id instead, so either counts as the caller's.
function ownedBy(recipe: Recipe, caller: Caller): boolean {
  return recipe.ownerId === caller.id || recipe.ownerId === caller.identityId;
}

// Expression values for "ownerId IN (:me, :meLegacy)".
function ownerValues(caller: Caller) {
  return { ":me": caller.id, ":meLegacy": caller.identityId ?? caller.id };
}

function view(recipe: Recipe, caller: Caller): RecipeView {
  return { ...recipe, mine: ownedBy(recipe, caller) };
}

export const ListRecipes = operation("ListRecipes", async (_input, caller) => {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: "pk = :pk",
        FilterExpression: "attribute_not_exists(#private) OR #private = :false OR ownerId IN (:me, :meLegacy)",
        ExpressionAttributeNames: { "#private": "private" },
        ExpressionAttributeValues: { ":pk": RECIPE_PK, ":false": false, ...ownerValues(caller) },
        ExclusiveStartKey,
      }),
    );
    items.push(...(result.Items ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return { recipes: items.map((item) => view(fromItem(item), caller)) };
});

export const GetRecipe = operation("GetRecipe", async ({ id }, caller) => {
  const result = await db.send(
    new GetCommand({ TableName: tableName(), Key: { pk: RECIPE_PK, sk: id } }),
  );
  const recipe = result.Item && fromItem(result.Item);
  // Someone else's private recipe looks the same as a missing one.
  if (!recipe || (recipe.private && !ownedBy(recipe, caller))) {
    throw new NotFoundError("Recipe not found");
  }
  return { recipe: view(recipe, caller) };
});

export const CreateRecipe = operation("CreateRecipe", async (input, caller) => {
  const recipe: Recipe = { id: randomUUID(), ownerId: caller.id, ...input.recipe };
  await db.send(
    new PutCommand({
      TableName: tableName(),
      Item: { pk: RECIPE_PK, sk: recipe.id, ...recipe },
    }),
  );
  return { recipe: view(recipe, caller) };
});

export const UpdateRecipe = operation("UpdateRecipe", async ({ id, recipe: changes }, caller) => {
  const result = await db.send(
    new GetCommand({ TableName: tableName(), Key: { pk: RECIPE_PK, sk: id } }),
  );
  const existing = result.Item && fromItem(result.Item);
  if (!existing || (existing.private && !ownedBy(existing, caller))) {
    throw new NotFoundError("Recipe not found");
  }
  // Owner only; ownerless (pre-ownership) recipes can be edited by anyone.
  if (existing.ownerId && !ownedBy(existing, caller)) {
    throw new ForbiddenError("Only the recipe's owner can edit it");
  }

  // Keeps id and the stored ownerId (which may be a legacy identity id).
  const recipe: Recipe = { ...changes, id, ownerId: existing.ownerId };
  try {
    await db.send(
      new PutCommand({
        TableName: tableName(),
        Item: { pk: RECIPE_PK, sk: id, ...recipe, ownerId: existing.ownerId || undefined },
        // Fails if the recipe was deleted or changed hands since it was read.
        ConditionExpression: existing.ownerId
          ? "ownerId = :owner"
          : "attribute_exists(pk) AND attribute_not_exists(ownerId)",
        ExpressionAttributeValues: existing.ownerId ? { ":owner": existing.ownerId } : undefined,
      }),
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      throw new NotFoundError("Recipe not found");
    }
    throw err;
  }
  return { recipe: view(recipe, caller) };
});

export const DeleteRecipe = operation("DeleteRecipe", async ({ id }, caller) => {
  try {
    await db.send(
      new DeleteCommand({
        TableName: tableName(),
        Key: { pk: RECIPE_PK, sk: id },
        // Owner only; ownerless (pre-ownership) recipes can be deleted by anyone.
        ConditionExpression: "attribute_not_exists(ownerId) OR ownerId IN (:me, :meLegacy)",
        ExpressionAttributeValues: ownerValues(caller),
      }),
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      throw new ForbiddenError("Only the recipe's owner can delete it");
    }
    throw err;
  }
  return {};
});
