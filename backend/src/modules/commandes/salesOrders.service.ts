import { SalesOrderStatus } from "@prisma/client";
import { ApiError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { consumeStockFifo } from "../stock/stock.service";

const ALLOWED_TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PREPARATION", "CANCELLED"],
  IN_PREPARATION: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

export function assertTransitionAllowed(from: SalesOrderStatus, to: SalesOrderStatus) {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw ApiError.badRequest(
      `Transition de statut invalide: ${from} → ${to}. Transitions possibles: ${
        ALLOWED_TRANSITIONS[from].join(", ") || "aucune"
      }`
    );
  }
}

export async function checkAvailability(orderId: string) {
  const order = await prisma.salesOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { lines: { include: { article: true, warehouse: true } } },
  });

  const results = await Promise.all(
    order.lines.map(async (line) => {
      const levels = await prisma.stockLevel.findMany({
        where: {
          articleId: line.articleId,
          ...(line.warehouseId ? { warehouseId: line.warehouseId } : {}),
        },
      });
      const available = levels.reduce((sum, l) => sum + Number(l.quantity), 0);
      return {
        lineId: line.id,
        articleId: line.articleId,
        articleName: line.article.name,
        requested: Number(line.quantity),
        available,
        sufficient: available >= Number(line.quantity),
      };
    })
  );

  return { orderId, lines: results, allSufficient: results.every((r) => r.sufficient) };
}

/**
 * Fait passer la commande au statut SHIPPED: consomme le stock des articles
 * (FIFO par lot) pour chaque ligne, dans l'entrepôt de la ligne ou l'entrepôt
 * par défaut. Échoue si le stock est insuffisant sur une ligne quelconque —
 * la transition est alors annulée dans son ensemble (transaction).
 */
export async function shipOrder(orderId: string, userId?: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.salesOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { lines: true },
    });
    assertTransitionAllowed(order.status, "SHIPPED");

    const defaultWarehouse = await tx.warehouse.findFirst({ where: { isDefault: true } });

    for (const line of order.lines) {
      const warehouseId = line.warehouseId ?? defaultWarehouse?.id;
      if (!warehouseId) {
        throw ApiError.badRequest(
          `Aucun entrepôt défini pour la ligne ${line.id} et aucun entrepôt par défaut configuré`
        );
      }
      await consumeStockFifo(tx, {
        articleId: line.articleId,
        warehouseId,
        quantity: Number(line.quantity),
        type: "SALE_SHIPMENT",
        referenceType: "SalesOrder",
        referenceId: order.id,
        createdById: userId,
      });
    }

    return tx.salesOrder.update({
      where: { id: orderId },
      data: { status: "SHIPPED", shippedDate: new Date() },
      include: { lines: { include: { article: true } }, client: true },
    });
  });
}
