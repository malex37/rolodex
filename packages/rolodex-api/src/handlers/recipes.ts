import { randomUUID } from "node:crypto";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Recipe } from "@rolodex/models";
import { RECIPE_PK, db, tableName } from "../lib/db.ts";
import { NotFoundError, operation } from "../lib/http.ts";

function fromItem({ pk: _pk, sk: _sk, ...recipe }: Record<string, unknown>): Recipe {
  return recipe as unknown as Recipe;
}

export const ListRecipes = operation("ListRecipes", async () => {
  const result = await db.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": RECIPE_PK },
    }),
  );
  return { recipes: (result.Items ?? []).map(fromItem) };
});

export const GetRecipe = operation("GetRecipe", async ({ id }) => {
  const result = await db.send(
    new GetCommand({ TableName: tableName(), Key: { pk: RECIPE_PK, sk: id } }),
  );
  if (!result.Item) throw new NotFoundError("Recipe not found");
  return { recipe: fromItem(result.Item) };
});

export const CreateRecipe = operation("CreateRecipe", async (input) => {
  const recipe: Recipe = { id: randomUUID(), ...input.recipe };
  await db.send(
    new PutCommand({
      TableName: tableName(),
      Item: { pk: RECIPE_PK, sk: recipe.id, ...recipe },
    }),
  );
  return { recipe };
});

export const DeleteRecipe = operation("DeleteRecipe", async ({ id }) => {
  await db.send(
    new DeleteCommand({ TableName: tableName(), Key: { pk: RECIPE_PK, sk: id } }),
  );
  return {};
});
