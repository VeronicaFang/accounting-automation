# Core Local Tests

Core accounting logic lives in `src/core` so it can be tested locally before pushing Apps Script code.

Run from the repository root:

```powershell
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\rules.test.mjs
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\budget.test.mjs
C:\Users\AA018507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests\cash-flow.test.mjs
```

Coverage currently includes:

- credit-card payment date rules;
- installment splitting;
- budget status thresholds;
- valid budget item filtering;
- annual budget summary and spending impact;
- monthly cash-flow overview;
- upcoming credit-card payment grouping.

Apps Script files in `src/apps-script` are the deployment layer. Keep business rules aligned with `src/core` and add local tests before changing deployed behavior.
