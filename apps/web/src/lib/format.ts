const numberFormatter = new Intl.NumberFormat("zh-TW", {
  maximumFractionDigits: 0
});

export function formatCurrency(value: number): string {
  return numberFormatter.format(value);
}

export function formatMonth(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return "月份未設定";
  }

  return month;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatVariance(value: number): string {
  if (value > 0) {
    return `+${formatCurrency(value)}`;
  }

  return formatCurrency(value);
}
