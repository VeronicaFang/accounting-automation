import assert from "node:assert/strict";

import { buildExistingInvoiceImportKeys, buildInvoiceDateKey, shouldSkipInvoiceImportRow } from "./invoice-import-dedupe.ts";
import { parseInvoiceText } from "./invoice-import.ts";

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
  false
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

const activeExpenseKeys = buildExistingInvoiceImportKeys(
  [],
  [{ sourceLineKey: "AW14290451|23415683|2026-06-23|toast|39|1", status: "active" }]
);
assert.equal(
  shouldSkipInvoiceImportRow(
    {
      sourceRecordId: "AW14290451",
      consumptionDate: "2026-06-23",
      sourceLineKey: "AW14290451|23415683|2026-06-23|toast|39|1"
    },
    activeExpenseKeys
  ),
  true
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


const parsed = parseInvoiceText([
  "發票日期,發票號碼,賣方統一編號,賣方名稱,消費明細_金額,消費明細_品名",
  "20260605,AW99003017,60383907,統一超商,55,糯玉米",
  "20260605,AW99003017,60383907,統一超商,-1,OPEN錢包聯邦"
].join("\n"));

assert.equal(parsed[0].invoiceNumber, "AW99003017");
assert.equal(parsed[0].sourceOrder, 1);
assert.equal(parsed[0].lineType, "item");
assert.equal(parsed[1].sourceOrder, 2);
assert.equal(parsed[1].lineType, "discount");
assert.notEqual(parsed[0].sourceLineKey, parsed[1].sourceLineKey);
console.log("invoice import dedupe: 15 assertions passed");
