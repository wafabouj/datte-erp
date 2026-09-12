// Amorçage minimal pour une instance de production réelle : uniquement le
// compte administrateur et les référentiels de base indispensables (devises,
// unités de mesure, un entrepôt). Aucune donnée fictive (pas de client,
// fournisseur, article, nomenclature ou commande d'exemple) — l'utilisateur
// saisit ses propres données via l'interface après connexion.
// Contrairement à seed.ts (données de démonstration pour un essai local),
// ce script est fait pour être exécuté une fois sur une base de production.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@dattes-export.tn";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_NAME = process.env.ADMIN_NAME || "Administrateur";

async function main() {
  console.log("Amorçage: devises...");
  await prisma.currency.upsert({
    where: { code: "TND" },
    update: {},
    create: { code: "TND", name: "Dinar tunisien", symbol: "DT", isBaseCurrency: true },
  });
  await prisma.currency.upsert({
    where: { code: "EUR" },
    update: {},
    create: { code: "EUR", name: "Euro", symbol: "€" },
  });
  await prisma.currency.upsert({
    where: { code: "USD" },
    update: {},
    create: { code: "USD", name: "Dollar américain", symbol: "$" },
  });
  const hasEurRate = await prisma.exchangeRate.findFirst({ where: { currencyCode: "EUR" } });
  if (!hasEurRate) {
    await prisma.exchangeRate.createMany({
      data: [
        { currencyCode: "EUR", rateToBase: 3.4 },
        { currencyCode: "USD", rateToBase: 3.1 },
        { currencyCode: "TND", rateToBase: 1 },
      ],
    });
  }

  console.log("Amorçage: unités de mesure...");
  const kg = await prisma.unitOfMeasure.upsert({
    where: { code: "KG" },
    update: {},
    create: { code: "KG", name: "Kilogramme" },
  });
  const carton5 = await prisma.unitOfMeasure.upsert({
    where: { code: "CARTON5" },
    update: {},
    create: { code: "CARTON5", name: "Carton 5kg" },
  });
  const carton10 = await prisma.unitOfMeasure.upsert({
    where: { code: "CARTON10" },
    update: {},
    create: { code: "CARTON10", name: "Carton 10kg" },
  });
  await prisma.unitOfMeasure.upsert({
    where: { code: "UNITE" },
    update: {},
    create: { code: "UNITE", name: "Unité" },
  });

  await prisma.uomConversion.upsert({
    where: { fromUomId_toUomId: { fromUomId: carton5.id, toUomId: kg.id } },
    update: {},
    create: { fromUomId: carton5.id, toUomId: kg.id, factor: 5 },
  });
  await prisma.uomConversion.upsert({
    where: { fromUomId_toUomId: { fromUomId: carton10.id, toUomId: kg.id } },
    update: {},
    create: { fromUomId: carton10.id, toUomId: kg.id, factor: 10 },
  });

  console.log("Amorçage: entrepôt par défaut...");
  await prisma.warehouse.upsert({
    where: { code: "PRINCIPAL" },
    update: {},
    create: { code: "PRINCIPAL", name: "Entrepôt principal", isDefault: true },
  });

  console.log("Amorçage: compte administrateur...");
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: { email: ADMIN_EMAIL, passwordHash, name: ADMIN_NAME, role: "ADMIN" },
  });

  if (!process.env.ADMIN_PASSWORD) {
    console.warn(
      `\nATTENTION: aucun ADMIN_PASSWORD fourni — mot de passe par défaut "${ADMIN_PASSWORD}" utilisé pour ${ADMIN_EMAIL}. Changez-le après votre première connexion.`
    );
  }

  console.log("Amorçage terminé. Connectez-vous avec:", ADMIN_EMAIL);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
