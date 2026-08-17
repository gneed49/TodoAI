const endpoint = process.env.CAIRN_MCP_URL ?? "http://127.0.0.1:37777/mcp";
let nextId = 1;

async function call(method, params = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-03-26",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`${method}: ${payload.error.message}`);
  return payload.result;
}

const initialized = await call("initialize", {
  protocolVersion: "2025-03-26",
  capabilities: {},
  clientInfo: { name: "todoai-smoke-test", version: "1.0.0" },
});
if (initialized.serverInfo?.name !== "todoai") throw new Error("Identité MCP incorrecte");

const listed = await call("tools/list");
const expected = ["list_workspaces", "create_workspace", "list_todos", "get_todo", "create_todo", "update_todo", "delete_todo"];
for (const name of expected) {
  if (!listed.tools.some((tool) => tool.name === name)) throw new Error(`Outil manquant: ${name}`);
}

const workspaces = await call("tools/call", { name: "list_workspaces", arguments: {} });
const workspaceId = workspaces.structuredContent?.workspaces?.[0]?.id;
if (!workspaceId) throw new Error("Aucun espace retourné");

const created = await call("tools/call", {
  name: "create_todo",
  arguments: { workspace_id: workspaceId, title: "Vérifier le serveur MCP", priority: "low" },
});
const todoId = created.structuredContent?.todo?.id;
if (!todoId) throw new Error("La création n’a pas retourné de tâche");

const updated = await call("tools/call", { name: "update_todo", arguments: { id: todoId, status: "done" } });
if (updated.structuredContent?.todo?.status !== "done") throw new Error("La mise à jour du statut a échoué");

const deleted = await call("tools/call", { name: "delete_todo", arguments: { id: todoId } });
if (deleted.structuredContent?.deleted !== true) throw new Error("La suppression a échoué");

console.log(`MCP OK — ${listed.tools.length} outils, cycle CRUD validé.`);
