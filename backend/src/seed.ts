import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";
import { recordStockMovement } from "./modules/stock/stock.service";

async function main() {
  console.log("Seed: référentiels de base...");

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
  await prisma.exchangeRate.createMany({
    data: [
      { currencyCode: "EUR", rateToBase: 3.4 },
      { currencyCode: "USD", rateToBase: 3.1 },
      { currencyCode: "TND", rateToBase: 1 },
    ],
  });

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
  const unite = await prisma.unitOfMeasure.upsert({
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

  const entrepotMP = await prisma.warehouse.upsert({
    where: { code: "MP-KEBILI" },
    update: {},
    create: { code: "MP-KEBILI", name: "Dépôt matières premières - Kébili", isDefault: true },
  });
  const entrepotPF = await prisma.warehouse.upsert({
    where: { code: "PF-SFAX" },
    update: {},
    create: { code: "PF-SFAX", name: "Dépôt produits finis - Sfax" },
  });

  const fournisseur1 = await prisma.supplier.upsert({
    where: { code: "FRS-001" },
    update: {},
    create: {
      code: "FRS-001",
      name: "Coopérative Oasis de Kébili",
      country: "Tunisie",
      contactName: "Mohamed Trabelsi",
      contactEmail: "contact@oasis-kebili.tn",
      contactPhone: "+216 75 000 000",
    },
  });
  await prisma.supplier.upsert({
    where: { code: "FRS-002" },
    update: {},
    create: {
      code: "FRS-002",
      name: "Coopérative Nefzaoua",
      country: "Tunisie",
      contactName: "Amira Ben Salah",
      contactEmail: "contact@nefzaoua-coop.tn",
    },
  });

  const client1 = await prisma.client.upsert({
    where: { code: "CLI-001" },
    update: {},
    create: {
      code: "CLI-001",
      name: "Gourmet Import GmbH",
      country: "Allemagne",
      contactName: "Klaus Weber",
      contactEmail: "klaus@gourmet-import.de",
      paymentTermsDays: 30,
      currencyCode: "EUR",
      defaultIncoterm: "CIF",
    },
  });
  await prisma.client.upsert({
    where: { code: "CLI-002" },
    update: {},
    create: {
      code: "CLI-002",
      name: "Atlantic Dates Trading LLC",
      country: "États-Unis",
      contactName: "John Miller",
      contactEmail: "john@atlanticdates.com",
      paymentTermsDays: 45,
      currencyCode: "USD",
      defaultIncoterm: "FOB",
    },
  });

  const dattesBrutes = await prisma.article.upsert({
    where: { code: "MP-DEGLET" },
    update: {},
    create: {
      code: "MP-DEGLET",
      name: "Dattes Deglet Nour brutes (non triées)",
      type: "RAW_MATERIAL",
      variety: "Deglet Nour",
      uomId: kg.id,
      minStock: 500,
      unitCost: 4.5,
      currencyCode: "TND",
    },
  });
  const dattesBrutesMejhoul = await prisma.article.upsert({
    where: { code: "MP-MEJHOUL" },
    update: {},
    create: {
      code: "MP-MEJHOUL",
      name: "Dattes Mejhoul brutes (non triées)",
      type: "RAW_MATERIAL",
      variety: "Mejhoul",
      uomId: kg.id,
      minStock: 300,
      unitCost: 9,
      currencyCode: "TND",
    },
  });
  const cartonVide5kg = await prisma.article.upsert({
    where: { code: "EMB-CARTON5" },
    update: {},
    create: {
      code: "EMB-CARTON5",
      name: "Carton vide 5kg",
      type: "PACKAGING",
      uomId: unite.id,
      minStock: 200,
      unitCost: 1.2,
      currencyCode: "TND",
    },
  });
  const pfDegletCarton5 = await prisma.article.upsert({
    where: { code: "PF-DEGLET-C5" },
    update: {},
    create: {
      code: "PF-DEGLET-C5",
      name: "Deglet Nour calibrée - Carton 5kg",
      type: "FINISHED_PRODUCT",
      variety: "Deglet Nour",
      caliber: "Gros calibre",
      packaging: "Carton 5kg",
      uomId: carton5.id,
      minStock: 50,
      unitCost: 25,
      unitPrice: 38,
      currencyCode: "EUR",
    },
  });
  const pfMejhoulCarton5 = await prisma.article.upsert({
    where: { code: "PF-MEJHOUL-C5" },
    update: {},
    create: {
      code: "PF-MEJHOUL-C5",
      name: "Mejhoul extra - Carton 5kg",
      type: "FINISHED_PRODUCT",
      variety: "Mejhoul",
      caliber: "Extra",
      packaging: "Carton 5kg",
      uomId: carton5.id,
      minStock: 30,
      unitCost: 48,
      unitPrice: 72,
      currencyCode: "EUR",
    },
  });

  console.log("Seed: nomenclatures (BOM)...");
  const bomDeglet = await prisma.billOfMaterial.upsert({
    where: { id: "seed-bom-deglet" },
    update: {},
    create: {
      id: "seed-bom-deglet",
      finishedArticleId: pfDegletCarton5.id,
      name: "Deglet Nour Carton 5kg - standard",
      expectedYieldPct: 85,
      components: {
        create: [
          { articleId: dattesBrutes.id, qtyPerUnit: 5.9 }, // kg brut / carton (perte tri ~15%)
          { articleId: cartonVide5kg.id, qtyPerUnit: 1 },
        ],
      },
    },
  });
  await prisma.billOfMaterial.upsert({
    where: { id: "seed-bom-mejhoul" },
    update: {},
    create: {
      id: "seed-bom-mejhoul",
      finishedArticleId: pfMejhoulCarton5.id,
      name: "Mejhoul Extra Carton 5kg - standard",
      expectedYieldPct: 80,
      components: {
        create: [
          { articleId: dattesBrutesMejhoul.id, qtyPerUnit: 6.25 },
          { articleId: cartonVide5kg.id, qtyPerUnit: 1 },
        ],
      },
    },
  });

  console.log("Seed: postes de travail et ouvriers...");
  const ligneTri = await prisma.workCenter.upsert({
    where: { code: "LIGNE-TRI" },
    update: {},
    create: {
      code: "LIGNE-TRI",
      name: "Ligne de tri et calibrage",
      capacityKgPerHourPerWorker: 60,
      workingHoursPerDay: 8,
      workingDays: [1, 2, 3, 4, 5],
      breakMinutesPerDay: 30,
    },
  });
  await prisma.workCenter.upsert({
    where: { code: "LIGNE-EMB" },
    update: {},
    create: {
      code: "LIGNE-EMB",
      name: "Ligne d'emballage",
      capacityKgPerHourPerWorker: 90,
      workingHoursPerDay: 8,
      workingDays: [1, 2, 3, 4, 5],
      breakMinutesPerDay: 30,
    },
  });

  const ouvrier1 = await prisma.worker.upsert({
    where: { id: "seed-worker-1" },
    update: {},
    create: { id: "seed-worker-1", name: "Ahmed Bouzid", defaultWorkCenterId: ligneTri.id },
  });
  await prisma.worker.upsert({
    where: { id: "seed-worker-2" },
    update: {},
    create: { id: "seed-worker-2", name: "Salma Gharbi", defaultWorkCenterId: ligneTri.id },
  });
  await prisma.worker.upsert({
    where: { id: "seed-worker-3" },
    update: {},
    create: { id: "seed-worker-3", name: "Karim Jendoubi", defaultWorkCenterId: ligneTri.id },
  });

  console.log("Seed: utilisateur admin...");
  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@dattes-export.tn" },
    update: {},
    create: {
      email: "admin@dattes-export.tn",
      passwordHash,
      name: "Administrateur",
      role: "ADMIN",
    },
  });

  console.log("Seed: réception de matière première (stock initial)...");
  const lotBrut = await prisma.lot.upsert({
    where: { code: "LOT-MP-DEGLET-SEED-001" },
    update: {},
    create: {
      code: "LOT-MP-DEGLET-SEED-001",
      articleId: dattesBrutes.id,
      supplierId: fournisseur1.id,
      harvestDate: new Date("2025-11-15"),
      receptionDate: new Date("2025-11-20"),
    },
  });
  const existingMovement = await prisma.stockMovement.findFirst({
    where: { referenceType: "SeedReception", referenceId: lotBrut.id },
  });
  if (!existingMovement) {
    await prisma.$transaction((tx) =>
      recordStockMovement(tx, {
        articleId: dattesBrutes.id,
        warehouseId: entrepotMP.id,
        lotId: lotBrut.id,
        quantity: 3000,
        type: "RECEPTION",
        referenceType: "SeedReception",
        referenceId: lotBrut.id,
        notes: "Réception initiale de démonstration",
      })
    );
    await prisma.$transaction((tx) =>
      recordStockMovement(tx, {
        articleId: cartonVide5kg.id,
        warehouseId: entrepotMP.id,
        quantity: 1000,
        type: "RECEPTION",
        referenceType: "SeedReception",
        referenceId: "cartons-seed",
        notes: "Réception initiale de démonstration",
      })
    );
    await prisma.$transaction((tx) =>
      recordStockMovement(tx, {
        articleId: pfDegletCarton5.id,
        warehouseId: entrepotPF.id,
        quantity: 120,
        type: "ADJUSTMENT",
        referenceType: "SeedInitialStock",
        referenceId: "pf-deglet-seed",
        notes: "Stock initial de démonstration",
      })
    );
  }

  console.log("Seed: commande client de démonstration...");
  const existingOrder = await prisma.salesOrder.findFirst({ where: { number: "CMD-2026-000001" } });
  if (!existingOrder) {
    await prisma.salesOrder.create({
      data: {
        number: "CMD-2026-000001",
        clientId: client1.id,
        currencyCode: "EUR",
        incoterm: "CIF",
        status: "CONFIRMED",
        requestedDeliveryDate: new Date("2026-10-15"),
        lines: {
          create: [
            {
              articleId: pfDegletCarton5.id,
              warehouseId: entrepotPF.id,
              quantity: 40,
              unitPrice: 38,
              lineTotal: 1520,
            },
          ],
        },
      },
    });
  }

  console.log("Seed: ordre de fabrication planifié de démonstration...");
  const existingOF = await prisma.productionOrder.findFirst({ where: { number: "OF-2026-000001" } });
  if (!existingOF) {
    await prisma.productionOrder.create({
      data: {
        number: "OF-2026-000001",
        bomId: bomDeglet.id,
        quantityPlanned: 200,
        status: "PLANNED",
        workCenterId: ligneTri.id,
        workerCount: 2,
        warehouseId: entrepotMP.id,
        plannedStartDate: new Date("2026-09-15T08:00:00Z"),
        plannedEndDate: new Date("2026-09-17T12:00:00Z"),
        workers: { create: [{ workerId: ouvrier1.id }] },
      },
    });
  }

  console.log("Seed terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
