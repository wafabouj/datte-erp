import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";

export const suppliersRouter = Router();

const supplierSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  country: z.string().min(1),
  address: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  isActive: z.boolean().optional(),
});

suppliersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search } = req.query;
    const suppliers = await prisma.supplier.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: String(search), mode: "insensitive" } },
              { code: { contains: String(search), mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
    });
    res.json(suppliers);
  })
);

suppliersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const supplier = await prisma.supplier.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { lots: { orderBy: { createdAt: "desc" }, take: 30, include: { article: true } } },
    });
    res.json(supplier);
  })
);

suppliersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = supplierSchema.parse(req.body);
    const supplier = await prisma.supplier.create({ data });
    res.status(201).json(supplier);
  })
);

suppliersRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = supplierSchema.partial().parse(req.body);
    const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data });
    res.json(supplier);
  })
);

suppliersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.supplier.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).end();
  })
);
