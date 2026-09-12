import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { formatMoney } from "../lib/format";
import { StatusBadge } from "../components/StatusBadge";

interface Kpis {
  salesOrdersByStatus: { status: string; count: number }[];
  productionOrdersByStatus: { status: string; count: number }[];
  receivables: { totalOutstanding: number; totalOverdue: number };
  stockValueByArticleType: Record<string, number>;
  lowStockAlerts: { articleId: string; name: string; minStock: number; currentStock: number }[];
}

const ARTICLE_TYPE_LABELS: Record<string, string> = {
  RAW_MATERIAL: "Matières premières",
  PACKAGING: "Emballages",
  FINISHED_PRODUCT: "Produits finis",
};

export function Dashboard() {
  const { data, isLoading } = useQuery<Kpis>({
    queryKey: ["dashboard-kpis"],
    queryFn: async () => (await api.get("/dashboard/kpis")).data,
  });

  if (isLoading || !data) return <p className="muted">Chargement...</p>;

  const totalStockValue = Object.values(data.stockValueByArticleType).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="page-header">
        <h1>Tableau de bord</h1>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="label">Créances clients en cours</div>
          <div className="value">{formatMoney(data.receivables.totalOutstanding)}</div>
        </div>
        <div className="kpi">
          <div className="label">Dont en retard</div>
          <div className="value" style={{ color: "var(--color-danger)" }}>
            {formatMoney(data.receivables.totalOverdue)}
          </div>
        </div>
        <div className="kpi">
          <div className="label">Valeur de stock totale</div>
          <div className="value">{formatMoney(totalStockValue)}</div>
        </div>
        <div className="kpi">
          <div className="label">Alertes stock bas</div>
          <div className="value">{data.lowStockAlerts.length}</div>
        </div>
      </div>

      <div className="form-grid">
        <div className="card">
          <h3>Commandes par statut</h3>
          <table>
            <tbody>
              {data.salesOrdersByStatus.map((s) => (
                <tr key={s.status}>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="text-right">{s.count}</td>
                </tr>
              ))}
              {data.salesOrdersByStatus.length === 0 && (
                <tr>
                  <td className="muted">Aucune commande</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Ordres de fabrication par statut</h3>
          <table>
            <tbody>
              {data.productionOrdersByStatus.map((s) => (
                <tr key={s.status}>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="text-right">{s.count}</td>
                </tr>
              ))}
              {data.productionOrdersByStatus.length === 0 && (
                <tr>
                  <td className="muted">Aucun ordre</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Valeur de stock par type</h3>
          <table>
            <tbody>
              {Object.entries(data.stockValueByArticleType).map(([type, value]) => (
                <tr key={type}>
                  <td>{ARTICLE_TYPE_LABELS[type] ?? type}</td>
                  <td className="text-right">{formatMoney(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Alertes de stock bas</h3>
          {data.lowStockAlerts.length === 0 ? (
            <p className="muted">Aucune alerte, tous les stocks sont au-dessus du minimum.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Article</th>
                  <th className="text-right">Stock actuel</th>
                  <th className="text-right">Minimum</th>
                </tr>
              </thead>
              <tbody>
                {data.lowStockAlerts.map((a) => (
                  <tr key={a.articleId}>
                    <td>{a.name}</td>
                    <td className="text-right" style={{ color: "var(--color-danger)" }}>
                      {a.currentStock}
                    </td>
                    <td className="text-right">{a.minStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
