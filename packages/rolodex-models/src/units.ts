import { ValidationError } from "./validation.ts";

// Units an ingredient amount can be in. "whole" is a plain count (2 eggs).
export const UNITS = [
  "whole",
  "teaspoon",
  "tablespoon",
  "cup",
  "fl oz",
  "oz",
  "grams",
  "kilograms",
  "lbs",
] as const;

export type Units = (typeof UNITS)[number];

export function isUnit(value: unknown): value is Units {
  return typeof value === "string" && (UNITS as readonly string[]).includes(value);
}

/**
 * Units a quantity can be shown in: the stored Units plus metric volumes,
 * which only appear when converting imperial volumes for display.
 */
export type DisplayUnit = Units | "ml" | "liters";

// How each unit reads after an amount: [one, many]. "whole" shows no unit.
const UNIT_LABELS: Record<DisplayUnit, [string, string]> = {
  whole: ["", ""],
  teaspoon: ["teaspoon", "teaspoons"],
  tablespoon: ["tablespoon", "tablespoons"],
  cup: ["cup", "cups"],
  "fl oz": ["fl oz", "fl oz"],
  oz: ["oz", "oz"],
  grams: ["gram", "grams"],
  kilograms: ["kilogram", "kilograms"],
  lbs: ["lb", "lbs"],
  ml: ["ml", "ml"],
  liters: ["liter", "liters"],
};

/** Name of a unit in a picker, e.g. "teaspoon" or "whole (count)". */
export function unitLabel(unit: Units): string {
  return unit === "whole" ? "whole (count)" : UNIT_LABELS[unit][0];
}

// Amounts

const VULGAR_FRACTIONS: Record<string, string> = {
  "¼": "1/4", "½": "1/2", "¾": "3/4", "⅓": "1/3", "⅔": "2/3", "⅕": "1/5", "⅖": "2/5",
  "⅗": "3/5", "⅘": "4/5", "⅙": "1/6", "⅚": "5/6", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8",
  "⅞": "7/8",
};

// "1½" -> "1 1/2", "¾" -> "3/4", "1⁄2" (fraction slash) -> "1/2".
function normalizeFractions(text: string): string {
  return text
    .replace(/⁄/g, "/")
    .replace(/(\d)?\s*([¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, (_m, whole: string | undefined, f: string) =>
      whole ? `${whole} ${VULGAR_FRACTIONS[f]}` : VULGAR_FRACTIONS[f],
    );
}

// A decimal ("0.25", ".5", "2"), fraction ("1/4") or mixed number ("1 1/2").
const AMOUNT = String.raw`\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+`;

function amountValue(text: string): number | undefined {
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  const fraction = text.match(/^(\d+)\/(\d+)$/);
  const value = mixed
    ? Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
    : fraction
      ? Number(fraction[1]) / Number(fraction[2])
      : /^(\d*\.\d+|\d+)$/.test(text)
        ? Number(text)
        : NaN;
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Reads an amount typed as a decimal (0.25) or fraction (1/4, 1 1/2); undefined if it isn't one. */
export function readAmount(input: unknown): number | undefined {
  if (typeof input === "number") return Number.isFinite(input) && input > 0 ? input : undefined;
  if (typeof input !== "string") return undefined;
  return amountValue(normalizeFractions(input.trim()).replace(/\s+/g, " "));
}

/** Like readAmount, but throws a ValidationError naming `what` when it isn't an amount. */
export function parseAmount(input: unknown, what = "amount"): number {
  const amount = readAmount(input);
  if (amount === undefined) {
    throw new ValidationError(`${what} must be a positive number like 0.25, 1/4 or 1 1/2`);
  }
  return amount;
}

const DENOMINATORS = [2, 3, 4, 8];

/** Shows an amount as a fraction where one is close (0.25 -> "1/4", 1.5 -> "1 1/2"), else a short decimal. */
export function formatAmount(amount: number): string {
  let whole = Math.floor(amount);
  const rest = amount - whole;
  if (rest < 0.005) return String(whole);
  if (rest > 0.995) return String(whole + 1);
  for (const d of DENOMINATORS) {
    const n = Math.round(rest * d);
    if (n > 0 && n < d && Math.abs(rest - n / d) < 0.01) {
      return whole ? `${whole} ${n}/${d}` : `${n}/${d}`;
    }
  }
  return String(Math.round(amount * 100) / 100);
}

export interface Quantity {
  amount: number;
  unit: DisplayUnit;
}

/** "1 1/2 cups", "1 tablespoon", "2" (whole), "2.5 ml". Metric amounts show as decimals. */
export function formatQuantity({ amount, unit }: Quantity): string {
  const [one, many] = UNIT_LABELS[unit];
  const label = amount > 1 ? many : one;
  const shown =
    MEASURES[unit]?.system === "metric"
      ? String(Math.round(amount * 100) / 100)
      : formatAmount(amount);
  return label ? `${shown} ${label}` : shown;
}

// Conversions between imperial and metric, for display only.

export type MeasurementSystem = "imperial" | "metric";

// Each convertible unit's system and its size in the base metric unit
// (ml for volume, grams for weight). "whole" is neither and never converts.
const MEASURES: Partial<Record<DisplayUnit, { system: MeasurementSystem; base: "ml" | "grams"; size: number }>> = {
  teaspoon: { system: "imperial", base: "ml", size: 4.92892 },
  tablespoon: { system: "imperial", base: "ml", size: 14.7868 },
  cup: { system: "imperial", base: "ml", size: 236.588 },
  "fl oz": { system: "imperial", base: "ml", size: 29.5735 },
  oz: { system: "imperial", base: "grams", size: 28.3495 },
  lbs: { system: "imperial", base: "grams", size: 453.592 },
  ml: { system: "metric", base: "ml", size: 1 },
  liters: { system: "metric", base: "ml", size: 1000 },
  grams: { system: "metric", base: "grams", size: 1 },
  kilograms: { system: "metric", base: "grams", size: 1000 },
};

/** True when convertQuantity would show this quantity differently in `system`. */
export function canConvert(quantity: Quantity, system: MeasurementSystem): boolean {
  const measure = MEASURES[quantity.unit];
  return measure !== undefined && measure.system !== system;
}

// Metric reads best as round numbers (5 ml, 454 g, 1.25 kg).
function roundMetric(amount: number, unit: DisplayUnit): Quantity {
  const big = unit === "ml" ? "liters" : "kilograms";
  if (amount >= 1000) return { amount: Math.round(amount / 10) / 100, unit: big };
  return { amount: amount < 10 ? Math.round(amount * 10) / 10 : Math.round(amount), unit };
}

// Imperial reads best as eighths (3 1/2 oz, 1 1/8 lbs).
function roundImperial(amount: number, unit: DisplayUnit): Quantity {
  const eighths = Math.max(1, Math.round(amount * 8)) / 8;
  return { amount: eighths, unit };
}

/**
 * The quantity in `system`, approximately. Imperial volumes become ml or
 * liters and weights grams or kilograms; metric weights become oz or lbs.
 * Quantities already in `system`, and counts, come back unchanged.
 */
export function convertQuantity(quantity: Quantity, system: MeasurementSystem): Quantity {
  const measure = MEASURES[quantity.unit];
  if (!measure || measure.system === system) return quantity;

  const base = quantity.amount * measure.size;
  if (system === "metric") return roundMetric(base, measure.base);

  // Metric to imperial: only weights can be stored in metric (grams, kilograms),
  // and metric volumes only appear after converting, so map both by base.
  if (measure.base === "ml") {
    const flOz = base / MEASURES["fl oz"]!.size;
    return flOz >= 8
      ? roundImperial(flOz / 8, "cup")
      : roundImperial(base / MEASURES.tablespoon!.size, "tablespoon");
  }
  const oz = base / MEASURES.oz!.size;
  return oz >= 16 ? roundImperial(oz / 16, "lbs") : roundImperial(oz, "oz");
}

// Reading free-text ingredient lines ("½ cup unsalted butter, softened")

// Spellings of each unit at the start of an ingredient line, longest first so
// "fl oz" wins over "oz".
const UNIT_WORDS: [RegExp, Units][] = (
  [
    ["fluid ounces?|fl\\.? ?oz\\.?", "fl oz"],
    ["tablespoons?|tbsps?\\.?|tbs\\.?", "tablespoon"],
    ["teaspoons?|tsps?\\.?", "teaspoon"],
    ["cups?", "cup"],
    ["ounces?|oz\\.?", "oz"],
    ["kilograms?|kilos?|kgs?\\.?", "kilograms"],
    ["grams?|g\\.?", "grams"],
    ["pounds?|lbs?\\.?", "lbs"],
  ] as const
).map(([pattern, unit]) => [new RegExp(`^(?:${pattern})(?=\\s|$)\\s*`, "i"), unit]);

export interface IngredientDraft {
  name: string;
  amount?: number;
  unit?: Units;
}

/**
 * Splits a free-text ingredient into amount, unit and name, e.g.
 * "1 ½ tablespoons ground cumin" -> 1.5 tablespoon "ground cumin" and
 * "2 15-ounce cans kidney beans" -> 2 whole "15-ounce cans kidney beans".
 * Amount and unit are left out when the text doesn't start with an amount
 * ("Pinch of salt"). Ranges ("¾ to 1 cup") use their first amount.
 */
export function parseIngredientText(text: string): IngredientDraft {
  const line = normalizeFractions(text.trim()).replace(/\s+/g, " ");
  const half = line.match(/^half (?:a|an)(?=\s|$)\s*/i);
  const match = half
    ? null
    : line.match(new RegExp(`^(${AMOUNT})(?:\\s*(?:to|-|–|or)\\s*(?:${AMOUNT}))?(?=\\s|$)\\s*`));
  const amount = half ? 0.5 : match && amountValue(match[1]);
  if (!amount) return { name: line };

  let rest = line.slice((half ?? match!)[0].length);
  let unit: Units = "whole";
  for (const [pattern, candidate] of UNIT_WORDS) {
    const word = rest.match(pattern);
    if (word) {
      unit = candidate;
      rest = rest.slice(word[0].length).replace(/^of\s+/i, "");
      break;
    }
  }
  return { name: rest, amount, unit };
}
