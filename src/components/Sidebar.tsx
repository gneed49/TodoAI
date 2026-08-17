import { Bot, CalendarDays, CirclePlus, Cloud, ListTodo, LogOut } from "lucide-react";
import type { Workspace } from "../types";
import { BrandMark } from "./BrandMark";

interface SidebarProps {
  workspaces: Workspace[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAddWorkspace: () => void;
  mobileOpen: boolean;
  onClose: () => void;
  email: string;
  onSignOut: () => void;
}

export function Sidebar({
  workspaces,
  selectedId,
  onSelect,
  onAddWorkspace,
  mobileOpen,
  onClose,
  email,
  onSignOut,
}: SidebarProps) {
  const select = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <>
      <div className={`sidebar-scrim ${mobileOpen ? "is-visible" : ""}`} onClick={onClose} />
      <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`}>
        <BrandMark />
        <nav className="sidebar-nav" aria-label="Navigation principale">
          <button className="nav-row" type="button" onClick={() => select("today")}>
            <CalendarDays size={19} strokeWidth={1.8} />
            <span>Aujourd’hui</span>
          </button>
          <button className="nav-row" type="button" onClick={() => select("all")}>
            <ListTodo size={19} strokeWidth={1.8} />
            <span>Toutes les tâches</span>
          </button>
        </nav>

        <div className="sidebar-section">
          <p className="sidebar-label">Espaces</p>
          <div className="workspace-list">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                className={`workspace-row ${workspace.id === selectedId ? "is-active" : ""}`}
                type="button"
                onClick={() => select(workspace.id)}
              >
                <span className="workspace-dot" style={{ background: workspace.color }} />
                <span>{workspace.name}</span>
              </button>
            ))}
            <button className="workspace-row workspace-row--add" type="button" onClick={onAddWorkspace}>
              <CirclePlus size={18} strokeWidth={1.8} />
              <span>Ajouter un espace</span>
            </button>
          </div>
        </div>

        <div className="sidebar-status" aria-label="État de TodoAI">
          <div><Cloud size={17} /><span>Cloud synchronisé</span><i /></div>
          <div><Bot size={17} /><span>MCP distant</span><i /></div>
          <button className="account-row" type="button" onClick={onSignOut} title={email}>
            <LogOut size={17} />
            <span>{email}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
