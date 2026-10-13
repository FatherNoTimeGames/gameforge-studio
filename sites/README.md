# GameForge on ChatGPT Sites

This is an additional hosting target for the existing GameForge interface. The
root `src/` and `shared/` directories remain the source of truth. The original
Node/static hosting targets remain available.

## What this target does

- Uses ChatGPT sign-in and isolates every workspace and AI request by the
  trusted Sites user ID. The same account sees the same cloud workspace on a
  phone, tablet and computer.
- Saves the complete project workspace in R2, with an atomic revision pointer
  in D1. Phone and tablet saves both succeed: only changed fields/items are
  submitted, so unrelated edits from another device remain. The last successful
  submission wins when both devices change the same field. Deletions propagate;
  stale edits do not resurrect a deleted item.
- Checks for cloud updates every two seconds while the page is visible and when
  returning to the app or reconnecting. Unsubmitted typing stays in place during
  refreshes. Pending edits are backed up per account and retried automatically,
  including after reopening the app. Each device keeps its own selected project.
- Preserves the wiki, sources, concept/teacher chats, scratchpads, snapshots,
  histories, imports, exports, mobile panes and existing AI prompt workflows.
- Exposes a private `/mcp` server with `list_requests`, `read_request` and
  `complete_request`. Publishing with Sites registers the hosted plugin.
- Saves AI tasks and answers across reloads. The task inbox supports stopping
  a wait, copying a saved reply, recovering it and deleting old tasks.

## How AI works

Click an AI action in GameForge. In **ChatGPT tasks**, copy the instruction and
send it in a ChatGPT conversation with your GameForge plugin connected. ChatGPT
reads the saved task, generates its answer in that conversation, and saves the
answer through `complete_request`. Return to GameForge; the waiting action uses
the reply through its existing parsing/review workflow.

Keep the app open during an action. For a concept/teacher chat interrupted by a
reload, use **Restore chat reply** to add the saved reply to its original project
and thread; sending another message changes the chat context and creates a new
task. For utility actions, reopen the same project and retry the same action with
the same inputs. A pending/completed request with the identical prompt is reused.
If that answer was already taken, choose **Recover reply**, then retry the action.
Replies remain viewable even after they were taken. If inputs changed, copy the
saved reply for manual use; do not apply it to unrelated content. Multi-step workflows, including automatic
repair and indexing several pages, can require several successive ChatGPT tasks.

This is a deliberate handoff between the website and ChatGPT. A standalone
browser tab cannot invoke subscription inference automatically. No embedded
ChatGPT UI support is assumed. The Sites target never calls the OpenAI inference
API, never asks for an API key, and does not silently switch to paid inference.
The selected ChatGPT conversation controls model, reasoning and speed; the
website cannot force GPT-6.1 Sol/high or promise a model unavailable in your plan.
Your subscription's usage limits still apply.

## Prepare standalone source for Sites

From the repository root:

```sh
npm run sites:export
cd .sites-export/gameforge
npm ci --include=dev
npm run typecheck
npm run build
```

The export contains the Vinext starter build integration, the authoritative app
source copied at export time, storage migrations and hosting manifest. It is
self-contained; edits should be made in the repository and exported again.
Do not upload `node_modules`, local storage, `.wrangler`, runtime state or secrets.

The tracked manifest intentionally has no `project_id`: preparing GitHub source
does not register or publish a Site. When publication is requested, register a
private Site through the Sites workflow, persist the returned real ID, build and
publish this exported project. Keep the `DB` and `BUCKET` logical bindings and
`mcp` capability. Sites provisions their production resources and applies the
committed D1 migrations before uploading the Worker. Do not run `wrangler deploy`
or create a separately billed Cloudflare account for this route.

After publication, connect the generated GameForge plugin to the same ChatGPT
account. Confirm a real request/reply and a cross-device save before relying on
the app. Access the private Site URL in Chrome or another browser on Android;
sign in with the same account. An Android home-screen bookmark is optional.

Sites hosting and plugin availability depend on your plan and Sites limits.
There is no extra OpenAI API bill in this target. Sharing the Site and sharing
the plugin are separate capabilities; personal-account plugin sharing must not
be assumed. Keep the Site private for personal use initially.

## Bring your existing projects

Export a full project JSON backup from the old app, then import it into the new
Site. Browser storage belongs to a specific origin and does not move to the Site
URL automatically. Account-scoped local backups prevent a new account from
automatically inheriting another account's browser workspace. Preserve your
external JSON backups as well as the cloud save.

## Local development

```sh
cd sites
npm ci --include=dev
npm run db:generate
npm run build
```

Apply every committed SQL migration to the local D1 binding, in filename order:

```sh
for migration in drizzle/*.sql; do
  npx wrangler d1 execute DB --local --persist-to .wrangler/state --config dist/server/wrangler.json --file "$migration"
done
npm run dev
```

Local Vinext preview provides the starter's loopback-only mock sign-in. Production
identity is provided by Sites dispatch. The Worker must be served through Sites,
not an untrusted reverse proxy where visitors could forge identity headers.
The production build includes no local mock-auth middleware.

For schema changes, run `npm run db:generate`, inspect and commit the new SQL and
metadata. Never rewrite migrations that have been published. CI verifies both
hosting targets, the generated UI and server types, and the standalone export.
It also runs the built Worker with real local D1/R2 bindings to check page
rendering, identity isolation, multi-device saves and an MCP task round trip.

## Limits and remaining deployment checks

- Workspace JSON: 8 MB per save; text source URL imports: 2 MB; task upload:
  16 MB; answer text: 1 MB; inbox: 40 retained tasks per account.
- URL imports accept public HTTPS hosts for GitHub, Godot docs, Unity docs and
  English Wikipedia. Paste or upload source text from other hosts. The original
  Node target retains its broader DNS-validated source importer.
- Normal saves retire their previous R2 blob. A Worker interruption between a
  blob upload and its pointer commit can leave an orphan; retain export backups
  and monitor storage quotas. No scheduled maintenance or billing is configured.
- Browser UI, Android return-to-app behavior, actual Sites identity/storage,
  plugin installation and a real native ChatGPT task must be tested after private
  publication. Automated source checks cannot establish those integrations.

No Site is registered or deployed by this pull request.
