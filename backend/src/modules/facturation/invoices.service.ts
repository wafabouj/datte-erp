import { Invoice, InvoiceStatus, Payment } from "@prisma/client";

export function effectiveStatus(invoice: Invoice & { payments?: Payment[] }): InvoiceStatus {
  if (invoice.status === "CANCELLED" || invoice.type === "CREDIT_NOTE") return invoice.status;
  const paid = (invoice.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const total = Number(invoice.totalAmount);
  if (paid >= total && total > 0) return "PAID";
  if (paid > 0 && paid < total) {
    return invoice.dueDate < new Date() ? "OVERDUE" : "PARTIALLY_PAID";
  }
  if (invoice.dueDate < new Date()) return "OVERDUE";
  return "ISSUED";
}

export function amountPaid(payments: Payment[]) {
  return payments.reduce((s, p) => s + Number(p.amount), 0);
}
