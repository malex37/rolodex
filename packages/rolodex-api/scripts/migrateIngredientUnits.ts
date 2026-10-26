// One-off: converts recipes saved with free-text ingredient quantities
// ({ name, quantity: "1 ½ tablespoons" }) to { name, amount, unit }.
// Prints the plan; writes only with --apply. A recipe with any quantity that
// can't be read is skipped and listed, so it can be fixed by hand.
//   TABLE_NAME=... AWS_REGION=us-west-2 npx tsx scripts/migrateIngredientUnits.ts [--apply]
import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { type Ingredient, formatQuantity, parseIngredientText } from "@rolodex/models";
import { RECIPE_PK, db, tableName } from "../src/lib/db.ts";

interface LegacyIngredient {
  name: string;
  quantity?: string;
}

// "1 large" + "onion" -> 1 whole "large onion"; text after the amount and unit
// joins the name.
function convert({ name, quantity }: LegacyIngredient): Ingredient | undefined {
  const draft = parseIngredientText(quantity ?? "");
  if (!draft.amount || !draft.unit) return undefined;
  return { name: [draft.name, name].filter(Boolean).join(" "), amount: draft.amount, unit: draft.unit };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const rows: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": RECIPE_PK },
        ExclusiveStartKey,
      }),
    );
    rows.push(...(result.Items ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  for (const row of rows) {
    const legacy = (row.ingredients ?? []) as LegacyIngredient[];
    if (!legacy.some((item) => "quantity" in item)) continue;

    console.log(`\n${row.name} (${row.sk})`);
    const converted = legacy.map((item) => ({ item, result: convert(item) }));
    for (const { item, result } of converted) {
      const before = `${item.quantity ?? ""} | ${item.name}`;
      console.log(`  ${before.padEnd(60)} -> ${result ? `${formatQuantity(result)} | ${result.unit} | ${result.name}` : "CAN'T READ"}`);
    }
    if (converted.some(({ result }) => !result)) {
      console.log("  skipped: fix the lines above by hand");
      continue;
    }
    if (apply) {
      await db.send(
        new UpdateCommand({
          TableName: tableName(),
          Key: { pk: RECIPE_PK, sk: row.sk },
          UpdateExpression: "SET ingredients = :new",
          // Only if nobody changed the ingredients since they were read.
          ConditionExpression: "ingredients = :old",
          ExpressionAttributeValues: {
            ":new": converted.map(({ result }) => result),
            ":old": row.ingredients,
          },
        }),
      );
      console.log("  migrated");
    }
  }
  if (!apply) console.log("\nDry run; nothing written. Run with --apply to migrate.");
}

void main();
