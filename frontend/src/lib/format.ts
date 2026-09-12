export function formatMoney(value: string | number, currency?: string) {
  const n = Number(value);
  const formatted = n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}

export function formatQty(value: string | number) {
  return Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("fr-FR");
}
