import { ProductionOrderStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/errors";
import { computeDurationHours, computeEndDate } from "../../lib/capacity";
import { consumeStockFifo, getAvailableQuantity, recordStockMovement } from "../stock/stock.service";
import { nextLotCode } from "../../lib/numbering";

const ALLOWED_TRANSITIONS: Record<ProductionOrderStatus, ProductionOrderStatus[]> = {
  DRAFT: ["PLANNED", "CANCELLED"],
  PLANNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["DONE"],
  DONE: [],
  CANCELLED: [],
};

export function assertProductionTransitionAllowed(
  from: ProductionOrderStatus,
  to: ProductionOrderStatus
) {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw ApiError.badRequest(
      `Transition invalide: ${from} → ${to}. Autorisées: ${
        ALLOWED_TRANSITIONS[from].join(", ") || "aucune"
      }`
    );
  }
}

/**
 * Calcule la quantité de matière première/emballage requise (en kg ou unité
 * de la nomenclature) pour produire `quantityPlanned` unités de produit fini,
 * ainsi que la durée prévisionnelle sur le poste de travail affecté.
 */
export async function planProductionOrder(params: {
  bomId: string;
  quantityPlanned: number;
  workCenterId?: string | null;
  workerCount?: number | null;
  plannedStartDate?: Date | null;
}) {
  const bom = await prisma.billOfMaterial.findUniqueOrThrow({
    where: { id: params.bomId },
    include: { components: true },
  });

  const requiredComponents = bom.components.map((c) => ({
    articleId: c.articleId,
    quantity: Number(c.qtyPerUnit) * params.quantityPlanned,
  }));

  let plannedEndDate: Date | null = null;
  let durationHours: number | null = null;

  if (params.workCenterId && params.plannedStartDate) {
    const wc = await prisma.workCenter.findUniqueOrThrow({ where: { id: params.workCenterId } });
    const totalRawKg = requiredComponents.reduce((s, c) => s + c.quantity, 0);
    durationHours = computeDurationHours(
      totalRawKg,
      {
        capacityKgPerHourPerWorker: Number(wc.capacityKgPerHourPerWorker),
        workingHoursPerDay: Number(wc.workingHoursPerDay),
        workingDays: wc.workingDays,
        breakMinutesPerDay: wc.breakMinutesPerDay,
      },
      params.workerCount ?? 1
    );
    plannedEndDate = computeEndDate(
      params.plannedStartDate,
      durationHours,
      {
        capacityKgPerHourPerWorker: Number(wc.capacityKgPerHourPerWorker),
        workingHoursPerDay: Number(wc.workingHoursPerDay),
        workingDays: wc.workingDays,
        breakMinutesPerDay: wc.breakMinutesPerDay,
      }
    );
  }

  return { bom, requiredComponents, durationHours, plannedEndDate };
}

export async function checkMaterialAvailability(
  requiredComponents: { articleId: string; quantity: number }[],
  warehouseId?: string | null
) {
  return Promise.all(
    requiredComponents.map(async (c) => {
      const available = await getAvailableQuantity(prisma, c.articleId, warehouseId ?? undefined);
      return { ...c, available, sufficient: available >= c.quantity };
    })
  );
}

/**
 * Consomme la matière première/emballage à la validation (passage IN_PROGRESS)
 * de l'ordre de fabrication, en respectant la traçabilité par lot (FIFO).
 */
export async function consumeMaterialsForOrder(productionOrderId: string, userId?: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.productionOrder.findUniqueOrThrow({
      where: { id: productionOrderId },
      include: { bom: { include: { components: true } } },
    });
    assertProductionTransitionAllowed(order.status, "IN_PROGRESS");
    if (!order.warehouseId) {
      throw ApiError.badRequest("Aucun entrepôt défini pour cet ordre de fabrication");
    }

    for (const component of order.bom.components) {
      const quantity = Number(component.qtyPerUnit) * Number(order.quantityPlanned);
      const consumedLots = await consumeStockFifo(tx, {
        articleId: component.articleId,
        warehouseId: order.warehouseId,
        quantity,
        type: "PRODUCTION_CONSUMPTION",
        referenceType: "ProductionOrder",
        referenceId: order.id,
        createdById: userId,
      });
      for (const lot of consumedLots) {
        await tx.productionConsumption.create({
          data: {
            productionOrderId: order.id,
            articleId: component.articleId,
            lotId: lot.lotId,
            quantity: lot.quantity,
          },
        });
      }
    }

    return tx.productionOrder.update({
      where: { id: productionOrderId },
      data: { status: "IN_PROGRESS", actualStartDate: new Date() },
      include: { bom: { include: { finishedArticle: true } } },
    });
  });
}

/**
 * Clôture l'ordre: crée le lot de produit fini (traçabilité aval) et
 * l'entrée en stock correspondante.
 */
export async function completeProductionOrder(
  productionOrderId: string,
  quantityProduced: number,
  userId?: string
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.productionOrder.findUniqueOrThrow({
      where: { id: productionOrderId },
      include: { bom: { include: { finishedArticle: true } } },
    });
    assertProductionTransitionAllowed(order.status, "DONE");
    if (!order.warehouseId) {
      throw ApiError.badRequest("Aucun entrepôt défini pour cet ordre de fabrication");
    }

    const lotCode = await nextLotCode(order.bom.finishedArticle.code);
    const lot = await tx.lot.create({
      data: {
        code: lotCode,
        articleId: order.bom.finishedArticleId,
        productionOrderId: order.id,
      },
    });

    await recordStockMovement(tx, {
      articleId: order.bom.finishedArticleId,
      warehouseId: order.warehouseId,
      lotId: lot.id,
      quantity: quantityProduced,
      type: "PRODUCTION_OUTPUT",
      referenceType: "ProductionOrder",
      referenceId: order.id,
      createdById: userId,
    });

    await tx.productionOutput.create({
      data: {
        productionOrderId: order.id,
        articleId: order.bom.finishedArticleId,
        lotId: lot.id,
        quantity: quantityProduced,
      },
    });

    return tx.productionOrder.update({
      where: { id: productionOrderId },
      data: {
        status: "DONE",
        actualEndDate: new Date(),
        quantityProduced,
      },
      include: { bom: { include: { finishedArticle: true } }, outputLots: true },
    });
  });
}
