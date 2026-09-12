import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../api/client";
import { WorkCenter, Worker } from "../../api/types";
import { Modal } from "../../components/Modal";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export function WorkCentersAndWorkers() {
  const qc = useQueryClient();
  const [showWc, setShowWc] = useState(false);
  const [showWorker, setShowWorker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: workCenters = [] } = useQuery<WorkCenter[]>({
    queryKey: ["work-centers"],
    queryFn: async () => (await api.get("/planification/postes")).data,
  });
  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["workers"],
    queryFn: async () => (await api.get("/planification/ouvriers")).data,
  });

  const [wcForm, setWcForm] = useState({
    code: "",
    name: "",
    capacityKgPerHourPerWorker: 50,
    workingHoursPerDay: 8,
    breakMinutesPerDay: 30,
    workingDays: [1, 2, 3, 4, 5] as number[],
  });
  const createWc = useMutation({
    mutationFn: async () => api.post("/planification/postes", wcForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-centers"] });
      setShowWc(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const [workerForm, setWorkerForm] = useState({ name: "", defaultWorkCenterId: "" });
  const createWorker = useMutation({
    mutationFn: async () => api.post("/planification/ouvriers", workerForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      setShowWorker(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function toggleDay(day: number) {
    setWcForm((prev) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day].sort(),
    }));
  }

  return (
    <div>
      <div className="page-header">
        <h1>Postes de travail & ouvriers</h1>
      </div>

      <div className="form-grid">
        <div className="card">
          <div className="flex-between">
            <h3>Postes de travail</h3>
            <button
              className="btn btn-sm"
              onClick={() => {
                setError(null);
                setShowWc(true);
              }}
            >
              + Ajouter
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Nom</th>
                <th className="text-right">Capacité (kg/h/ouvrier)</th>
                <th>Jours ouvrés</th>
              </tr>
            </thead>
            <tbody>
              {workCenters.map((wc) => (
                <tr key={wc.id}>
                  <td>{wc.code}</td>
                  <td>{wc.name}</td>
                  <td className="text-right">{wc.capacityKgPerHourPerWorker}</td>
                  <td>{wc.workingDays.map((d) => DAY_LABELS[d]).join(", ")}</td>
                </tr>
              ))}
              {workCenters.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    Aucun poste défini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="flex-between">
            <h3>Ouvriers</h3>
            <button
              className="btn btn-sm"
              onClick={() => {
                setWorkerForm({ name: "", defaultWorkCenterId: workCenters[0]?.id ?? "" });
                setError(null);
                setShowWorker(true);
              }}
            >
              + Ajouter
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Poste habituel</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id}>
                  <td>{w.name}</td>
                  <td>{w.defaultWorkCenter?.name ?? "-"}</td>
                </tr>
              ))}
              {workers.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty-state">
                    Aucun ouvrier enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showWc && (
        <Modal title="Nouveau poste de travail" onClose={() => setShowWc(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createWc.mutate();
            }}
          >
            <div className="form-grid">
              <div className="field">
                <label>Code</label>
                <input required value={wcForm.code} onChange={(e) => setWcForm({ ...wcForm, code: e.target.value })} />
              </div>
              <div className="field">
                <label>Nom</label>
                <input required value={wcForm.name} onChange={(e) => setWcForm({ ...wcForm, name: e.target.value })} />
              </div>
              <div className="field">
                <label>Capacité (kg/h/ouvrier)</label>
                <input
                  type="number"
                  step="0.1"
                  value={wcForm.capacityKgPerHourPerWorker}
                  onChange={(e) => setWcForm({ ...wcForm, capacityKgPerHourPerWorker: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>Heures/jour</label>
                <input
                  type="number"
                  step="0.5"
                  value={wcForm.workingHoursPerDay}
                  onChange={(e) => setWcForm({ ...wcForm, workingHoursPerDay: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>Pause (minutes/jour)</label>
                <input
                  type="number"
                  value={wcForm.breakMinutesPerDay}
                  onChange={(e) => setWcForm({ ...wcForm, breakMinutesPerDay: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>Jours ouvrés</label>
                <div className="flex-row">
                  {DAY_LABELS.map((label, day) => (
                    <label key={day} style={{ fontSize: 12.5 }}>
                      <input type="checkbox" checked={wcForm.workingDays.includes(day)} onChange={() => toggleDay(day)} />{" "}
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="flex-row mt-16">
              <button className="btn" disabled={createWc.isPending}>
                Enregistrer
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showWorker && (
        <Modal title="Nouvel ouvrier" onClose={() => setShowWorker(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createWorker.mutate();
            }}
          >
            <div className="form-grid">
              <div className="field">
                <label>Nom</label>
                <input required value={workerForm.name} onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })} />
              </div>
              <div className="field">
                <label>Poste habituel</label>
                <select
                  value={workerForm.defaultWorkCenterId}
                  onChange={(e) => setWorkerForm({ ...workerForm, defaultWorkCenterId: e.target.value })}
                >
                  <option value="">-</option>
                  {workCenters.map((wc) => (
                    <option key={wc.id} value={wc.id}>
                      {wc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="flex-row mt-16">
              <button className="btn" disabled={createWorker.isPending}>
                Enregistrer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
