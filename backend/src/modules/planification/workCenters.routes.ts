import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";

export const workCentersRouter = Router();

const workCenterSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  capacityKgPerHourPerWorker: z.coerce.number().positive(),
  workingHoursPerDay: z.coerce.number().positive().optional(),
  workingDays: z.array(z.number().int().min(0).max(6)).optional(),
  breakMinutesPerDay: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

workCentersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const centers = await prisma.workCenter.findMany({
      include: { workers: true },
      orderBy: { name: "asc" },
    });
    res.json(centers);
  })
);

workCentersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = workCenterSchema.parse(req.body);
    const center = await prisma.workCenter.create({ data });
    res.status(201).json(center);
  })
);

workCentersRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = workCenterSchema.partial().parse(req.body);
    const center = await prisma.workCenter.update({ where: { id: req.params.id }, data });
    res.json(center);
  })
);

workCentersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.workCenter.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).end();
  })
);
