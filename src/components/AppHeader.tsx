import { Menu, Moon, Search, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ViewMode, Workspace } from "../types";

interface AppHeaderProps {
  title: string;
  workspace?: Workspace;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  searchOpen: boolean;
  search: string;
  onSearchOpen: () => void;
  onSearchChange: (value: string) => void;
  onMenuOpen: () => void;
  theme: "light" | "dark";
  onThemeChange: () => void;
}

export function AppHeader({
  title,
  workspace,
  view,
  onViewChange,
  searchOpen,
  search,
  onSearchOpen,
  onSearchChange,
  onMenuOpen,
  theme,
  onThemeChange,
}: AppHeaderProps) {
  return (
    <header className={`app-header ${searchOpen ? "is-searching" : ""}`}>
      <div className="title-wrap">
        <Button className="icon-button mobile-menu" variant="outline" size="icon-lg" type="button" aria-label="Ouvrir le menu" onClick={onMenuOpen}><Menu /></Button>
        <span className="title-dot" style={{ background: workspace?.color ?? "#216b3a" }} />
        <h1>{title}</h1>
      </div>
      <div className="header-tools">
        <div className="header-actions">
          {searchOpen ? (
            <label className="search-field">
              <Search size={17} />
              <input
                autoFocus
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Rechercher…"
                aria-label="Rechercher des tâches"
              />
              <button type="button" aria-label="Fermer la recherche" onClick={onSearchOpen}>
                <X size={15} />
              </button>
            </label>
          ) : (
            <Tooltip><TooltipTrigger asChild><Button className="icon-button" variant="outline" size="icon-lg" type="button" aria-label="Rechercher" onClick={onSearchOpen}><Search /></Button></TooltipTrigger><TooltipContent>Rechercher</TooltipContent></Tooltip>
          )}
          <Tooltip><TooltipTrigger asChild><Button className="icon-button" variant="outline" size="icon-lg" type="button" aria-label={theme === "dark" ? "Activer le thème clair" : "Activer le thème sombre"} onClick={onThemeChange}>{theme === "dark" ? <Sun /> : <Moon />}</Button></TooltipTrigger><TooltipContent>{theme === "dark" ? "Thème clair" : "Thème sombre"}</TooltipContent></Tooltip>
        </div>
        <ToggleGroup className="view-switch" type="single" variant="outline" spacing={0} value={view} onValueChange={(value) => value && onViewChange(value as ViewMode)} aria-label="Mode d’affichage">
          <ToggleGroupItem value="list" aria-label="Vue Liste">Liste</ToggleGroupItem>
          <ToggleGroupItem value="kanban" aria-label="Vue Kanban">Kanban</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </header>
  );
}
