import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("MerchantPaymentRules Apps Script headers include merchant display name", () => {
  const config = fs.readFileSync("src/apps-script/Config.gs", "utf8");
  const headerBlock = config.match(/MerchantPaymentRules:\s*\[([\s\S]*?)\]/)?.[1] || "";

  assert.match(headerBlock, /"merchant_display_name"/);
});

test("AppSettings sheet stores cash flow opening balance settings", () => {
  const config = fs.readFileSync("src/apps-script/Config.gs", "utf8");
  const headerBlock = config.match(/AppSettings:\s*\[([\s\S]*?)\]/)?.[1] || "";

  assert.match(config, /appSettings: "AppSettings"/);
  assert.match(headerBlock, /"setting_key"/);
  assert.match(headerBlock, /"setting_value"/);
});
