import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, apiErrorMessage } from "../../api/client";
import { BillOfMaterial, ProductionOrder, Warehouse, WorkCenter, Worker } from "../../api/types";
import { Modal } from "../../components/Modal";
import { StatusBadge } from "../../components/StatusBadge";
import { formatDateTime, formatQty } from "../../lib/format";

export function ProductionOrders() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [bomId, setBomId] = useState("");
  const [quantityPlanned, setQuantityPlanned] = useState(0);
  const [workCenterId, setWorkCenterId] = useState("");
  const [workerCount, setWorkerCount] = useState(1);
  const [workerIds, setWorkerIds] = useState<string[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [plannedStartDate, setPlannedStartDate] = useState("");

  const { data: orders = [] } = useQuery<ProductionOrder[]>({
    queryKey: ["production-orders"],
    queryFn: async () => (await api.get("/production/ordres")).data,
  });
  const { data: boms = [] } = useQuery<BillOfMaterial[]>({
    queryKey: ["boms"],
    queryFn: async () => (await api.get("/production/bom")).data,
  });
  const { data: workCenters = [] } = useQuery<WorkCenter[]>({
    queryKey: ["work-centers"],
    queryFn: async () => (await api.get("/planification/postes")).data,
  });
  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["workers"],
    queryFn: async () => (await api.get("/planification/ouvriers")).data,
  });
  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ["warehouses"],
    queryFn: async () => (await api.get("/referentiels/warehouses")).data,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post("/production/ordres", {
        bomId,
        quantityPlanned,
        workCenterId: workCenterId || undefined,
        workerCount,
        workerIds,
        warehouseId: warehouseId || undefined,
        plannedStartDate: plannedStartDate || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["production-orders"] });
      const shortages = res.data.materialAvailability.filter((a: { sufficient: boolean }) => !a.sufficient);
      if (shortages.length > 0) {
        setInfo("Ordre créé, mais attention : matière première insuffisante en stock actuellement.");
      } else {
        setShowForm(false);
        navigate(`/production/ordres/${res.data.order.id}`);
      }
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function openCreate() {
    setBomId(boms[0]?.id ?? "");
    setQuantityPlanned(0);
    setWorkCenterId(workCenters[0]?.id ?? "");
    setWorkerCount(1);
    setWorkerIds([]);
    setWarehouseId(warehouses[0]?.id ?? "");
    setPlannedStartDate("");
    setError(null);
    setInfo(null);
    setShowForm(true);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Ordres de fabrication</h1>
        <button className="btn" onClick={openCreate}>
          + Nouvel ordre
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Produit fini</th>
              <th className="text-right">Qté planifiée</th>
              <th>Poste</th>
              <th>Statut</th>
              <th>Début prévu</th>
              <th>Fin prévue</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} onClick={() => navigate(`/production/ordres/${o.id}`)} style={{ cursor: "pointer" }}>
                <td>{o.number}</td>
                <td>{o.bom.finishedArticle.name}</td>
                <td className="text-right">{formatQty(o.quantityPlanned)}</td>
                <td>{o.workCenter?.name ?? "-"}</td>
                <td>
                  <StatusBadge status={o.status} />
                </td>
                <td>{formatDateTime(o.plannedStartDate)}</td>
                <td>{formatDateTime(o.plannedEndDate)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state">
                  Aucun ordre de fabrication.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Nouvel ordre de fabrication" onClose={() => setShowForm(false)} width={700}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="form-grid">
              <div className="field">
                <label>Nomenclature (BOM)</label>
                <select value={bomId} onChange={(e) => setBomId(e.target.value)} required>
                  {boms.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Quantité de produit fini planifiée</label>
                <input
                  type="number"
                  step="0.001"
                  value={quantityPlanned}
                  onChange={(e) => setQuantityPlanned(Number(e.target.value))}
                  required
                />
              </div>
              <div className="field">
                <label>Entrepôt (MP sortie / PF entrée)</label>
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Poste de travail</label>
                <select value={workCenterId} onChange={(e) => setWorkCenterId(e.target.value)}>
                  <option value="">-</option>
                  {workCenters.map((wc) => (
                    <option key={wc.id} value={wc.id}>
                      {wc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Effectif affecté</label>
                <input type="number" min={1} value={workerCount} onChange={(e) => setWorkerCount(Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Date de début prévue</label>
                <input type="datetime-local" value={plannedStartDate} onChange={(e) => setPlannedStartDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Ouvriers affectés</label>
                <select
                  multiple
                  value={workerIds}
                  onChange={(e) => setWorkerIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                  style={{ minHeight: 70 }}
                >
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {info && <p className="muted">{info}</p>}
            {error && <p className="error-text">{error}</p>}
            <div className="flex-row mt-16">
              <button className="btn" disabled={createMutation.isPending}>
                Créer l'ordre
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
