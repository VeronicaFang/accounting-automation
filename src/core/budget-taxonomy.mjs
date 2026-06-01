export function parseLegacyBudgetItem(value) {
  const legacyName = String(value ?? "").trim();
  const codedMatch = legacyName.match(/^(\d+)\.\s*(.+)$/);

  if (!codedMatch) {
    return {
      legacy_code: null,
      legacy_name: legacyName,
      item_name: legacyName,
    };
  }

  return {
    legacy_code: Number(codedMatch[1]),
    legacy_name: legacyName,
    item_name: codedMatch[2].trim(),
  };
}

export function buildBudgetMappingDrafts(rows) {
  return rows
    .filter((row) => isValidExpenseItem(row.is_valid_expense_item))
    .map((row) => {
      const legacyBudgetItem = row.legacy_budget_item ?? row.budget_item ?? "";
      const parsed = parseLegacyBudgetItem(legacyBudgetItem);
      const suggestion = suggestBudgetGroup(parsed.item_name);

      return {
        legacy_budget_item: parsed.legacy_name,
        legacy_code: parsed.legacy_code,
        suggested_group_name: suggestion.groupName,
        suggested_item_name: parsed.item_name,
        review_status: "needs_review",
        confidence: suggestion.confidence,
      };
    });
}

function isValidExpenseItem(value) {
  return value === true || String(value).trim().toLowerCase() === "true";
}

function suggestBudgetGroup(itemName) {
  if (containsAny(itemName, ["老公", "家用"])) {
    return { groupName: "家人", confidence: 90 };
  }

  if (containsAny(itemName, ["動動", "小孩"])) {
    return { groupName: "小孩", confidence: 90 };
  }

  if (containsAny(itemName, ["餐費", "日常", "用品"])) {
    return { groupName: "家庭生活", confidence: 80 };
  }

  if (containsAny(itemName, ["旅遊", "露營", "奢侈", "娛樂"])) {
    return { groupName: "旅遊休閒", confidence: 80 };
  }

  return { groupName: "待整理", confidence: 50 };
}

function containsAny(value, keywords) {
  return keywords.some((keyword) => value.includes(keyword));
}
