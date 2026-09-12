import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, apiErrorMessage } from "../../api/client";
import { Article, Client, SalesOrder, Warehouse } from "../../api/types";
import { Modal } from "../../components/Modal";
import { StatusBadge, STATUS_LABELS } from "../../components/StatusBadge";
import { formatDate, formatMoney } from "../../lib/format";
import { exportToCsv } from "../../lib/csv";

interface LineForm {
  articleId: string;
  warehouseId: string;
  quantity: number;
  unitPrice: number;
}

export function OrdersList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [currencyCode, setCurrencyCode] = useState("EUR");
  const [incoterm, setIncoterm] = useState("");
  const [lines, setLines] = useState<LineForm[]>([{ articleId: "", warehouseId: "", quantity: 1, unitPrice: 0 }]);

  const { data: orders = [] } = useQuery<SalesOrder[]>({
    queryKey: ["orders"],
    queryFn: async () => (await api.get("/commandes")).data,
  });
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: async () => (await api.get("/referentiels/clients")).data,
  });
  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ["articles", "FINISHED_PRODUCT"],
    queryFn: async () => (await api.get("/referentiels/articles", { params: { type: "FINISHED_PRODUCT" } })).data,
  });
  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ["warehouses"],
    queryFn: async () => (await api.get("/referentiels/warehouses")).data,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post("/commandes", {
        clientId,
        currencyCode,
        incoterm: incoterm || undefined,
        lines: lines.map((l) => ({
          articleId: l.articleId,
          warehouseId: l.warehouseId || undefined,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      setShowForm(false);
      navigate(`/commandes/${res.data.id}`);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function openCreate() {
    setClientId(clients[0]?.id ?? "");
    setCurrencyCode("EUR");
    setIncoterm("");
    setLines([{ articleId: articles[0]?.id ?? "", warehouseId: "", quantity: 1, unitPrice: 0 }]);
    setError(null);
    setShowForm(true);
  }

  function updateLine(index: number, patch: Partial<LineForm>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  function handleExport() {
    exportToCsv(
      "commandes",
      ["N°", "Client", "Date", "Statut", "Incoterm", "Devise", "Total"],
      orders.map((o) => [
        o.number,
        o.client?.name ?? "",
        formatDate(o.orderDate),
        STATUS_LABELS[o.status] ?? o.status,
        o.incoterm ?? "",
        o.currencyCode,
        o.lines.reduce((s, l) => s + Number(l.lineTotal), 0),
      ])
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Commandes clients</h1>
        <div className="flex-row">
          <button className="btn btn-secondary" onClick={handleExport}>
            Exporter Excel
          </button>
          <button className="btn" onClick={openCreate}>
            + Nouvelle commande
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Client</th>
              <th>Date</th>
              <th>Statut</th>
              <th>Incoterm</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} onClick={() => navigate(`/commandes/${o.id}`)} style={{ cursor: "pointer" }}>
                <td>{o.number}</td>
                <td>{o.client?.name}</td>
                <td>{formatDate(o.orderDate)}</td>
                <td>
                  <StatusBadge status={o.status} />
                </td>
                <td>{o.incoterm ?? "-"}</td>
                <td className="text-right">
                  {formatMoney(
                    o.lines.reduce((s, l) => s + Number(l.lineTotal), 0),
                    o.currencyCode
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">
                  Aucune commande.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Nouvelle commande" onClose={() => setShowForm(false)} width={760}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="form-grid">
              <div className="field">
                <label>Client</label>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Devise</label>
                <input value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} maxLength={3} />
              </div>
              <div className="field">
                <label>Incoterm</label>
                <select value={incoterm} onChange={(e) => setIncoterm(e.target.value)}>
                  <option value="">-</option>
                  {["EXW", "FOB", "CIF", "CFR", "DAP", "DDP"].map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <h3 className="mt-16">Lignes</h3>
            {lines.map((line, i) => (
              <div key={i} className="flex-row mt-16">
                <select
                  style={{ flex: 2 }}
                  value={line.articleId}
                  onChange={(e) => {
                    const article = articles.find((a) => a.id === e.target.value);
                    updateLine(i, { articleId: e.target.value, unitPrice: article ? Number(article.unitPrice) : 0 });
                  }}
                  required
                >
                  <option value="">Article</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <select
                  style={{ flex: 1 }}
                  value={line.warehouseId}
                  onChange={(e) => updateLine(i, { warehouseId: e.target.value })}
                >
                  <option value="">Entrepôt (défaut)</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.001"
                  style={{ width: 90 }}
                  value={line.quantity}
                  onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                  placeholder="Qté"
                />
                <input
                  type="number"
                  step="0.01"
                  style={{ width: 90 }}
                  value={line.unitPrice}
                  onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })}
                  placeholder="PU"
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={lines.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm mt-16"
              onClick={() => setLines((prev) => [...prev, { articleId: "", warehouseId: "", quantity: 1, unitPrice: 0 }])}
            >
              + Ajouter une ligne
            </button>

            <p className="mt-16" style={{ fontWeight: 600 }}>
              Total: {formatMoney(total, currencyCode)}
            </p>

            {error && <p className="error-text">{error}</p>}
            <div className="flex-row mt-16">
              <button className="btn" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Création..." : "Créer la commande"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
