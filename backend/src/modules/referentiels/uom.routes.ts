import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { allowRoles } from "../../middleware/roles";

export const uomRouter = Router();
const canWrite = allowRoles("PRODUCTION");

const uomSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

uomRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const uoms = await prisma.unitOfMeasure.findMany({ orderBy: { code: "asc" } });
    res.json(uoms);
  })
);

uomRouter.post(
  "/",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = uomSchema.parse(req.body);
    const uom = await prisma.unitOfMeasure.create({ data });
    res.status(201).json(uom);
  })
);

uomRouter.put(
  "/:id",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = uomSchema.partial().parse(req.body);
    const uom = await prisma.unitOfMeasure.update({ where: { id: req.params.id }, data });
    res.json(uom);
  })
);

uomRouter.delete(
  "/:id",
  canWrite,
  asyncHandler(async (req, res) => {
    await prisma.unitOfMeasure.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

const conversionSchema = z.object({
  fromUomId: z.string(),
  toUomId: z.string(),
  factor: z.coerce.number().positive(),
});

uomRouter.get(
  "/conversions",
  asyncHandler(async (_req, res) => {
    const conversions = await prisma.uomConversion.findMany({
      include: { fromUom: true, toUom: true },
    });
    res.json(conversions);
  })
);

uomRouter.post(
  "/conversions",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = conversionSchema.parse(req.body);
    const conversion = await prisma.uomConversion.create({ data });
    res.status(201).json(conversion);
  })
);

uomRouter.delete(
  "/conversions/:id",
  canWrite,
  asyncHandler(async (req, res) => {
    await prisma.uomConversion.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);
