use std::{fs, path::Path, sync::Mutex};

use anyhow::{anyhow, Context, Result};
use chrono::{Duration, Local, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::models::{
    validate_priority, validate_status, AppData, CreateTodoInput, CreateWorkspaceInput, Todo,
    UpdateTodoInput, Workspace,
};

pub struct Database {
    connection: Mutex<Connection>,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).context("impossible de créer le dossier de données")?;
        }
        let connection = Connection::open(path).context("impossible d’ouvrir la base Cairn")?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        connection.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS workspaces (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              color TEXT NOT NULL,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS todos (
              id TEXT PRIMARY KEY,
              workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
              title TEXT NOT NULL,
              notes TEXT NOT NULL DEFAULT '',
              status TEXT NOT NULL CHECK(status IN ('todo','doing','done')),
              priority TEXT NOT NULL CHECK(priority IN ('none','low','medium','high')),
              due_date TEXT,
              position INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_todos_workspace ON todos(workspace_id, position);
            CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
            ",
        )?;
        let database = Self {
            connection: Mutex::new(connection),
        };
        database.seed_if_empty()?;
        Ok(database)
    }

    fn seed_if_empty(&self) -> Result<()> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| anyhow!("base verrouillée"))?;
        let count: i64 =
            connection.query_row("SELECT COUNT(*) FROM workspaces", [], |row| row.get(0))?;
        if count > 0 {
            return Ok(());
        }
        let now = Utc::now().to_rfc3339();
        let today = Local::now().date_naive().format("%Y-%m-%d").to_string();
        let tomorrow = (Local::now().date_naive() + Duration::days(1))
            .format("%Y-%m-%d")
            .to_string();
        connection.execute(
            "INSERT INTO workspaces VALUES (?1, ?2, ?3, ?4)",
            params!["work", "Travail", "#216b3a", now],
        )?;
        connection.execute(
            "INSERT INTO workspaces VALUES (?1, ?2, ?3, ?4)",
            params!["personal", "Personnel", "#3196b5", now],
        )?;
        let samples = [
            (
                "Finaliser la proposition client",
                "Relire le budget et envoyer la version finale.",
                "todo",
                "high",
                Some(today.as_str()),
            ),
            (
                "Préparer le point d’équipe",
                "Rassembler les sujets bloquants.",
                "doing",
                "medium",
                Some(tomorrow.as_str()),
            ),
            ("Réserver le train pour Lyon", "", "todo", "medium", None),
            ("Relire le contrat fournisseur", "", "todo", "low", None),
            ("Mettre à jour la roadmap produit", "", "done", "low", None),
            ("Envoyer les notes de frais", "", "todo", "low", None),
            ("Planifier la revue de code", "", "todo", "medium", None),
            ("Organiser les retours de test", "", "todo", "none", None),
            ("Envoyer l’invitation au webinaire", "", "done", "low", None),
            ("Corriger le bug d’export CSV", "", "done", "medium", None),
        ];
        for (index, sample) in samples.iter().enumerate() {
            connection.execute(
                "INSERT INTO todos (id, workspace_id, title, notes, status, priority, due_date, position, created_at, updated_at) VALUES (?1, 'work', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
                params![Uuid::new_v4().to_string(), sample.0, sample.1, sample.2, sample.3, sample.4, index as i64 + 1, now],
            )?;
        }
        connection.execute(
            "INSERT INTO todos (id, workspace_id, title, status, priority, position, created_at, updated_at) VALUES (?1, 'personal', ?2, 'todo', 'none', 1, ?3, ?3)",
            params![Uuid::new_v4().to_string(), "Acheter des plantes pour le balcon", now],
        )?;
        Ok(())
    }

    pub fn app_data(&self) -> Result<AppData> {
        Ok(AppData {
            workspaces: self.list_workspaces()?,
            todos: self.list_todos()?,
        })
    }

    pub fn list_workspaces(&self) -> Result<Vec<Workspace>> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| anyhow!("base verrouillée"))?;
        let mut statement = connection
            .prepare("SELECT id, name, color, created_at FROM workspaces ORDER BY created_at")?;
        let workspaces = statement
            .query_map([], |row| {
                Ok(Workspace {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                    created_at: row.get(3)?,
                })
            })?
            .collect::<rusqlite::Result<_>>()?;
        Ok(workspaces)
    }

    pub fn create_workspace(&self, input: CreateWorkspaceInput) -> Result<Workspace> {
        let name = input.name.trim();
        if name.is_empty() || name.chars().count() > 80 {
            return Err(anyhow!(
                "le nom de l’espace doit contenir entre 1 et 80 caractères"
            ));
        }
        let workspace = Workspace {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            color: input.color,
            created_at: Utc::now().to_rfc3339(),
        };
        let connection = self
            .connection
            .lock()
            .map_err(|_| anyhow!("base verrouillée"))?;
        connection.execute(
            "INSERT INTO workspaces VALUES (?1, ?2, ?3, ?4)",
            params![
                workspace.id,
                workspace.name,
                workspace.color,
                workspace.created_at
            ],
        )?;
        Ok(workspace)
    }

    pub fn list_todos(&self) -> Result<Vec<Todo>> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| anyhow!("base verrouillée"))?;
        let mut statement = connection.prepare("SELECT id, workspace_id, title, notes, status, priority, due_date, position, created_at, updated_at FROM todos ORDER BY position, updated_at DESC")?;
        let todos = statement
            .query_map([], todo_from_row)?
            .collect::<rusqlite::Result<_>>()?;
        Ok(todos)
    }

    pub fn get_todo(&self, id: &str) -> Result<Todo> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| anyhow!("base verrouillée"))?;
        connection.query_row(
            "SELECT id, workspace_id, title, notes, status, priority, due_date, position, created_at, updated_at FROM todos WHERE id = ?1",
            [id], todo_from_row,
        ).optional()?.ok_or_else(|| anyhow!("tâche introuvable"))
    }

    pub fn create_todo(&self, input: CreateTodoInput) -> Result<Todo> {
        let title = input.title.trim();
        if title.is_empty() || title.chars().count() > 240 {
            return Err(anyhow!("le titre doit contenir entre 1 et 240 caractères"));
        }
        let status = input.status.unwrap_or_else(|| "todo".into());
        let priority = input.priority.unwrap_or_else(|| "none".into());
        if !validate_status(&status) || !validate_priority(&priority) {
            return Err(anyhow!("statut ou priorité invalide"));
        }
        let connection = self
            .connection
            .lock()
            .map_err(|_| anyhow!("base verrouillée"))?;
        let workspace_exists: bool = connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id = ?1)",
            [&input.workspace_id],
            |row| row.get(0),
        )?;
        if !workspace_exists {
            return Err(anyhow!("espace introuvable"));
        }
        let position: i64 = connection.query_row(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM todos WHERE workspace_id = ?1",
            [&input.workspace_id],
            |row| row.get(0),
        )?;
        let now = Utc::now().to_rfc3339();
        let todo = Todo {
            id: Uuid::new_v4().to_string(),
            workspace_id: input.workspace_id,
            title: title.into(),
            notes: input.notes.unwrap_or_default(),
            status,
            priority,
            due_date: input.due_date,
            position,
            created_at: now.clone(),
            updated_at: now,
        };
        connection.execute(
            "INSERT INTO todos (id, workspace_id, title, notes, status, priority, due_date, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![todo.id, todo.workspace_id, todo.title, todo.notes, todo.status, todo.priority, todo.due_date, todo.position, todo.created_at, todo.updated_at],
        )?;
        Ok(todo)
    }

    pub fn update_todo(&self, input: UpdateTodoInput) -> Result<Todo> {
        let mut todo = self.get_todo(&input.id)?;
        if let Some(title) = input.title {
            let title = title.trim();
            if title.is_empty() || title.chars().count() > 240 {
                return Err(anyhow!("titre invalide"));
            }
            todo.title = title.into();
        }
        if let Some(notes) = input.notes {
            todo.notes = notes;
        }
        if let Some(status) = input.status {
            if !validate_status(&status) {
                return Err(anyhow!("statut invalide"));
            }
            todo.status = status;
        }
        if let Some(priority) = input.priority {
            if !validate_priority(&priority) {
                return Err(anyhow!("priorité invalide"));
            }
            todo.priority = priority;
        }
        if let Some(due_date) = input.due_date {
            todo.due_date = due_date;
        }
        if let Some(workspace_id) = input.workspace_id {
            todo.workspace_id = workspace_id;
        }
        if let Some(position) = input.position {
            todo.position = position.max(0);
        }
        todo.updated_at = Utc::now().to_rfc3339();
        let connection = self
            .connection
            .lock()
            .map_err(|_| anyhow!("base verrouillée"))?;
        connection.execute(
            "UPDATE todos SET workspace_id=?2, title=?3, notes=?4, status=?5, priority=?6, due_date=?7, position=?8, updated_at=?9 WHERE id=?1",
            params![todo.id, todo.workspace_id, todo.title, todo.notes, todo.status, todo.priority, todo.due_date, todo.position, todo.updated_at],
        )?;
        Ok(todo)
    }

    pub fn delete_todo(&self, id: &str) -> Result<()> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| anyhow!("base verrouillée"))?;
        if connection.execute("DELETE FROM todos WHERE id = ?1", [id])? == 0 {
            return Err(anyhow!("tâche introuvable"));
        }
        Ok(())
    }
}

fn todo_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Todo> {
    Ok(Todo {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        title: row.get(2)?,
        notes: row.get(3)?,
        status: row.get(4)?,
        priority: row.get(5)?,
        due_date: row.get(6)?,
        position: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}
