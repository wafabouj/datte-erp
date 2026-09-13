import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { allowRoles } from "../../middleware/roles";

export const articlesRouter = Router();
const canWrite = allowRoles("COMMERCIAL", "PRODUCTION");

const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const articleSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["RAW_MATERIAL", "PACKAGING", "FINISHED_PRODUCT"]),
  variety: z.string().optional(),
  process: emptyToUndefined(z.enum(["WITH_PIT", "PITTED"])),
  treatment: emptyToUndefined(z.enum(["BRANCH", "STANDARD", "PACKAGED"])),
  caliber: z.string().optional(),
  packaging: z.string().optional(),
  uomId: z.string(),
  minStock: z.coerce.number().min(0).optional(),
  unitCost: z.coerce.number().min(0).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  currencyCode: z.string().min(3).max(3),
  isActive: z.boolean().optional(),
});

articlesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search, type } = req.query;
    const articles = await prisma.article.findMany({
      where: {
        AND: [
          search
            ? {
                OR: [
                  { name: { contains: String(search), mode: "insensitive" } },
                  { code: { contains: String(search), mode: "insensitive" } },
                  { variety: { contains: String(search), mode: "insensitive" } },
                ],
              }
            : {},
          type ? { type: type as never } : {},
        ],
      },
      orderBy: { name: "asc" },
      include: { uom: true, currency: true },
    });
    res.json(articles);
  })
);

articlesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const article = await prisma.article.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        uom: true,
        currency: true,
        stockLevels: { include: { warehouse: true, lot: true } },
      },
    });
    res.json(article);
  })
);

articlesRouter.post(
  "/",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = articleSchema.parse(req.body);
    const article = await prisma.article.create({ data });
    res.status(201).json(article);
  })
);

articlesRouter.put(
  "/:id",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = articleSchema.partial().parse(req.body);
    const article = await prisma.article.update({ where: { id: req.params.id }, data });
    res.json(article);
  })
);

articlesRouter.delete(
  "/:id",
  canWrite,
  asyncHandler(async (req, res) => {
    await prisma.article.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).end();
  })
);
