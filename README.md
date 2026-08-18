# TodoAI

TodoAI est une application de tâches Linux rapide, synchronisée et privée. L’interface utilise Tauri 2, React, TypeScript et shadcn/ui. Les données sont stockées dans Supabase Postgres et protégées par des règles d’accès propres à chaque compte.

## Fonctionnalités

- Espaces de travail, tâches, notes, priorité et échéance
- Vues Liste et Kanban avec glisser-déposer
- Thèmes clair et sombre
- Synchronisation Supabase entre l’application et le MCP
- MCP distant avec 7 outils CRUD, déployé en Edge Function
- Authentification par compte Supabase
- Import unique de l’ancienne base SQLite au premier compte connecté

## Lancer et construire

Prérequis : Node.js, Rust et les dépendances Linux de Tauri/WebKitGTK 4.1.

```bash
npm install
npm run tauri:dev
npm run tauri:build
```

La configuration publique Supabase est déjà fournie dans l’application. `.env.example` documente les variables disponibles. La clé publiée est une clé client ; les données restent protégées par l’authentification et les règles RLS Postgres.

Paquets générés :

- `src-tauri/target/release/bundle/appimage/TodoAI_0.3.0_amd64.AppImage` pour Fedora et les distributions compatibles AppImage
- `src-tauri/target/release/bundle/deb/TodoAI_0.3.0_amd64.deb` pour Debian et Ubuntu

## Base Supabase

Le schéma reproductible se trouve dans `supabase/migrations/20260817140000_create_todoai_core.sql`. Il crée :

- `public.workspaces` et `public.todos`
- les index et contrôles de validité
- les politiques RLS limitant chaque requête à son propriétaire
- un sas privé et consommable une seule fois pour importer l’ancienne base locale

La base SQLite d’origine n’est pas supprimée et reste une sauvegarde locale.

## MCP distant

URL déployée :

```text
https://zoyxothgwbpgkjnjunis.supabase.co/functions/v1/todoai-mcp
```

Outils : `list_workspaces`, `create_workspace`, `list_todos`, `get_todo`, `create_todo`, `update_todo`, `delete_todo`.

Le serveur expose Streamable HTTP, vérifie le jeton Supabase de l’utilisateur puis exécute les requêtes avec les politiques RLS. Une requête sans authentification reçoit une réponse `401` et indique automatiquement les métadonnées OAuth.

## Connexion ChatGPT

ChatGPT utilise OAuth 2.1 pour accéder aux données privées et aux actions d’écriture. La page de connexion et de consentement est publiée sur GitHub Pages :

```text
https://gneed49.github.io/todoai-auth/oauth/consent/
```

Configuration Supabase Auth associée :

1. URL du site : `https://gneed49.github.io/todoai-auth` ;
2. chemin d’autorisation : `/oauth/consent/` ;
3. serveur OAuth 2.1 et enregistrement dynamique des clients activés ;
4. URL MCP à ajouter dans ChatGPT : `https://zoyxothgwbpgkjnjunis.supabase.co/functions/v1/todoai-mcp`.

Le code source de la page reste dans `auth-site/`. Son dépôt de publication est public sur <https://github.com/gneed49/todoai-auth>.

Le paquet de plugin se trouve dans `plugins/cairn` ; son identifiant historique est conservé pour la compatibilité, mais son nom visible et sa connexion utilisent TodoAI.

## Vérifications

```bash
npm run check
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

L’interface d’authentification est également vérifiée dans le navigateur en formats bureau et mobile.
