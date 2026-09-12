import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../api/client";
import { Article, StockLevel, Supplier, Warehouse } from "../../api/types";
import { Modal } from "../../components/Modal";
import { formatQty } from "../../lib/format";

const ARTICLE_TYPE_LABELS: Record<string, string> = {
  RAW_MATERIAL: "Matière première",
  PACKAGING: "Emballage",
  FINISHED_PRODUCT: "Produit fini",
};

export function StockLevels() {
  const qc = useQueryClient();
  const [showReception, setShowReception] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: levels = [] } = useQuery<StockLevel[]>({
    queryKey: ["stock-levels"],
    queryFn: async () => (await api.get("/stock/niveaux")).data,
  });
  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ["articles-all"],
    queryFn: async () => (await api.get("/referentiels/articles")).data,
  });
  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ["warehouses"],
    queryFn: async () => (await api.get("/referentiels/warehouses")).data,
  });
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: async () => (await api.get("/referentiels/suppliers")).data,
  });

  const [receptionForm, setReceptionForm] = useState({
    articleId: "",
    warehouseId: "",
    quantity: 0,
    supplierId: "",
  });
  const receptionMutation = useMutation({
    mutationFn: async () => api.post("/stock/receptions", receptionForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-levels"] });
      setShowReception(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const [adjustmentForm, setAdjustmentForm] = useState({ articleId: "", warehouseId: "", quantity: 0, notes: "" });
  const adjustmentMutation = useMutation({
    mutationFn: async () => api.post("/stock/ajustements", adjustmentForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-levels"] });
      setShowAdjustment(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <div>
      <div className="page-header">
        <h1>Niveaux de stock</h1>
        <div className="flex-row">
          <button
            className="btn btn-secondary"
            onClick={() => {
              setError(null);
              setReceptionForm({ articleId: articles[0]?.id ?? "", warehouseId: warehouses[0]?.id ?? "", quantity: 0, supplierId: "" });
              setShowReception(true);
            }}
          >
            Réception matière première
          </button>
          <button
            className="btn"
            onClick={() => {
              setError(null);
              setAdjustmentForm({ articleId: articles[0]?.id ?? "", warehouseId: warehouses[0]?.id ?? "", quantity: 0, notes: "" });
              setShowAdjustment(true);
            }}
          >
            Ajustement d'inventaire
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Article</th>
              <th>Type</th>
              <th>Entrepôt</th>
              <th>Lot</th>
              <th className="text-right">Quantité</th>
              <th>UdM</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((l) => (
              <tr key={l.id}>
                <td>{l.article.name}</td>
                <td>{ARTICLE_TYPE_LABELS[l.article.type]}</td>
                <td>{l.warehouse.name}</td>
                <td>{l.lot?.code ?? "-"}</td>
                <td className="text-right">{formatQty(l.quantity)}</td>
                <td>{l.article.uom?.code}</td>
              </tr>
            ))}
            {levels.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">
                  Aucun stock enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showReception && (
        <Modal title="Réception matière première / emballage" onClose={() => setShowReception(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              receptionMutation.mutate();
            }}
          >
            <div className="form-grid">
              <div className="field">
                <label>Article</label>
                <select
                  value={receptionForm.articleId}
                  onChange={(e) => setReceptionForm({ ...receptionForm, articleId: e.target.value })}
                >
                  {articles
                    .filter((a) => a.type !== "FINISHED_PRODUCT")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label>Entrepôt</label>
                <select
                  value={receptionForm.warehouseId}
                  onChange={(e) => setReceptionForm({ ...receptionForm, warehouseId: e.target.value })}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Fournisseur</label>
                <select
                  value={receptionForm.supplierId}
                  onChange={(e) => setReceptionForm({ ...receptionForm, supplierId: e.target.value })}
                >
                  <option value="">-</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Quantité</label>
                <input
                  type="number"
                  step="0.001"
                  value={receptionForm.quantity}
                  onChange={(e) => setReceptionForm({ ...receptionForm, quantity: Number(e.target.value) })}
                  required
                />
              </div>
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="flex-row mt-16">
              <button className="btn" disabled={receptionMutation.isPending}>
                Enregistrer la réception
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showAdjustment && (
        <Modal title="Ajustement d'inventaire" onClose={() => setShowAdjustment(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              adjustmentMutation.mutate();
            }}
          >
            <div className="form-grid">
              <div className="field">
                <label>Article</label>
                <select
                  value={adjustmentForm.articleId}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, articleId: e.target.value })}
                >
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Entrepôt</label>
                <select
                  value={adjustmentForm.warehouseId}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, warehouseId: e.target.value })}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Quantité (+ ou -)</label>
                <input
                  type="number"
                  step="0.001"
                  value={adjustmentForm.quantity}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, quantity: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="field">
                <label>Motif</label>
                <input value={adjustmentForm.notes} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, notes: e.target.value })} />
              </div>
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="flex-row mt-16">
              <button className="btn" disabled={adjustmentMutation.isPending}>
                Enregistrer l'ajustement
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
