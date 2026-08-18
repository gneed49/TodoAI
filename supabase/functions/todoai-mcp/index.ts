import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const PUBLISHABLE_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const MCP_URL = `${SUPABASE_URL}/functions/v1/todoai-mcp`;
const AUTH_SERVER = `${SUPABASE_URL}/auth/v1`;
const oauthSecurity = [{ type: "oauth2", scopes: ["openid", "email"] }] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TodoStatus = z.enum(["todo", "doing", "done"]);
const Priority = z.enum(["none", "low", "medium", "high"]);
const DateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const CreateWorkspace = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#6366f1"),
}).strict();
const ListTodos = z.object({
  workspace_id: z.string().optional(),
  status: TodoStatus.optional(),
  query: z.string().max(200).optional(),
  include_completed: z.boolean().default(true),
}).strict();
const CreateTodo = z.object({
  workspace_id: z.string().min(1),
  title: z.string().trim().min(1).max(240),
  notes: z.string().max(10_000).default(""),
  status: TodoStatus.default("todo"),
  priority: Priority.default("none"),
  due_date: DateValue.optional().default(null),
}).strict();
const UpdateTodo = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(240).optional(),
  notes: z.string().max(10_000).optional(),
  status: TodoStatus.optional(),
  priority: Priority.optional(),
  due_date: DateValue.optional(),
  position: z.number().int().min(0).optional(),
}).strict();
const IdOnly = z.object({ id: z.string().uuid() }).strict();

type RpcRequest = { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };

const workspaceSchema = {
  type: "object",
  properties: {
    id: { type: "string" }, name: { type: "string" }, color: { type: "string" }, created_at: { type: "string" },
  },
  required: ["id", "name", "color", "created_at"],
};
const todoSchema = {
  type: "object",
  properties: {
    id: { type: "string" }, workspace_id: { type: "string" }, title: { type: "string" }, notes: { type: "string" },
    status: { type: "string", enum: ["todo", "doing", "done"] },
    priority: { type: "string", enum: ["none", "low", "medium", "high"] },
    due_date: { type: ["string", "null"] }, position: { type: "integer" },
    created_at: { type: "string" }, updated_at: { type: "string" },
  },
  required: ["id", "workspace_id", "title", "notes", "status", "priority", "due_date", "position", "created_at", "updated_at"],
};

const tools = [
  {
    name: "list_workspaces", title: "Lister les espaces TodoAI",
    description: "Use this when the user wants to see their TodoAI workspaces or when a workspace ID is needed for another operation.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: { type: "object", properties: { workspaces: { type: "array", items: workspaceSchema } }, required: ["workspaces"] },
    securitySchemes: oauthSecurity,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "create_workspace", title: "Créer un espace TodoAI",
    description: "Use this when the user wants to create a new workspace for grouping their TodoAI tasks.",
    inputSchema: { type: "object", properties: { name: { type: "string", minLength: 1, maxLength: 80 }, color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$", default: "#6366f1" } }, required: ["name"], additionalProperties: false },
    outputSchema: { type: "object", properties: { workspace: workspaceSchema }, required: ["workspace"] },
    securitySchemes: oauthSecurity,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
  },
  {
    name: "list_todos", title: "Lister les tâches TodoAI",
    description: "Use this when the user wants to find, review, summarize, or count their TodoAI tasks. Filters are optional and can be combined.",
    inputSchema: { type: "object", properties: { workspace_id: { type: "string" }, status: { type: "string", enum: ["todo", "doing", "done"] }, query: { type: "string", maxLength: 200 }, include_completed: { type: "boolean", default: true } }, additionalProperties: false },
    outputSchema: { type: "object", properties: { todos: { type: "array", items: todoSchema } }, required: ["todos"] },
    securitySchemes: oauthSecurity,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "get_todo", title: "Lire une tâche TodoAI",
    description: "Use this when the user wants the current details of one TodoAI task or before an update that depends on its current values.",
    inputSchema: { type: "object", properties: { id: { type: "string", format: "uuid" } }, required: ["id"], additionalProperties: false },
    outputSchema: { type: "object", properties: { todo: todoSchema }, required: ["todo"] },
    securitySchemes: oauthSecurity,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "create_todo", title: "Créer une tâche TodoAI",
    description: "Use this when the user wants to add one actionable task to a known TodoAI workspace.",
    inputSchema: { type: "object", properties: { workspace_id: { type: "string" }, title: { type: "string", minLength: 1, maxLength: 240 }, notes: { type: "string", maxLength: 10000 }, status: { type: "string", enum: ["todo", "doing", "done"], default: "todo" }, priority: { type: "string", enum: ["none", "low", "medium", "high"], default: "none" }, due_date: { type: ["string", "null"], format: "date" } }, required: ["workspace_id", "title"], additionalProperties: false },
    outputSchema: { type: "object", properties: { todo: todoSchema }, required: ["todo"] },
    securitySchemes: oauthSecurity,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
  },
  {
    name: "update_todo", title: "Mettre à jour une tâche TodoAI",
    description: "Use this when the user wants to edit, complete, reopen, move, prioritize, or reschedule an existing TodoAI task. Send only fields that should change.",
    inputSchema: { type: "object", properties: { id: { type: "string", format: "uuid" }, workspace_id: { type: "string" }, title: { type: "string", minLength: 1, maxLength: 240 }, notes: { type: "string", maxLength: 10000 }, status: { type: "string", enum: ["todo", "doing", "done"] }, priority: { type: "string", enum: ["none", "low", "medium", "high"] }, due_date: { type: ["string", "null"], format: "date" }, position: { type: "integer", minimum: 0 } }, required: ["id"], additionalProperties: false },
    outputSchema: { type: "object", properties: { todo: todoSchema }, required: ["todo"] },
    securitySchemes: oauthSecurity,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  },
  {
    name: "delete_todo", title: "Supprimer une tâche TodoAI",
    description: "Use this only when the user explicitly wants to permanently delete one existing TodoAI task.",
    inputSchema: { type: "object", properties: { id: { type: "string", format: "uuid" } }, required: ["id"], additionalProperties: false },
    outputSchema: { type: "object", properties: { deleted: { type: "boolean" }, id: { type: "string" } }, required: ["deleted", "id"] },
    securitySchemes: oauthSecurity,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: true },
  },
];

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

function toolResult(structuredContent: unknown, text: string) {
  return { structuredContent, content: [{ type: "text", text }] };
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: "text", text: message }] };
}

async function authenticatedClient(req: Request): Promise<SupabaseClient> {
  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw new Error("UNAUTHORIZED");
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("UNAUTHORIZED");
  return client;
}

async function callTool(db: SupabaseClient, name: string, rawArguments: unknown) {
  const args = rawArguments ?? {};
  if (name === "list_workspaces") {
    const { data, error } = await db.from("workspaces").select("id,name,color,created_at").order("position").order("created_at");
    if (error) throw error;
    return toolResult({ workspaces: data ?? [] }, `${data?.length ?? 0} espace(s) TodoAI trouvé(s).`);
  }
  if (name === "create_workspace") {
    const input = CreateWorkspace.parse(args);
    const { count } = await db.from("workspaces").select("id", { count: "exact", head: true });
    const { data, error } = await db.from("workspaces").insert({ id: crypto.randomUUID(), ...input, position: count ?? 0 }).select("id,name,color,created_at").single();
    if (error) throw error;
    return toolResult({ workspace: data }, `L’espace « ${data.name} » a été créé.`);
  }
  if (name === "list_todos") {
    const input = ListTodos.parse(args);
    let query = db.from("todos").select("id,workspace_id,title,notes,status,priority,due_date,position,created_at,updated_at").order("position").order("updated_at", { ascending: false });
    if (input.workspace_id) query = query.eq("workspace_id", input.workspace_id);
    if (input.status) query = query.eq("status", input.status);
    if (!input.include_completed) query = query.neq("status", "done");
    const { data, error } = await query;
    if (error) throw error;
    const needle = input.query?.trim().toLocaleLowerCase("fr") ?? "";
    const todos = needle ? (data ?? []).filter((todo) => `${todo.title} ${todo.notes}`.toLocaleLowerCase("fr").includes(needle)) : data ?? [];
    return toolResult({ todos }, `${todos.length} tâche(s) TodoAI trouvée(s).`);
  }
  if (name === "get_todo") {
    const input = IdOnly.parse(args);
    const { data, error } = await db.from("todos").select("id,workspace_id,title,notes,status,priority,due_date,position,created_at,updated_at").eq("id", input.id).single();
    if (error) throw error;
    return toolResult({ todo: data }, `Tâche lue : ${data.title}.`);
  }
  if (name === "create_todo") {
    const input = CreateTodo.parse(args);
    const { data: lastTodo } = await db.from("todos").select("position").eq("workspace_id", input.workspace_id).order("position", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await db.from("todos").insert({ ...input, position: (lastTodo?.position ?? 0) + 1 }).select("id,workspace_id,title,notes,status,priority,due_date,position,created_at,updated_at").single();
    if (error) throw error;
    return toolResult({ todo: data }, `La tâche « ${data.title} » a été créée.`);
  }
  if (name === "update_todo") {
    const input = UpdateTodo.parse(args);
    const { id, ...changes } = input;
    const { data, error } = await db.from("todos").update(changes).eq("id", id).select("id,workspace_id,title,notes,status,priority,due_date,position,created_at,updated_at").single();
    if (error) throw error;
    return toolResult({ todo: data }, `La tâche « ${data.title} » a été mise à jour.`);
  }
  if (name === "delete_todo") {
    const input = IdOnly.parse(args);
    const { error } = await db.from("todos").delete().eq("id", input.id);
    if (error) throw error;
    return toolResult({ deleted: true, id: input.id }, "La tâche a été supprimée.");
  }
  return toolError(`Outil inconnu : ${name}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const pathname = new URL(req.url).pathname;
  if (pathname.endsWith("/.well-known/oauth-protected-resource")) {
    return json({
      resource: MCP_URL,
      authorization_servers: [AUTH_SERVER],
      scopes_supported: ["openid", "email"],
      resource_documentation: "https://github.com/gneed49/TodoAI#connexion-chatgpt",
    });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });

  let db: SupabaseClient;
  try {
    db = await authenticatedClient(req);
  } catch {
    return json({ error: "authentication_required" }, 401, {
      "WWW-Authenticate": `Bearer resource_metadata="${MCP_URL}/.well-known/oauth-protected-resource", scope="openid email"`,
    });
  }

  let request: RpcRequest;
  try {
    request = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON" } }, 400);
  }
  if (request.id === undefined) return new Response(null, { status: 202, headers: corsHeaders });

  try {
    let result: unknown;
    if (request.method === "initialize") {
      result = {
        protocolVersion: "2025-03-26",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "todoai", version: "0.3.0" },
        instructions: "TodoAI gère les tâches privées du compte connecté. Listez les espaces avant de créer une tâche si l’identifiant n’est pas connu. Relisez une tâche avant une modification ambiguë. Les suppressions sont définitives.",
      };
    } else if (request.method === "ping") {
      result = {};
    } else if (request.method === "tools/list") {
      result = { tools };
    } else if (request.method === "tools/call") {
      const params = request.params ?? {};
      result = await callTool(db, String(params.name ?? ""), params.arguments);
    } else {
      return json({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "Méthode MCP inconnue" } });
    }
    return json({ jsonrpc: "2.0", id: request.id, result });
  } catch (error) {
    return json({ jsonrpc: "2.0", id: request.id, result: toolError(error) });
  }
});
