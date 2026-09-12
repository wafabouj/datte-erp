import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";

export const workersRouter = Router();

const workerSchema = z.object({
  name: z.string().min(1),
  defaultWorkCenterId: z.string().optional(),
  yieldKgPerHour: z.coerce.number().positive().optional(),
  isActive: z.boolean().optional(),
});

workersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const workers = await prisma.worker.findMany({
      include: { defaultWorkCenter: true },
      orderBy: { name: "asc" },
    });
    res.json(workers);
  })
);

workersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = workerSchema.parse(req.body);
    const worker = await prisma.worker.create({ data });
    res.status(201).json(worker);
  })
);

workersRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = workerSchema.partial().parse(req.body);
    const worker = await prisma.worker.update({ where: { id: req.params.id }, data });
    res.json(worker);
  })
);

workersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.worker.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).end();
  })
);
