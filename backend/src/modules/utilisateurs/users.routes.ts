import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { ApiError } from "../../lib/errors";
import { requireAdmin } from "../../middleware/roles";

// Gestion des comptes: réservée aux administrateurs, en lecture comme en
// écriture — contrairement aux autres modules où la lecture reste ouverte
// à tous, ces données (emails, rôles) relèvent de l'administration du système.
export const usersRouter = Router();
usersRouter.use(requireAdmin);

const ROLES = ["ADMIN", "COMMERCIAL", "PRODUCTION", "COMPTABILITE"] as const;

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(ROLES),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

usersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    res.json(users);
  })
);

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = userSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { email: data.email, name: data.name, role: data.role, passwordHash },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
    res.status(201).json(user);
  })
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

usersRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    if (req.params.id === req.user?.id && data.isActive === false) {
      throw ApiError.badRequest("Vous ne pouvez pas désactiver votre propre compte");
    }
    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        role: data.role,
        isActive: data.isActive,
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
    res.json(user);
  })
);
