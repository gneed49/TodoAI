import type {
  AppData,
  CreateTodoInput,
  Todo,
  UpdateTodoInput,
  Workspace,
} from "../types";
import { legacyMigrationToken, supabase } from "./supabase";

const workspaceColumns = "id,name,color,created_at";
const todoColumns = "id,workspace_id,title,notes,status,priority,due_date,position,created_at,updated_at";

function fail(error: { message: string } | null): never {
  throw new Error(error?.message ?? "Une erreur Supabase est survenue.");
}

export const api = {
  async getAppData(): Promise<AppData> {
    const [workspaceResult, todoResult] = await Promise.all([
      supabase.from("workspaces").select(workspaceColumns).order("position").order("created_at"),
      supabase.from("todos").select(todoColumns).order("position").order("updated_at", { ascending: false }),
    ]);
    if (workspaceResult.error) fail(workspaceResult.error);
    if (todoResult.error) fail(todoResult.error);
    return {
      workspaces: (workspaceResult.data ?? []) as Workspace[],
      todos: (todoResult.data ?? []) as Todo[],
    };
  },

  async claimLegacyData(): Promise<boolean> {
    if (!legacyMigrationToken) return false;
    const marker = "todoai-legacy-import-v1";
    if (localStorage.getItem(marker)) return false;
    const { error } = await supabase.rpc("claim_todoai_legacy_import", {
      migration_token: legacyMigrationToken,
    });
    if (!error) localStorage.setItem(marker, "claimed");
    return !error;
  },

  async ensureDefaultWorkspaces(): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabase.from("workspaces").upsert([
      { id: "work", name: "Travail", color: "#6366f1", position: 0, created_at: now },
      { id: "personal", name: "Personnel", color: "#06b6d4", position: 1, created_at: now },
    ], { onConflict: "user_id,id", ignoreDuplicates: true });
    if (error) fail(error);
  },

  async createWorkspace(name: string, color: string): Promise<Workspace> {
    const { count } = await supabase.from("workspaces").select("id", { count: "exact", head: true });
    const { data, error } = await supabase.from("workspaces").insert({
      id: crypto.randomUUID(),
      name: name.trim(),
      color,
      position: count ?? 0,
    }).select(workspaceColumns).single();
    if (error) fail(error);
    return data as Workspace;
  },

  async createTodo(input: CreateTodoInput): Promise<Todo> {
    const { data: lastTodo } = await supabase.from("todos")
      .select("position")
      .eq("workspace_id", input.workspace_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await supabase.from("todos").insert({
      workspace_id: input.workspace_id,
      title: input.title.trim(),
      notes: input.notes ?? "",
      status: input.status ?? "todo",
      priority: input.priority ?? "none",
      due_date: input.due_date ?? null,
      position: (lastTodo?.position ?? 0) + 1,
    }).select(todoColumns).single();
    if (error) fail(error);
    return data as Todo;
  },

  async updateTodo(input: UpdateTodoInput): Promise<Todo> {
    const { id, ...changes } = input;
    const { data, error } = await supabase.from("todos")
      .update(changes)
      .eq("id", id)
      .select(todoColumns)
      .single();
    if (error) fail(error);
    return data as Todo;
  },

  async deleteTodo(id: string): Promise<void> {
    const { error } = await supabase.from("todos").delete().eq("id", id);
    if (error) fail(error);
  },
};
