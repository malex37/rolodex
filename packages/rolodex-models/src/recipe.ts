import { type IngredientDraft, type Units, isUnit, parseAmount, readAmount, UNITS } from "./units.ts";
import { ValidationError, asObject, stringList, trimmed } from "./validation.ts";

export interface Ingredient {
  name: string;
  amount: number;
  unit: Units;
}

export interface Recipe {
  id: string;
  /** Id (Cognito user pool sub) of the user who created it. */
  ownerId: string;
  /** Private recipes are only visible to their owner; others are visible to every user. */
  private: boolean;
  name: string;
  category: string;
  tags: string[];
  ingredients: Ingredient[];
  steps: string[];
}

export type NewRecipe = Omit<Recipe, "id" | "ownerId">;

/** A recipe as returned to a caller: `mine` is true when the caller owns it. */
export type RecipeView = Recipe & { mine: boolean };

/** A recipe that may not be complete yet (e.g. imported): ingredients may lack amount or unit. */
export type RecipeDraft = Omit<NewRecipe, "ingredients"> & { ingredients: IngredientDraft[] };

export const DEFAULT_CATEGORY = "Uncategorized";

function objects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : [];
}

// Everything but the ingredients: trims strings, lowercases tags, drops empty entries.
function parseRecipeFields(input: unknown, what: string): Omit<NewRecipe, "ingredients"> {
  const data = asObject(input, what);
  const name = trimmed(data.name);
  if (!name) throw new ValidationError("name is required");
  return {
    name,
    private: data.private === true,
    category: trimmed(data.category) || DEFAULT_CATEGORY,
    tags: stringList(data.tags)
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
    steps: stringList(data.steps)
      .map((step) => step.trim())
      .filter(Boolean),
  };
}

// Blank rows (no name, amount or unit) are dropped.
function isBlank(item: Record<string, unknown>): boolean {
  return !trimmed(item.name) && !trimmed(String(item.amount ?? "")) && !item.unit;
}

// Normalizes untrusted input (a request body, a form) into a NewRecipe. Every
// ingredient needs a name, an amount (0.25, 1/4 or 1 1/2) and one of UNITS.
export function parseNewRecipe(input: unknown): NewRecipe {
  const fields = parseRecipeFields(input, "Recipe");
  const ingredients = objects(asObject(input, "Recipe").ingredients)
    .filter((item) => !isBlank(item))
    .map((item, i): Ingredient => {
      const name = trimmed(item.name);
      const label = `Ingredient ${i + 1}${name ? ` (${name})` : ""}`;
      if (!name) throw new ValidationError(`${label} needs a name`);
      if (!isUnit(item.unit)) {
        throw new ValidationError(`${label} needs a unit: one of ${UNITS.join(", ")}`);
      }
      return { name, amount: parseAmount(item.amount, `${label}: amount`), unit: item.unit };
    });
  return { ...fields, ingredients };
}

// Like parseNewRecipe, but keeps ingredients whose amount or unit is missing
// or invalid (leaving those out) so a person can complete them.
export function parseRecipeDraft(input: unknown): RecipeDraft {
  const fields = parseRecipeFields(input, "Recipe");
  const ingredients = objects(asObject(input, "Recipe").ingredients)
    .map((item): IngredientDraft => ({
      name: trimmed(item.name),
      amount: readAmount(item.amount),
      unit: isUnit(item.unit) ? item.unit : undefined,
    }))
    .filter((item) => item.name);
  return { ...fields, ingredients };
}
