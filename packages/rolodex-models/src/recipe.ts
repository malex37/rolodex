import { ValidationError, asObject, stringList, trimmed } from "./validation.ts";

export interface Ingredient {
  name: string;
  quantity: string;
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  tags: string[];
  ingredients: Ingredient[];
  steps: string[];
}

export type NewRecipe = Omit<Recipe, "id">;

export const DEFAULT_CATEGORY = "Uncategorized";

// Normalizes untrusted input (a request body, a form) into a NewRecipe:
// trims strings, lowercases tags, drops empty entries.
export function parseNewRecipe(input: unknown): NewRecipe {
  const data = asObject(input, "Recipe");

  const name = trimmed(data.name);
  if (!name) throw new ValidationError("name is required");

  const ingredients = Array.isArray(data.ingredients)
    ? data.ingredients
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({ name: trimmed(item.name), quantity: trimmed(item.quantity) }))
        .filter((item) => item.name)
    : [];

  return {
    name,
    category: trimmed(data.category) || DEFAULT_CATEGORY,
    tags: stringList(data.tags)
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
    ingredients,
    steps: stringList(data.steps)
      .map((step) => step.trim())
      .filter(Boolean),
  };
}
