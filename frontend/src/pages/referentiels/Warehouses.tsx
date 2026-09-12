import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../api/client";
import { Warehouse } from "../../api/types";
import { Modal } from "../../components/Modal";

const emptyForm = { code: "", name: "", address: "", isDefault: false };

export function Warehouses() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ["warehouses"],
    queryFn: async () => (await api.get("/referentiels/warehouses")).data,
  });

  const saveMutation = useMutation({
    mutationFn: async () =>
      editing ? api.put(`/referentiels/warehouses/${editing.id}`, form) : api.post("/referentiels/warehouses", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      setShowForm(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <div>
      <div className="page-header">
        <h1>Entrepôts</h1>
        <button
          className="btn"
          onClick={() => {
            setEditing(null);
            setForm(emptyForm);
            setError(null);
            setShowForm(true);
          }}
        >
          + Nouvel entrepôt
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Adresse</th>
              <th>Par défaut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((w) => (
              <tr key={w.id}>
                <td>{w.code}</td>
                <td>{w.name}</td>
                <td>{w.address ?? "-"}</td>
                <td>{w.isDefault ? "Oui" : ""}</td>
                <td>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setEditing(w);
                      setForm({ code: w.code, name: w.name, address: w.address ?? "", isDefault: w.isDefault });
                      setError(null);
                      setShowForm(true);
                    }}
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
            {warehouses.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  Aucun entrepôt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editing ? "Modifier l'entrepôt" : "Nouvel entrepôt"} onClose={() => setShowForm(false)}>
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
                <label>Adresse</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="field">
                <label>
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  />{" "}
                  Entrepôt par défaut
                </label>
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
