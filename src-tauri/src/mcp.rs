use std::{net::SocketAddr, sync::Arc};

use anyhow::{Context, Result};
use axum::{
    extract::State,
    http::{Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

use crate::{
    db::Database,
    models::{CreateTodoInput, CreateWorkspaceInput, UpdateTodoInput},
};

#[derive(Clone)]
struct McpState {
    db: Arc<Database>,
}

pub async fn serve(db: Arc<Database>, address: SocketAddr) -> Result<()> {
    let app = Router::new()
        .route(
            "/health",
            get(|| async { Json(json!({ "status": "ok", "service": "todoai-mcp" })) }),
        )
        .route("/mcp", post(handle_mcp).get(mcp_get))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(McpState { db });
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .context("impossible de démarrer le port MCP")?;
    tracing::info!(%address, "serveur MCP TodoAI prêt");
    axum::serve(listener, app)
        .await
        .context("le serveur MCP s’est arrêté")?;
    Ok(())
}

async fn mcp_get() -> impl IntoResponse {
    (
        StatusCode::METHOD_NOT_ALLOWED,
        [("allow", "POST")],
        "TodoAI utilise le transport MCP Streamable HTTP sans flux SSE. Envoyez les requêtes JSON-RPC avec POST.",
    )
}

async fn handle_mcp(State(state): State<McpState>, Json(request): Json<Value>) -> Response {
    let id = request.get("id").cloned().unwrap_or(Value::Null);
    let method = request
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let params = request.get("params").cloned().unwrap_or_else(|| json!({}));

    if request.get("id").is_none() {
        return StatusCode::ACCEPTED.into_response();
    }

    let result = match method {
        "initialize" => Ok(json!({
            "protocolVersion": "2025-03-26",
            "capabilities": { "tools": { "listChanged": false } },
            "serverInfo": { "name": "todoai", "version": env!("CARGO_PKG_VERSION") },
            "instructions": "TodoAI gère des tâches locales regroupées par espaces. Listez les espaces avant de créer une tâche si l’identifiant n’est pas connu. Relisez une tâche avant une modification ambiguë. Les suppressions sont définitives."
        })),
        "ping" => Ok(json!({})),
        "tools/list" => Ok(json!({ "tools": tool_descriptors() })),
        "tools/call" => call_tool(&state.db, params),
        _ => return rpc_error(id, -32601, "Méthode MCP inconnue"),
    };

    match result {
        Ok(value) => Json(json!({ "jsonrpc": "2.0", "id": id, "result": value })).into_response(),
        Err(message) => rpc_error(id, -32602, &message),
    }
}

fn rpc_error(id: Value, code: i64, message: &str) -> Response {
    Json(json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } }))
        .into_response()
}

fn tool_descriptors() -> Vec<Value> {
    vec![
        json!({
            "name": "list_workspaces",
            "title": "Lister les espaces TodoAI",
            "description": "Use this when the user wants to see the available TodoAI workspaces or when a workspace ID is needed for another operation.",
            "inputSchema": { "type": "object", "properties": {}, "additionalProperties": false },
            "outputSchema": { "type": "object", "properties": { "workspaces": { "type": "array", "items": workspace_schema() } }, "required": ["workspaces"] },
            "annotations": { "readOnlyHint": true, "destructiveHint": false, "openWorldHint": false }
        }),
        json!({
            "name": "create_workspace",
            "title": "Créer un espace TodoAI",
            "description": "Use this when the user wants to create a new local workspace for grouping tasks in TodoAI.",
            "inputSchema": {
                "type": "object",
                "properties": { "name": { "type": "string", "minLength": 1, "maxLength": 80 }, "color": { "type": "string", "pattern": "^#[0-9A-Fa-f]{6}$", "default": "#216b3a" } },
                "required": ["name"], "additionalProperties": false
            },
            "outputSchema": { "type": "object", "properties": { "workspace": workspace_schema() }, "required": ["workspace"] },
            "annotations": { "readOnlyHint": false, "destructiveHint": false, "openWorldHint": false, "idempotentHint": false }
        }),
        json!({
            "name": "list_todos",
            "title": "Lister les tâches TodoAI",
            "description": "Use this when the user wants to find, review, summarize, or count tasks stored in TodoAI. Filters are optional and can be combined.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "workspace_id": { "type": "string", "description": "Stable workspace ID returned by list_workspaces." },
                    "status": { "type": "string", "enum": ["todo", "doing", "done"] },
                    "query": { "type": "string", "maxLength": 200 },
                    "include_completed": { "type": "boolean", "default": true }
                },
                "additionalProperties": false
            },
            "outputSchema": { "type": "object", "properties": { "todos": { "type": "array", "items": todo_schema() } }, "required": ["todos"] },
            "annotations": { "readOnlyHint": true, "destructiveHint": false, "openWorldHint": false }
        }),
        json!({
            "name": "get_todo",
            "title": "Lire une tâche TodoAI",
            "description": "Use this when the user wants the full current details of one TodoAI task or before an update that depends on its current values.",
            "inputSchema": { "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"], "additionalProperties": false },
            "outputSchema": { "type": "object", "properties": { "todo": todo_schema() }, "required": ["todo"] },
            "annotations": { "readOnlyHint": true, "destructiveHint": false, "openWorldHint": false }
        }),
        json!({
            "name": "create_todo",
            "title": "Créer une tâche TodoAI",
            "description": "Use this when the user wants to add one actionable task to a known TodoAI workspace.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "workspace_id": { "type": "string" }, "title": { "type": "string", "minLength": 1, "maxLength": 240 },
                    "notes": { "type": "string", "maxLength": 10000 }, "status": { "type": "string", "enum": ["todo", "doing", "done"], "default": "todo" },
                    "priority": { "type": "string", "enum": ["none", "low", "medium", "high"], "default": "none" },
                    "due_date": { "type": ["string", "null"], "format": "date" }
                },
                "required": ["workspace_id", "title"], "additionalProperties": false
            },
            "outputSchema": { "type": "object", "properties": { "todo": todo_schema() }, "required": ["todo"] },
            "annotations": { "readOnlyHint": false, "destructiveHint": false, "openWorldHint": false, "idempotentHint": false }
        }),
        json!({
            "name": "update_todo",
            "title": "Mettre à jour une tâche TodoAI",
            "description": "Use this when the user wants to edit, complete, reopen, move, prioritize, or reschedule an existing TodoAI task. Send only fields that should change.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": { "type": "string" }, "workspace_id": { "type": "string" }, "title": { "type": "string", "minLength": 1, "maxLength": 240 },
                    "notes": { "type": "string", "maxLength": 10000 }, "status": { "type": "string", "enum": ["todo", "doing", "done"] },
                    "priority": { "type": "string", "enum": ["none", "low", "medium", "high"] },
                    "due_date": { "type": ["string", "null"], "format": "date" }, "position": { "type": "integer", "minimum": 0 }
                },
                "required": ["id"], "additionalProperties": false
            },
            "outputSchema": { "type": "object", "properties": { "todo": todo_schema() }, "required": ["todo"] },
            "annotations": { "readOnlyHint": false, "destructiveHint": false, "openWorldHint": false, "idempotentHint": true }
        }),
        json!({
            "name": "delete_todo",
            "title": "Supprimer une tâche TodoAI",
            "description": "Use this only when the user explicitly wants to permanently delete one existing TodoAI task.",
            "inputSchema": { "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"], "additionalProperties": false },
            "outputSchema": { "type": "object", "properties": { "deleted": { "type": "boolean" }, "id": { "type": "string" } }, "required": ["deleted", "id"] },
            "annotations": { "readOnlyHint": false, "destructiveHint": true, "openWorldHint": false, "idempotentHint": true }
        }),
    ]
}

fn workspace_schema() -> Value {
    json!({ "type": "object", "properties": { "id": {"type":"string"}, "name":{"type":"string"}, "color":{"type":"string"}, "created_at":{"type":"string"} }, "required": ["id","name","color","created_at"] })
}

fn todo_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "id":{"type":"string"}, "workspace_id":{"type":"string"}, "title":{"type":"string"}, "notes":{"type":"string"},
            "status":{"type":"string","enum":["todo","doing","done"]}, "priority":{"type":"string","enum":["none","low","medium","high"]},
            "due_date":{"type":["string","null"]}, "position":{"type":"integer"}, "created_at":{"type":"string"}, "updated_at":{"type":"string"}
        },
        "required": ["id","workspace_id","title","notes","status","priority","due_date","position","created_at","updated_at"]
    })
}

#[derive(Deserialize)]
struct ToolCall {
    name: String,
    #[serde(default)]
    arguments: Value,
}

#[derive(Deserialize)]
struct ListTodosArgs {
    workspace_id: Option<String>,
    status: Option<String>,
    query: Option<String>,
    #[serde(default = "default_true")]
    include_completed: bool,
}

fn default_true() -> bool {
    true
}

fn call_tool(db: &Database, params: Value) -> std::result::Result<Value, String> {
    let call: ToolCall = serde_json::from_value(params)
        .map_err(|error| format!("appel d’outil invalide: {error}"))?;
    let outcome = match call.name.as_str() {
        "list_workspaces" => db.list_workspaces().map(|workspaces| {
            let count = workspaces.len();
            tool_result(
                json!({ "workspaces": workspaces }),
                format!("{count} espace(s) TodoAI trouvé(s)."),
            )
        }),
        "create_workspace" => {
            #[derive(Deserialize)]
            struct Args {
                name: String,
                #[serde(default = "default_color")]
                color: String,
            }
            fn default_color() -> String {
                "#216b3a".into()
            }
            serde_json::from_value::<Args>(call.arguments)
                .map_err(anyhow::Error::from)
                .and_then(|args| {
                    db.create_workspace(CreateWorkspaceInput {
                        name: args.name,
                        color: args.color,
                    })
                })
                .map(|workspace| {
                    let text = format!("L’espace « {} » a été créé.", workspace.name);
                    tool_result(json!({ "workspace": workspace }), text)
                })
        }
        "list_todos" => serde_json::from_value::<ListTodosArgs>(call.arguments)
            .map_err(anyhow::Error::from)
            .and_then(|args| {
                let query = args.query.unwrap_or_default().to_lowercase();
                db.list_todos().map(|todos| {
                    todos
                        .into_iter()
                        .filter(|todo| {
                            args.workspace_id
                                .as_ref()
                                .map(|id| &todo.workspace_id == id)
                                .unwrap_or(true)
                                && args
                                    .status
                                    .as_ref()
                                    .map(|status| &todo.status == status)
                                    .unwrap_or(true)
                                && (args.include_completed || todo.status != "done")
                                && (query.is_empty()
                                    || todo.title.to_lowercase().contains(&query)
                                    || todo.notes.to_lowercase().contains(&query))
                        })
                        .collect::<Vec<_>>()
                })
            })
            .map(|todos| {
                let count = todos.len();
                tool_result(
                    json!({ "todos": todos }),
                    format!("{count} tâche(s) TodoAI trouvée(s)."),
                )
            }),
        "get_todo" => {
            #[derive(Deserialize)]
            struct Args {
                id: String,
            }
            serde_json::from_value::<Args>(call.arguments)
                .map_err(anyhow::Error::from)
                .and_then(|args| db.get_todo(&args.id))
                .map(|todo| {
                    let text = format!("Tâche lue : {}.", todo.title);
                    tool_result(json!({ "todo": todo }), text)
                })
        }
        "create_todo" => serde_json::from_value::<CreateTodoInput>(call.arguments)
            .map_err(anyhow::Error::from)
            .and_then(|input| db.create_todo(input))
            .map(|todo| {
                let text = format!("La tâche « {} » a été créée.", todo.title);
                tool_result(json!({ "todo": todo }), text)
            }),
        "update_todo" => serde_json::from_value::<UpdateTodoInput>(call.arguments)
            .map_err(anyhow::Error::from)
            .and_then(|input| db.update_todo(input))
            .map(|todo| {
                let text = format!("La tâche « {} » a été mise à jour.", todo.title);
                tool_result(json!({ "todo": todo }), text)
            }),
        "delete_todo" => {
            #[derive(Deserialize)]
            struct Args {
                id: String,
            }
            serde_json::from_value::<Args>(call.arguments)
                .map_err(anyhow::Error::from)
                .and_then(|args| db.delete_todo(&args.id).map(|_| args.id))
                .map(|id| {
                    tool_result(
                        json!({ "deleted": true, "id": id }),
                        "La tâche a été supprimée.".into(),
                    )
                })
        }
        _ => return Ok(tool_error(format!("outil inconnu : {}", call.name))),
    };
    Ok(outcome.unwrap_or_else(|error| tool_error(error.to_string())))
}

fn tool_result(structured_content: Value, text: String) -> Value {
    json!({ "structuredContent": structured_content, "content": [{ "type": "text", "text": text }] })
}

fn tool_error(message: String) -> Value {
    json!({ "isError": true, "content": [{ "type": "text", "text": message }] })
}
