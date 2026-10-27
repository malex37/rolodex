import {
  type GroceryItem,
  type GroceryListView,
  type GroceryUpdate,
  type NewGroceryItem,
  parseEmail,
  parseGroceryUpdate,
  parseListName,
  parseNewGroceryItems,
  parseSectionName,
} from "./grocery.ts";
import { type NewRecipe, type RecipeDraft, type RecipeView, parseNewRecipe } from "./recipe.ts";
import { ValidationError, asObject, stringList, trimmed } from "./validation.ts";

// Every API operation is `POST /{OperationName}` with a JSON body of
// `{OperationName}Input`, answering 200 with `{OperationName}Output`.

export type EmptyOutput = Record<string, never>;

// Recipes

// Every user sees all public recipes plus their own private ones; a private
// recipe owned by someone else is reported as NotFound.

export type ListRecipesInput = Record<string, never>;
export interface ListRecipesOutput {
  recipes: RecipeView[];
}

export interface GetRecipeInput {
  id: string;
}
export interface GetRecipeOutput {
  recipe: RecipeView;
}

export interface CreateRecipeInput {
  recipe: NewRecipe;
}
export interface CreateRecipeOutput {
  recipe: RecipeView;
}

// Replaces a recipe's contents. Only the owner can update or delete a recipe
// (Forbidden otherwise).
export interface UpdateRecipeInput {
  id: string;
  recipe: NewRecipe;
}
export interface UpdateRecipeOutput {
  recipe: RecipeView;
}

export interface DeleteRecipeInput {
  id: string;
}
export type DeleteRecipeOutput = EmptyOutput;

export type NytRecipeUri = `${string}cooking.nytimes.com/recipes/${string}`;

// Imports a recipe from NYT Cooking without saving it; the caller reviews it,
// fills in any ingredient amounts or units it couldn't read, and saves it with
// CreateRecipe.
export interface FeedRecipeInput {
  uri: NytRecipeUri;
}
export interface FeedRecipeOutput {
  recipe: RecipeDraft;
}

// Grocery lists

// A user sees the lists they own or that were shared with them; any other
// list is reported as NotFound. Only the owner can share, rename or delete a
// list; members can change its items and leave it.

export type ListGroceryListsInput = Record<string, never>;
export interface ListGroceryListsOutput {
  lists: GroceryListView[];
}

export interface CreateGroceryListInput {
  name: string;
}
export interface CreateGroceryListOutput {
  list: GroceryListView;
}

export interface DeleteGroceryListInput {
  id: string;
}
export type DeleteGroceryListOutput = EmptyOutput;

/** Gives the user with this email access to the list. */
export interface ShareGroceryListInput {
  id: string;
  email: string;
}
export interface ShareGroceryListOutput {
  list: GroceryListView;
}

/** The owner removes a member, or a member removes themselves (leaves). */
export interface UnshareGroceryListInput {
  id: string;
  userId: string;
}
export type UnshareGroceryListOutput = EmptyOutput;

// Sections of a list, which group its items (say, by store). Any member can
// add, rename or remove them; each answers with the updated list.

export interface CreateGrocerySectionInput {
  listId: string;
  name: string;
}
export interface CreateGrocerySectionOutput {
  list: GroceryListView;
}

export interface RenameGrocerySectionInput {
  listId: string;
  id: string;
  name: string;
}
export interface RenameGrocerySectionOutput {
  list: GroceryListView;
}

/** Its items move to the list's main section. */
export interface DeleteGrocerySectionInput {
  listId: string;
  id: string;
}
export interface DeleteGrocerySectionOutput {
  list: GroceryListView;
}

// Grocery items, always within a list. An item's sectionId must be one of
// its list's sections (ValidationError otherwise).

export interface ListGroceriesInput {
  listId: string;
}
export interface ListGroceriesOutput {
  items: GroceryItem[];
}

export interface AddGroceriesInput {
  listId: string;
  items: NewGroceryItem[];
}
export interface AddGroceriesOutput {
  items: GroceryItem[];
}

export interface UpdateGroceryInput {
  listId: string;
  id: string;
  changes: GroceryUpdate;
}
export interface UpdateGroceryOutput {
  item: GroceryItem;
}

export interface DeleteGroceryInput {
  listId: string;
  id: string;
}
export type DeleteGroceryOutput = EmptyOutput;

/**
 * Puts the list's items in the order of `ids`. Items missing from `ids` (say,
 * added by another member meanwhile) keep their place after them; unknown ids
 * are ignored.
 */
export interface ReorderGroceriesInput {
  listId: string;
  ids: string[];
}
export type ReorderGroceriesOutput = EmptyOutput;

// Errors: any non-200 response has this body.

export type ErrorCode = "ValidationError" | "Forbidden" | "NotFound" | "InternalError";

export interface ErrorOutput {
  code: ErrorCode;
  message: string;
}

// Operation registry

export interface RolodexOperations {
  ListRecipes: { input: ListRecipesInput; output: ListRecipesOutput };
  GetRecipe: { input: GetRecipeInput; output: GetRecipeOutput };
  CreateRecipe: { input: CreateRecipeInput; output: CreateRecipeOutput };
  UpdateRecipe: { input: UpdateRecipeInput; output: UpdateRecipeOutput };
  DeleteRecipe: { input: DeleteRecipeInput; output: DeleteRecipeOutput };
  FeedRecipe: { input: FeedRecipeInput; output: FeedRecipeOutput };
  ListGroceryLists: { input: ListGroceryListsInput; output: ListGroceryListsOutput };
  CreateGroceryList: { input: CreateGroceryListInput; output: CreateGroceryListOutput };
  DeleteGroceryList: { input: DeleteGroceryListInput; output: DeleteGroceryListOutput };
  ShareGroceryList: { input: ShareGroceryListInput; output: ShareGroceryListOutput };
  UnshareGroceryList: { input: UnshareGroceryListInput; output: UnshareGroceryListOutput };
  CreateGrocerySection: { input: CreateGrocerySectionInput; output: CreateGrocerySectionOutput };
  RenameGrocerySection: { input: RenameGrocerySectionInput; output: RenameGrocerySectionOutput };
  DeleteGrocerySection: { input: DeleteGrocerySectionInput; output: DeleteGrocerySectionOutput };
  ListGroceries: { input: ListGroceriesInput; output: ListGroceriesOutput };
  AddGroceries: { input: AddGroceriesInput; output: AddGroceriesOutput };
  UpdateGrocery: { input: UpdateGroceryInput; output: UpdateGroceryOutput };
  DeleteGrocery: { input: DeleteGroceryInput; output: DeleteGroceryOutput };
  ReorderGroceries: { input: ReorderGroceriesInput; output: ReorderGroceriesOutput };
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

function parseListId(input: unknown): { listId: string } {
  const listId = trimmed(asObject(input, "Input").listId);
  if (!listId) throw new ValidationError("listId is required");
  return { listId };
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
  UpdateRecipe: (input) => ({
    ...parseId(input),
    recipe: parseNewRecipe(asObject(input, "Input").recipe),
  }),
  DeleteRecipe: parseId,
  FeedRecipe: parseNytRecipeUri,
  ListGroceryLists: parseEmpty,
  CreateGroceryList: (input) => ({ name: parseListName(asObject(input, "Input").name) }),
  DeleteGroceryList: parseId,
  ShareGroceryList: (input) => ({
    ...parseId(input),
    email: parseEmail(asObject(input, "Input").email),
  }),
  UnshareGroceryList: (input) => {
    const userId = trimmed(asObject(input, "Input").userId);
    if (!userId) throw new ValidationError("userId is required");
    return { ...parseId(input), userId };
  },
  CreateGrocerySection: (input) => ({
    ...parseListId(input),
    name: parseSectionName(asObject(input, "Input").name),
  }),
  RenameGrocerySection: (input) => ({
    ...parseListId(input),
    ...parseId(input),
    name: parseSectionName(asObject(input, "Input").name),
  }),
  DeleteGrocerySection: (input) => ({ ...parseListId(input), ...parseId(input) }),
  ListGroceries: parseListId,
  AddGroceries: (input) => ({
    ...parseListId(input),
    items: parseNewGroceryItems(asObject(input, "Input").items),
  }),
  UpdateGrocery: (input) => ({
    ...parseListId(input),
    ...parseId(input),
    changes: parseGroceryUpdate(asObject(input, "Input").changes),
  }),
  DeleteGrocery: (input) => ({ ...parseListId(input), ...parseId(input) }),
  ReorderGroceries: (input) => {
    const ids = [...new Set(stringList(asObject(input, "Input").ids).map((id) => id.trim()))];
    if (ids.length === 0 || ids.some((id) => !id)) {
      throw new ValidationError("ids must be a non-empty array of item ids");
    }
    return { ...parseListId(input), ids };
  },
};
