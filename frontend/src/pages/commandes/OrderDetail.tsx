import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiErrorMessage, openPdf } from "../../api/client";
import { SalesOrder, SalesOrderStatus } from "../../api/types";
import { StatusBadge } from "../../components/StatusBadge";
import { Modal } from "../../components/Modal";
import { formatDate, formatMoney, formatQty } from "../../lib/format";

const NEXT_STATUS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PREPARATION", "CANCELLED"],
  IN_PREPARATION: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

interface Availability {
  allSufficient: boolean;
  lines: { lineId: string; articleName: string; requested: number; available: number; sufficient: boolean }[];
}

export function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceQuantities, setInvoiceQuantities] = useState<Record<string, number>>({});

  const { data: order } = useQuery<SalesOrder>({
    queryKey: ["order", id],
    queryFn: async () => (await api.get(`/commandes/${id}`)).data,
    enabled: !!id,
  });

  const { data: availability } = useQuery<Availability>({
    queryKey: ["order-availability", id],
    queryFn: async () => (await api.get(`/commandes/${id}/disponibilite`)).data,
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: async (status: SalesOrderStatus) => api.post(`/commandes/${id}/statut`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["order-availability", id] });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const invoiceMutation = useMutation({
    mutationFn: async () =>
      api.post(`/factures/depuis-commande/${id}`, {
        lines: Object.entries(invoiceQuantities)
          .filter(([, qty]) => qty > 0)
          .map(([salesOrderLineId, quantity]) => ({ salesOrderLineId, quantity })),
      }),
    onSuccess: (res) => {
      setShowInvoiceForm(false);
      navigate(`/factures/${res.data.id}`);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  if (!order) return <p className="muted">Chargement...</p>;

  const total = order.lines.reduce((s, l) => s + Number(l.lineTotal), 0);
  const canInvoice = ["CONFIRMED", "IN_PREPARATION", "SHIPPED", "DELIVERED"].includes(order.status);

  function openInvoiceForm() {
    const defaults: Record<string, number> = {};
    order!.lines.forEach((l) => (defaults[l.id] = Number(l.quantity)));
    setInvoiceQuantities(defaults);
    setShowInvoiceForm(true);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Commande {order.number}</h1>
        <StatusBadge status={order.status} />
      </div>

      <div className="card">
        <div className="form-grid">
          <div>
            <div className="muted">Client</div>
            <div>{order.client?.name}</div>
          </div>
          <div>
            <div className="muted">Date de commande</div>
            <div>{formatDate(order.orderDate)}</div>
          </div>
          <div>
            <div className="muted">Livraison souhaitée</div>
            <div>{formatDate(order.requestedDeliveryDate)}</div>
          </div>
          <div>
            <div className="muted">Incoterm</div>
            <div>{order.incoterm ?? "-"}</div>
          </div>
        </div>

        <div className="flex-row mt-16">
          {NEXT_STATUS[order.status].map((s) => (
            <button
              key={s}
              className={`btn btn-sm ${s === "CANCELLED" ? "btn-danger" : ""}`}
              onClick={() => statusMutation.mutate(s)}
              disabled={statusMutation.isPending}
            >
              → <StatusBadge status={s} />
            </button>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={() => openPdf(`/commandes/${order.id}/pdf`)}>
            Voir le PDF proforma
          </button>
          {canInvoice && (
            <button className="btn btn-secondary btn-sm" onClick={openInvoiceForm}>
              Générer une facture
            </button>
          )}
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>

      {availability && !availability.allSufficient && (
        <div className="card" style={{ borderColor: "var(--color-danger)" }}>
          <strong style={{ color: "var(--color-danger)" }}>Stock insuffisant pour cette commande</strong>
          <table className="mt-16">
            <thead>
              <tr>
                <th>Article</th>
                <th className="text-right">Demandé</th>
                <th className="text-right">Disponible</th>
              </tr>
            </thead>
            <tbody>
              {availability.lines
                .filter((l) => !l.sufficient)
                .map((l) => (
                  <tr key={l.lineId}>
                    <td>{l.articleName}</td>
                    <td className="text-right">{l.requested}</td>
                    <td className="text-right" style={{ color: "var(--color-danger)" }}>
                      {l.available}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Article</th>
              <th className="text-right">Quantité</th>
              <th className="text-right">PU</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.article?.name}</td>
                <td className="text-right">{formatQty(l.quantity)}</td>
                <td className="text-right">{formatMoney(l.unitPrice)}</td>
                <td className="text-right">{formatMoney(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="text-right" style={{ fontWeight: 600 }}>
                Total
              </td>
              <td className="text-right" style={{ fontWeight: 600 }}>
                {formatMoney(total, order.currencyCode)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {showInvoiceForm && (
        <Modal title="Générer une facture" onClose={() => setShowInvoiceForm(false)}>
          <p className="muted">Ajustez les quantités à facturer (facturation partielle possible).</p>
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th className="text-right">Commandé</th>
                <th className="text-right">À facturer</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.article?.name}</td>
                  <td className="text-right">{formatQty(l.quantity)}</td>
                  <td className="text-right">
                    <input
                      type="number"
                      style={{ width: 90 }}
                      max={Number(l.quantity)}
                      min={0}
                      step="0.001"
                      value={invoiceQuantities[l.id] ?? 0}
                      onChange={(e) =>
                        setInvoiceQuantities({ ...invoiceQuantities, [l.id]: Number(e.target.value) })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {error && <p className="error-text">{error}</p>}
          <div className="flex-row mt-16">
            <button className="btn" onClick={() => invoiceMutation.mutate()} disabled={invoiceMutation.isPending}>
              {invoiceMutation.isPending ? "Génération..." : "Générer la facture"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
