import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Flag, GripVertical, MoreHorizontal, Plus } from "lucide-react";
import { useState, type CSSProperties } from "react";
import type { Todo, TodoStatus } from "../types";

const columns: { status: TodoStatus; label: string }[] = [
  { status: "todo", label: "À faire" },
  { status: "doing", label: "En cours" },
  { status: "done", label: "Terminé" },
];

const priorityLabels = { none: "", low: "Basse", medium: "Moyenne", high: "Haute" } as const;

function formatDate(date: string | null): string {
  if (!date) return "";
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === today) return "Aujourd’hui";
  if (date === tomorrow.toISOString().slice(0, 10)) return "Demain";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
}

function CardContent({ todo }: { todo: Todo }) {
  return (
    <>
      <div className="kanban-card__copy">
        <span className="kanban-card__title">{todo.title}</span>
        <MoreHorizontal aria-hidden="true" />
      </div>
      <div className="kanban-card__meta">
        {todo.priority !== "none" ? <span className={`priority priority--${todo.priority}`}><Flag fill="currentColor" />{priorityLabels[todo.priority]}</span> : <span />}
        {todo.due_date ? <span className={todo.due_date <= new Date().toISOString().slice(0, 10) && todo.status !== "done" ? "due-now" : ""}>{formatDate(todo.due_date)}</span> : null}
      </div>
    </>
  );
}

function DraggableCard({ todo, onOpen }: { todo: Todo; onOpen: (todo: Todo) => void }) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, isDragging } = useDraggable({
    id: todo.id,
    data: { status: todo.status },
  });
  const style: CSSProperties | undefined = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <article ref={setNodeRef} style={style} className={`kanban-card ${isDragging ? "is-dragging" : ""}`} onClick={() => onOpen(todo)}>
      <button
        ref={setActivatorNodeRef}
        className="drag-handle"
        type="button"
        aria-label={`Déplacer ${todo.title}`}
        onClick={(event) => event.stopPropagation()}
        {...listeners}
        {...attributes}
      >
        <GripVertical />
      </button>
      <CardContent todo={todo} />
    </article>
  );
}

function KanbanColumn({ status, label, todos, onOpen, onAdd }: { status: TodoStatus; label: string; todos: Todo[]; onOpen: (todo: Todo) => void; onAdd: (status: TodoStatus) => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} className={`kanban-column ${isOver ? "is-over" : ""}`} aria-label={`${label}, ${todos.length} tâches`}>
      <header><h2>{label}</h2><span>{todos.length}</span><button type="button" aria-label={`Ajouter dans ${label}`} onClick={() => onAdd(status)}><Plus /></button></header>
      <div className="kanban-stack">
        {todos.map((todo) => <DraggableCard key={todo.id} todo={todo} onOpen={onOpen} />)}
        {!todos.length ? <div className="kanban-empty">Déposez des tâches ici</div> : <div className="kanban-drop-tail" aria-hidden="true">Déposer ici</div>}
      </div>
    </section>
  );
}

interface KanbanBoardProps {
  todos: Todo[];
  onMove: (id: string, status: TodoStatus) => void;
  onOpen: (todo: Todo) => void;
  onAdd: (status: TodoStatus) => void;
}

export function KanbanBoard({ todos, onMove, onOpen, onAdd }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const activeTodo = activeId ? todos.find((todo) => todo.id === activeId) : undefined;

  const finishDrag = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const nextStatus = over?.id as TodoStatus | undefined;
    const todo = todos.find((item) => item.id === String(active.id));
    if (!todo || !nextStatus || !columns.some((column) => column.status === nextStatus) || todo.status === nextStatus) return;
    onMove(todo.id, nextStatus);
    const label = columns.find((column) => column.status === nextStatus)?.label ?? nextStatus;
    setAnnouncement(`${todo.title} déplacée vers ${label}`);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={({ active }) => setActiveId(String(active.id))} onDragCancel={() => setActiveId(null)} onDragEnd={finishDrag}>
      <div className="kanban-board">
        {columns.map((column) => <KanbanColumn key={column.status} {...column} todos={todos.filter((todo) => todo.status === column.status)} onOpen={onOpen} onAdd={onAdd} />)}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
        {activeTodo ? <article className="kanban-card kanban-card--overlay"><span className="drag-handle"><GripVertical /></span><CardContent todo={activeTodo} /></article> : null}
      </DragOverlay>
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </DndContext>
  );
}
