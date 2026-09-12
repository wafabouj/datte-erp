import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { recordStockMovement } from "./stock.service";
import { nextLotCode } from "../../lib/numbering";
import { allowRoles } from "../../middleware/roles";

export const stockRouter = Router();
const canWrite = allowRoles("PRODUCTION");

stockRouter.get(
  "/niveaux",
  asyncHandler(async (req, res) => {
    const { articleId, warehouseId } = req.query;
    const levels = await prisma.stockLevel.findMany({
      where: {
        ...(articleId ? { articleId: String(articleId) } : {}),
        ...(warehouseId ? { warehouseId: String(warehouseId) } : {}),
        quantity: { not: 0 },
      },
      include: { article: { include: { uom: true } }, warehouse: true, lot: true },
      orderBy: [{ article: { name: "asc" } }],
    });
    res.json(levels);
  })
);

stockRouter.get(
  "/mouvements",
  asyncHandler(async (req, res) => {
    const { articleId, warehouseId, lotId, referenceType, referenceId } = req.query;
    const movements = await prisma.stockMovement.findMany({
      where: {
        ...(articleId ? { articleId: String(articleId) } : {}),
        ...(warehouseId ? { warehouseId: String(warehouseId) } : {}),
        ...(lotId ? { lotId: String(lotId) } : {}),
        ...(referenceType ? { referenceType: String(referenceType) } : {}),
        ...(referenceId ? { referenceId: String(referenceId) } : {}),
      },
      include: { article: true, warehouse: true, lot: true, createdBy: true },
      orderBy: { date: "desc" },
      take: 200,
    });
    res.json(movements);
  })
);

stockRouter.get(
  "/lots",
  asyncHandler(async (req, res) => {
    const { articleId } = req.query;
    const lots = await prisma.lot.findMany({
      where: articleId ? { articleId: String(articleId) } : undefined,
      include: {
        article: true,
        supplier: true,
        productionOrder: true,
        stockLevels: { include: { warehouse: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(lots);
  })
);

// Traçabilité complète d'un lot: origine (fournisseur/récolte ou OF amont)
// et utilisation (mouvements de sortie, OF ayant consommé ce lot)
stockRouter.get(
  "/lots/:id/tracabilite",
  asyncHandler(async (req, res) => {
    const lot = await prisma.lot.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        article: true,
        supplier: true,
        productionOrder: { include: { bom: { include: { finishedArticle: true } } } },
      },
    });
    const movements = await prisma.stockMovement.findMany({
      where: { lotId: lot.id },
      include: { warehouse: true },
      orderBy: { date: "asc" },
    });
    const consumedInOrders = await prisma.productionConsumption.findMany({
      where: { lotId: lot.id },
      include: { productionOrder: { include: { bom: { include: { finishedArticle: true } } } } },
    });
    res.json({ lot, movements, consumedInOrders });
  })
);

const receptionSchema = z.object({
  articleId: z.string(),
  warehouseId: z.string(),
  quantity: z.coerce.number().positive(),
  supplierId: z.string().optional(),
  harvestDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

// Réception de matière première / emballage: crée un lot de traçabilité amont
stockRouter.post(
  "/receptions",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = receptionSchema.parse(req.body);
    const article = await prisma.article.findUniqueOrThrow({ where: { id: data.articleId } });
    const lotCode = await nextLotCode(article.code);

    const result = await prisma.$transaction(async (tx) => {
      const lot = await tx.lot.create({
        data: {
          code: lotCode,
          articleId: data.articleId,
          supplierId: data.supplierId,
          harvestDate: data.harvestDate,
          receptionDate: new Date(),
        },
      });
      const { movement } = await recordStockMovement(tx, {
        articleId: data.articleId,
        warehouseId: data.warehouseId,
        lotId: lot.id,
        quantity: data.quantity,
        type: "RECEPTION",
        referenceType: "Reception",
        referenceId: lot.id,
        notes: data.notes,
        createdById: req.user?.id,
      });
      return { lot, movement };
    });

    res.status(201).json(result);
  })
);

const adjustmentSchema = z.object({
  articleId: z.string(),
  warehouseId: z.string(),
  lotId: z.string().optional(),
  quantity: z.coerce.number().refine((v) => v !== 0, "La quantité ne peut pas être nulle"),
  notes: z.string().optional(),
});

stockRouter.post(
  "/ajustements",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = adjustmentSchema.parse(req.body);
    const result = await prisma.$transaction((tx) =>
      recordStockMovement(tx, {
        articleId: data.articleId,
        warehouseId: data.warehouseId,
        lotId: data.lotId,
        quantity: data.quantity,
        type: "ADJUSTMENT",
        referenceType: "Adjustment",
        notes: data.notes,
        createdById: req.user?.id,
      })
    );
    res.status(201).json(result);
  })
);
