import express from "express";
import cors from "cors";
import { authRouter } from "./modules/auth/auth.routes";
import { referentielsRouter } from "./modules/referentiels";
import { requireAuth } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";
import { stockRouter } from "./modules/stock/stock.routes";
import { salesOrdersRouter } from "./modules/commandes/salesOrders.routes";
import { invoicesRouter } from "./modules/facturation/invoices.routes";
import { bomRouter } from "./modules/production/bom.routes";
import { productionOrdersRouter } from "./modules/production/productionOrders.routes";
import { workCentersRouter } from "./modules/planification/workCenters.routes";
import { workersRouter } from "./modules/planification/workers.routes";
import { planningRouter } from "./modules/planification/planning.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);

// Tout le reste de l'API nécessite une authentification
app.use("/api/referentiels", requireAuth, referentielsRouter);
app.use("/api/stock", requireAuth, stockRouter);
app.use("/api/commandes", requireAuth, salesOrdersRouter);
app.use("/api/factures", requireAuth, invoicesRouter);
app.use("/api/production/bom", requireAuth, bomRouter);
app.use("/api/production/ordres", requireAuth, productionOrdersRouter);
app.use("/api/planification/postes", requireAuth, workCentersRouter);
app.use("/api/planification/ouvriers", requireAuth, workersRouter);
app.use("/api/planification/planning", requireAuth, planningRouter);
app.use("/api/dashboard", requireAuth, dashboardRouter);

app.use(errorHandler);
