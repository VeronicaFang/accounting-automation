import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildSupabaseImportPackage } from "../src/core/google-sheet-migration-package.mjs";

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  throw new Error("Usage: generate_supabase_import_package.mjs <mapped-workbook-rows.json> <output.json>");
}

const workbookRows = JSON.parse(readFileSync(inputPath, "utf8"));
const importPackage = buildSupabaseImportPackage(workbookRows);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(importPackage, null, 2));

console.log(
  JSON.stringify(
    {
      outputPath,
      summary: importPackage.summary
    },
    null,
    2
  )
);
