import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api, apiErrorMessage, openPdf } from "../../api/client";
import { Invoice } from "../../api/types";
import { StatusBadge } from "../../components/StatusBadge";
import { formatDate, formatMoney, formatQty } from "../../lib/format";

export function InvoiceDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("virement");

  const { data: invoice } = useQuery<Invoice>({
    queryKey: ["invoice", id],
    queryFn: async () => (await api.get(`/factures/${id}`)).data,
    enabled: !!id,
  });

  const paymentMutation = useMutation({
    mutationFn: async () => api.post(`/factures/${id}/paiements`, { amount, method }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["receivables"] });
      setAmount(0);
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => api.post(`/factures/${id}/annuler`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice", id] }),
    onError: (err) => setError(apiErrorMessage(err)),
  });

  if (!invoice) return <p className="muted">Chargement...</p>;

  const paid = (invoice.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const balance = Number(invoice.totalAmount) - paid;

  return (
    <div>
      <div className="page-header">
        <h1>{invoice.type === "INVOICE" ? "Facture" : "Avoir"} {invoice.number}</h1>
        <StatusBadge status={invoice.effectiveStatus ?? invoice.status} />
      </div>

      <div className="card">
        <div className="form-grid">
          <div>
            <div className="muted">Client</div>
            <div>{invoice.client?.name}</div>
          </div>
          <div>
            <div className="muted">Émission</div>
            <div>{formatDate(invoice.issueDate)}</div>
          </div>
          <div>
            <div className="muted">Échéance</div>
            <div>{formatDate(invoice.dueDate)}</div>
          </div>
          <div>
            <div className="muted">Total</div>
            <div>{formatMoney(invoice.totalAmount, invoice.currencyCode)}</div>
          </div>
        </div>
        <div className="flex-row mt-16">
          <button className="btn btn-secondary btn-sm" onClick={() => openPdf(`/factures/${invoice.id}/pdf`)}>
            Voir le PDF
          </button>
          {invoice.status !== "CANCELLED" && (invoice.payments?.length ?? 0) === 0 && (
            <button className="btn btn-danger btn-sm" onClick={() => cancelMutation.mutate()}>
              Annuler la facture
            </button>
          )}
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>

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
            {invoice.lines?.map((l) => (
              <tr key={l.id}>
                <td>{l.description ?? l.article?.name}</td>
                <td className="text-right">{formatQty(l.quantity)}</td>
                <td className="text-right">{formatMoney(l.unitPrice)}</td>
                <td className="text-right">{formatMoney(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invoice.type === "INVOICE" && (
        <div className="card">
          <h3>Paiements</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Méthode</th>
                <th className="text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments?.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.date)}</td>
                  <td>{p.method ?? "-"}</td>
                  <td className="text-right">{formatMoney(p.amount, invoice.currencyCode)}</td>
                </tr>
              ))}
              {(invoice.payments?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    Aucun paiement enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex-between mt-16">
            <strong>Solde dû: {formatMoney(balance, invoice.currencyCode)}</strong>
          </div>

          {balance > 0.001 && invoice.status !== "CANCELLED" && (
            <form
              className="flex-row mt-16"
              onSubmit={(e) => {
                e.preventDefault();
                paymentMutation.mutate();
              }}
            >
              <input
                type="number"
                step="0.01"
                max={balance}
                placeholder="Montant"
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
                style={{ width: 120 }}
              />
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="virement">Virement</option>
                <option value="cheque">Chèque</option>
                <option value="lc">Lettre de crédit</option>
                <option value="especes">Espèces</option>
              </select>
              <button className="btn btn-sm" disabled={paymentMutation.isPending}>
                Enregistrer le paiement
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
