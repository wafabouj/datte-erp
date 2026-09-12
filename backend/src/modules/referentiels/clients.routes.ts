import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";

export const clientsRouter = Router();

const clientSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  country: z.string().min(1),
  address: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  paymentTermsDays: z.coerce.number().int().min(0).optional(),
  currencyCode: z.string().min(3).max(3),
  defaultIncoterm: z.string().optional(),
  isActive: z.boolean().optional(),
});

clientsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search } = req.query;
    const clients = await prisma.client.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: String(search), mode: "insensitive" } },
              { code: { contains: String(search), mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
      include: { currency: true },
    });
    res.json(clients);
  })
);

clientsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const client = await prisma.client.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        currency: true,
        salesOrders: { orderBy: { orderDate: "desc" }, take: 20 },
        invoices: { orderBy: { issueDate: "desc" }, take: 20 },
      },
    });
    res.json(client);
  })
);

clientsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = clientSchema.parse(req.body);
    const client = await prisma.client.create({ data });
    res.status(201).json(client);
  })
);

clientsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = clientSchema.partial().parse(req.body);
    const client = await prisma.client.update({ where: { id: req.params.id }, data });
    res.json(client);
  })
);

clientsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.client.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).end();
  })
);
