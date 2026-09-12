import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { StockMovement } from "../../api/types";
import { formatDateTime, formatQty } from "../../lib/format";

const TYPE_LABELS: Record<string, string> = {
  RECEPTION: "Réception",
  SALE_SHIPMENT: "Expédition vente",
  PRODUCTION_CONSUMPTION: "Consommation production",
  PRODUCTION_OUTPUT: "Entrée production",
  ADJUSTMENT: "Ajustement",
  TRANSFER_OUT: "Transfert (sortie)",
  TRANSFER_IN: "Transfert (entrée)",
};

export function StockMovements() {
  const { data: movements = [] } = useQuery<StockMovement[]>({
    queryKey: ["stock-movements"],
    queryFn: async () => (await api.get("/stock/mouvements")).data,
  });

  return (
    <div>
      <div className="page-header">
        <h1>Mouvements de stock</h1>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Article</th>
              <th>Entrepôt</th>
              <th>Lot</th>
              <th>Type</th>
              <th className="text-right">Quantité</th>
              <th>Référence</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td>{formatDateTime(m.date)}</td>
                <td>{m.article.name}</td>
                <td>{m.warehouse.name}</td>
                <td>{m.lot?.code ?? "-"}</td>
                <td>{TYPE_LABELS[m.type] ?? m.type}</td>
                <td className="text-right" style={{ color: Number(m.quantity) < 0 ? "var(--color-danger)" : "var(--color-accent)" }}>
                  {Number(m.quantity) > 0 ? "+" : ""}
                  {formatQty(m.quantity)}
                </td>
                <td>{m.referenceType ?? "-"}</td>
              </tr>
            ))}
            {movements.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state">
                  Aucun mouvement.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
