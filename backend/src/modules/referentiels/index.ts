import { Router } from "express";
import { currenciesRouter } from "./currencies.routes";
import { uomRouter } from "./uom.routes";
import { clientsRouter } from "./clients.routes";
import { suppliersRouter } from "./suppliers.routes";
import { warehousesRouter } from "./warehouses.routes";
import { articlesRouter } from "./articles.routes";

export const referentielsRouter = Router();

referentielsRouter.use("/currencies", currenciesRouter);
referentielsRouter.use("/uom", uomRouter);
referentielsRouter.use("/clients", clientsRouter);
referentielsRouter.use("/suppliers", suppliersRouter);
referentielsRouter.use("/warehouses", warehousesRouter);
referentielsRouter.use("/articles", articlesRouter);
