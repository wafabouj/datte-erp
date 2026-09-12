import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Lot, StockMovement } from "../../api/types";
import { Modal } from "../../components/Modal";
import { formatDate, formatDateTime, formatQty } from "../../lib/format";

interface Traceability {
  lot: Lot;
  movements: StockMovement[];
  consumedInOrders: {
    id: string;
    quantity: string;
    productionOrder: { number: string; bom: { finishedArticle: { name: string } } };
  }[];
}

export function Lots() {
  const [selected, setSelected] = useState<string | null>(null);

  const { data: lots = [] } = useQuery<Lot[]>({
    queryKey: ["lots"],
    queryFn: async () => (await api.get("/stock/lots")).data,
  });

  const { data: trace } = useQuery<Traceability>({
    queryKey: ["lot-trace", selected],
    queryFn: async () => (await api.get(`/stock/lots/${selected}/tracabilite`)).data,
    enabled: !!selected,
  });

  return (
    <div>
      <div className="page-header">
        <h1>Lots & traçabilité</h1>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Code lot</th>
              <th>Article</th>
              <th>Origine</th>
              <th>Récolte</th>
              <th>Réception</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lots.map((l) => (
              <tr key={l.id}>
                <td>{l.code}</td>
                <td>{l.article?.name}</td>
                <td>{l.supplier?.name ?? (l.productionOrderId ? "Production interne" : "-")}</td>
                <td>{formatDate(l.harvestDate)}</td>
                <td>{formatDate(l.receptionDate)}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelected(l.id)}>
                    Traçabilité
                  </button>
                </td>
              </tr>
            ))}
            {lots.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">
                  Aucun lot enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && trace && (
        <Modal title={`Traçabilité du lot ${trace.lot.code}`} onClose={() => setSelected(null)} width={720}>
          <div className="form-grid">
            <div>
              <div className="muted">Article</div>
              <div>{trace.lot.article?.name}</div>
            </div>
            <div>
              <div className="muted">Fournisseur / origine</div>
              <div>{trace.lot.supplier?.name ?? "Production interne"}</div>
            </div>
            <div>
              <div className="muted">Date de récolte</div>
              <div>{formatDate(trace.lot.harvestDate)}</div>
            </div>
            <div>
              <div className="muted">Date de réception</div>
              <div>{formatDate(trace.lot.receptionDate)}</div>
            </div>
          </div>

          <h3 className="mt-16">Mouvements de stock</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Entrepôt</th>
                <th>Type</th>
                <th className="text-right">Quantité</th>
              </tr>
            </thead>
            <tbody>
              {trace.movements.map((m) => (
                <tr key={m.id}>
                  <td>{formatDateTime(m.date)}</td>
                  <td>{m.warehouse.name}</td>
                  <td>{m.type}</td>
                  <td className="text-right">{formatQty(m.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {trace.consumedInOrders.length > 0 && (
            <>
              <h3 className="mt-16">Utilisé dans les ordres de fabrication</h3>
              <table>
                <thead>
                  <tr>
                    <th>Ordre</th>
                    <th>Produit fini</th>
                    <th className="text-right">Quantité consommée</th>
                  </tr>
                </thead>
                <tbody>
                  {trace.consumedInOrders.map((c) => (
                    <tr key={c.id}>
                      <td>{c.productionOrder.number}</td>
                      <td>{c.productionOrder.bom.finishedArticle.name}</td>
                      <td className="text-right">{formatQty(c.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
