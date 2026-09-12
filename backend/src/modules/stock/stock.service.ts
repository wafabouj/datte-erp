import { Prisma, PrismaClient, StockMovementType } from "@prisma/client";
import { ApiError } from "../../lib/errors";

type Tx = Prisma.TransactionClient | PrismaClient;

interface MovementInput {
  articleId: string;
  warehouseId: string;
  lotId?: string | null;
  quantity: number; // signé: positif = entrée, négatif = sortie
  type: StockMovementType;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdById?: string;
}

/**
 * Enregistre un mouvement dans le ledger et met à jour le solde dérivé
 * StockLevel en une seule transaction. C'est le point d'entrée unique pour
 * toute variation de stock (vente, production, réception, ajustement) afin
 * de garantir que le ledger et les soldes ne divergent jamais.
 */
export async function recordStockMovement(tx: Tx, input: MovementInput) {
  const movement = await tx.stockMovement.create({
    data: {
      articleId: input.articleId,
      warehouseId: input.warehouseId,
      lotId: input.lotId ?? null,
      quantity: input.quantity,
      type: input.type,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      notes: input.notes,
      createdById: input.createdById,
    },
  });

  // Upsert manuel: la contrainte unique porte sur une colonne nullable
  // (lotId), ce que le client Prisma généré ne modélise pas proprement pour
  // upsert() — on cherche donc l'enregistrement existant nous-mêmes.
  const existing = await tx.stockLevel.findFirst({
    where: {
      articleId: input.articleId,
      warehouseId: input.warehouseId,
      lotId: input.lotId ?? null,
    },
  });

  const level = existing
    ? await tx.stockLevel.update({
        where: { id: existing.id },
        data: { quantity: { increment: input.quantity } },
      })
    : await tx.stockLevel.create({
        data: {
          articleId: input.articleId,
          warehouseId: input.warehouseId,
          lotId: input.lotId ?? null,
          quantity: input.quantity,
        },
      });

  return { movement, level };
}

export async function getAvailableQuantity(
  tx: Tx,
  articleId: string,
  warehouseId?: string
) {
  const levels = await tx.stockLevel.findMany({
    where: { articleId, ...(warehouseId ? { warehouseId } : {}) },
  });
  return levels.reduce((sum, l) => sum + Number(l.quantity), 0);
}

/**
 * Consomme du stock en priorisant les lots les plus anciens (FEFO/FIFO simplifié)
 * dans un entrepôt donné. Lève une erreur si le stock disponible est insuffisant.
 * Retourne le détail des lots consommés pour la traçabilité amont.
 */
export async function consumeStockFifo(
  tx: Tx,
  params: {
    articleId: string;
    warehouseId: string;
    quantity: number;
    type: StockMovementType;
    referenceType?: string;
    referenceId?: string;
    createdById?: string;
  }
) {
  const levels = await tx.stockLevel.findMany({
    where: {
      articleId: params.articleId,
      warehouseId: params.warehouseId,
      quantity: { gt: 0 },
    },
    include: { lot: true },
    orderBy: { lot: { createdAt: "asc" } },
  });

  const totalAvailable = levels.reduce((sum, l) => sum + Number(l.quantity), 0);
  if (totalAvailable < params.quantity) {
    throw ApiError.conflict(
      `Stock insuffisant : disponible ${totalAvailable}, demandé ${params.quantity}`
    );
  }

  let remaining = params.quantity;
  const consumed: { lotId: string | null; quantity: number }[] = [];

  for (const level of levels) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(level.quantity));
    await recordStockMovement(tx, {
      articleId: params.articleId,
      warehouseId: params.warehouseId,
      lotId: level.lotId,
      quantity: -take,
      type: params.type,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      createdById: params.createdById,
    });
    consumed.push({ lotId: level.lotId, quantity: take });
    remaining -= take;
  }

  return consumed;
}
