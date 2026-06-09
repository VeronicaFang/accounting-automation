export type PaymentToolType = "cash" | "credit_card";

export type EntryCreditCard = {
  id: string;
  name: string;
  cutoff_day: number;
  payment_day: number;
  legacy_id: string | null;
};

export type SplitInstallment = {
  sequence: number;
  amount: number;
};

export type PaymentPlan = {
  sequence: number;
  paymentDate: string;
  cashFlowMonth: string;
  amount: number;
};

export type ParsedManualExpenseRow = {
  consumptionDate: string;
  itemDescription: string;
  amount: number;
  merchantName: string;
  budgetItemName: string;
  paymentToolType: PaymentToolType;
  creditCardName: string;
  notes: string;
};

const defaultManualHeaders = [
  "消費日",
  "購買品項",
  "消費金額",
  "消費通路",
  "預算項目",
  "支付方式",
  "信用卡",
  "備註"
];

const headerAliases: Record<keyof ParsedManualExpenseRow, string[]> = {
  consumptionDate: ["消費日", "日期", "交易日期", "consumption_date"],
  itemDescription: ["購買品項", "品項", "項目", "item_description", "purchase_item"],
  amount: ["消費金額", "金額", "amount"],
  merchantName: ["消費通路", "店家", "通路", "merchant_name", "channel"],
  budgetItemName: ["預算項目", "budget_item"],
  paymentToolType: ["支付方式", "payment_tool_type", "payment_method"],
  creditCardName: ["信用卡", "credit_card", "credit_card_name"],
  notes: ["備註", "notes"]
};

export function monthKeyFromDate(date: string): string {
  return normalizeDateInput(date).slice(0, 7);
}

export function normalizeDateInput(value: string): string {
  const text = String(value || "").trim();
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);

  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }

  const monthOnly = text.match(/^(\d{4})[./-](\d{1,2})$/);

  if (monthOnly) {
    return `${monthOnly[1]}-${monthOnly[2].padStart(2, "0")}-01`;
  }

  const full = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);

  if (full) {
    return `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
  }

  return text.slice(0, 10);
}

export function addMonths(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function buildMonthDate(monthKey: string, day: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const safeDay = Math.max(1, Math.min(day, lastDay));

  return `${monthKey}-${String(safeDay).padStart(2, "0")}`;
}

export function getCardBillMonth(consumptionDate: string, creditCard: EntryCreditCard): string {
  const normalizedDate = normalizeDateInput(consumptionDate);
  const month = normalizedDate.slice(0, 7);
  const day = Number(normalizedDate.slice(8, 10));

  return day <= creditCard.cutoff_day ? month : addMonths(month, 1);
}

export function splitInstallments(amount: number, installmentCount: number): SplitInstallment[] {
  const count = Math.max(1, Math.trunc(installmentCount || 1));
  const cents = Math.round(Number(amount || 0) * 100);
  const base = Math.trunc(cents / count);
  const remainder = cents - base * count;

  return Array.from({ length: count }, (_, index) => ({
    sequence: index + 1,
    amount: (base + (index < remainder ? 1 : 0)) / 100
  }));
}

export function buildPaymentPlans(input: {
  amount: number;
  consumptionDate: string;
  paymentToolType: PaymentToolType;
  installmentCount: number;
  creditCard?: EntryCreditCard | null;
}): PaymentPlan[] {
  if (input.paymentToolType === "cash") {
    const normalizedDate = normalizeDateInput(input.consumptionDate);

    return [
      {
        sequence: 1,
        paymentDate: normalizedDate,
        cashFlowMonth: normalizedDate.slice(0, 7),
        amount: Number(input.amount)
      }
    ];
  }

  if (!input.creditCard) {
    throw new Error("信用卡付款需要選擇信用卡。");
  }

  const firstBillMonth = getCardBillMonth(input.consumptionDate, input.creditCard);

  return splitInstallments(input.amount, input.installmentCount).map((installment, index) => {
    const cashFlowMonth = addMonths(firstBillMonth, index);

    return {
      sequence: installment.sequence,
      paymentDate: buildMonthDate(cashFlowMonth, input.creditCard!.payment_day),
      cashFlowMonth,
      amount: installment.amount
    };
  });
}

export function parseDelimitedLine(line: string, delimiter: string): string[] {
  if (delimiter === "\t") {
    return line.split("\t");
  }

  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current);
  return cells;
}

export function parseManualExpenseText(text: string): ParsedManualExpenseRow[] {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return [];
  }

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const firstRow = parseDelimitedLine(lines[0], delimiter).map((cell) => cell.trim());
  const hasHeader = firstRow.some((cell) => defaultManualHeaders.includes(cell));
  const headers = hasHeader ? firstRow : defaultManualHeaders.slice(0, Math.max(firstRow.length, 1));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const cells = parseDelimitedLine(line, delimiter);
      const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));

      return normalizeManualRow(row);
    })
    .filter((row) => row.consumptionDate || row.itemDescription || row.amount > 0);
}

function normalizeManualRow(row: Record<string, string>): ParsedManualExpenseRow {
  const paymentText = pickField(row, headerAliases.paymentToolType);
  const paymentToolType: PaymentToolType =
    paymentText === "credit_card" || paymentText.toLowerCase() === "card" || paymentText.includes("信用卡")
      ? "credit_card"
      : "cash";

  return {
    consumptionDate: normalizeDateInput(pickField(row, headerAliases.consumptionDate)),
    itemDescription: pickField(row, headerAliases.itemDescription),
    amount: parseAmount(pickField(row, headerAliases.amount)),
    merchantName: pickField(row, headerAliases.merchantName),
    budgetItemName: pickField(row, headerAliases.budgetItemName),
    paymentToolType,
    creditCardName: paymentToolType === "credit_card" ? pickField(row, headerAliases.creditCardName) : "",
    notes: pickField(row, headerAliases.notes)
  };
}

function pickField(row: Record<string, string>, names: string[]): string {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) {
      return String(row[name] || "").trim();
    }
  }

  return "";
}

function parseAmount(value: string): number {
  const amount = Number(String(value || "").replace(/[,$\s]/g, ""));

  return Number.isFinite(amount) ? amount : 0;
}
