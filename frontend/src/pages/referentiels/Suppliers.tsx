import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../api/client";
import { Supplier } from "../../api/types";
import { Modal } from "../../components/Modal";

const emptyForm = { code: "", name: "", country: "", address: "", contactName: "", contactEmail: "", contactPhone: "" };

export function Suppliers() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: async () => (await api.get("/referentiels/suppliers")).data,
  });

  const saveMutation = useMutation({
    mutationFn: async () =>
      editing ? api.put(`/referentiels/suppliers/${editing.id}`, form) : api.post("/referentiels/suppliers", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setShowForm(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      code: s.code,
      name: s.name,
      country: s.country,
      address: s.address ?? "",
      contactName: s.contactName ?? "",
      contactEmail: s.contactEmail ?? "",
      contactPhone: s.contactPhone ?? "",
    });
    setError(null);
    setShowForm(true);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Fournisseurs</h1>
        <button className="btn" onClick={openCreate}>
          + Nouveau fournisseur
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Pays</th>
              <th>Contact</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td>{s.code}</td>
                <td>{s.name}</td>
                <td>{s.country}</td>
                <td>{s.contactName ?? "-"}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  Aucun fournisseur enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editing ? "Modifier le fournisseur" : "Nouveau fournisseur"} onClose={() => setShowForm(false)}>
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
                <label>Pays</label>
                <input required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
              <div className="field">
                <label>Adresse</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="field">
                <label>Contact</label>
                <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Téléphone</label>
                <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
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
