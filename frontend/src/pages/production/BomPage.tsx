import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../api/client";
import { Article, BillOfMaterial } from "../../api/types";
import { Modal } from "../../components/Modal";
import { formatQty } from "../../lib/format";

interface ComponentForm {
  articleId: string;
  qtyPerUnit: number;
}

export function BomPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [finishedArticleId, setFinishedArticleId] = useState("");
  const [expectedYieldPct, setExpectedYieldPct] = useState(100);
  const [components, setComponents] = useState<ComponentForm[]>([{ articleId: "", qtyPerUnit: 0 }]);

  const { data: boms = [] } = useQuery<BillOfMaterial[]>({
    queryKey: ["boms"],
    queryFn: async () => (await api.get("/production/bom")).data,
  });
  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ["articles-all"],
    queryFn: async () => (await api.get("/referentiels/articles")).data,
  });

  const finishedArticles = articles.filter((a) => a.type === "FINISHED_PRODUCT");
  const componentArticles = articles.filter((a) => a.type !== "FINISHED_PRODUCT");

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post("/production/bom", {
        name,
        finishedArticleId,
        expectedYieldPct,
        components: components.filter((c) => c.articleId && c.qtyPerUnit > 0),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boms"] });
      setShowForm(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function openCreate() {
    setName("");
    setFinishedArticleId(finishedArticles[0]?.id ?? "");
    setExpectedYieldPct(100);
    setComponents([{ articleId: componentArticles[0]?.id ?? "", qtyPerUnit: 0 }]);
    setError(null);
    setShowForm(true);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Nomenclatures (BOM)</h1>
        <button className="btn" onClick={openCreate}>
          + Nouvelle nomenclature
        </button>
      </div>

      {boms.map((bom) => (
        <div key={bom.id} className="card">
          <div className="flex-between">
            <div>
              <strong>{bom.name}</strong>
              <div className="muted">Produit fini: {bom.finishedArticle.name}</div>
            </div>
            <span className="badge badge-blue">Rendement attendu {Number(bom.expectedYieldPct)}%</span>
          </div>
          <table className="mt-16">
            <thead>
              <tr>
                <th>Composant</th>
                <th className="text-right">Qté par unité de produit fini</th>
              </tr>
            </thead>
            <tbody>
              {bom.components.map((c) => (
                <tr key={c.id}>
                  <td>{c.article.name}</td>
                  <td className="text-right">
                    {formatQty(c.qtyPerUnit)} {c.article.uom?.code}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {boms.length === 0 && <p className="empty-state">Aucune nomenclature définie.</p>}

      {showForm && (
        <Modal title="Nouvelle nomenclature" onClose={() => setShowForm(false)} width={700}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="form-grid">
              <div className="field">
                <label>Nom</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label>Produit fini</label>
                <select value={finishedArticleId} onChange={(e) => setFinishedArticleId(e.target.value)} required>
                  {finishedArticles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Rendement attendu (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={expectedYieldPct}
                  onChange={(e) => setExpectedYieldPct(Number(e.target.value))}
                />
              </div>
            </div>

            <h3 className="mt-16">Composants (par unité de produit fini)</h3>
            {components.map((c, i) => (
              <div key={i} className="flex-row mt-16">
                <select
                  style={{ flex: 2 }}
                  value={c.articleId}
                  onChange={(e) =>
                    setComponents((prev) => prev.map((p, idx) => (idx === i ? { ...p, articleId: e.target.value } : p)))
                  }
                >
                  {componentArticles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.uom?.code})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.0001"
                  style={{ width: 120 }}
                  value={c.qtyPerUnit}
                  onChange={(e) =>
                    setComponents((prev) =>
                      prev.map((p, idx) => (idx === i ? { ...p, qtyPerUnit: Number(e.target.value) } : p))
                    )
                  }
                  placeholder="Qté/unité"
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setComponents((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={components.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm mt-16"
              onClick={() => setComponents((prev) => [...prev, { articleId: componentArticles[0]?.id ?? "", qtyPerUnit: 0 }])}
            >
              + Ajouter un composant
            </button>

            {error && <p className="error-text">{error}</p>}
            <div className="flex-row mt-16">
              <button className="btn" disabled={createMutation.isPending}>
                Enregistrer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
