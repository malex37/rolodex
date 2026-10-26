import { ValidationError, asObject, trimmed } from "./validation.ts";

export interface GroceryListMember {
  /** User id (Cognito user pool sub). */
  id: string;
  email: string;
}

// A shopping list. Its owner can share it with other users by email; every
// member can view and change its items.
export interface GroceryList {
  id: string;
  name: string;
  ownerId: string;
  /** Everyone with access, owner included. */
  members: GroceryListMember[];
}

/** A list as returned to a caller: `mine` is true when the caller owns it. */
export type GroceryListView = GroceryList & { mine: boolean };

export interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  done: boolean;
}

export type NewGroceryItem = Pick<GroceryItem, "name" | "quantity">;

export type GroceryUpdate = Partial<Pick<GroceryItem, "name" | "quantity" | "done">>;

export function parseListName(input: unknown): string {
  const name = trimmed(input);
  if (!name) throw new ValidationError("name is required");
  return name;
}

// Emails are matched against the user pool, so keep them to a plain shape
// (no quotes or backslashes that could break a ListUsers filter).
export function parseEmail(input: unknown): string {
  const email = trimmed(input).toLowerCase();
  if (!/^[^\s"\\@]+@[^\s"\\@]+\.[^\s"\\@]+$/.test(email)) {
    throw new ValidationError("A valid email is required");
  }
  return email;
}

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
