import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { ApiError } from "../../lib/errors";
import { computeDurationHours, computeEndDate, rangesOverlap } from "../../lib/capacity";
import { checkMaterialAvailability } from "../production/productionOrders.service";

export const planningRouter = Router();

/**
 * Vue Gantt: renvoie tous les ordres de fabrication planifiés/en cours avec
 * leurs bornes temporelles, poste et effectif, plus la liste des conflits
 * détectés (surcharge de poste, effectif partagé, matière première manquante).
 */
planningRouter.get(
  "/gantt",
  asyncHandler(async (_req, res) => {
    const orders = await prisma.productionOrder.findMany({
      where: {
        status: { in: ["PLANNED", "IN_PROGRESS"] },
        plannedStartDate: { not: null },
        plannedEndDate: { not: null },
      },
      include: {
        bom: { include: { finishedArticle: true, components: true } },
        workCenter: true,
        workers: { include: { worker: true } },
      },
      orderBy: { plannedStartDate: "asc" },
    });

    const conflicts: {
      type: "WORK_CENTER_OVERLAP" | "WORKER_OVERLAP" | "MATERIAL_SHORTAGE";
      orderIds: string[];
      message: string;
    }[] = [];

    for (let i = 0; i < orders.length; i++) {
      for (let j = i + 1; j < orders.length; j++) {
        const a = orders[i];
        const b = orders[j];
        if (!a.plannedStartDate || !a.plannedEndDate || !b.plannedStartDate || !b.plannedEndDate) continue;
        const overlap = rangesOverlap(
          { start: a.plannedStartDate, end: a.plannedEndDate },
          { start: b.plannedStartDate, end: b.plannedEndDate }
        );
        if (!overlap) continue;

        if (a.workCenterId && a.workCenterId === b.workCenterId) {
          conflicts.push({
            type: "WORK_CENTER_OVERLAP",
            orderIds: [a.id, b.id],
            message: `Les ordres ${a.number} et ${b.number} se chevauchent sur le poste ${a.workCenter?.name ?? ""}`,
          });
        }

        const workersA = new Set(a.workers.map((w) => w.workerId));
        const sharedWorkers = b.workers.filter((w) => workersA.has(w.workerId));
        if (sharedWorkers.length > 0) {
          conflicts.push({
            type: "WORKER_OVERLAP",
            orderIds: [a.id, b.id],
            message: `Les ordres ${a.number} et ${b.number} partagent ${sharedWorkers
              .map((w) => w.worker.name)
              .join(", ")} sur une plage horaire commune`,
          });
        }
      }

      const requiredComponents = orders[i].bom.components.map((c) => ({
        articleId: c.articleId,
        quantity: Number(c.qtyPerUnit) * Number(orders[i].quantityPlanned),
      }));
      const availability = await checkMaterialAvailability(requiredComponents, orders[i].warehouseId);
      const shortages = availability.filter((a) => !a.sufficient);
      if (shortages.length > 0) {
        conflicts.push({
          type: "MATERIAL_SHORTAGE",
          orderIds: [orders[i].id],
          message: `Matière première insuffisante pour l'ordre ${orders[i].number}`,
        });
      }
    }

    res.json({ orders, conflicts });
  })
);

const rescheduleSchema = z.object({
  workCenterId: z.string().optional(),
  workerCount: z.coerce.number().int().min(1).optional(),
  workerIds: z.array(z.string()).optional(),
  plannedStartDate: z.coerce.date().optional(),
});

// Déplace un ordre dans le planning (nouveau poste / date / effectif) et
// recalcule automatiquement sa date de fin prévisionnelle.
planningRouter.patch(
  "/ordres/:id",
  asyncHandler(async (req, res) => {
    const data = rescheduleSchema.parse(req.body);
    const order = await prisma.productionOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { bom: { include: { components: true } } },
    });

    const workCenterId = data.workCenterId ?? order.workCenterId;
    const workerCount = data.workerCount ?? order.workerCount ?? 1;
    const plannedStartDate = data.plannedStartDate ?? order.plannedStartDate;

    if (!workCenterId || !plannedStartDate) {
      throw ApiError.badRequest("Poste de travail et date de début requis pour planifier");
    }

    const wc = await prisma.workCenter.findUniqueOrThrow({ where: { id: workCenterId } });
    const totalRawKg = order.bom.components.reduce(
      (s, c) => s + Number(c.qtyPerUnit) * Number(order.quantityPlanned),
      0
    );
    const wcCapacity = {
      capacityKgPerHourPerWorker: Number(wc.capacityKgPerHourPerWorker),
      workingHoursPerDay: Number(wc.workingHoursPerDay),
      workingDays: wc.workingDays,
      breakMinutesPerDay: wc.breakMinutesPerDay,
    };
    const durationHours = computeDurationHours(totalRawKg, wcCapacity, workerCount);
    const plannedEndDate = computeEndDate(plannedStartDate, durationHours, wcCapacity);

    const updated = await prisma.$transaction(async (tx) => {
      if (data.workerIds) {
        await tx.productionOrderWorker.deleteMany({ where: { productionOrderId: order.id } });
        await tx.productionOrderWorker.createMany({
          data: data.workerIds.map((workerId) => ({ productionOrderId: order.id, workerId })),
        });
      }
      return tx.productionOrder.update({
        where: { id: order.id },
        data: {
          workCenterId,
          workerCount,
          plannedStartDate,
          plannedEndDate,
          status: order.status === "DRAFT" ? "PLANNED" : order.status,
        },
        include: { workCenter: true, workers: { include: { worker: true } }, bom: { include: { finishedArticle: true } } },
      });
    });

    res.json({ order: updated, durationHours });
  })
);
