import { operation } from "../lib/http.ts";
import { fetchNytRecipe } from "../lib/nyt.ts";

export const FeedRecipe = operation("FeedRecipe", async ({ uri }) => ({
  recipe: await fetchNytRecipe(uri),
}));
