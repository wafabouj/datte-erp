import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { nextProductionOrderNumber } from "../../lib/numbering";
import {
  assertProductionTransitionAllowed,
  checkMaterialAvailability,
  completeProductionOrder,
  consumeMaterialsForOrder,
  planProductionOrder,
} from "./productionOrders.service";
import { ApiError } from "../../lib/errors";

export const productionOrdersRouter = Router();

const createSchema = z.object({
  bomId: z.string(),
  quantityPlanned: z.coerce.number().positive(),
  workCenterId: z.string().optional(),
  workerCount: z.coerce.number().int().min(1).optional(),
  workerIds: z.array(z.string()).optional(),
  warehouseId: z.string().optional(),
  plannedStartDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

productionOrdersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, workCenterId } = req.query;
    const orders = await prisma.productionOrder.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(workCenterId ? { workCenterId: String(workCenterId) } : {}),
      },
      include: {
        bom: { include: { finishedArticle: true } },
        workCenter: true,
        workers: { include: { worker: true } },
        warehouse: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  })
);

productionOrdersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const order = await prisma.productionOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        bom: { include: { finishedArticle: true, components: { include: { article: true } } } },
        workCenter: true,
        workers: { include: { worker: true } },
        warehouse: true,
        consumptions: { include: { article: true, lot: true } },
        outputs: { include: { article: true, lot: true } },
      },
    });
    res.json(order);
  })
);

productionOrdersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const { requiredComponents, durationHours, plannedEndDate } = await planProductionOrder({
      bomId: data.bomId,
      quantityPlanned: data.quantityPlanned,
      workCenterId: data.workCenterId,
      workerCount: data.workerCount,
      plannedStartDate: data.plannedStartDate,
    });
    const availability = await checkMaterialAvailability(requiredComponents, data.warehouseId);

    const number = await nextProductionOrderNumber();
    const order = await prisma.productionOrder.create({
      data: {
        number,
        bomId: data.bomId,
        quantityPlanned: data.quantityPlanned,
        workCenterId: data.workCenterId,
        workerCount: data.workerCount ?? 1,
        warehouseId: data.warehouseId,
        plannedStartDate: data.plannedStartDate,
        plannedEndDate,
        notes: data.notes,
        createdById: req.user?.id,
        workers: data.workerIds
          ? { create: data.workerIds.map((workerId) => ({ workerId })) }
          : undefined,
      },
      include: {
        bom: { include: { finishedArticle: true } },
        workCenter: true,
        workers: { include: { worker: true } },
      },
    });

    res.status(201).json({ order, durationHours, materialAvailability: availability });
  })
);

const statusSchema = z.object({
  status: z.enum(["DRAFT", "PLANNED", "IN_PROGRESS", "DONE", "CANCELLED"]),
  quantityProduced: z.coerce.number().positive().optional(),
});

productionOrdersRouter.post(
  "/:id/statut",
  asyncHandler(async (req, res) => {
    const { status, quantityProduced } = statusSchema.parse(req.body);
    const order = await prisma.productionOrder.findUniqueOrThrow({ where: { id: req.params.id } });

    if (status === "IN_PROGRESS") {
      const updated = await consumeMaterialsForOrder(req.params.id, req.user?.id);
      return res.json(updated);
    }

    if (status === "DONE") {
      const qty = quantityProduced ?? Number(order.quantityPlanned);
      const updated = await completeProductionOrder(req.params.id, qty, req.user?.id);
      return res.json(updated);
    }

    assertProductionTransitionAllowed(order.status, status);
    if (status === "CANCELLED" && order.status !== "DRAFT" && order.status !== "PLANNED") {
      throw ApiError.badRequest("Impossible d'annuler un ordre déjà en cours ou terminé");
    }
    const updated = await prisma.productionOrder.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(updated);
  })
);

productionOrdersRouter.get(
  "/:id/tracabilite",
  asyncHandler(async (req, res) => {
    const order = await prisma.productionOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        bom: { include: { finishedArticle: true } },
        consumptions: { include: { article: true, lot: { include: { supplier: true } } } },
        outputs: { include: { article: true, lot: true } },
      },
    });
    res.json(order);
  })
);
