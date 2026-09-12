import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../api/client";
import { Article, ArticleType, Currency, UnitOfMeasure } from "../../api/types";
import { Modal } from "../../components/Modal";
import { exportToCsv } from "../../lib/csv";

const emptyForm = {
  code: "",
  name: "",
  type: "FINISHED_PRODUCT" as ArticleType,
  variety: "",
  caliber: "",
  packaging: "",
  uomId: "",
  minStock: 0,
  unitCost: 0,
  unitPrice: 0,
  currencyCode: "EUR",
};

const TYPE_LABELS: Record<ArticleType, string> = {
  RAW_MATERIAL: "Matière première",
  PACKAGING: "Emballage",
  FINISHED_PRODUCT: "Produit fini",
};

export function Articles() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Article | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("");

  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ["articles", filterType],
    queryFn: async () =>
      (await api.get("/referentiels/articles", { params: filterType ? { type: filterType } : {} })).data,
  });
  const { data: uoms = [] } = useQuery<UnitOfMeasure[]>({
    queryKey: ["uoms"],
    queryFn: async () => (await api.get("/referentiels/uom")).data,
  });
  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ["currencies"],
    queryFn: async () => (await api.get("/referentiels/currencies")).data,
  });

  const saveMutation = useMutation({
    mutationFn: async () =>
      editing ? api.put(`/referentiels/articles/${editing.id}`, form) : api.post("/referentiels/articles", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      setShowForm(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, uomId: uoms[0]?.id ?? "" });
    setError(null);
    setShowForm(true);
  }

  function openEdit(a: Article) {
    setEditing(a);
    setForm({
      code: a.code,
      name: a.name,
      type: a.type,
      variety: a.variety ?? "",
      caliber: a.caliber ?? "",
      packaging: a.packaging ?? "",
      uomId: a.uomId,
      minStock: Number(a.minStock),
      unitCost: Number(a.unitCost),
      unitPrice: Number(a.unitPrice),
      currencyCode: a.currencyCode,
    });
    setError(null);
    setShowForm(true);
  }

  function handleExport() {
    exportToCsv(
      "articles",
      ["Code", "Nom", "Type", "Variété", "Calibre", "Conditionnement", "UdM", "Stock min", "Coût unitaire", "Prix vente", "Devise"],
      articles.map((a) => [
        a.code,
        a.name,
        TYPE_LABELS[a.type],
        a.variety ?? "",
        a.caliber ?? "",
        a.packaging ?? "",
        a.uom?.code ?? "",
        a.minStock,
        a.unitCost,
        a.unitPrice,
        a.currencyCode,
      ])
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Articles</h1>
        <div className="flex-row">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Tous types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={handleExport}>
            Exporter Excel
          </button>
          <button className="btn" onClick={openCreate}>
            + Nouvel article
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Type</th>
              <th>Variété</th>
              <th>Conditionnement</th>
              <th>UdM</th>
              <th className="text-right">PU vente</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => (
              <tr key={a.id}>
                <td>{a.code}</td>
                <td>{a.name}</td>
                <td>{TYPE_LABELS[a.type]}</td>
                <td>{a.variety ?? "-"}</td>
                <td>{a.packaging ?? "-"}</td>
                <td>{a.uom?.code}</td>
                <td className="text-right">
                  {Number(a.unitPrice).toFixed(2)} {a.currencyCode}
                </td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(a)}>
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
            {articles.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-state">
                  Aucun article.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editing ? "Modifier l'article" : "Nouvel article"} onClose={() => setShowForm(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="form-grid">
              <div className="field">
                <label>Code</label>
                <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div className="field">
                <label>Nom</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ArticleType })}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Variété</label>
                <input value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} />
              </div>
              <div className="field">
                <label>Calibre</label>
                <input value={form.caliber} onChange={(e) => setForm({ ...form, caliber: e.target.value })} />
              </div>
              <div className="field">
                <label>Conditionnement</label>
                <input
                  placeholder="Carton 5kg, vrac..."
                  value={form.packaging}
                  onChange={(e) => setForm({ ...form, packaging: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Unité de mesure</label>
                <select value={form.uomId} onChange={(e) => setForm({ ...form, uomId: e.target.value })}>
                  {uoms.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code} - {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Stock minimum</label>
                <input
                  type="number"
                  step="0.001"
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>Coût unitaire</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.unitCost}
                  onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>Prix de vente</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>Devise</label>
                <select value={form.currencyCode} onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}>
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="flex-row mt-16">
              <button className="btn" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
