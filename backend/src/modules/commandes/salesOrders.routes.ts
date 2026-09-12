import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { ApiError } from "../../lib/errors";
import { nextSalesOrderNumber } from "../../lib/numbering";
import { assertTransitionAllowed, checkAvailability, shipOrder } from "./salesOrders.service";
import { drawHeader, drawTable, renderPdf } from "../../lib/pdf";
import { allowRoles } from "../../middleware/roles";

export const salesOrdersRouter = Router();
const canWrite = allowRoles("COMMERCIAL");

const lineSchema = z.object({
  articleId: z.string(),
  warehouseId: z.string().optional(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
});

const orderSchema = z.object({
  clientId: z.string(),
  currencyCode: z.string().min(3).max(3),
  incoterm: z.string().optional(),
  requestedDeliveryDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

function computeLineTotal(qty: number, price: number) {
  return Math.round(qty * price * 100) / 100;
}

salesOrdersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { clientId, status } = req.query;
    const orders = await prisma.salesOrder.findMany({
      where: {
        ...(clientId ? { clientId: String(clientId) } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: { client: true, lines: true },
      orderBy: { orderDate: "desc" },
    });
    res.json(orders);
  })
);

salesOrdersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const order = await prisma.salesOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        client: true,
        currency: true,
        lines: { include: { article: true, warehouse: true } },
        invoices: true,
      },
    });
    res.json(order);
  })
);

salesOrdersRouter.post(
  "/",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = orderSchema.parse(req.body);
    const number = await nextSalesOrderNumber();
    const order = await prisma.salesOrder.create({
      data: {
        number,
        clientId: data.clientId,
        currencyCode: data.currencyCode,
        incoterm: data.incoterm,
        requestedDeliveryDate: data.requestedDeliveryDate,
        notes: data.notes,
        createdById: req.user?.id,
        lines: {
          create: data.lines.map((l) => ({
            articleId: l.articleId,
            warehouseId: l.warehouseId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: computeLineTotal(l.quantity, l.unitPrice),
          })),
        },
      },
      include: { lines: true, client: true },
    });
    res.status(201).json(order);
  })
);

salesOrdersRouter.put(
  "/:id",
  canWrite,
  asyncHandler(async (req, res) => {
    const existing = await prisma.salesOrder.findUniqueOrThrow({ where: { id: req.params.id } });
    if (existing.status !== "DRAFT") {
      throw ApiError.badRequest("Seule une commande en brouillon peut être modifiée");
    }
    const data = orderSchema.parse(req.body);

    const order = await prisma.$transaction(async (tx) => {
      await tx.salesOrderLine.deleteMany({ where: { orderId: req.params.id } });
      return tx.salesOrder.update({
        where: { id: req.params.id },
        data: {
          clientId: data.clientId,
          currencyCode: data.currencyCode,
          incoterm: data.incoterm,
          requestedDeliveryDate: data.requestedDeliveryDate,
          notes: data.notes,
          lines: {
            create: data.lines.map((l) => ({
              articleId: l.articleId,
              warehouseId: l.warehouseId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineTotal: computeLineTotal(l.quantity, l.unitPrice),
            })),
          },
        },
        include: { lines: true, client: true },
      });
    });
    res.json(order);
  })
);

salesOrdersRouter.get(
  "/:id/disponibilite",
  asyncHandler(async (req, res) => {
    const availability = await checkAvailability(req.params.id);
    res.json(availability);
  })
);

const statusSchema = z.object({ status: z.enum([
  "DRAFT", "CONFIRMED", "IN_PREPARATION", "SHIPPED", "DELIVERED", "CLOSED", "CANCELLED",
]) });

salesOrdersRouter.post(
  "/:id/statut",
  canWrite,
  asyncHandler(async (req, res) => {
    const { status } = statusSchema.parse(req.body);
    const order = await prisma.salesOrder.findUniqueOrThrow({ where: { id: req.params.id } });

    if (status === "SHIPPED") {
      const updated = await shipOrder(req.params.id, req.user?.id);
      return res.json(updated);
    }

    assertTransitionAllowed(order.status, status);
    const extraFields =
      status === "DELIVERED" ? { deliveredDate: new Date() } : {};
    const updated = await prisma.salesOrder.update({
      where: { id: req.params.id },
      data: { status, ...extraFields },
      include: { lines: { include: { article: true } }, client: true },
    });
    res.json(updated);
  })
);

salesOrdersRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const order = await prisma.salesOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { client: true, lines: { include: { article: true } } },
    });

    const pdf = await renderPdf((doc) => {
      drawHeader(doc, `Proforma ${order.number}`);
      doc
        .fontSize(10)
        .text(`Client: ${order.client.name} (${order.client.country})`)
        .text(`Date: ${order.orderDate.toLocaleDateString("fr-FR")}`)
        .text(`Incoterm: ${order.incoterm ?? "-"}`)
        .text(`Devise: ${order.currencyCode}`)
        .moveDown(1);

      drawTable(
        doc,
        [
          { header: "Article", width: 220 },
          { header: "Quantité", width: 80, align: "right" },
          { header: "PU", width: 90, align: "right" },
          { header: "Total", width: 100, align: "right" },
        ],
        order.lines.map((l) => [
          l.article.name,
          Number(l.quantity).toLocaleString("fr-FR"),
          Number(l.unitPrice).toFixed(2),
          Number(l.lineTotal).toFixed(2),
        ])
      );

      const total = order.lines.reduce((s, l) => s + Number(l.lineTotal), 0);
      doc.moveDown(1).fontSize(12).font("Helvetica-Bold").text(
        `Total: ${total.toFixed(2)} ${order.currencyCode}`,
        { align: "right" }
      );
      doc.moveDown(2).fontSize(8).font("Helvetica").text(
        "Document proforma sans valeur fiscale, établi à titre indicatif pour la commande export.",
        { align: "center" }
      );
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${order.number}.pdf"`);
    res.send(pdf);
  })
);
