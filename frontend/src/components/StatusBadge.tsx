const COLORS: Record<string, string> = {
  DRAFT: "gray",
  CONFIRMED: "blue",
  IN_PREPARATION: "amber",
  SHIPPED: "blue",
  DELIVERED: "green",
  CLOSED: "gray",
  CANCELLED: "red",
  ISSUED: "blue",
  PARTIALLY_PAID: "amber",
  PAID: "green",
  OVERDUE: "red",
  PLANNED: "blue",
  IN_PROGRESS: "amber",
  DONE: "green",
};

const LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  CONFIRMED: "Confirmée",
  IN_PREPARATION: "En préparation",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CLOSED: "Clôturée",
  CANCELLED: "Annulée",
  ISSUED: "Émise",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Payée",
  OVERDUE: "En retard",
  PLANNED: "Planifié",
  IN_PROGRESS: "En cours",
  DONE: "Terminé",
};

export function StatusBadge({ status }: { status: string }) {
  const color = COLORS[status] ?? "gray";
  return <span className={`badge badge-${color}`}>{LABELS[status] ?? status}</span>;
}
