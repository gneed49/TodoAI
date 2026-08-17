export type TodoStatus = "todo" | "doing" | "done";
export type Priority = "none" | "low" | "medium" | "high";
export type ViewMode = "list" | "kanban";

export interface Workspace {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Todo {
  id: string;
  workspace_id: string;
  title: string;
  notes: string;
  status: TodoStatus;
  priority: Priority;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface AppData {
  workspaces: Workspace[];
  todos: Todo[];
}

export interface CreateTodoInput {
  workspace_id: string;
  title: string;
  notes?: string;
  status?: TodoStatus;
  priority?: Priority;
  due_date?: string | null;
}

export interface UpdateTodoInput {
  id: string;
  title?: string;
  notes?: string;
  status?: TodoStatus;
  priority?: Priority;
  due_date?: string | null;
  workspace_id?: string;
  position?: number;
}
