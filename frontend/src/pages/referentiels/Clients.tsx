import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../api/client";
import { Client, Currency } from "../../api/types";
import { Modal } from "../../components/Modal";
import { exportToCsv } from "../../lib/csv";

const emptyForm = {
  code: "",
  name: "",
  country: "",
  address: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  paymentTermsDays: 30,
  currencyCode: "EUR",
  defaultIncoterm: "",
};

export function Clients() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: async () => (await api.get("/referentiels/clients")).data,
  });
  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ["currencies"],
    queryFn: async () => (await api.get("/referentiels/currencies")).data,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) return api.put(`/referentiels/clients/${editing.id}`, form);
      return api.post("/referentiels/clients", form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
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

  function openEdit(client: Client) {
    setEditing(client);
    setForm({
      code: client.code,
      name: client.name,
      country: client.country,
      address: client.address ?? "",
      contactName: client.contactName ?? "",
      contactEmail: client.contactEmail ?? "",
      contactPhone: client.contactPhone ?? "",
      paymentTermsDays: client.paymentTermsDays,
      currencyCode: client.currencyCode,
      defaultIncoterm: client.defaultIncoterm ?? "",
    });
    setError(null);
    setShowForm(true);
  }

  function handleExport() {
    exportToCsv(
      "clients",
      ["Code", "Nom", "Pays", "Adresse", "Contact", "Email", "Téléphone", "Devise", "Délai paiement (j)", "Incoterm"],
      clients.map((c) => [
        c.code,
        c.name,
        c.country,
        c.address ?? "",
        c.contactName ?? "",
        c.contactEmail ?? "",
        c.contactPhone ?? "",
        c.currencyCode,
        c.paymentTermsDays,
        c.defaultIncoterm ?? "",
      ])
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Clients</h1>
        <div className="flex-row">
          <button className="btn btn-secondary" onClick={handleExport}>
            Exporter Excel
          </button>
          <button className="btn" onClick={openCreate}>
            + Nouveau client
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Pays</th>
              <th>Devise</th>
              <th>Conditions</th>
              <th>Incoterm</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.name}</td>
                <td>{c.country}</td>
                <td>{c.currencyCode}</td>
                <td>{c.paymentTermsDays}j</td>
                <td>{c.defaultIncoterm ?? "-"}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state">
                  Aucun client enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editing ? "Modifier le client" : "Nouveau client"} onClose={() => setShowForm(false)}>
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
              <div className="field">
                <label>Devise</label>
                <select value={form.currencyCode} onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}>
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Délai de paiement (jours)</label>
                <input
                  type="number"
                  value={form.paymentTermsDays}
                  onChange={(e) => setForm({ ...form, paymentTermsDays: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>Incoterm par défaut</label>
                <select
                  value={form.defaultIncoterm}
                  onChange={(e) => setForm({ ...form, defaultIncoterm: e.target.value })}
                >
                  <option value="">-</option>
                  {["EXW", "FOB", "CIF", "CFR", "DAP", "DDP"].map((i) => (
                    <option key={i} value={i}>
                      {i}
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
