import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api, apiErrorMessage } from "../../api/client";
import { ProductionOrder, ProductionOrderStatus } from "../../api/types";
import { StatusBadge } from "../../components/StatusBadge";
import { formatDateTime, formatQty } from "../../lib/format";

const NEXT_STATUS: Record<ProductionOrderStatus, ProductionOrderStatus[]> = {
  DRAFT: ["PLANNED", "CANCELLED"],
  PLANNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["DONE"],
  DONE: [],
  CANCELLED: [],
};

interface ConsumptionOrOutput {
  id: string;
  articleId: string;
  article: { name: string };
  lot?: { code: string; supplier?: { name: string } | null } | null;
  quantity: string;
}

interface OrderTrace extends ProductionOrder {
  consumptions: ConsumptionOrOutput[];
  outputs: ConsumptionOrOutput[];
}

export function ProductionOrderDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [quantityProduced, setQuantityProduced] = useState<number | "">("");

  const { data: order } = useQuery<OrderTrace>({
    queryKey: ["production-order", id],
    queryFn: async () => (await api.get(`/production/ordres/${id}/tracabilite`)).data,
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: { status: ProductionOrderStatus; quantityProduced?: number }) =>
      api.post(`/production/ordres/${id}/statut`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-order", id] });
      qc.invalidateQueries({ queryKey: ["stock-levels"] });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  if (!order) return <p className="muted">Chargement...</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Ordre de fabrication {order.number}</h1>
        <StatusBadge status={order.status} />
      </div>

      <div className="card">
        <div className="form-grid">
          <div>
            <div className="muted">Nomenclature</div>
            <div>{order.bom.name}</div>
          </div>
          <div>
            <div className="muted">Produit fini</div>
            <div>{order.bom.finishedArticle.name}</div>
          </div>
          <div>
            <div className="muted">Quantité planifiée</div>
            <div>{formatQty(order.quantityPlanned)}</div>
          </div>
          <div>
            <div className="muted">Quantité produite</div>
            <div>{formatQty(order.quantityProduced)}</div>
          </div>
          <div>
            <div className="muted">Poste</div>
            <div>{order.workCenter?.name ?? "-"}</div>
          </div>
          <div>
            <div className="muted">Effectif</div>
            <div>{order.workerCount}</div>
          </div>
          <div>
            <div className="muted">Début prévu</div>
            <div>{formatDateTime(order.plannedStartDate)}</div>
          </div>
          <div>
            <div className="muted">Fin prévue</div>
            <div>{formatDateTime(order.plannedEndDate)}</div>
          </div>
        </div>

        <div className="flex-row mt-16">
          {NEXT_STATUS[order.status].map((s) =>
            s === "DONE" ? (
              <div key={s} className="flex-row">
                <input
                  type="number"
                  step="0.001"
                  placeholder={`Qté produite (déf. ${order.quantityPlanned})`}
                  style={{ width: 200 }}
                  value={quantityProduced}
                  onChange={(e) => setQuantityProduced(e.target.value === "" ? "" : Number(e.target.value))}
                />
                <button
                  className="btn btn-sm"
                  onClick={() =>
                    statusMutation.mutate({
                      status: "DONE",
                      quantityProduced: quantityProduced === "" ? undefined : quantityProduced,
                    })
                  }
                >
                  Clôturer l'ordre
                </button>
              </div>
            ) : (
              <button
                key={s}
                className={`btn btn-sm ${s === "CANCELLED" ? "btn-danger" : ""}`}
                onClick={() => statusMutation.mutate({ status: s })}
                disabled={statusMutation.isPending}
              >
                → <StatusBadge status={s} />
              </button>
            )
          )}
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="form-grid">
        <div className="card">
          <h3>Consommations (traçabilité amont)</h3>
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Lot</th>
                <th className="text-right">Quantité</th>
              </tr>
            </thead>
            <tbody>
              {order.consumptions.map((c) => (
                <tr key={c.id}>
                  <td>{c.article.name}</td>
                  <td>{c.lot?.code ?? "-"}</td>
                  <td className="text-right">{formatQty(c.quantity)}</td>
                </tr>
              ))}
              {order.consumptions.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    Pas encore de consommation enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Production (traçabilité aval)</h3>
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Lot produit</th>
                <th className="text-right">Quantité</th>
              </tr>
            </thead>
            <tbody>
              {order.outputs.map((o) => (
                <tr key={o.id}>
                  <td>{o.article.name}</td>
                  <td>{o.lot?.code ?? "-"}</td>
                  <td className="text-right">{formatQty(o.quantity)}</td>
                </tr>
              ))}
              {order.outputs.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    Pas encore d'entrée en stock.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
