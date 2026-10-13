# GameForge audit — 2026-10-13

Scope: the merged Sites preparation and retained React/Vite/Express/serverless
targets in `FatherNoTimeGames/gameforge-studio`. This is a source, regression,
build, local Worker and dependency audit. It does not establish that a public
deployment is running this revision.

## Findings fixed

| Priority | Trigger and previous behavior | Change |
| --- | --- | --- |
| High | Rename an imported backup, then reload/sync: stale `projectName` metadata could replace the new name. Loading also reset project timestamps. | Prefer the current canonical name and preserve valid timestamps. |
| High | A backup contained malformed snapshot pages or duplicate chat/source IDs. Import succeeded and later restore/sync could fail or merge whole arrays incorrectly. | Validate nested snapshot contents and unique identifiers before accepting imports or replacing a saved workspace. |
| High | Start condensing page A, select page B before the reply returns, then apply: B could receive A's text. | Save the original project/page IDs with the result and apply only there. A deleted original page is not recreated. Section-apply results also retain their original project. |
| High | Scratchpads said “never sent,” but chat requests included their text. | Exclude notes by default. A saved project checkbox explicitly enables scratchpad context. The existing ability to supply notes remains available. |
| High | Two titles sanitized to the same Markdown filename, such as `Damage/Stats` and `Damage Stats`. The ZIP silently retained only one file. | Generate unique filenames, including case-insensitive collisions, and safely quote metadata. |
| High | Another tab changed the signed-in account while an old workspace remained open. Background calls could submit old-page content under the new session. | Bind local API calls to the originally loaded Sites account and reject mismatches. Cloud editing pauses until reload; external source services never receive the account header. |
| Medium | Both devices waited for the same AI task. One took the reply and the other could wait for 45 minutes or apply it twice. | Atomically claim completed replies. The other device gets recovery guidance instead of hanging. |
| Medium | Restore an AI reply while its original request was returning: the same chat message could be appended twice. | Deduplicate by the durable task/message ID. |
| Medium | Every keystroke consumed one of five history entries. Earlier work disappeared after a few characters. | Keep pre-edit checkpoints across a typing session and add another after a pause or explicit AI application. |
| Medium | Parent selectors or imported/generated data created page cycles. | Prevent selecting descendants as parents and normalize malformed hierarchies. |
| Medium | Plain Markdown proposals could not be applied; Unicode headings collided during section merging; nested code could be truncated by auto-repair fence extraction. | Parse plain and fenced replies, keep code fences intact and match Unicode headings correctly. |
| Medium | Category editing, wiki indexing and clearing sources had callbacks but no reachable controls. | Wire their controls into the existing interface. Index failures now appear to the user. |
| Medium | Condense copy implied complete fact verification; exported starter code claimed to come from the user's wiki although its values were fixed examples. | Describe the checks as number/table/link aids and label scaffolds as examples. Unsupported engines get a scaffold README instead of an invalid fake source file. |
| Medium | The context gauge claimed free headroom against a hardcoded model budget, even though Sites uses the user's selected conversation model. | Show estimated wiki size and explain that model limits and actual request sizes vary. |
| Low | Mobile downloads revoked their temporary URLs immediately; repeated selection of the same backup was unreliable; file-read errors had no feedback. | Delay URL cleanup, reset the file input and show file-read errors. |
| Low | Obsolete model/fallback constants and unused imports remained after the model migration. | Remove confirmed unused definitions and add TypeScript checks for unused locals/parameters. Retain working alternative hosting adapters. |

## Dependency audit

The initial production-package scan found no advisories in the root target.
It found advisories in the Sites target's pinned Next.js and sharp versions.
The update pins Next.js to `16.4.0` and sharp to `0.35.5`; final lockfiles and
audit results are checked alongside the Worker and standalone builds. The full
scan also identified advisories in the older React server, Vinext/Vite and
Cloudflare tooling graph. Those versions and their required peers were updated
as a compatible set; the Drizzle configuration loader's old esbuild dependency
uses a patched override. Both production scans and the complete Sites graph
are rechecked after locking the final transitive dependencies. Advisory counts
are recorded below after the last verification run; they do not guarantee
against all security issues. The final scan still flags the glob build-tool
chain through `braces` (`braces`, `micromatch`, `fast-glob`, dynamic-import/commonjs
plugins and Vinext). npm's published latest `braces` version is still `3.0.3`,
inside the advisory range; its suggested Vinext downgrade is not a compatible
fix for this application. That upstream finding remains open. These packages
process build-time import patterns; this app does not expose a glob-pattern
input endpoint. This is a source assessment, not a proof of non-exploitability.
The old font-renderer ZIP dependency uses patched `fflate` `0.8.3`.
Package advisories describe installed dependency versions, not proof that the
application exposed an affected endpoint or that an exploit occurred.

CI retains production and complete Sites dependency audit JSON as build
artifacts. Those results must be distinguished from development-only tooling
reports and from the modules included in the final Worker bundle.

## Validation

The audit adds regression cases for imported names, malformed data, hierarchy
cycles, useful history, original AI targets, scratchpad opt-in, duplicate replies,
colliding export names, Unicode/plain Markdown and account isolation. Checks
also cover concurrent phone/tablet edits, last-submitted field overwrites,
pending edits, task recovery, backups and authenticated API access.

Required checks: root tests/typecheck/build, unused-local/parameter checks,
Sites typecheck/build, migration drift, standalone source export/build and the
built Worker smoke check with real local D1/R2. Final CI results are recorded
in the pull request.

## Remaining improvements and verification limits

- A live URL was not supplied, and Sites discovery in the connected account
  returned no owned Site. PR #3 is merged; that alone does not publish a Site.
  Production identity, a real ChatGPT plugin task and Android browser behavior
  still require testing against the actual deployment.
- Same-field saves intentionally use the last successful submission, as
  requested. Text is not merged character by character. A interrupted response
  can cause an identical pending edit to retry; operation-ID deduplication would
  be a useful later improvement for unreliable connections.
- Wiki proposals identify pages by title. Duplicate titles and repeated section
  headings can remain ambiguous. A future page-ID proposal format would remove
  that ambiguity without renaming existing documents.
- Source URL imports in Sites retain their documented host allowlist. Other
  material supports paste/upload. Workspace/upload/inbox limits remain visible
  save/import errors rather than silently truncating documents.
- Worker interruptions can leave unreferenced R2 blobs. Scheduled cleanup and
  quota monitoring are future operational improvements; project exports remain
  the external backup path.
- Modal focus trapping, keyboard dismissal and a complete Android accessibility
  pass remain useful browser-level improvements. No browser automation was
  available in this workspace.

## Quick tablet setup

1. Open the actual published GameForge Site URL in Chrome and bookmark it.
2. Sign in with the same ChatGPT account on phone and tablet.
3. Export a full project JSON from the old app and import it through **Export →
   Import Project** on the new URL.
4. Edit a short test sentence, wait for **Saved to server**, then confirm it on
   the other device. Unrelated edits are retained; the last submitted edit wins
   on the same field.
5. Connect the generated GameForge plugin in ChatGPT. Press an AI action in the
   app, copy the instruction from **ChatGPT tasks**, send it in a conversation
   with that plugin connected, then return for the saved reply.

If only the GitHub PR was merged, private Sites publication is still required
before these steps produce a usable URL/plugin. A computer does not need to stay
running after Sites publication. See `sites/README.md` for the source workflow.
