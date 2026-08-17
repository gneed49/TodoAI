import { ChevronDown } from "lucide-react";
import type { Todo } from "../types";
import { TodoRow } from "./TodoRow";

interface ListViewProps {
  todos: Todo[];
  onToggle: (todo: Todo) => void;
  onOpen: (todo: Todo) => void;
}

export function ListView({ todos, onToggle, onOpen }: ListViewProps) {
  const active = todos.filter((todo) => todo.status !== "done");
  const done = todos.filter((todo) => todo.status === "done");

  if (!todos.length) {
    return (
      <div className="empty-state">
        <div className="empty-check">✓</div>
        <h2>Tout est calme ici</h2>
        <p>Ajoutez une tâche ci-dessus pour commencer.</p>
      </div>
    );
  }

  return (
    <div className="list-view">
      <section className="task-section">
        <header><h2>À faire</h2><span>{active.length}</span><div /><span>Priorité</span><span>Échéance</span><i /></header>
        <div className="task-table">
          {active.map((todo) => <TodoRow key={todo.id} todo={todo} onToggle={onToggle} onOpen={onOpen} />)}
        </div>
      </section>
      {done.length ? (
        <section className="task-section task-section--done">
          <header><h2>Terminées</h2><span>{done.length}</span><div /><span /><span /><ChevronDown size={15} /></header>
          <div className="task-table">
            {done.map((todo) => <TodoRow key={todo.id} todo={todo} onToggle={onToggle} onOpen={onOpen} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
