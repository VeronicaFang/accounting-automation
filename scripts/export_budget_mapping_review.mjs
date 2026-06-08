import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { generateBudgetMappingReviewRows } from "../src/core/google-sheet-migration-drafts.mjs";

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  throw new Error("Usage: export_budget_mapping_review.mjs <workbook-rows.json> <output.csv>");
}

const workbookRows = JSON.parse(readFileSync(inputPath, "utf8"));
const rows = generateBudgetMappingReviewRows(workbookRows);
const headers = [
  "legacy_budget_item",
  "occurrence_count",
  "suggested_group_name",
  "suggested_item_name",
  "confidence",
  "confirmed_budget_item",
  "review_status",
  "notes"
];

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `\uFEFF${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvCell(row[header])).join(","))
    .join("\n")}\n`
);

console.log(
  JSON.stringify(
    {
      outputPath,
      rowCount: rows.length
    },
    null,
    2
  )
);
