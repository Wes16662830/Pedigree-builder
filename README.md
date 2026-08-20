# OudeLuck Pedigree Builder

Local tool for OudeLuck Lofts (OneLoft Genetics), Athlone Farm, Tarkastad,
Eastern Cape. Upload two parent pedigrees — any loft, any format, image or
PDF — and produce a branded, editable OudeLuck pedigree for the child bird.

The hard part isn't the web app. It's that pedigrees from different lofts
have no common format, no consistent ring convention, no consistent sex
marker, and mix English/German/Dutch/Czech text. Extraction is done by a
vision model (Claude), not OCR + regex — see the build brief this project
was built from for the full reasoning.

This started as the **local tool** (build option A from the brief): runs on
your own machine, API key in `.env`, no auth, no hosting, no per-user
storage, a single SQLite file on disk. It can now also run **hosted on
Cloudflare** (Workers + D1 + R2) so it's reachable from a real URL like your
other sites — see [Hosting on Cloudflare](#hosting-on-cloudflare) below. Both
targets share the same core logic (`shared/`); only where data is stored and
where the API key comes from differs.

## Setup (local)

```bash
npm install
cp .env.example .env   # add your ANTHROPIC_API_KEY
npm run db:seed        # optional — seeds ZA 2805, ZA 2818, ZA 2911, and a
                        # small "The 404" fixture, so the app has real data
                        # to browse without needing a scan on hand yet
npm run dev             # runs the Vite frontend (5173) + Express API (8787)
```

Open http://localhost:5173.

## Pipeline

```
upload 2 files → vision extract → HUMAN VERIFY → merge into child → render → edit → export
```

1. **Extract** (`POST /api/extract`) — one Claude vision call per parent
   pedigree upload. Returns the full ancestor tree found (typically 4–5
   generations), verbatim ring numbers and notes, English translation in a
   separate field, `sex: "unknown"` unless the source states it outright for
   that specific bird (never inferred from an ancestor's V/W marker), and a
   confidence score per bird. Nothing is invented — a missing ring, result,
   or ancestor is left out, not guessed.

2. **Verify** (the split-screen UI) — original scan on the left, extracted
   fields on the right, sorted lowest-confidence first, anything under 85%
   confidence flagged amber. Every field is editable. Nothing can be merged
   or rendered until every bird in the tree is ticked "verified".

3. **Merge** (`POST /api/merge`) — mechanical once both parent trees are
   verified: creates the child bird, attaches `sireId`/`damId`, assembles the
   full tree. Then one Claude call writes the prose sections (Breeding,
   Line-breeding of note, Sire's/Dam's own record, loft credentials),
   grounded only in what's actually in the verified tree — loft-level claims
   ("6× National Champion") are kept separate from a bird's own race record,
   and a sibling's results are never presented as the bird's own.

4. **Render / edit** (the sheet view) — A4 landscape, 4-generation grid,
   sire's side above dam's side, OudeLuck gold (`#D19A45`) and black header
   panel (with a white-panel print variant toggle for inkjet printers). Three
   modes: **view**, **text** (contenteditable), and **layout** (drag to move,
   corner grip to resize, A−/A+ per-box text scale, arrow-key nudge, per-box
   and global reset). Unconfirmed/missing data always renders in red — a
   missing race result or unknown sex is a visible placeholder, never
   silently dropped.

5. **Export** — writes a self-contained HTML file (the sheet's own DOM is
   styled entirely with inline styles, so no external stylesheet is needed)
   with all edits baked in. Downloads in the browser and saves a copy under
   `data/exports/`.

6. **Cross-reference** (`GET /api/crossref`) — the actual differentiator.
   Every ancestor from every upload lives in one database, matched by
   `ringNormalised` across the whole collection (not by row id — the sire's
   and dam's pedigrees are extracted independently, so the same physical
   ancestor gets a different row each time it's uploaded). Surfaces shared
   ancestors between any two birds, line-breeding within one pedigree,
   sibling relationships across sheets, and Wright's coefficient of
   inbreeding computed from the merged tree.

7. **Batch mode** (`npm run batch -- <input-dir> [output-dir]`) — a folder of
   scans in, extraction JSON out, one Claude call per file. It only removes
   the one-at-a-time drudgery of Phase 1 — everything still needs Phase 2
   verification before it can be merged or rendered; batch mode does not
   render certificates from unverified data.

## Data model

See `shared/types.ts`. The rules that matter:

- `ring` is stored **verbatim**, exactly as printed. `ringNormalised` is a
  derived matching key, computed by `shared/ring.ts`, used only for
  cross-referencing — it never overwrites `ring`.
- `notes` and `results[].raw` keep the source wording verbatim. A non-English
  translation goes in the separate `notesEn` field, same index alignment —
  never paraphrased in place.
- `sex` is `"unknown"` unless the source states it for that specific bird.
- Every bird from every upload is stored, not just the parents — that's what
  makes cross-referencing (`shared/inbreeding.ts`, `shared/crossref.ts`)
  possible at all.

## Ring format — the one open decision (build brief §7)

Wes writes `ZA 2805 BORD 2026` (ring, then year). Kingslea's convention is
`ZA 21 BPFD 845` (year, then ring). Both are stored verbatim as extracted —
this tool doesn't rewrite anyone's ring numbers. `ringNormalised`
(`shared/ring.ts`) is order-independent (`COUNTRY-YEAR-REST`), so matching
works regardless of which convention a given loft used. Which order to
*display* a ring in on a rendered sheet is a per-sheet setting
(`ring_field_order` on `child_pedigrees`, toggle in the sheet toolbar) —
deliberately left as a setting rather than a hardcoded choice, since the
brief leaves this unresolved.

## Project layout

```
shared/              Pure logic shared by EVERYTHING (client, local server,
                      Cloudflare Worker): data model, ring normalisation,
                      Wright's coefficient of inbreeding, extraction/prose
                      prompts, cross-reference matching, and the Claude
                      vision/prose calls themselves (anthropic.ts — takes an
                      already-built client + model id, so it doesn't care
                      which backend constructed them).
server/               Local deploy target — Express + better-sqlite3
  index.ts             Express app
  db.ts                better-sqlite3 access layer (reads schema.sql)
  env.ts                .env loading — API key never leaves the server
  lib/
    anthropic.ts        Thin adapter: builds the client from .env, calls shared/anthropic.ts
    merge.ts             Phase 3 tree assembly
  routes/               /api/extract, /api/birds, /api/merge, /api/crossref, /api/pedigrees
  scripts/
    seed.ts              Seeds the 3 real pedigrees + fixtures described in the brief
    batch.ts             Folder-in, extraction-out batch mode
worker/                Cloudflare deploy target — Hono + D1 + R2
  index.ts               Worker entry (Hono app), also serves /uploads/* from R2
  db.ts                  D1 access layer (async), same schema as server/db.ts
  env.ts                 Typed bindings (DB, UPLOADS, ANTHROPIC_API_KEY)
  lib/
    anthropic.ts          Thin adapter: builds the client from the Worker secret
    merge.ts               Phase 3 tree assembly (D1 version)
  routes/                 Same route surface as server/routes, Hono-flavoured
src/
  components/
    PedigreeSheet.tsx    The render/edit component (Phase 4)
  pages/                 Upload, Verify, Merge, Sheet, Cross-reference, Home
  lib/                   API client, layout geometry, export-to-HTML
schema.sql             Canonical SQLite/D1 schema (read by server/db.ts directly;
                        copied into migrations/0001_init.sql for `wrangler d1 execute`)
migrations/             D1 migrations
wrangler.toml           Cloudflare Worker config (D1/R2 bindings, static assets)
data/                   birds.db, uploads/, exports/ — local-target only (gitignored)
```

## Hosting on Cloudflare

The local tool and the hosted one are the same app — same data model, same
extraction rules, same UI. What changes going to Cloudflare:

| | Local (`npm run dev`) | Cloudflare (`wrangler deploy`) |
|---|---|---|
| Backend | Express, a long-running Node process | Workers (Hono), one request at a time, no persistent process |
| Database | `better-sqlite3` → `data/birds.db` on disk | D1 (Cloudflare's managed SQLite) |
| Uploaded scans | Saved to `data/uploads/` on disk | Saved to an R2 bucket |
| API key | `.env` (`ANTHROPIC_API_KEY`) | a Worker secret (`wrangler secret put`) — still never reaches the browser |
| Who can reach it | only you, it's on your machine | **anyone who has the URL, unless you gate it** — see below |

**That last row is the one that matters.** There is no login built into the
app itself — the brief's local-tool design never needed one. Putting this on
a public Cloudflare URL without a gate in front of it means anyone who finds
the link can trigger paid Claude API calls on your account. The fix isn't
app code — it's **Cloudflare Access**, which sits in front of the Worker and
requires a login (yours, by email) before any request reaches it at all:

1. In the Cloudflare dashboard: **Zero Trust → Access → Applications → Add an application → Self-hosted**.
2. Point it at this Worker's route/domain (e.g. `pedigree.yourdomain.com`, same as your pricing calculator's setup).
3. Add a policy: **Allow**, action **Login**, include rule = your email address only (Cloudflare will email you a one-time code — no password to manage).
4. Save. Now the app is reachable only after you log in with that email; nobody else gets past Access to even hit `/api/*`.

This is a dashboard step, not something in this repo — there's nothing to
commit for it.

### First-time deploy

```bash
npx wrangler login                      # opens a browser to authorize wrangler

npx wrangler d1 create oudeluck-pedigree-builder
# -> copy the printed database_id into wrangler.toml's [[d1_databases]] block

npx wrangler r2 bucket create oudeluck-pedigree-uploads

npm run db:migrate:remote               # applies schema.sql to the D1 database

npx wrangler secret put ANTHROPIC_API_KEY
# -> paste your key when prompted

npm run deploy                          # builds the frontend, then wrangler deploy
```

Then set up Cloudflare Access as above. After that, `npm run deploy` is the
only command you need for future updates.

### Local Worker preview

`npm run worker:dev` runs the actual Worker code (Hono, D1, R2) against
Miniflare's local emulation — a truer preview than the plain `npm run dev`
Express server, useful for testing the Cloudflare-specific code paths before
deploying. Apply the schema to the local D1 emulation first with
`npm run db:migrate:local`. This is entirely separate from your production
data — nothing here touches the real D1 database or `data/birds.db`.

### Model note

Both deploy targets default to `claude-opus-5`. Override it per-target if
needed: locally via `PEDIGREE_EXTRACTION_MODEL`/`PEDIGREE_PROSE_MODEL` in
`.env`; on Cloudflare via the commented-out `[vars]` block in `wrangler.toml`.

## What's deliberately not here

Per the brief: no OCR/regex parser, no API key in frontend code, no
paraphrasing of source text into storage, no inferring a bird's sex from an
ancestor's V/W marker, no rendering a sheet that hasn't passed verification,
no `localStorage` for pedigree data.

## Known limitation

The original OudeLuck HTML template (crest asset, exact box styling) wasn't
available to port directly into this repo — `PedigreeSheet.tsx` rebuilds the
described layout (A4 landscape, 4-generation grid, sire/dam bands, gold +
black header, white-panel variant) from the brief's spec, with a placeholder
crest mark. Swap in the real base64 logo asset in the header block once
available; everything else (grid geometry, edit modes, export) is real and
working.
