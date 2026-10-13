# App review and handoff

## Sites preparation

The current personal-use route is the additional ChatGPT Sites target in
`sites/`, with setup and migration instructions in `sites/README.md`. It keeps
the existing interface, uses ChatGPT sign-in and per-account D1/R2 cloud saves,
and exposes saved AI tasks through a private MCP plugin. AI answers are generated
in a connected ChatGPT conversation and returned to the app; the Site has no
inference API key or paid-inference fallback. Conversation settings control the
model and reasoning. The browser handoff is explicit and multi-step actions can
require several tasks.

Six additional tests cover private account isolation, competing device writes,
durable task/reply recovery, native MCP calls, the browser handoff, and preventing
paid fallback. CI also builds/typechecks the Vinext target and standalone export,
checks migration drift, and runs the built Worker with local D1/R2 to check page
rendering, identity, saves, conflicts and an MCP round trip. Live Sites identity,
plugin connection, a real ChatGPT answer and Android behavior still need private
deployment checks. No Site has been registered or published.

The initial API-hosting review below describes the retained alternative targets.

## Original API-hosting review

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

Seventeen regression tests and two Express integration tests pass in GitHub Actions on Node 24. TypeScript checking and the production Vite build also pass. They cover AI settings and response parsing, screenshot requests, all AI workflows, backup round trips, durable disk writes and stale revisions, auto-repair and stopping, context hierarchy, auto-linking, section/code preservation, and URL validation. `git diff --check` passes.

## Verification limits

Local dependency installation is still restricted, but GitHub Actions installed dependencies and successfully ran TypeScript checking, all 19 tests, and the production Vite build. `npm run check` and the included GitHub Actions workflow run all of these checks once dependencies can be installed. Browser QA and a real OpenAI call have not run; no API key was provided.

The initial improvements were delivered in [pull request #2](https://github.com/FatherNoTimeGames/gameforge-studio/pull/2) and are now merged into main. They remain the basis of the new Sites target. No hosting deployment has been made in this preparation.

## Remaining setup

For the personal Sites route, review the current pull request and follow `sites/README.md`; no API key or Render account is needed. The instructions below apply only if the separate API-hosting alternative is chosen: review service/disk costs and configure an OpenAI API key and private app password. The included Render setup preserves the Node server. See README.md for that alternative's setup and data migration steps.

Standard processing selects the model's normal API service tier; high reasoning can still take time. This app calls the API model and does not inherit this ChatGPT session's tools or memory. File-based persistence is for one private owner workspace on one server instance, not multi-user collaboration. Keep external exports; named snapshots share the same workspace storage.

The upstream API-key settings, browser viewport handling, and deployment adapters were reconciled into the initial update. Serverless and direct browser API paths share the Responses implementation and cannot fall back to GPT-5 Mini/Nano. Render is the retained persistent Node option; Vercel/Netlify are API alternatives with their storage/runtime limits documented. Sites is the current preparation for subscription use through a ChatGPT conversation.
