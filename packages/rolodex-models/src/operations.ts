import {
  type GroceryItem,
  type GroceryUpdate,
  type NewGroceryItem,
  parseGroceryUpdate,
  parseNewGroceryItems,
} from "./grocery.ts";
import { type NewRecipe, type Recipe, parseNewRecipe } from "./recipe.ts";
import { ValidationError, asObject, trimmed } from "./validation.ts";

// Every API operation is `POST /{OperationName}` with a JSON body of
// `{OperationName}Input`, answering 200 with `{OperationName}Output`.

export type EmptyOutput = Record<string, never>;

// Recipes

export type ListRecipesInput = Record<string, never>;
export interface ListRecipesOutput {
  recipes: Recipe[];
}

export interface GetRecipeInput {
  id: string;
}
export interface GetRecipeOutput {
  recipe: Recipe;
}

export interface CreateRecipeInput {
  recipe: NewRecipe;
}
export interface CreateRecipeOutput {
  recipe: Recipe;
}

export interface DeleteRecipeInput {
  id: string;
}
export type DeleteRecipeOutput = EmptyOutput;

export type NytRecipeUri = `${string}cooking.nytimes.com/recipes/${string}`;

// Imports a recipe from NYT Cooking without saving it; the caller reviews it
// and saves it with CreateRecipe.
export interface FeedRecipeInput {
  uri: NytRecipeUri;
}
export interface FeedRecipeOutput {
  recipe: NewRecipe;
}

// Groceries

export type ListGroceriesInput = Record<string, never>;
export interface ListGroceriesOutput {
  items: GroceryItem[];
}

export interface AddGroceriesInput {
  items: NewGroceryItem[];
}
export interface AddGroceriesOutput {
  items: GroceryItem[];
}

export interface UpdateGroceryInput {
  id: string;
  changes: GroceryUpdate;
}
export interface UpdateGroceryOutput {
  item: GroceryItem;
}

export interface DeleteGroceryInput {
  id: string;
}
export type DeleteGroceryOutput = EmptyOutput;

// Errors: any non-200 response has this body.

export type ErrorCode = "ValidationError" | "NotFound" | "InternalError";

export interface ErrorOutput {
  code: ErrorCode;
  message: string;
}

// Operation registry

export interface RolodexOperations {
  ListRecipes: { input: ListRecipesInput; output: ListRecipesOutput };
  GetRecipe: { input: GetRecipeInput; output: GetRecipeOutput };
  CreateRecipe: { input: CreateRecipeInput; output: CreateRecipeOutput };
  DeleteRecipe: { input: DeleteRecipeInput; output: DeleteRecipeOutput };
  FeedRecipe: { input: FeedRecipeInput; output: FeedRecipeOutput };
  ListGroceries: { input: ListGroceriesInput; output: ListGroceriesOutput };
  AddGroceries: { input: AddGroceriesInput; output: AddGroceriesOutput };
  UpdateGrocery: { input: UpdateGroceryInput; output: UpdateGroceryOutput };
  DeleteGrocery: { input: DeleteGroceryInput; output: DeleteGroceryOutput };
}

export type OperationName = keyof RolodexOperations;
export type OperationInput<N extends OperationName> = RolodexOperations[N]["input"];
export type OperationOutput<N extends OperationName> = RolodexOperations[N]["output"];

// Input parsing: normalizes untrusted request bodies, throwing ValidationError.

function parseId(input: unknown): { id: string } {
  const id = trimmed(asObject(input, "Input").id);
  if (!id) throw new ValidationError("id is required");
  return { id };
}

function parseEmpty(input: unknown): Record<string, never> {
  asObject(input, "Input");
  return {};
}

// The template type alone would accept e.g. "https://evil.example/?cooking.nytimes.com/recipes/",
// so check the parsed host and rebuild the URL from its path.
function parseNytRecipeUri(input: unknown): FeedRecipeInput {
  const raw = trimmed(asObject(input, "Input").uri);
  let url: URL;
  try {
    url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
  } catch {
    throw new ValidationError("uri must be a URL");
  }
  if (url.hostname !== "cooking.nytimes.com" || !url.pathname.startsWith("/recipes/")) {
    throw new ValidationError("uri must be a cooking.nytimes.com/recipes/ URL");
  }
  return { uri: `https://cooking.nytimes.com${url.pathname}` as NytRecipeUri };
}

export const inputParsers: {
  [N in OperationName]: (input: unknown) => OperationInput<N>;
} = {
  ListRecipes: parseEmpty,
  GetRecipe: parseId,
  CreateRecipe: (input) => ({ recipe: parseNewRecipe(asObject(input, "Input").recipe) }),
  DeleteRecipe: parseId,
  FeedRecipe: parseNytRecipeUri,
  ListGroceries: parseEmpty,
  AddGroceries: (input) => ({ items: parseNewGroceryItems(asObject(input, "Input").items) }),
  UpdateGrocery: (input) => ({
    ...parseId(input),
    changes: parseGroceryUpdate(asObject(input, "Input").changes),
  }),
  DeleteGrocery: parseId,
};
