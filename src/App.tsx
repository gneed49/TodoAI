import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AppHeader } from "./components/AppHeader";
import { AuthScreen } from "./components/AuthScreen";
import { FilterBar } from "./components/FilterBar";
import { KanbanBoard } from "./components/KanbanBoard";
import { ListView } from "./components/ListView";
import { QuickAdd } from "./components/QuickAdd";
import { Sidebar } from "./components/Sidebar";
import { TaskEditor } from "./components/TaskEditor";
import { WorkspaceDialog } from "./components/WorkspaceDialog";
import { api } from "./lib/api";
import { supabase } from "./lib/supabase";
import type { AppData, Priority, Todo, TodoStatus, UpdateTodoInput, ViewMode } from "./types";

const emptyData: AppData = { workspaces: [], todos: [] };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<AppData>(emptyData);
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem("cairn-view") as ViewMode) || "list");
  const [status, setStatus] = useState<TodoStatus | "all">("all");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [due, setDue] = useState<"all" | "today" | "overdue" | "none">("all");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [workspaceDialog, setWorkspaceDialog] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("todoai-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: authData }) => {
      setSession(authData.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setData(emptyData);
      setSelectedId("");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        let next = await api.getAppData();
        if (next.workspaces.length === 0) {
          await api.ensureDefaultWorkspaces();
          next = await api.getAppData();
        }
        if (cancelled) return;
        setData(next);
        setSelectedId((current) => {
          if (["all", "today"].includes(current)) return current;
          return next.workspaces.some((item) => item.id === current)
            ? current
            : next.workspaces[0]?.id ?? "all";
        });
      } catch (reason) {
        if (!cancelled) setError(String(reason));
      } finally {
        if (!cancelled && showLoading) setLoading(false);
      }
    };

    void load(true);
    const refresh = () => void load(false);
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 15_000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
    };
  }, [session?.user.id]);

  useEffect(() => localStorage.setItem("cairn-view", view), [view]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("todoai-theme", theme);
  }, [theme]);

  const workspace = data.workspaces.find((item) => item.id === selectedId);
  const title = selectedId === "today" ? "Aujourd’hui" : selectedId === "all" ? "Toutes les tâches" : workspace?.name ?? "TodoAI";

  const visibleTodos = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const query = search.trim().toLocaleLowerCase("fr");
    return data.todos
      .filter((todo) => {
        if (selectedId === "today" && todo.due_date !== today) return false;
        if (selectedId !== "all" && selectedId !== "today" && todo.workspace_id !== selectedId) return false;
        if (status !== "all" && todo.status !== status) return false;
        if (priority !== "all" && todo.priority !== priority) return false;
        if (due === "today" && todo.due_date !== today) return false;
        if (due === "overdue" && (!todo.due_date || todo.due_date >= today || todo.status === "done")) return false;
        if (due === "none" && todo.due_date) return false;
        if (query && !`${todo.title} ${todo.notes}`.toLocaleLowerCase("fr").includes(query)) return false;
        return true;
      })
      .sort((a, b) => a.position - b.position || b.updated_at.localeCompare(a.updated_at));
  }, [data.todos, selectedId, status, priority, due, search]);

  const updateLocalTodo = (updated: Todo) => {
    setData((current) => ({ ...current, todos: current.todos.map((item) => item.id === updated.id ? updated : item) }));
    setEditing((current) => current?.id === updated.id ? updated : current);
  };

  const createTodo = async (title: string, forcedStatus: TodoStatus = "todo") => {
    const workspaceId = workspace?.id ?? data.workspaces[0]?.id;
    if (!workspaceId) return;
    try {
      const created = await api.createTodo({ workspace_id: workspaceId, title, status: forcedStatus });
      setData((current) => ({ ...current, todos: [...current.todos, created] }));
    } catch (reason) {
      setError(String(reason));
    }
  };

  const updateTodo = async (input: UpdateTodoInput) => {
    const previous = data.todos.find((todo) => todo.id === input.id);
    if (previous) {
      setData((current) => ({
        ...current,
        todos: current.todos.map((todo) => todo.id === input.id ? { ...todo, ...input } : todo),
      }));
    }
    try {
      updateLocalTodo(await api.updateTodo(input));
    } catch (reason) {
      if (previous) updateLocalTodo(previous);
      setError(String(reason));
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      await api.deleteTodo(id);
      setData((current) => ({ ...current, todos: current.todos.filter((item) => item.id !== id) }));
      setEditing(null);
    } catch (reason) {
      setError(String(reason));
    }
  };

  if (!authReady || (session && loading)) {
    return <div className="loading-screen"><div className="loading-cairn"><i /><i /><i /></div><span>Ouverture de TodoAI…</span></div>;
  }

  if (!session) return <AuthScreen />;

  return (
    <div className="app-shell">
      <Sidebar
        workspaces={data.workspaces}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAddWorkspace={() => setWorkspaceDialog(true)}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        email={session.user.email ?? "Compte TodoAI"}
        onSignOut={() => void supabase.auth.signOut()}
      />
      <main className="main-content">
        <AppHeader
          title={title}
          workspace={workspace}
          view={view}
          onViewChange={setView}
          searchOpen={searchOpen}
          search={search}
          onSearchOpen={() => { setSearchOpen((current) => !current); if (searchOpen) setSearch(""); }}
          onSearchChange={setSearch}
          onMenuOpen={() => setSidebarOpen(true)}
          theme={theme}
          onThemeChange={() => setTheme((current) => current === "dark" ? "light" : "dark")}
        />
        <QuickAdd onAdd={createTodo} />
        <FilterBar
          status={status}
          priority={priority}
          due={due}
          onStatusChange={setStatus}
          onPriorityChange={setPriority}
          onDueChange={setDue}
          onClear={() => { setStatus("all"); setPriority("all"); setDue("all"); setSearch(""); }}
        />
        <div className={`content-view content-view--${view}`}>
          {view === "list" ? (
            <ListView
              todos={visibleTodos}
              onToggle={(todo) => void updateTodo({ id: todo.id, status: todo.status === "done" ? "todo" : "done" })}
              onOpen={setEditing}
            />
          ) : (
            <KanbanBoard
              todos={visibleTodos}
              onMove={(id, nextStatus) => void updateTodo({ id, status: nextStatus })}
              onOpen={setEditing}
              onAdd={(nextStatus) => {
                const title = window.prompt("Titre de la tâche");
                if (title) void createTodo(title, nextStatus);
              }}
            />
          )}
        </div>
        <div className="autosave-status"><i />Synchronisé avec Supabase</div>
      </main>

      <TaskEditor todo={editing} workspaces={data.workspaces} onClose={() => setEditing(null)} onSave={updateTodo} onDelete={deleteTodo} />
      <WorkspaceDialog
        open={workspaceDialog}
        onClose={() => setWorkspaceDialog(false)}
        onCreate={async (name, color) => {
          try {
            const created = await api.createWorkspace(name, color);
            setData((current) => ({ ...current, workspaces: [...current.workspaces, created] }));
            setSelectedId(created.id);
          } catch (reason) {
            setError(String(reason));
          }
        }}
      />
      {error ? <div className="error-toast" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")}>Fermer</button></div> : null}
    </div>
  );
}
