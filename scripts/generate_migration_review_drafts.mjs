import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { generateMigrationReviewDrafts } from "../src/core/google-sheet-migration-drafts.mjs";

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  throw new Error("Usage: generate_migration_review_drafts.mjs <workbook-rows.json> <output.json>");
}

const workbookRows = JSON.parse(readFileSync(inputPath, "utf8"));
const reviewDrafts = generateMigrationReviewDrafts(workbookRows);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(reviewDrafts, null, 2));

console.log(
  JSON.stringify(
    {
      outputPath,
      summary: reviewDrafts.summary
    },
    null,
    2
  )
);
