import { Calendar, Flag, MoreHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Todo } from "../types";

const priorityLabels = { none: "", low: "Basse", medium: "Moyenne", high: "Haute" } as const;

function formatDate(date: string | null): string {
  if (!date) return "";
  const today = new Date().toISOString().slice(0, 10);
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  if (date === today) return "Aujourd’hui";
  if (date === tomorrowDate.toISOString().slice(0, 10)) return "Demain";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
}

interface TodoRowProps {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  onOpen: (todo: Todo) => void;
}

export function TodoRow({ todo, onToggle, onOpen }: TodoRowProps) {
  return (
    <div className={`todo-row ${todo.status === "done" ? "is-done" : ""}`}>
      <Checkbox
        className="todo-checkbox"
        aria-label={todo.status === "done" ? `Rouvrir ${todo.title}` : `Terminer ${todo.title}`}
        checked={todo.status === "done"}
        onCheckedChange={() => onToggle(todo)}
      />
      <button className="todo-title" type="button" onClick={() => onOpen(todo)}>{todo.title}</button>
      <span className={`priority priority--${todo.priority}`}>
        {todo.priority !== "none" ? <><Flag size={13} fill="currentColor" />{priorityLabels[todo.priority]}</> : null}
      </span>
      <span className={`todo-due ${todo.due_date && todo.due_date <= new Date().toISOString().slice(0, 10) && todo.status !== "done" ? "due-now" : ""}`}>
        {todo.due_date ? <><Calendar size={14} />{formatDate(todo.due_date)}</> : null}
      </span>
      <button className="row-menu" type="button" aria-label={`Modifier ${todo.title}`} onClick={() => onOpen(todo)}>
        <MoreHorizontal size={18} />
      </button>
    </div>
  );
}
