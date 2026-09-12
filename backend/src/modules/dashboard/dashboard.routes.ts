import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { amountPaid, effectiveStatus } from "../facturation/invoices.service";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/kpis",
  asyncHandler(async (_req, res) => {
    const [ordersByStatus, invoices, stockLevels, productionOrdersByStatus, lowStockArticles] =
      await Promise.all([
        prisma.salesOrder.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.invoice.findMany({
          where: { type: "INVOICE", status: { not: "CANCELLED" } },
          include: { payments: true },
        }),
        prisma.stockLevel.findMany({ include: { article: true }, where: { quantity: { not: 0 } } }),
        prisma.productionOrder.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.article.findMany({
          where: { isActive: true },
          include: { stockLevels: true },
        }),
      ]);

    const receivables = invoices.map((inv) => {
      const paid = amountPaid(inv.payments);
      return { balance: Number(inv.totalAmount) - paid, status: effectiveStatus(inv) };
    });
    const totalOutstanding = receivables.reduce((s, r) => s + Math.max(0, r.balance), 0);
    const totalOverdue = receivables
      .filter((r) => r.status === "OVERDUE")
      .reduce((s, r) => s + Math.max(0, r.balance), 0);

    const stockValueByArticleType = stockLevels.reduce<Record<string, number>>((acc, level) => {
      const key = level.article.type;
      acc[key] = (acc[key] ?? 0) + Number(level.quantity) * Number(level.article.unitCost);
      return acc;
    }, {});

    const lowStock = lowStockArticles
      .map((a) => ({
        articleId: a.id,
        name: a.name,
        minStock: Number(a.minStock),
        currentStock: a.stockLevels.reduce((s, l) => s + Number(l.quantity), 0),
      }))
      .filter((a) => a.currentStock < a.minStock);

    res.json({
      salesOrdersByStatus: ordersByStatus.map((s) => ({ status: s.status, count: s._count._all })),
      productionOrdersByStatus: productionOrdersByStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      receivables: { totalOutstanding, totalOverdue },
      stockValueByArticleType,
      lowStockAlerts: lowStock,
    });
  })
);
