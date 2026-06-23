import assert from "node:assert/strict";

import { buildExistingInvoiceImportKeys, buildInvoiceDateKey, shouldSkipInvoiceImportRow } from "./invoice-import-dedupe.ts";

assert.equal(buildInvoiceDateKey("BK08413127", "2026-06-06"), "BK08413127|2026-06-06");
assert.equal(buildInvoiceDateKey("BK08413127||2026-06-06||50|1", "2026-06-06"), "BK08413127|2026-06-06");
assert.equal(buildInvoiceDateKey("", "2026-06-06"), null);

assert.equal(
  shouldSkipInvoiceImportRow(
    {
      sourceRecordId: "BK08413127",
      consumptionDate: "2026-06-06",
      sourceLineKey: "BK08413127|82112989|2026-06-06|tea|50|1"
    },
    {
      sourceLineKeys: new Set(),
      invoiceDateKeys: new Set(["BK08413127|2026-06-06"])
    }
  ),
  true
);

assert.equal(
  shouldSkipInvoiceImportRow(
    {
      sourceRecordId: "BK08413127",
      consumptionDate: "2026-06-06",
      sourceLineKey: "BK08413127|82112989|2026-06-06|tea|50|1"
    },
    {
      sourceLineKeys: new Set(["BK08413127|82112989|2026-06-06|tea|50|1"]),
      invoiceDateKeys: new Set()
    }
  ),
  true
);

assert.equal(
  shouldSkipInvoiceImportRow(
    {
      sourceRecordId: "AW14290451",
      consumptionDate: "2026-06-23",
      sourceLineKey: "AW14290451|23415683|2026-06-23|toast|39|1"
    },
    {
      sourceLineKeys: new Set(),
      invoiceDateKeys: new Set(["BK08413127|2026-06-06"])
    }
  ),
  false
);

const deletedOnlyKeys = buildExistingInvoiceImportKeys(
  [
    {
      sourceLineKey: "AW14290451|23415683|2026-06-23|toast|39|1",
      consumptionDate: "2026-06-23",
      reviewStatus: "deleted"
    }
  ],
  []
);

assert.equal(
  shouldSkipInvoiceImportRow(
    {
      sourceRecordId: "AW14290451",
      consumptionDate: "2026-06-23",
      sourceLineKey: "AW14290451|23415683|2026-06-23|toast|39|1"
    },
    deletedOnlyKeys
  ),
  false
);

const confirmedKeys = buildExistingInvoiceImportKeys(
  [
    {
      sourceLineKey: "AW14290451|23415683|2026-06-23|toast|39|1",
      consumptionDate: "2026-06-23",
      reviewStatus: "confirmed"
    }
  ],
  []
);

assert.equal(
  shouldSkipInvoiceImportRow(
    {
      sourceRecordId: "AW14290451",
      consumptionDate: "2026-06-23",
      sourceLineKey: "AW14290451|23415683|2026-06-23|toast|39|1"
    },
    confirmedKeys
  ),
  true
);

console.log("invoice import dedupe: 8 assertions passed");
