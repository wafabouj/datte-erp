import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { allowRoles } from "../../middleware/roles";

export const currenciesRouter = Router();
const canWrite = allowRoles("COMPTABILITE");

const currencySchema = z.object({
  code: z.string().min(3).max(3).toUpperCase(),
  name: z.string().min(1),
  symbol: z.string().min(1),
  isBaseCurrency: z.boolean().optional(),
});

currenciesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const currencies = await prisma.currency.findMany({
      orderBy: { code: "asc" },
      include: { exchangeRates: { orderBy: { date: "desc" }, take: 1 } },
    });
    res.json(currencies);
  })
);

currenciesRouter.post(
  "/",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = currencySchema.parse(req.body);
    const currency = await prisma.currency.create({ data });
    res.status(201).json(currency);
  })
);

currenciesRouter.put(
  "/:code",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = currencySchema.partial().parse(req.body);
    const currency = await prisma.currency.update({
      where: { code: req.params.code },
      data,
    });
    res.json(currency);
  })
);

const rateSchema = z.object({
  rateToBase: z.coerce.number().positive(),
  date: z.coerce.date().optional(),
});

currenciesRouter.post(
  "/:code/rates",
  canWrite,
  asyncHandler(async (req, res) => {
    const data = rateSchema.parse(req.body);
    const rate = await prisma.exchangeRate.create({
      data: {
        currencyCode: req.params.code,
        rateToBase: data.rateToBase,
        date: data.date ?? new Date(),
      },
    });
    res.status(201).json(rate);
  })
);

currenciesRouter.get(
  "/:code/rates",
  asyncHandler(async (req, res) => {
    const rates = await prisma.exchangeRate.findMany({
      where: { currencyCode: req.params.code },
      orderBy: { date: "desc" },
    });
    res.json(rates);
  })
);
