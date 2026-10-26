// Runs the FeedRecipe handler locally:
//   npx tsx scripts/feedRecipe.ts https://cooking.nytimes.com/recipes/3783-original-plum-torte
// To send a logged-in session, put NYT_COOKIE in packages/rolodex-api/.env and
// add --env-file=.env.
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { FeedRecipe } from "../src/handlers/feed.ts";

async function main() {
  const uri = process.argv[2];
  if (!uri) throw new Error("Usage: feedRecipe.ts <cooking.nytimes.com recipe URL>");
  const result = await FeedRecipe({ body: JSON.stringify({ uri }) } as APIGatewayProxyEventV2);
  console.log(result.statusCode);
  console.log(JSON.stringify(JSON.parse(result.body ?? "null"), null, 2));
}

void main();
