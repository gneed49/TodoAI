use serde::{Deserialize, Deserializer, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub color: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub notes: String,
    pub status: String,
    pub priority: String,
    pub due_date: Option<String>,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppData {
    pub workspaces: Vec<Workspace>,
    pub todos: Vec<Todo>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkspaceInput {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTodoInput {
    pub workspace_id: String,
    pub title: String,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub due_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTodoInput {
    pub id: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default, deserialize_with = "double_option")]
    pub due_date: Option<Option<String>>,
    #[serde(default)]
    pub workspace_id: Option<String>,
    #[serde(default)]
    pub position: Option<i64>,
}

fn double_option<'de, D>(deserializer: D) -> Result<Option<Option<String>>, D::Error>
where
    D: Deserializer<'de>,
{
    Option::<String>::deserialize(deserializer).map(Some)
}

pub fn validate_status(value: &str) -> bool {
    matches!(value, "todo" | "doing" | "done")
}

pub fn validate_priority(value: &str) -> bool {
    matches!(value, "none" | "low" | "medium" | "high")
}
