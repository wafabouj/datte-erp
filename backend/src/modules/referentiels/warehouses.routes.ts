import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { allowRoles } from "../../middleware/roles";

export const warehousesRouter = Router();
const canWrite = allowRoles("PRODUCTION");

const warehouseSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  address: z.string().optional(),
  isDefault: z.boolean().optional(),
});

warehousesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const warehouses = await prisma.warehouse.findMany({ orderBy: { name: "asc" } });
    res.json(warehouses);
  })
);

warehousesRouter.post(
  "/",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = warehouseSchema.parse(req.body);
    const warehouse = await prisma.warehouse.create({ data });
    res.status(201).json(warehouse);
  })
);

warehousesRouter.put(
  "/:id",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = warehouseSchema.partial().parse(req.body);
    const warehouse = await prisma.warehouse.update({ where: { id: req.params.id }, data });
    res.json(warehouse);
  })
);

warehousesRouter.delete(
  "/:id",
  canWrite,
  asyncHandler(async (req, res) => {
    await prisma.warehouse.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);
