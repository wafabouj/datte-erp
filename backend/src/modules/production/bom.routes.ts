import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { allowRoles } from "../../middleware/roles";

export const bomRouter = Router();
const canWrite = allowRoles("PRODUCTION");

const componentSchema = z.object({
  articleId: z.string(),
  qtyPerUnit: z.coerce.number().positive(),
});

const bomSchema = z.object({
  finishedArticleId: z.string(),
  name: z.string().min(1),
  expectedYieldPct: z.coerce.number().min(0).max(100).optional(),
  components: z.array(componentSchema).min(1),
});

bomRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const boms = await prisma.billOfMaterial.findMany({
      include: { finishedArticle: true, components: { include: { article: true } } },
      orderBy: { name: "asc" },
    });
    res.json(boms);
  })
);

bomRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const bom = await prisma.billOfMaterial.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { finishedArticle: true, components: { include: { article: true } } },
    });
    res.json(bom);
  })
);

bomRouter.post(
  "/",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = bomSchema.parse(req.body);
    const bom = await prisma.billOfMaterial.create({
      data: {
        finishedArticleId: data.finishedArticleId,
        name: data.name,
        expectedYieldPct: data.expectedYieldPct ?? 100,
        components: { create: data.components },
      },
      include: { finishedArticle: true, components: { include: { article: true } } },
    });
    res.status(201).json(bom);
  })
);

bomRouter.put(
  "/:id",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = bomSchema.parse(req.body);
    const bom = await prisma.$transaction(async (tx) => {
      await tx.bomComponent.deleteMany({ where: { bomId: req.params.id } });
      return tx.billOfMaterial.update({
        where: { id: req.params.id },
        data: {
          finishedArticleId: data.finishedArticleId,
          name: data.name,
          expectedYieldPct: data.expectedYieldPct ?? 100,
          components: { create: data.components },
        },
        include: { finishedArticle: true, components: { include: { article: true } } },
      });
    });
    res.json(bom);
  })
);

bomRouter.delete(
  "/:id",
  canWrite,
  asyncHandler(async (req, res) => {
    await prisma.billOfMaterial.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).end();
  })
);
