import { type NewRecipe, type NytRecipeUri, parseNewRecipe } from "@rolodex/models";
import { NotFoundError } from "./http.ts";

// Optional NYT Cooking login. Recipe pages currently include the full recipe
// in __NEXT_DATA__ even for anonymous requests (the paywall is applied in the
// browser), so a session is only needed if NYT stops doing that.
export interface NytSession {
  cookie(): Promise<string | undefined>;
}

// NYT_COOKIE is a logged-in Cookie header; unset means anonymous requests.
export const envNytSession: NytSession = {
  async cookie() {
    return process.env.NYT_COOKIE || undefined;
  },
};

// Browser-like headers; NYT serves the full page to these.
const headers = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:158.0) Gecko/20100101 Firefox/158.0",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  Referer: "https://cooking.nytimes.com/",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
  Priority: "u=0, i",
  Pragma: "no-cache",
  "Cache-Control": "no-cache",
  TE: "trailers",
};

// The subset of the page's ScoopRecipe that we read. Rich-text fields are
// ProseMirror-style docs: { type, text?, content?: Node[] }.
interface DocNode {
  type: string;
  text?: string;
  content?: DocNode[];
}

interface ScoopRecipe {
  title: string;
  tags?: { name: string; type: string }[];
  ingredients?: { doc: DocNode };
  structuredIngredientsBeta?: { ingredientsBeta?: { name: string }[] }[];
  preparation?: { doc: DocNode };
}

function getNextData(html: string): unknown {
  const match = html.match(
    /<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match) {
    throw new Error("__NEXT_DATA__ script tag not found in page");
  }
  return JSON.parse(match[1]);
}

function textOf(node: DocNode): string {
  return node.text ?? (node.content ?? []).map(textOf).join("");
}

function nodesOfType(node: DocNode, type: string): DocNode[] {
  if (node.type === type) return [node];
  return (node.content ?? []).flatMap((child) => nodesOfType(child, type));
}

// "½ cup unsalted butter, softened" with structured name "unsalted butter"
// becomes quantity "½ cup", name "unsalted butter, softened".
function splitIngredient(text: string, name: string | undefined) {
  const at = name ? text.toLowerCase().indexOf(name.toLowerCase()) : -1;
  if (at <= 0) return { name: text, quantity: "" };
  return { name: text.slice(at), quantity: text.slice(0, at) };
}

export function toNewRecipe(scoop: ScoopRecipe): NewRecipe {
  const lines = scoop.ingredients ? nodesOfType(scoop.ingredients.doc, "list_item").map(textOf) : [];
  const names = scoop.structuredIngredientsBeta ?? [];
  // Only trust the structured names when they line up with the ingredient lines.
  const aligned = names.length === lines.length;
  const tags = scoop.tags ?? [];

  return parseNewRecipe({
    name: scoop.title,
    category: tags.find((tag) => tag.type === "COURSE")?.name,
    tags: tags.filter((tag) => tag.type !== "COURSE").map((tag) => tag.name),
    ingredients: lines.map((line, i) =>
      splitIngredient(line, aligned ? names[i].ingredientsBeta?.[0]?.name : undefined),
    ),
    steps: scoop.preparation ? nodesOfType(scoop.preparation.doc, "step").map(textOf) : [],
  });
}

export async function fetchNytRecipe(
  uri: NytRecipeUri,
  session: NytSession = envNytSession,
): Promise<NewRecipe> {
  const cookie = await session.cookie();
  const page = await fetch(uri, {
    headers: cookie ? { ...headers, Cookie: cookie } : headers,
  });
  if (page.status === 404) throw new NotFoundError("Recipe page not found");
  if (!page.ok) {
    throw new Error(`NYT request failed: ${page.status} ${page.statusText}`);
  }
  const nextData = getNextData(await page.text()) as {
    props?: { pageProps?: { scoopRecipe?: ScoopRecipe } };
  };
  const scoop = nextData.props?.pageProps?.scoopRecipe;
  if (!scoop) throw new Error("Page has no scoopRecipe");
  const recipe = toNewRecipe(scoop);
  // An empty recipe most likely means NYT stopped serving it to this request
  // (e.g. it now needs a session); fail rather than return a blank recipe.
  if (!recipe.ingredients.length && !recipe.steps.length) {
    throw new Error("NYT page had no ingredients or steps");
  }
  return recipe;
}
