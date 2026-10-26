import { ValidationError, asObject, trimmed } from "./validation.ts";

export interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  done: boolean;
}

export type NewGroceryItem = Pick<GroceryItem, "name" | "quantity">;

export type GroceryUpdate = Partial<Pick<GroceryItem, "name" | "quantity" | "done">>;

export function parseNewGroceryItem(input: unknown): NewGroceryItem {
  const data = asObject(input, "Grocery item");
  const name = trimmed(data.name);
  if (!name) throw new ValidationError("Each grocery item needs a name");
  return { name, quantity: trimmed(data.quantity) };
}

export function parseNewGroceryItems(input: unknown): NewGroceryItem[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new ValidationError("items must be a non-empty array");
  }
  return input.map(parseNewGroceryItem);
}

export function parseGroceryUpdate(input: unknown): GroceryUpdate {
  const data = asObject(input, "Grocery update");
  const update: GroceryUpdate = {};
  if (typeof data.done === "boolean") update.done = data.done;
  if (trimmed(data.name)) update.name = trimmed(data.name);
  if (typeof data.quantity === "string") update.quantity = data.quantity.trim();
  if (Object.keys(update).length === 0) throw new ValidationError("Nothing to update");
  return update;
}
