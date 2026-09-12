import { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/errors";

/**
 * Restreint une route à certains rôles. ADMIN passe toujours, quels que
 * soient les rôles listés. La lecture (GET) reste ouverte à tout utilisateur
 * authentifié dans toute l'application — seule l'écriture est filtrée par
 * rôle, module par module.
 */
export function allowRoles(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role) return next(ApiError.unauthorized());
    if (role === "ADMIN" || roles.includes(role)) return next();
    return next(
      ApiError.forbidden(`Action réservée aux rôles: ADMIN, ${roles.join(", ")}`)
    );
  };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    return next(ApiError.forbidden("Action réservée aux administrateurs"));
  }
  next();
}
