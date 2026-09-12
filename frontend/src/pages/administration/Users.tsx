import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../api/client";
import { Modal } from "../../components/Modal";
import { useAuth } from "../../context/AuthContext";
import { formatDate } from "../../lib/format";

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur",
  COMMERCIAL: "Commercial",
  PRODUCTION: "Production",
  COMPTABILITE: "Comptabilité",
};

const emptyForm = { email: "", name: "", role: "COMMERCIAL", password: "" };

export function Users() {
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/utilisateurs")).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => api.post("/utilisateurs", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowForm(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/utilisateurs/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (err) => alert(apiErrorMessage(err)),
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) =>
      api.put(`/utilisateurs/${id}`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (err) => alert(apiErrorMessage(err)),
  });

  return (
    <div>
      <div className="page-header">
        <h1>Comptes utilisateurs</h1>
        <button
          className="btn"
          onClick={() => {
            setForm(emptyForm);
            setError(null);
            setShowForm(true);
          }}
        >
          + Nouveau compte
        </button>
      </div>

      <p className="muted" style={{ marginTop: -8 }}>
        Chaque rôle limite les actions d'écriture possibles : Commercial (clients, commandes),
        Production (stock, articles, production, planification), Comptabilité (factures, devises).
        La lecture reste ouverte à tous. Administrateur a tous les droits.
      </p>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Créé le</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={(e) => changeRoleMutation.mutate({ id: u.id, role: e.target.value })}
                    disabled={u.id === currentUser?.id}
                  >
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{formatDate(u.createdAt)}</td>
                <td>
                  <span className={`badge ${u.isActive ? "badge-green" : "badge-red"}`}>
                    {u.isActive ? "Actif" : "Désactivé"}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={u.id === currentUser?.id}
                    onClick={() => toggleActiveMutation.mutate({ id: u.id, isActive: !u.isActive })}
                  >
                    {u.isActive ? "Désactiver" : "Réactiver"}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">
                  Aucun compte.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Nouveau compte utilisateur" onClose={() => setShowForm(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="form-grid">
              <div className="field">
                <label>Nom</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Rôle</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Mot de passe initial</label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="flex-row mt-16">
              <button className="btn" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Création..." : "Créer le compte"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
