import { ValidationError, asObject, trimmed } from "./validation.ts";

export interface GroceryListMember {
  /** User id (Cognito user pool sub). */
  id: string;
  email: string;
}

/** A group of a list's items, e.g. those bought at one store. */
export interface GrocerySection {
  id: string;
  /** May be empty while a member hasn't named it yet. */
  name: string;
}

// A shopping list. Its owner can share it with other users by email; every
// member can view and change its items and sections.
export interface GroceryList {
  id: string;
  name: string;
  ownerId: string;
  /** Everyone with access, owner included. */
  members: GroceryListMember[];
  /** In display order, after the list's main (unnamed) section. */
  sections: GrocerySection[];
}

/** A list as returned to a caller: `mine` is true when the caller owns it. */
export type GroceryListView = GroceryList & { mine: boolean };

export interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  done: boolean;
  /** The section it's in; absent for the list's main section. */
  sectionId?: string;
}

export type NewGroceryItem = Pick<GroceryItem, "name" | "quantity" | "sectionId">;

/** A sectionId of null moves the item to the main section. */
export type GroceryUpdate = Partial<Pick<GroceryItem, "name" | "quantity" | "done">> & {
  sectionId?: string | null;
};

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

/** Section names may be empty (not named yet) but not long. */
export function parseSectionName(input: unknown): string {
  const name = trimmed(input);
  if (name.length > 60) throw new ValidationError("Section names are at most 60 characters");
  return name;
}

export function parseNewGroceryItem(input: unknown): NewGroceryItem {
  const data = asObject(input, "Grocery item");
  const name = trimmed(data.name);
  if (!name) throw new ValidationError("Each grocery item needs a name");
  const sectionId = trimmed(data.sectionId);
  return { name, quantity: trimmed(data.quantity), ...(sectionId && { sectionId }) };
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
  if (data.sectionId === null || trimmed(data.sectionId)) {
    update.sectionId = data.sectionId === null ? null : trimmed(data.sectionId);
  }
  if (Object.keys(update).length === 0) throw new ValidationError("Nothing to update");
  return update;
}
