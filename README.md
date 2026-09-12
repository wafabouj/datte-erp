# Mini ERP — Export de dattes

Application interne de gestion (mini-ERP) centrée sur 4 modules : **Commandes**,
**Facturation**, **Production** et **Stock**, avec les référentiels de base
nécessaires (clients, fournisseurs, articles, entrepôts, unités, devises) et
un module de planification de production avec vue Gantt et détection de
conflits de capacité.

## Stack technique

- **Backend** : Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, JWT, PDFKit
- **Frontend** : React + Vite + TypeScript, React Router, TanStack Query, Axios
- **Base de données** : PostgreSQL

## Structure du dépôt

```
datte-erp/
  backend/    API REST + logique métier + base de données (Prisma)
  frontend/   Application web React
```

## Démarrage local

### 1. Base de données PostgreSQL

Créez une base et un utilisateur PostgreSQL, par exemple :

```sql
CREATE USER erp_user WITH PASSWORD 'erp_password_dev' CREATEDB;
CREATE DATABASE erp_dattes OWNER erp_user;
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # ajustez DATABASE_URL / JWT_SECRET si besoin
npm install
npx prisma migrate dev
npm run seed            # jeu de données de démonstration
npm run dev             # démarre l'API sur http://localhost:4000
```

Utilisateur de démonstration créé par le seed :
- email : `admin@dattes-export.tn`
- mot de passe : `admin123`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev              # démarre l'app sur http://localhost:5173
```

Le serveur de dev Vite proxie automatiquement `/api` vers `http://localhost:4000`.

## Modules fonctionnels

### Référentiels
Clients, fournisseurs, articles (matières premières / emballages / produits
finis avec variété, calibre, conditionnement), entrepôts, unités de mesure
avec table de conversion, devises et taux de change.

### Commandes (ventes)
Création de commande multi-lignes, workflow de statuts
(Brouillon → Confirmée → En préparation → Expédiée → Livrée → Clôturée /
Annulée), vérification de disponibilité de stock, génération de PDF
proforma, gestion des Incoterms.

### Facturation
Génération de facture totale ou partielle depuis une commande, avoirs,
suivi des paiements et des échéances, PDF facture, tableau de bord des
créances clients (encours, retards).

### Stock & traçabilité
Ledger de mouvements de stock (immuable) + soldes dérivés par
article/entrepôt/lot, réception de matière première avec création de lot,
ajustements d'inventaire, traçabilité amont/aval par numéro de lot.

### Production
Nomenclatures (BOM) matière première + emballage par unité de produit fini,
ordres de fabrication avec consommation automatique de stock à la
validation et entrée automatique du produit fini (nouveau lot) à la
clôture, calcul de rendement.

### Planification de production
Postes de travail avec capacité (kg/h/ouvrier), horaires de travail,
ouvriers, calcul automatique de la durée prévisionnelle d'un ordre à partir
de la capacité du poste et de l'effectif affecté, vue Gantt, détection des
conflits (chevauchement de poste, effectif partagé, rupture de matière
première), recalcul automatique des dates lors d'une replanification.

## Notes d'architecture

- Toute variation de stock passe par un point d'entrée unique
  (`recordStockMovement` / `consumeStockFifo`) qui journalise le mouvement
  et met à jour le solde dérivé dans la même transaction — garantissant que
  le ledger et les soldes ne divergent jamais.
- La consommation de matière première utilise une logique FIFO par date de
  création de lot.
- Les numéros de commande/facture/OF sont séquentiels par année
  (`PREFIX-AAAA-000123`) ; à remplacer par une séquence dédiée en base si le
  volume ou la concurrence d'écriture l'exigent.
