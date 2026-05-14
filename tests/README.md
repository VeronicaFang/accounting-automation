# Core Local Tests

Core accounting logic lives in `src/core` so it can be tested locally before pushing Apps Script code.

Run from the repository root:

```powershell
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\rules.test.mjs
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\budget.test.mjs
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\cash-flow.test.mjs
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\expenses.test.mjs
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\income.test.mjs
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\invoice-import.test.mjs
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\apps-script-config.test.mjs
```

Coverage currently includes:

- credit-card payment date rules;
- installment splitting;
- budget status thresholds;
- valid budget item filtering;
- annual budget summary and spending impact;
- monthly cash-flow overview;
- monthly credit-card bill estimates;
- payment status updates;
- recent expenses and manual batch import parsing;
- income schedule creation and reconciliation;
- invoice draft parsing, duplicate checks, pending draft pagination;
- Apps Script header consistency checks.

Apps Script files in `src/apps-script` are the deployment layer. Keep business rules aligned with `src/core` and add local tests before changing deployed behavior.
