import { prisma } from "./prisma";

/**
 * Génère un numéro séquentiel du type PREFIX-YYYY-000123 en comptant les
 * enregistrements existants de l'année en cours. Simple et suffisant pour un
 * volume PME ; à remplacer par une séquence DB dédiée si la concurrence
 * d'écriture devient un problème.
 */
export async function nextNumber(
  prefix: string,
  count: () => Promise<number>
): Promise<string> {
  const year = new Date().getFullYear();
  const existing = await count();
  const seq = String(existing + 1).padStart(6, "0");
  return `${prefix}-${year}-${seq}`;
}

export async function nextSalesOrderNumber() {
  return nextNumber("CMD", () => prisma.salesOrder.count());
}

export async function nextInvoiceNumber(type: "INVOICE" | "CREDIT_NOTE") {
  const prefix = type === "INVOICE" ? "FAC" : "AVO";
  return nextNumber(prefix, () => prisma.invoice.count({ where: { type } }));
}

export async function nextProductionOrderNumber() {
  return nextNumber("OF", () => prisma.productionOrder.count());
}

export async function nextLotCode(articleCode: string) {
  const date = new Date();
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const existing = await prisma.lot.count({
    where: { code: { startsWith: `LOT-${articleCode}-${ymd}` } },
  });
  const seq = String(existing + 1).padStart(3, "0");
  return `LOT-${articleCode}-${ymd}-${seq}`;
}
