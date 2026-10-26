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

function view(recipe: Recipe, caller: Caller): RecipeView {
  return { ...recipe, mine: recipe.ownerId === caller.id };
}

export const ListRecipes = operation("ListRecipes", async (_input, caller) => {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: "pk = :pk",
        FilterExpression: "attribute_not_exists(#private) OR #private = :false OR ownerId = :me",
        ExpressionAttributeNames: { "#private": "private" },
        ExpressionAttributeValues: { ":pk": RECIPE_PK, ":false": false, ":me": caller.id },
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
  if (!recipe || (recipe.private && recipe.ownerId !== caller.id)) {
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

export const DeleteRecipe = operation("DeleteRecipe", async ({ id }, caller) => {
  try {
    await db.send(
      new DeleteCommand({
        TableName: tableName(),
        Key: { pk: RECIPE_PK, sk: id },
        // Owner only; ownerless (pre-ownership) recipes can be deleted by anyone.
        ConditionExpression: "attribute_not_exists(ownerId) OR ownerId = :me",
        ExpressionAttributeValues: { ":me": caller.id },
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
