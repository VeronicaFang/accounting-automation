import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("Apps Script UI keeps the daily dashboard sections first", () => {
  const index = read("src/apps-script/Index.html");

  assert.match(index, /class="[^"]*app-header/);
  assert.match(index, /class="[^"]*priority-grid/);
  assert.match(index, /id="cashFlowOverview"/);
  assert.match(index, /id="monthlyBillEstimates"/);
  assert.match(index, /id="budgetSummary"/);
  assert.ok(index.indexOf('id="cashFlowOverview"') < index.indexOf('id="invoiceWorkbench"'));
});

test("invoice review workbench exposes batch controls and selection feedback", () => {
  const index = read("src/apps-script/Index.html");
  const client = read("src/apps-script/Client.html");

  assert.match(index, /id="invoiceWorkbench"/);
  assert.match(index, /class="[^"]*batch-toolbar/);
  assert.match(client, /id="invoiceSelectionMeta"/);
  assert.match(client, /function updateInvoiceSelectionSummary/);
  assert.match(client, /onchange="updateInvoiceSelectionSummary\(\)"/);
});

test("Styles define the dashboard UI primitives used by the page", () => {
  const styles = read("src/apps-script/Styles.html");

  for (const className of [
    ".app-header",
    ".priority-grid",
    ".workflow-grid",
    ".section-header",
    ".action-bar",
    ".status-pill",
  ]) {
    assert.match(styles, new RegExp(className.replace(".", "\\.")));
  }
});
