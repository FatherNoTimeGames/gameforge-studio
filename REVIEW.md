# App review and handoff

Baseline: `FatherNoTimeGames/gameforge-studio`, main commit `c822a177d1fe2fb44ef9019956fbaf3d7190a98a`.

The app has a React/Vite frontend and Express backend. The existing seven engine targets, two assistant threads, source builder, wiki editor and reader, page history, snapshots, and export/import controls have been retained. A mobile panel selector makes the two-pane workspace usable on narrow screens.

## Changes

- Replaced Gemini and its fallback model loop with the OpenAI Responses API using `gpt-6.1-sol`, high reasoning, and standard processing. All seven chat actions and the build, verification, repair, index, condense, and naming operations use one request helper. Images remain supported. Wiki building, verification, and indexing use strict JSON schemas. An API key stays on the server.
- Fixed the repair loop to verify its latest repaired page contents. Stop waits for the current request and prevents subsequent repairs. Page revisions remain available.
- Fixed a conditional React hook in the section apply modal that could crash on open/close. Section merging and proposal parsing preserve code fences, including nested code inside four-backtick Markdown proposals.
- Fixed auto-linking to avoid changing headings, code, and existing links. Context hierarchy includes deeper descendants and orphaned legacy pages; parent lookup uses a map. Changed pages invalidate their summaries and keywords.
- Consolidated repeated API calls and error handling, memoized chat Markdown rendering, loaded ZIP generation only on demand, and removed unused dependencies and the obsolete Gemini lockfile.
- Removed silent 12,000-character source and 20,000-character generated-page truncation. Larger requests now receive explicit size/incomplete-response errors instead of quietly losing material.
- Full JSON and ZIP manifests include sources, both scratchpads, both chats, snapshots, hierarchy and history. Legacy combined notepad backups still import.
- Added optional persistent server saves with atomic replacement and revision conflict protection. Retained the existing browser storage keys and browser backups. Save errors are visible. Corrupt browser data is not overwritten with the default project.
- Added production password protection, same-origin write checks, bounded AI concurrency, and public-only source retrieval with validated DNS pinned to the actual HTTP request. Render configuration and deployment instructions are included.

## Verification performed

Sixteen regression tests pass when run directly with Node 24. They cover AI settings and response parsing, screenshot requests, all AI workflows, backup round trips, durable disk writes and stale revisions, auto-repair and stopping, context hierarchy, auto-linking, section/code preservation, and URL validation. `git diff --check` passes.

## Verification still needed

Dependency installation was blocked by local network permissions. TypeScript checking, the production Vite build, and Express server integration tests have not run. `npm run check` and the included GitHub Actions workflow run all of these checks once dependencies can be installed. Browser QA and a real OpenAI call have not run; no API key was provided.

Before GitHub App installation, the integration returned HTTP 403 (`Resource not accessible by integration`) when creating a tree, including a retry without the workflow file. After installation, branch writes became available. A review branch is being prepared against the newer main. No merge or hosting deployment has been made.

## Remaining setup

Run the full checks and review the pull request before merging. Choose a hosting account, review the paid service/disk costs, and configure an OpenAI API key and private app password. The included Render setup preserves the Node server; it does not require a frontend rewrite. See README.md for the exact setup and data migration steps.

Standard processing selects the model's normal API service tier; high reasoning can still take time. This app calls the API model and does not inherit this ChatGPT session's tools or memory. File-based persistence is for one private owner workspace on one server instance, not multi-user collaboration. Keep external exports; named snapshots share the same workspace storage.

The newer upstream API-key settings, browser viewport handling, and deployment adapters were reconciled into this update. Serverless and direct browser paths share the Responses implementation and cannot fall back to GPT-5 Mini/Nano. Render remains the recommended persistent owner deployment; Vercel/Netlify are supported alternatives with their storage/runtime limits documented.
