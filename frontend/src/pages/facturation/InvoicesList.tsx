import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { Invoice } from "../../api/types";
import { StatusBadge, STATUS_LABELS } from "../../components/StatusBadge";
import { formatDate, formatMoney } from "../../lib/format";
import { exportToCsv } from "../../lib/csv";

interface Receivables {
  totalOutstanding: number;
  totalOverdue: number;
  outstandingInvoices: {
    id: string;
    number: string;
    clientName: string;
    currencyCode: string;
    balance: number;
    dueDate: string;
    status: string;
    daysOverdue: number;
  }[];
}

export function InvoicesList() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"factures" | "creances">("factures");

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: async () => (await api.get("/factures")).data,
  });
  const { data: receivables } = useQuery<Receivables>({
    queryKey: ["receivables"],
    queryFn: async () => (await api.get("/factures/dashboard/creances")).data,
  });

  function handleExport() {
    if (tab === "factures") {
      exportToCsv(
        "factures",
        ["N°", "Type", "Client", "Émission", "Échéance", "Statut", "Devise", "Total"],
        invoices.map((inv) => [
          inv.number,
          inv.type === "INVOICE" ? "Facture" : "Avoir",
          inv.client?.name ?? "",
          formatDate(inv.issueDate),
          formatDate(inv.dueDate),
          STATUS_LABELS[inv.effectiveStatus ?? inv.status] ?? inv.status,
          inv.currencyCode,
          inv.totalAmount,
        ])
      );
    } else {
      exportToCsv(
        "creances",
        ["N° Facture", "Client", "Échéance", "Statut", "Devise", "Solde dû", "Jours de retard"],
        (receivables?.outstandingInvoices ?? []).map((inv) => [
          inv.number,
          inv.clientName,
          formatDate(inv.dueDate),
          STATUS_LABELS[inv.status] ?? inv.status,
          inv.currencyCode,
          inv.balance,
          inv.daysOverdue > 0 ? inv.daysOverdue : 0,
        ])
      );
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Facturation</h1>
        <button className="btn btn-secondary" onClick={handleExport}>
          Exporter Excel
        </button>
      </div>

      <div className="tabs">
        <button className={tab === "factures" ? "active" : ""} onClick={() => setTab("factures")}>
          Factures & avoirs
        </button>
        <button className={tab === "creances" ? "active" : ""} onClick={() => setTab("creances")}>
          Créances clients
        </button>
      </div>

      {tab === "factures" ? (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>N°</th>
                <th>Type</th>
                <th>Client</th>
                <th>Émission</th>
                <th>Échéance</th>
                <th>Statut</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} onClick={() => navigate(`/factures/${inv.id}`)} style={{ cursor: "pointer" }}>
                  <td>{inv.number}</td>
                  <td>{inv.type === "INVOICE" ? "Facture" : "Avoir"}</td>
                  <td>{inv.client?.name}</td>
                  <td>{formatDate(inv.issueDate)}</td>
                  <td>{formatDate(inv.dueDate)}</td>
                  <td>
                    <StatusBadge status={inv.effectiveStatus ?? inv.status} />
                  </td>
                  <td className="text-right">{formatMoney(inv.totalAmount, inv.currencyCode)}</td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    Aucune facture.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="kpi-grid">
            <div className="kpi">
              <div className="label">Total en cours</div>
              <div className="value">{formatMoney(receivables?.totalOutstanding ?? 0)}</div>
            </div>
            <div className="kpi">
              <div className="label">Total en retard</div>
              <div className="value" style={{ color: "var(--color-danger)" }}>
                {formatMoney(receivables?.totalOverdue ?? 0)}
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>N° Facture</th>
                  <th>Client</th>
                  <th>Échéance</th>
                  <th>Statut</th>
                  <th className="text-right">Solde dû</th>
                  <th className="text-right">Jours de retard</th>
                </tr>
              </thead>
              <tbody>
                {(receivables?.outstandingInvoices ?? []).map((inv) => (
                  <tr key={inv.id} onClick={() => navigate(`/factures/${inv.id}`)} style={{ cursor: "pointer" }}>
                    <td>{inv.number}</td>
                    <td>{inv.clientName}</td>
                    <td>{formatDate(inv.dueDate)}</td>
                    <td>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="text-right">{formatMoney(inv.balance, inv.currencyCode)}</td>
                    <td className="text-right">{inv.daysOverdue > 0 ? inv.daysOverdue : "-"}</td>
                  </tr>
                ))}
                {(receivables?.outstandingInvoices.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      Aucune créance en cours.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
