import { CalendarClock, Flag, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Priority, TodoStatus } from "../types";

interface FilterBarProps {
  status: TodoStatus | "all";
  priority: Priority | "all";
  due: "all" | "today" | "overdue" | "none";
  onStatusChange: (value: TodoStatus | "all") => void;
  onPriorityChange: (value: Priority | "all") => void;
  onDueChange: (value: "all" | "today" | "overdue" | "none") => void;
  onClear: () => void;
}

export function FilterBar(props: FilterBarProps) {
  return (
    <div className="filter-bar">
      <Select value={props.status} onValueChange={(value) => props.onStatusChange(value as TodoStatus | "all")}>
        <SelectTrigger className="filter-control filter-control--accent" aria-label="Filtrer par statut"><ListFilter /><SelectValue /></SelectTrigger>
        <SelectContent position="popper" align="start"><SelectGroup><SelectItem value="all">Tous les statuts</SelectItem><SelectItem value="todo">À faire</SelectItem><SelectItem value="doing">En cours</SelectItem><SelectItem value="done">Terminées</SelectItem></SelectGroup></SelectContent>
      </Select>
      <Select value={props.priority} onValueChange={(value) => props.onPriorityChange(value as Priority | "all")}>
        <SelectTrigger className="filter-control" aria-label="Filtrer par priorité"><Flag /><SelectValue /></SelectTrigger>
        <SelectContent position="popper" align="start"><SelectGroup><SelectItem value="all">Priorité</SelectItem><SelectItem value="high">Haute</SelectItem><SelectItem value="medium">Moyenne</SelectItem><SelectItem value="low">Basse</SelectItem><SelectItem value="none">Sans priorité</SelectItem></SelectGroup></SelectContent>
      </Select>
      <Select value={props.due} onValueChange={(value) => props.onDueChange(value as FilterBarProps["due"])}>
        <SelectTrigger className="filter-control" aria-label="Filtrer par échéance"><CalendarClock /><SelectValue /></SelectTrigger>
        <SelectContent position="popper" align="start"><SelectGroup><SelectItem value="all">Échéance</SelectItem><SelectItem value="today">Aujourd’hui</SelectItem><SelectItem value="overdue">En retard</SelectItem><SelectItem value="none">Sans date</SelectItem></SelectGroup></SelectContent>
      </Select>
      <Button className="clear-filters" variant="ghost" size="sm" type="button" onClick={props.onClear}>Effacer</Button>
    </div>
  );
}
