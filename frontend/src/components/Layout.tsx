import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { section: "Vue d'ensemble", links: [{ to: "/", label: "Tableau de bord" }] },
  {
    section: "Référentiels",
    links: [
      { to: "/referentiels/clients", label: "Clients" },
      { to: "/referentiels/fournisseurs", label: "Fournisseurs" },
      { to: "/referentiels/articles", label: "Articles" },
      { to: "/referentiels/entrepots", label: "Entrepôts" },
      { to: "/referentiels/unites", label: "Unités & devises" },
    ],
  },
  {
    section: "Ventes",
    links: [
      { to: "/commandes", label: "Commandes" },
      { to: "/factures", label: "Facturation" },
    ],
  },
  {
    section: "Stock",
    links: [
      { to: "/stock/niveaux", label: "Niveaux de stock" },
      { to: "/stock/mouvements", label: "Mouvements" },
      { to: "/stock/lots", label: "Lots & traçabilité" },
    ],
  },
  {
    section: "Production",
    links: [
      { to: "/production/nomenclatures", label: "Nomenclatures (BOM)" },
      { to: "/production/ordres", label: "Ordres de fabrication" },
      { to: "/production/planning", label: "Planning (Gantt)" },
      { to: "/production/postes", label: "Postes & ouvriers" },
    ],
  },
];

const ADMIN_NAV = {
  section: "Administration",
  links: [{ to: "/administration/utilisateurs", label: "Utilisateurs" }],
};

export function Layout() {
  const { user, logout } = useAuth();
  const nav = user?.role === "ADMIN" ? [...NAV, ADMIN_NAV] : NAV;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          Dattes Export ERP
          <small>mini-ERP interne</small>
        </div>
        {nav.map((group) => (
          <div key={group.section}>
            <div className="sidebar__section">{group.section}</div>
            {group.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        ))}
      </aside>
      <div className="main">
        <div className="topbar">
          <div />
          <div className="flex-row">
            <span className="muted">{user?.name}</span>
            <button className="btn btn-secondary btn-sm" onClick={logout}>
              Déconnexion
            </button>
          </div>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
