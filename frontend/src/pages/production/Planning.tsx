import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../api/client";
import { ProductionOrder, Worker } from "../../api/types";
import { Modal } from "../../components/Modal";
import { formatDateTime } from "../../lib/format";

interface Conflict {
  type: "WORK_CENTER_OVERLAP" | "WORKER_OVERLAP" | "MATERIAL_SHORTAGE";
  orderIds: string[];
  message: string;
}

interface GanttData {
  orders: ProductionOrder[];
  conflicts: Conflict[];
}

function toDate(s?: string | null) {
  return s ? new Date(s) : null;
}

export function Planning() {
  const qc = useQueryClient();
  const [reschedule, setReschedule] = useState<ProductionOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newStart, setNewStart] = useState("");
  const [newWorkerCount, setNewWorkerCount] = useState(1);

  const { data } = useQuery<GanttData>({
    queryKey: ["gantt"],
    queryFn: async () => (await api.get("/planification/planning/gantt")).data,
  });
  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["workers"],
    queryFn: async () => (await api.get("/planification/ouvriers")).data,
  });

  const rescheduleMutation = useMutation({
    mutationFn: async () =>
      api.patch(`/planification/planning/ordres/${reschedule!.id}`, {
        plannedStartDate: newStart,
        workerCount: newWorkerCount,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gantt"] });
      qc.invalidateQueries({ queryKey: ["production-orders"] });
      setReschedule(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const { workCenterRows, rangeStart, rangeEnd, days } = useMemo(() => {
    const orders = data?.orders ?? [];
    const starts = orders.map((o) => toDate(o.plannedStartDate)).filter(Boolean) as Date[];
    const ends = orders.map((o) => toDate(o.plannedEndDate)).filter(Boolean) as Date[];
    const now = new Date();
    const minDate = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : now;
    const maxDate = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : new Date(now.getTime() + 7 * 86400000);

    const rangeStart = new Date(minDate);
    rangeStart.setDate(rangeStart.getDate() - 1);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(maxDate);
    rangeEnd.setDate(rangeEnd.getDate() + 1);
    rangeEnd.setHours(0, 0, 0, 0);

    const totalMs = rangeEnd.getTime() - rangeStart.getTime();
    const dayCount = Math.max(1, Math.round(totalMs / 86400000));
    const days = Array.from({ length: dayCount }, (_, i) => {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      return d;
    });

    const byWorkCenter = new Map<string, { name: string; orders: ProductionOrder[] }>();
    for (const o of orders) {
      const key = o.workCenterId ?? "none";
      const name = o.workCenter?.name ?? "Sans poste";
      if (!byWorkCenter.has(key)) byWorkCenter.set(key, { name, orders: [] });
      byWorkCenter.get(key)!.orders.push(o);
    }

    return { workCenterRows: Array.from(byWorkCenter.values()), rangeStart, rangeEnd, days };
  }, [data]);

  function positionStyle(order: ProductionOrder) {
    const start = toDate(order.plannedStartDate);
    const end = toDate(order.plannedEndDate);
    if (!start || !end) return { display: "none" };
    const total = rangeEnd.getTime() - rangeStart.getTime();
    const left = ((start.getTime() - rangeStart.getTime()) / total) * 100;
    const width = Math.max(1, ((end.getTime() - start.getTime()) / total) * 100);
    return { left: `${left}%`, width: `${width}%` };
  }

  function conflictsFor(orderId: string) {
    return (data?.conflicts ?? []).filter((c) => c.orderIds.includes(orderId));
  }

  function openReschedule(order: ProductionOrder) {
    setReschedule(order);
    setNewStart(order.plannedStartDate ? order.plannedStartDate.slice(0, 16) : "");
    setNewWorkerCount(order.workerCount ?? 1);
    setError(null);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Planning de production (Gantt)</h1>
      </div>

      {(data?.conflicts.length ?? 0) > 0 && (
        <div className="card" style={{ borderColor: "var(--color-danger)" }}>
          <strong style={{ color: "var(--color-danger)" }}>Conflits détectés</strong>
          <ul style={{ marginBottom: 0 }}>
            {data!.conflicts.map((c, i) => (
              <li key={i} style={{ fontSize: 13.5 }}>
                {c.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card" style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 900 }}>
          <div className="flex-row" style={{ marginLeft: 160 }}>
            {days.map((d, i) => (
              <div key={i} style={{ flex: 1, fontSize: 11, textAlign: "center", color: "#888" }}>
                {d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
              </div>
            ))}
          </div>

          {workCenterRows.map((row) => (
            <div key={row.name} className="flex-row" style={{ marginTop: 8 }}>
              <div style={{ width: 160, flexShrink: 0, fontSize: 13, fontWeight: 600 }}>{row.name}</div>
              <div style={{ position: "relative", flex: 1, height: 36 + row.orders.length * 30, background: "#f8f8f5", borderRadius: 4 }}>
                {row.orders.map((o, idx) => {
                  const conflicts = conflictsFor(o.id);
                  const hasConflict = conflicts.length > 0;
                  return (
                    <div
                      key={o.id}
                      onClick={() => openReschedule(o)}
                      title={conflicts.map((c) => c.message).join("\n") || `${o.number}`}
                      style={{
                        position: "absolute",
                        top: 6 + idx * 30,
                        height: 24,
                        borderRadius: 4,
                        background: hasConflict ? "var(--color-danger)" : "var(--color-primary)",
                        color: "white",
                        fontSize: 11.5,
                        padding: "3px 6px",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                        ...positionStyle(o),
                      }}
                    >
                      {o.number} — {o.bom.finishedArticle.name}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {workCenterRows.length === 0 && <p className="empty-state">Aucun ordre planifié pour le moment.</p>}
        </div>
      </div>

      {reschedule && (
        <Modal title={`Replanifier ${reschedule.number}`} onClose={() => setReschedule(null)}>
          <div className="form-grid">
            <div className="field">
              <label>Nouvelle date de début</label>
              <input type="datetime-local" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </div>
            <div className="field">
              <label>Effectif</label>
              <input type="number" min={1} value={newWorkerCount} onChange={(e) => setNewWorkerCount(Number(e.target.value))} />
            </div>
          </div>
          <p className="muted mt-16">
            Poste actuel: {reschedule.workCenter?.name} — {workers.length} ouvriers disponibles au total.
          </p>
          <p className="muted">
            Fin actuelle prévue: {formatDateTime(reschedule.plannedEndDate)} (recalculée automatiquement après replanification)
          </p>
          {error && <p className="error-text">{error}</p>}
          <div className="flex-row mt-16">
            <button className="btn" onClick={() => rescheduleMutation.mutate()} disabled={rescheduleMutation.isPending}>
              Replanifier
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
