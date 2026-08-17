import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Priority, Todo, TodoStatus, UpdateTodoInput, Workspace } from "../types";

interface TaskEditorProps {
  todo: Todo | null;
  workspaces: Workspace[];
  onClose: () => void;
  onSave: (input: UpdateTodoInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TaskEditor({ todo, workspaces, onClose, onSave, onDelete }: TaskEditorProps) {
  const [draft, setDraft] = useState<Todo | null>(todo);
  const [busy, setBusy] = useState(false);

  useEffect(() => setDraft(todo), [todo]);
  if (!todo || !draft) return null;

  const save = async () => {
    if (!draft.title.trim()) return;
    setBusy(true);
    try {
      await onSave({
        id: draft.id,
        title: draft.title.trim(),
        notes: draft.notes,
        status: draft.status,
        priority: draft.priority,
        due_date: draft.due_date,
        workspace_id: draft.workspace_id,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="task-editor" role="dialog" aria-modal="true" aria-label="Modifier la tâche" onMouseDown={(event) => event.stopPropagation()}>
        <header><h2>Modifier la tâche</h2><Button variant="ghost" size="icon" type="button" aria-label="Fermer" onClick={onClose}><X size={19} /></Button></header>
        <label className="editor-field editor-field--title">
          <span>Titre</span>
          <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </label>
        <label className="editor-field">
          <span>Notes</span>
          <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Ajouter des détails…" />
        </label>
        <div className="editor-grid">
          <label className="editor-field"><span>Statut</span><Select value={draft.status} onValueChange={(value) => setDraft({ ...draft, status: value as TodoStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todo">À faire</SelectItem><SelectItem value="doing">En cours</SelectItem><SelectItem value="done">Terminée</SelectItem></SelectContent></Select></label>
          <label className="editor-field"><span>Priorité</span><Select value={draft.priority} onValueChange={(value) => setDraft({ ...draft, priority: value as Priority })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Aucune</SelectItem><SelectItem value="low">Basse</SelectItem><SelectItem value="medium">Moyenne</SelectItem><SelectItem value="high">Haute</SelectItem></SelectContent></Select></label>
          <label className="editor-field"><span>Échéance</span><input type="date" value={draft.due_date ?? ""} onChange={(event) => setDraft({ ...draft, due_date: event.target.value || null })} /></label>
          <label className="editor-field"><span>Espace</span><Select value={draft.workspace_id} onValueChange={(value) => setDraft({ ...draft, workspace_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{workspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>)}</SelectContent></Select></label>
        </div>
        <footer>
          <Button className="danger-button" variant="ghost" type="button" onClick={() => void onDelete(todo.id)}><Trash2 size={16} />Supprimer</Button>
          <div><Button variant="outline" type="button" onClick={onClose}>Annuler</Button><Button type="button" disabled={busy} onClick={() => void save()}>Enregistrer</Button></div>
        </footer>
      </section>
    </div>
  );
}
