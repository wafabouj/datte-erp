import { Router } from "express";
import { z } from "zod";
import dayjs from "dayjs";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { ApiError } from "../../lib/errors";
import { nextInvoiceNumber } from "../../lib/numbering";
import { amountPaid, effectiveStatus } from "./invoices.service";
import { drawHeader, drawTable, renderPdf } from "../../lib/pdf";
import { allowRoles } from "../../middleware/roles";

export const invoicesRouter = Router();
const canWrite = allowRoles("COMPTABILITE");

function withEffectiveStatus<T extends Parameters<typeof effectiveStatus>[0]>(invoice: T) {
  return { ...invoice, effectiveStatus: effectiveStatus(invoice) };
}

invoicesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { clientId, type } = req.query;
    const invoices = await prisma.invoice.findMany({
      where: {
        ...(clientId ? { clientId: String(clientId) } : {}),
        ...(type ? { type: type as never } : {}),
      },
      include: { client: true, payments: true },
      orderBy: { issueDate: "desc" },
    });
    res.json(invoices.map(withEffectiveStatus));
  })
);

invoicesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        client: true,
        currency: true,
        lines: { include: { article: true } },
        payments: { orderBy: { date: "desc" } },
        salesOrder: true,
      },
    });
    res.json(withEffectiveStatus(invoice));
  })
);

const generateSchema = z.object({
  lines: z
    .array(
      z.object({
        salesOrderLineId: z.string(),
        quantity: z.coerce.number().positive(),
      })
    )
    .min(1),
  notes: z.string().optional(),
});

// Génère une facture (totale ou partielle) à partir des lignes d'une commande
invoicesRouter.post(
  "/depuis-commande/:orderId",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = generateSchema.parse(req.body);
    const order = await prisma.salesOrder.findUniqueOrThrow({
      where: { id: req.params.orderId },
      include: { lines: true, client: true },
    });

    if (!["CONFIRMED", "IN_PREPARATION", "SHIPPED", "DELIVERED"].includes(order.status)) {
      throw ApiError.badRequest(
        "La commande doit être au moins confirmée pour être facturée"
      );
    }

    const invoiceLines = data.lines.map((requested) => {
      const line = order.lines.find((l) => l.id === requested.salesOrderLineId);
      if (!line) throw ApiError.badRequest(`Ligne de commande introuvable: ${requested.salesOrderLineId}`);
      if (requested.quantity > Number(line.quantity)) {
        throw ApiError.badRequest(
          `Quantité facturée (${requested.quantity}) supérieure à la quantité commandée (${line.quantity})`
        );
      }
      return {
        salesOrderLineId: line.id,
        articleId: line.articleId,
        quantity: requested.quantity,
        unitPrice: Number(line.unitPrice),
        lineTotal: Math.round(requested.quantity * Number(line.unitPrice) * 100) / 100,
      };
    });

    const totalAmount = invoiceLines.reduce((s, l) => s + l.lineTotal, 0);
    const number = await nextInvoiceNumber("INVOICE");
    const issueDate = new Date();
    const dueDate = dayjs(issueDate).add(order.client.paymentTermsDays, "day").toDate();

    const invoice = await prisma.invoice.create({
      data: {
        number,
        type: "INVOICE",
        clientId: order.clientId,
        salesOrderId: order.id,
        currencyCode: order.currencyCode,
        issueDate,
        dueDate,
        totalAmount,
        notes: data.notes,
        createdById: req.user?.id,
        lines: { create: invoiceLines },
      },
      include: { lines: { include: { article: true } }, client: true },
    });

    res.status(201).json(invoice);
  })
);

const creditNoteSchema = z.object({
  invoiceId: z.string(),
  lines: z
    .array(
      z.object({
        articleId: z.string(),
        description: z.string().optional(),
        quantity: z.coerce.number().positive(),
        unitPrice: z.coerce.number().min(0),
      })
    )
    .min(1),
  notes: z.string().optional(),
});

invoicesRouter.post(
  "/avoirs",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = creditNoteSchema.parse(req.body);
    const original = await prisma.invoice.findUniqueOrThrow({ where: { id: data.invoiceId } });

    const lines = data.lines.map((l) => ({
      articleId: l.articleId,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: Math.round(l.quantity * l.unitPrice * 100) / 100,
    }));
    const totalAmount = lines.reduce((s, l) => s + l.lineTotal, 0);
    const number = await nextInvoiceNumber("CREDIT_NOTE");

    const creditNote = await prisma.invoice.create({
      data: {
        number,
        type: "CREDIT_NOTE",
        clientId: original.clientId,
        salesOrderId: original.salesOrderId,
        currencyCode: original.currencyCode,
        issueDate: new Date(),
        dueDate: new Date(),
        totalAmount,
        notes: data.notes ?? `Avoir sur facture ${original.number}`,
        createdById: req.user?.id,
        lines: { create: lines },
      },
      include: { lines: { include: { article: true } }, client: true },
    });

    res.status(201).json(creditNote);
  })
);

const paymentSchema = z.object({
  amount: z.coerce.number().positive(),
  date: z.coerce.date().optional(),
  method: z.string().optional(),
  reference: z.string().optional(),
});

invoicesRouter.post(
  "/:id/paiements",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = paymentSchema.parse(req.body);
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { payments: true },
    });
    if (invoice.status === "CANCELLED") {
      throw ApiError.badRequest("Impossible d'enregistrer un paiement sur une facture annulée");
    }

    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: data.amount,
        date: data.date ?? new Date(),
        method: data.method,
        reference: data.reference,
      },
    });

    const paid = amountPaid([...invoice.payments, payment]);
    const newStatus = paid >= Number(invoice.totalAmount) ? "PAID" : "PARTIALLY_PAID";
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: newStatus },
      include: { payments: true, client: true },
    });

    res.status(201).json(withEffectiveStatus(updated));
  })
);

invoicesRouter.post(
  "/:id/annuler",
  canWrite,
  asyncHandler(async (req, res) => {
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { payments: true },
    });
    if (invoice.payments.length > 0) {
      throw ApiError.badRequest("Impossible d'annuler une facture ayant déjà reçu des paiements");
    }
    const updated = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status: "CANCELLED" },
    });
    res.json(updated);
  })
);

invoicesRouter.get(
  "/dashboard/creances",
  asyncHandler(async (_req, res) => {
    const invoices = await prisma.invoice.findMany({
      where: { type: "INVOICE", status: { not: "CANCELLED" } },
      include: { client: true, payments: true },
    });

    const withBalances = invoices.map((inv) => {
      const paid = amountPaid(inv.payments);
      const balance = Number(inv.totalAmount) - paid;
      return {
        id: inv.id,
        number: inv.number,
        clientName: inv.client.name,
        currencyCode: inv.currencyCode,
        totalAmount: Number(inv.totalAmount),
        paid,
        balance,
        dueDate: inv.dueDate,
        status: effectiveStatus(inv),
        daysOverdue: Math.max(0, dayjs().diff(dayjs(inv.dueDate), "day")),
      };
    });

    const outstanding = withBalances.filter((i) => i.balance > 0.001);
    const overdue = outstanding.filter((i) => i.status === "OVERDUE");

    res.json({
      totalOutstanding: outstanding.reduce((s, i) => s + i.balance, 0),
      totalOverdue: overdue.reduce((s, i) => s + i.balance, 0),
      outstandingInvoices: outstanding,
      overdueInvoices: overdue,
    });
  })
);

invoicesRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { client: true, lines: { include: { article: true } }, payments: true },
    });

    const title = invoice.type === "INVOICE" ? `Facture ${invoice.number}` : `Avoir ${invoice.number}`;

    const pdf = await renderPdf((doc) => {
      drawHeader(doc, title);
      doc
        .fontSize(10)
        .text(`Client: ${invoice.client.name}`)
        .text(`Adresse: ${invoice.client.address ?? "-"}, ${invoice.client.country}`)
        .text(`Date d'émission: ${invoice.issueDate.toLocaleDateString("fr-FR")}`)
        .text(`Date d'échéance: ${invoice.dueDate.toLocaleDateString("fr-FR")}`)
        .text(`Devise: ${invoice.currencyCode}`)
        .moveDown(1);

      drawTable(
        doc,
        [
          { header: "Article", width: 220 },
          { header: "Quantité", width: 80, align: "right" },
          { header: "PU", width: 90, align: "right" },
          { header: "Total", width: 100, align: "right" },
        ],
        invoice.lines.map((l) => [
          l.description ?? l.article.name,
          Number(l.quantity).toLocaleString("fr-FR"),
          Number(l.unitPrice).toFixed(2),
          Number(l.lineTotal).toFixed(2),
        ])
      );

      doc.moveDown(1).fontSize(12).font("Helvetica-Bold").text(
        `Total ${invoice.type === "CREDIT_NOTE" ? "avoir" : "TTC"}: ${Number(invoice.totalAmount).toFixed(2)} ${invoice.currencyCode}`,
        { align: "right" }
      );

      const paid = amountPaid(invoice.payments);
      if (invoice.type === "INVOICE") {
        doc.fontSize(10).font("Helvetica").text(
          `Réglé: ${paid.toFixed(2)} ${invoice.currencyCode} — Solde dû: ${(Number(invoice.totalAmount) - paid).toFixed(2)} ${invoice.currencyCode}`,
          { align: "right" }
        );
      }

      doc.moveDown(2).fontSize(8).text(
        `Facture émise conformément aux dispositions applicables à l'export. N° facture: ${invoice.number}.`,
        { align: "center" }
      );
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${invoice.number}.pdf"`);
    res.send(pdf);
  })
);
