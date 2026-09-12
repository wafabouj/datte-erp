import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Clients } from "./pages/referentiels/Clients";
import { Suppliers } from "./pages/referentiels/Suppliers";
import { Articles } from "./pages/referentiels/Articles";
import { Warehouses } from "./pages/referentiels/Warehouses";
import { UnitsAndCurrencies } from "./pages/referentiels/UnitsAndCurrencies";
import { OrdersList } from "./pages/commandes/OrdersList";
import { OrderDetail } from "./pages/commandes/OrderDetail";
import { InvoicesList } from "./pages/facturation/InvoicesList";
import { InvoiceDetail } from "./pages/facturation/InvoiceDetail";
import { StockLevels } from "./pages/stock/StockLevels";
import { StockMovements } from "./pages/stock/StockMovements";
import { Lots } from "./pages/stock/Lots";
import { BomPage } from "./pages/production/BomPage";
import { ProductionOrders } from "./pages/production/ProductionOrders";
import { ProductionOrderDetail } from "./pages/production/ProductionOrderDetail";
import { Planning } from "./pages/production/Planning";
import { WorkCentersAndWorkers } from "./pages/production/WorkCentersAndWorkers";
import { Users } from "./pages/administration/Users";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 10_000 } },
});

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }: { children: React.ReactElement }) {
  const { user } = useAuth();
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="referentiels/clients" element={<Clients />} />
              <Route path="referentiels/fournisseurs" element={<Suppliers />} />
              <Route path="referentiels/articles" element={<Articles />} />
              <Route path="referentiels/entrepots" element={<Warehouses />} />
              <Route path="referentiels/unites" element={<UnitsAndCurrencies />} />
              <Route path="commandes" element={<OrdersList />} />
              <Route path="commandes/:id" element={<OrderDetail />} />
              <Route path="factures" element={<InvoicesList />} />
              <Route path="factures/:id" element={<InvoiceDetail />} />
              <Route path="stock/niveaux" element={<StockLevels />} />
              <Route path="stock/mouvements" element={<StockMovements />} />
              <Route path="stock/lots" element={<Lots />} />
              <Route path="production/nomenclatures" element={<BomPage />} />
              <Route path="production/ordres" element={<ProductionOrders />} />
              <Route path="production/ordres/:id" element={<ProductionOrderDetail />} />
              <Route path="production/planning" element={<Planning />} />
              <Route path="production/postes" element={<WorkCentersAndWorkers />} />
              <Route
                path="administration/utilisateurs"
                element={
                  <RequireAdmin>
                    <Users />
                  </RequireAdmin>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
