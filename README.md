# GameForge Studio

A private game design workspace with a wiki, source builder, concept assistant, engine-specific code teacher, screenshot support, page history, snapshots, and Markdown/JSON/ZIP exports.

Every AI workflow uses **GPT-6.1 Sol** (`gpt-6.1-sol`) through OpenAI's Responses API with **high reasoning** and **standard processing** (`service_tier: "default"`). The server owns these settings and never silently switches to a different model. This connects to the API model, not your ChatGPT conversation, ChatGPT memory, or subscription. OpenAI API billing is separate.

## Run locally

Use Node.js 24 or later.

```sh
npm ci
cp .env.example .env
```

Set `OPENAI_API_KEY` in `.env` to a key from your OpenAI API project. Set an app password if you want local access protection. Keep `.env` private.

```sh
npm run dev
```

Open `http://localhost:3000`. `DATA_DIR=./data` saves the workspace on disk. Without `DATA_DIR`, auto-save uses browser storage only. Never expose a development server to the public internet.

## Permanent hosting: Render

The included `render.yaml` runs the existing Node server and Vite frontend together at a stable HTTPS address. It configures one paid web-service instance with a 1 GB persistent disk. The configured service is currently $7/month plus $0.25/month for its 1 GB disk (about $7.25/month before usage extras and OpenAI API usage). Review Render's current pricing before creating the service; free ephemeral hosting does not provide the durable storage this setup needs.

1. Merge the app changes after the **App checks** workflow passes.
2. Sign in to [Render](https://render.com), connect this GitHub repository, and create a **Blueprint** using `render.yaml`.
3. Set `OPENAI_API_KEY` as a secret. Set `APP_PASSWORD` to a unique password of at least 16 characters; `APP_USERNAME` defaults to `owner`. `APP_URL` may be blank initially; after Render supplies the HTTPS address, set it to that address.
4. Deploy. Visit the address Render returns and sign in with the app username and password. Bookmark that address on your desktop and Android browser.
5. Export your existing project from the old app and import its JSON backup on the new address. Browser storage is specific to each address and does not transfer automatically.
6. Make a test edit, wait for **Saved to server**, reload, and verify it. Check access from a second device. Export a full backup before major edits.

Deploys are manual (`autoDeployTrigger: off`) so a GitHub push does not immediately change your live app. The disk mounts at `/var/data`; `DATA_DIR=/var/data/gameforge` keeps projects, sources, both scratchpads, chats, snapshots, and page history across restarts. The app uses atomic writes and revision checks to reject stale saves from another device. On a conflict, export your current project, reload to load the saved workspace, and re-import your backup as a separate project if needed. There is no live collaboration or automatic conflict merge. Use one server instance with this file-based storage.

This is an owner workspace, protected with HTTP Basic authentication over HTTPS. Everyone with the password shares the same workspace. For unrelated users, add individual accounts and a database before sharing it broadly. Keep the host and OpenAI API accounts under your control and set an OpenAI project spending limit.

If `DATA_DIR` is absent, only browser-local saving is available. Browser data can be cleared or hit storage limits; save errors are displayed in the app. Keep downloaded JSON or ZIP backups. Snapshots are stored inside the workspace, so they are not independent off-site backups. Wait for the saved indicator before closing a tab; navigation flushes the browser copy but an in-flight server save is not guaranteed to finish.

## Hosting choice and retained alternatives

Render is the recommended home for this private app because the existing Express server, private login, and persistent workspace disk run together. You manage one service and one address. The paid disk is required for the durable save mode. Hosting fees and OpenAI usage are separate; check [Render pricing](https://render.com/pricing) before provisioning.

The newer repository's Vercel/Netlify adapters and API-key settings are retained, but they are alternatives rather than a deployment decision. All adapters now use GPT-6.1 Sol, high reasoning and standard processing. Vercel's function duration is set to 300 seconds; it still needs separate storage for server-side project persistence. Netlify's synchronous functions currently have a 60-second platform limit, so long high-reasoning requests can time out despite the application's longer timeout. Render avoids that serverless execution constraint. See [Vercel duration limits](https://vercel.com/docs/functions/configuring-functions/duration) and [Netlify function configuration](https://docs.netlify.com/build/functions/configuration/).

On either serverless host, set both `OPENAI_API_KEY` and an `APP_PASSWORD` of at least 16 characters; API routes reject access to a server key without a protected owner login. Serverless saves use browser storage only. These adapters have tests but have not been deployed to either provider.

A purely static deployment retains the API Key dialog and direct browser mode for personal use. It uses the same Responses API model/settings and requires your own key. Browser keys are stored in localStorage and accessible to scripts on that app's origin. Build-time `VITE_OPENAI_API_KEY` injection is disabled. Use server secrets for the recommended deployment. Static URL imports use the existing AllOrigins reader service; paste/upload avoids sending a source URL to that service.

## Verification

```sh
npm run check
```

This runs TypeScript checks, regression tests, server integration tests, and a production frontend build. GitHub Actions runs the same checks on pull requests and `codex/**` branches. The integration tests use a local HTTP server and no live OpenAI key. Live AI verification requires a configured API key and billing; mocked API tests validate request format, model settings, screenshot inputs, strict JSON schemas, response parsing, and errors.

The regression suite covers source-to-wiki generation, all seven assistant actions, indexing, verification, auto-repair using the latest repaired text, condensation, project naming, complete backup restoration, safe public URL imports, and Markdown section/code preservation. AI source verification is advisory; it cannot prove every design claim is correct.

## Server settings

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Server-only OpenAI API key. Never put this in a `VITE_` variable. |
| `APP_USERNAME` | Login username, default `owner`. |
| `APP_PASSWORD` | Required in production, at least 16 characters. |
| `APP_URL` | Deployed HTTPS origin, used to validate browser writes. |
| `DATA_DIR` | Persistent workspace directory. Omit for browser-only saving. |
| `PORT` | HTTP listening port; hosting platforms set this automatically. |
| `NODE_ENV` | `production` serves the built `dist` directory. |

`/healthz` is public for hosting health checks. The app and `/api/*` require authentication when a password is configured. AI requests are capped at three concurrently and thirty per minute per server. Imported URLs must resolve to public addresses; private networks, credential-bearing URLs, and oversized or binary sources are rejected. Use public text/Markdown/HTML sources or upload/paste content directly.

## References

- [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol)
- [OpenAI Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [Render Blueprint configuration](https://render.com/docs/blueprint-spec)
- [Render persistent disks](https://render.com/docs/disks)
