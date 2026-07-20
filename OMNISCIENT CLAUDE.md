# Operating Guide — Projects & LLM Agents

This is the go-forward operational guide for **every project in this tree and any LLM agent
working in it** (new projects included). It synthesizes three things that proved out in
practice:

1. The **persistent-knowledge pattern** — Karpathy's LLM-wiki idea expressed in the Open
   Knowledge Format (OKF): treat knowledge as a durable, compounding, interlinked markdown
   artifact, not something re-derived each session.
2. The **memory-system lessons** from three internal systems — AppleHermesAgent, Mémoire,
   and Second Brain — on how an agent should capture, retrieve, and reconcile knowledge.
3. The **engineering conventions** shared across the seven Content & Partner Operations
   dashboards (3-Strikes, Reporter Checks, Scorecard Methodology, Scorecard One Sheets,
   Scorecard QC, Trinity, Warnings-Delays).

Read it before acting. When a project has its own `CLAUDE.md`, that file wins on specifics;
this guide governs everything it doesn't say.

---

## 1. How to work (agent behavior)

- **Act decisively; don't stall.** When you have enough to proceed, proceed. Don't narrate
  options you won't take or re-litigate settled decisions. State your assumption and move.
- **Plan big, verify at the end.** For multi-step work, sketch the steps, execute, then
  *verify* against reality (open the file, run the build, check the number) before declaring
  done.
- **Report faithfully.** If a build fails, say so with the output. If a step was skipped,
  say that. State "done and verified" only when it is.
- **Autonomous execution is expected** on established projects — don't pause for confirmation
  on routine work. Confirm only for irreversible or outward-facing actions (deploys to a
  shared URL, deletes, sending mail, publishing).
- **Delegate breadth.** When a task means reading across many files, fan out subagents and
  keep the conclusions, not the file dumps.

## 2. Knowledge is a durable artifact (the second-brain model)

Every project accumulates hard-won knowledge (formulas, gotchas, data lineage, deploy
quirks). Treat it as a **persistent, compounding artifact**, not tribal memory.

- **Capture as you go.** When you learn something non-obvious — a data-identity rule, a
  Tableau filter quirk, a credential path, a formula weight — write it down *now*, in the
  project's `CLAUDE.md` or a focused doc. The bookkeeping humans abandon is exactly what the
  agent should do.
- **What's worth capturing** (from Mémoire's memory types): **decisions** (why an approach
  was chosen), **preferences** (how the user wants things done), **failures** (what broke and
  why), **insights** (non-obvious discoveries), **procedures** (repeatable recipes).
- **One concept per file; keep pages focused.** Split a large doc into small topic pages
  (overview, data pipeline, one feature each, deploy). Big monoliths rot; small pages get
  maintained.
- **Retrieve before you answer.** Search existing docs/`CLAUDE.md`s *first*; don't
  re-derive what's already written. Don't invent a fact to fill a gap — an honest "not
  documented yet" plus a note to capture it is the correct output.
- **Date and cite claims.** Note when a fact was true and what source it came from. Numbers
  drift monthly; a stale figure with no date is a landmine.
- **Never silently overwrite a durable fact.** If new information contradicts an established
  decision or a manually-curated value, *surface the conflict* for a human decision rather
  than quietly replacing it. (Mémoire freezes "precious" memories until a human resolves
  them; do the same in spirit.)
- **Provenance over volume.** A cited, verified claim beats three plausible ones.

## 3. OKF conformance (when producing a knowledge bundle)

If you build or extend a knowledge bundle (see the `knowledge-okf` pattern):

- Every non-reserved `.md` starts with YAML frontmatter carrying a non-empty `type`
  (`Concept`, `Source`, `Playbook`, `Schema`). Recommended keys: `title`, `description`,
  `resource`, `tags`, `timestamp`.
- `index.md` and `log.md` are **reserved** (no frontmatter, except the root `index.md` may
  declare `okf_version`). `log.md` is date-grouped, newest first (`## YYYY-MM-DD`).
- Cross-link with **absolute, bundle-relative** paths beginning with `/`.
- Tolerate imperfect input — unknown types, extra keys, broken links must not make you reject
  a bundle. Fix what you can; flag the rest.
- **Never copy large binaries** (xlsx, PDFs, multi-GB CSVs, model weights) into a bundle —
  reference them by path/URL.

## 4. Engineering conventions (the seven projects, and new ones)

### Deliverable shape
- **Single self-contained HTML** for dashboards — no CDN, no bundler, no JS framework. Data
  is embedded inline. The only acceptable external `<script>`s are export/render libs where
  genuinely needed: Chart.js (charts), SheetJS `xlsx` (Excel export), `html-to-image` +
  `html2canvas` fallback (PNG export).
- **Generator, not hand-edits.** Never hand-edit a generated `dist/index.html`. Change the
  build script's template/CSS/JS blocks or its data structures and regenerate. The generated
  file is an artifact; the script is the source of truth.
- **Token-driven CSS.** Every spacing, type, motion, shadow, and color value resolves to a
  `:root` variable. Refactors edit tokens, not rules. Light/dark via `[data-theme]`,
  persisted to `localStorage`; set `color-scheme` so native controls match.
- **Idempotent Python builds.** Use `openpyxl` (read-only where possible); run with
  `/opt/homebrew/bin/python3`. Re-running a build overwrites cleanly. Prefer append-only,
  dry-run-by-default data pipelines (`--write` to commit); refuse to double-append a month.

### Data
- **Join on the stable ID, never on names.** Provider identity collapses to **Content
  Provider ID (CP-ID)**. Never reintroduce a hand-maintained name→alias lookup — it silently
  drops or double-counts providers.
- **Reason codes & scorecard formulas are canonical.** When composite scores are involved,
  use the documented blends (Operations = 0.4 Quality + 0.4 Adoption + 0.2 Ticket Response;
  Quality = 0.8 Music + 0.2 Music Video − P0 hide deductions, with the no-MV special case;
  Adoption on the WW storefront). Don't guess weights — cite the BRD / methodology doc.

### Design system
- Apple product-marketing visual language: pure-black surfaces (four elevations), SF Pro,
  full-chroma Apple system colors as **pillar tints** (quality `#FF9F0A`, adoption `#30D158`,
  ticket `#5E5CE6`, methodology/rose `#FF375F`, teal `#64D2FF`, strike `#FF453A`, accent
  `#0A84FF`), gradient hero phrase, tri-color ambient glow, frosted-glass sticky nav, 8pt
  spacing grid, Apple spring easing, `prefers-reduced-motion` honored.
- **Per-tab exports**: Excel (SheetJS) + PNG (html-to-image), filter-aware, filename-stamped
  `<Name>-<context>-<YYYY-MM-DD>`.

### Deploy & ops
- **Multidev hosting.** `multidev.yml` slug is the source of truth for the URL — and slugs
  may not match folder names (e.g. `scorecardqcgenerator`). Deploy `multidev deploy ./dist`
  (or the project's `dir/`). First deploy registers the project *before* the Settings →
  Deploy Key page exists; do it in that order.
- **Runbooks.** Monthly/quarterly projects ship a workflow runbook (HTML + PDF). Follow it:
  roll folders → build extracts → generate → splice → verify → deploy. Verify with a concrete
  check (e.g. the ≥5% KPI equals the count newly escalated).

### Known gotchas (don't rediscover these)
- **Tableau MCP:** use the official `@tableau/mcp-server` (PAT); `get-view-data` is
  double-JSON-encoded (`json.loads` once); dashboards need a `Report_Month` filter
  (`YYYY-MM-01`, not US `M/D/YYYY`); `get-datasource-metadata` is 403 for the PAT.
- **Quip MCP:** personal Bearer token in the MCP env (from `quip-apple.com/dev/token`); 401 =
  token unset/expired. Not browser SSO.
- **Chrome-headless PDF:** headless writes the PDF then lingers and never exits cleanly on
  macOS. Launch in background with a throwaway `--user-data-dir`, poll until the PDF stops
  growing, then kill the straggler. `timeout` is not installed here.

## 5. Security & credentials (non-negotiable)

- **Never hardcode a secret** (AccessToken, deploy key, Bearer token, API key) into any
  tracked file, log, comment, or doc. The canonical secret file is the single source of
  truth; read it at runtime and pass values inline, redacting to `***` in printed output.
- **Describe credential handling abstractly** in docs — never reproduce values.
- **Model calls go through Floodgate**, not third-party API keys: `appleconnect`
  OAuth (Hermes) or the `apple-genai` SDK (Mémoire). No keys in `.env`. Trust the Apple
  Corporate CA for the SSL-inspection proxy.
- **Store credential files `chmod 600`** (or Keychain); never in env vars committed anywhere.
- Model output/logs must be scrubbed of tokens before persistence.

## 6. Definition of done

- [ ] Change made in the **source** (generator/data/tokens), not the generated artifact.
- [ ] Build re-run; output **verified** (opened / numbers reconcile / KPI checks out).
- [ ] No secrets introduced; credential handling stayed abstract.
- [ ] Non-obvious learnings **captured** in the project `CLAUDE.md` or a focused doc, dated
      and cited.
- [ ] Runbook / URL table / layout notes updated if structure changed.
- [ ] Deploy only when asked or clearly authorized; report the result plainly.

---

*Why this exists:* an agent that rebuilds context from scratch every session wastes the
user's time and repeats old mistakes. Capturing knowledge as a durable, cited, focused
artifact — and following the conventions above — makes each session compound on the last.
That is the whole point of a second brain.
