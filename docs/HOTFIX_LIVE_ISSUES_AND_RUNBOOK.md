# Hotfix Runbook + Live Issue Tracker

Use this document to stabilize production **before** resuming e-commerce work.

---

## 1) Operating Rules (Hotfix Mode)

- Freeze feature work (billing/e-commerce branch is already backed up on GitHub).
- Only patch production-critical defects.
- Keep hotfix scope minimal to reduce regression risk.
- Every fix must map to a specific incident in the issue tracker below.

---

## 2) Branch Workflow

1. Checkout and update `main`.
2. Create a dedicated hotfix branch from current main.
3. Fix only live issues.
4. Open PR to `main` with explicit test evidence.
5. Deploy hotfix.
6. Merge/rebase billing branch **after** hotfix is stable.

Suggested branch name:
- `hotfix/live-stability`

---

## 3) Live Issue Tracker

> Status values: `new`, `triaging`, `reproduced`, `fixing`, `qa`, `deployed`, `monitoring`, `closed`

| ID | Status | Severity | Route/Page | Error/Behavior | Affected users | First seen | Owner | Notes |
|---|---|---|---|---|---|---|---|---|
| LIVE-001 | new | critical | TODO | TODO | TODO | TODO | TODO | Collect exact production route + stack trace |
| LIVE-002 | new | high | TODO | TODO | TODO | TODO | TODO | Add only if confirmed in live |
| LIVE-003 | new | medium | TODO | TODO | TODO | TODO | TODO | Add only if confirmed in live |
| LIVE-004 | closed | high | `/` (homepage) | Editorial placeholder copy is visible (`Remove:` / `Replace with:` instructions shown to users). | All homepage visitors | 2026-03-19 | TODO | Closed after manual production verification (private window + hard refresh): no visible `Remove:`/`Replace with:` strings. |
| LIVE-005 | closed | high | `/` (homepage) | Unfinished placeholder text visible (`Need a sentence here`). | All homepage visitors | 2026-03-19 | TODO | Closed after manual production verification: placeholder text no longer visible on homepage. |
| LIVE-006 | closed | high | `/` (homepage) | Draft/internal content exposed (raw replacement bullets and headings like `replace existing quote with:`). | All homepage visitors | 2026-03-19 | TODO | Closed after manual production verification: draft helper/instruction copy not present on homepage. |

---

## 4) Homepage Screenshot Actions (Line-by-Line)

Only the homepage (`/`) items shown in screenshots are listed here.

### Screenshot A (`6.03.13 PM`) — exact actions

1. **Remove this visible instruction line:**  
   `Remove: Your electronic health record for care. Progress notes, vital signs, and medication documentation in one place—so your team stays compliant and your record stays complete.`
2. **Keep only one approved replacement sentence** (do not show both options):  
   - Option currently shown #1: `Lasso: Capture and secure: Electronic health records made simple for tracking the people we care for`  
   - Option currently shown #2: `Capture and secure: Electronic health records built to easily track and care for those who matter`
3. **Delete the standalone word:** `Or`
4. **Remove this visible instruction line:**  
   `Remove: The old way is broken and text beneath it`
5. **Replace with final heading copy:** `Paper records`
6. **Keep list items but ensure they are final text (no draft markers):**
   - `Documentation errors`
   - `Hard to read`
   - `Missing information`
7. **Keep/confirm this explanatory sentence as final approved copy:**  
   `Because of these issues, many healthcare organizations move to electronic health record systems to improve accuracy, accessibility, and efficiency.`
8. **Remove this visible instruction line:**  
   `Remove: Lasso keeps your team in control and text beneath it`
9. **Replace with final heading copy:** `Lasso`
10. **Keep list items but ensure they are final text (no draft markers):**
    - `Supports accountability and clear tracking`
    - `Simplifies audits and compliance`
    - `Streamlines storage and organization`
    - `Designed for ease of use`
11. **Replace/remove placeholder line:** `Need a sentence here`  
    (must be replaced with final approved sentence; placeholder cannot remain)

### Screenshot B (`6.04.45 PM`) — exact actions

1. **Remove this visible instruction line:**  
   `Remove: Everything you need to deliver safer care - One electronic health record—progress notes, vital signs, and medication administration.`
2. **Replace with final approved headline:**  
   `All your records. One secure place`
3. **Remove this visible instruction line:**  
   `Remove: Progress notes and vitals, Digital MAR, Audit ready`
4. **Remove this visible instruction line:**  
   `Replace with:`
5. **Finalize and standardize section headings (no draft style):**
   - `Digital MAR`
   - `Electronic documentation`
   - `Audit-ready`
   - `Vital signs, progress notes, and care plans`
6. **Keep bullet lists only if these are final approved bullets**; otherwise replace with approved copy.
7. **Normalize heading punctuation/casing** for consistency (e.g., `Audit-ready` style used consistently).

### Screenshot C (`6.05.03 PM`) — exact actions

1. **Remove this visible instruction line:**  
   `replace existing quote with:`
2. **Show only finalized quote block text:**
   - Quote: `“With LASSO, our documentation time is way down, and our records are always survey-ready.”`
   - Attribution: `— Priya S., Director of Nursing`
3. **Ensure no instructional label or draft helper text appears above/below the quote.**

### Final acceptance for these screenshot items

- No `Remove:` text is visible on homepage.
- No `Replace with:` text is visible on homepage.
- No `Or` draft alternative line remains.
- No `Need a sentence here` placeholder remains.
- No `replace existing quote with:` instruction remains.
- Homepage displays only finalized production copy.

---

## 5) Product / Development Tasks (Ordered)

Follow these in order. Do not start the next item until the current item is confirmed complete.

1. **[DONE]** Restore patient data editing (names/spelling) from dashboard; sync to MAR where applicable.
2. **[DONE]** Show patient identity prominently on MAR (sticky bar; also **Progress Notes**).
3. **[DONE]** Medication / MAR calendar dates and “today” defaults: fixed client-side **UTC-midnight** parsing of `YYYY-MM-DD` and **UTC `toISOString()` “today”** (`lib/calendarDate`, MAR grid active-day logic, PRN add paths, DOB display/age). Re-open only if a new repro appears on live after deploy.
4. **[DONE]** Multiple administration times per day for a single **vital** row.
5. **[DONE]** PRN library + PRN records selection workflow (not free-typing every row).
6. **[DONE]** PRN activity feeds **Progress Notes** (signed PRNs only): linked `progress_note_entries` row, sync on save/update; migrations **064**/**065** for column + backfill; PRN **date** constrained to MAR month.
7. **[DONE]** Stepwise PRN completion guidance (time → result → initials → sign).
8. **[DONE]** Rename “Repair Order” → clearer label (**Repair Table View**); button later **removed** once DnD parent-row reorder shipped (extended #14).

---

### Extended backlog — MAR / Progress Notes / PRN (14 items, 2026-03-29)

Additional items from team notes. **Not** sequenced with §5 items 1–8 above; prioritize as agreed.

1. **DONE** — Standardize **Progress Notes** labels: tab buttons **Notes & Addendum** / **Monthly Summary** (no “Page 1/2”); Monthly Summary screen/print title **MONTHLY SUMMARY**. Shared **PatientStickyBar**: **Name**, **DOB**, **Sex** labels (same accent as Record No.).
2. **DONE** — Physician/APRN or Clinic: **+ Add** / **Add New** pattern; column + print use `physician_name` per note; **Existing notes** section has its own header row (Date / Physician/APRN or Clinic / Notes / Signature); TBD shows blank; debounced patient sync uses empty string (NOT NULL). PRN → Progress Notes: new sync omits **Initials** / **Documentation** lines (signature column is enough); UI strips legacy tail for `source_mar_prn_record_id` rows.
3. **DONE** — MAR / calendar **date display and grid logic** aligned with §5 #3 fix (`parseLocalDateFromYMD` / `localTodayYMD` / `formatCalendarDate`). Optional: second tester in US timezones post-deploy.
4. **DONE** — Multi-time vitals (same theme as §5 #4).
5. **DONE** — **Linear** PRN UX (MAR PRN Records table): columns ordered **Entry # → Date → Medication → Dosage → Reason/Indication → Time → Result → Initials → Signature** (on-screen + print; print keeps **Note** last). **Rule 1:** if **Time** is not set, **Result** is disabled with same UX as **Initials** / **Signature** prerequisites (`Set Time first`, non-clickable, muted). Further linear nudges (modal order, extra copy) remain optional.
6. **DONE** — **Prescription/start date** on PRN definitions shipped: `mar_prn_medications.start_date` (rename from `date_added`) and PRN record `start_date` support via migration **066**; MAR PRN flows read/write this field.
7. **DONE** — PRNs as **main MAR rows**, sortable like other rows.
8. **DONE** — **Add above/below** row insertion for PRNs like meds/vitals.
9. **DONE** — **Remove** separate PRN record section once integrated (retired from MAR UI in favor of main-row PRN workflow).
10. Auto PRN lines in Progress Notes (**done** — signed PRNs only; see §5 #6).
11. **DONE** — **MAR view filters (chips):** **All** / **Routine meds** / **Vitals** / **PRNs only** (or equivalent) on MAR detail (`marTableViewFilter`); behavior matches product sign-off.
12. **DONE** — **PRN refused** → document in Progress Notes, not as med admin.
13. **DONE** — How PRN auto-entries **sort vs. the full note timeline** was settled during **signed PRN → Progress Notes** sync work (§5 #6; `progress_note_entries` / `source_mar_prn_record_id`). No separate “decide” task remains.
14. **DONE** — **MAR row reorder (DnD):** Only the **first `<tr>` of each medication group** is sortable; extra administration-time rows are plain `<tr>`s so drops occur **between whole groups**, not inside multi-time stacks. **`handleDragEnd`** inserts **before** or **after** the full target group (`targetGroupMeds.length`). Shared **`getMarMedicationGroupKey`**. Drop indicator + `DragOverlay` for multi-time groups. **Repair Table View** UI button removed (2026-03-29); group reorder + persisted `display_order` replace that workflow.

---

### New backlog intake — Patient Binder & MAR review (2026-04-09)

Captured from product review notes/screenshots; default status is **TODO** unless noted otherwise.

#### Admissions Form

1. **DONE** — Default admission date to today (auto-fill current date, allow editing to prior date).
2. **DONE** — Consolidate name fields: first/middle/last on one row; reduce widths for DOB/age/sex fields.
3. **DONE** — Completion feedback in form flow clarified and implemented as inline field-level confirmation cues (green checks), including admissions and edit modals.
4. **DONE** — Add real-time validation/completion cues (green checkmarks while typing) with stricter thresholds; in edit modals checks appear only for fields the user actually edits.
5. **DONE** — Add phone number formatting/placeholders on phone number fields and MAR inputs.
6. **TODO** — Add diagnosis autocomplete (combo box with curated suggestions).

#### MAR (Medication Administration Record)

1. **DONE** — Sticky allergy header: move allergies to top of MAR and keep visible while scrolling.
2. **DONE** — Highlight today's date in the 31-day medication grid.
3. **TODO (spike/prototype)** — Medication-allergy conflict pop-up; evaluate AI vs internal rules/database check (include reliability/cost assessment).
4. **TODO** — Alerts for missed dates with jump-to-entry + edit flow.

#### Technical / Bug Fixes

1. **DONE (critical)** — Fix submit-button collision bug (prevent duplicate submissions from multiple clicks during server lag).
2. **DONE** — Add loading state (disable inputs + show progress indicator during save) to prevent duplicate records.
3. **PARTIAL** — Add debounce + input masking to reduce duplicate patient profiles (debounced duplicate warning implemented in admissions; placeholders/check thresholds in shared patient form. Full centralized masking + cross-flow duplicate strategy still open).

#### Navigation & UI Polish

1. **DONE** — Grey out inactive modules/features not yet active.
2. **TODO** — Refine multi-form print view for cleaner audit printing.
3. **TODO** — Add quick status/table view for per-patient activity status (e.g., active, draft).
4. **TODO** — Add hover legend showing code meanings.
5. **TODO** — PRN UI clarity: clarify that recent doses are shown, not a required "doses per day" count.

#### Testing & QA

1. **DONE (confirmed in admissions/edit flow)** — Tab order and keyboard navigation QA across all forms.

---

### MAR & Patient Binder — team intake (2026-05-12)

Merged from external `MAR_To-Do_List.md` (MAR + Patient Binder UX, Apr 22 / May 6, 2026). **Target rollout:** June 6, 2026. Items below were **not** already tracked above (skipped: multi-form print refinement → **Navigation & UI Polish #2**; hover legend → **#4**; MAR search scope question only partially overlaps shipped MAR search; PRN → Progress Notes / initials path → **§6a**; monthly MAR duplication build → **§6a**; field validation hard-stop → **§6a Critical**; phone masking → admissions **DONE**).

#### Critical / pre-launch

1. **TODO** — **Printed MAR must not include Progress Notes body**; notes print via their own flow (separate from “refine multi-form print view”).
2. **TODO** — **Read-only inspection mode:** verify **all** command actions are hidden (delete, add, plus notes, etc.) before launch.
3. **TODO** — **Finalize user-role definitions** before rollout (who can do what across binder / MAR / notes).

#### Rollout / operations (non-code)

1. **TODO** — Schedule and run follow-up meeting (per May 6 plan) to verify finalized launch items.
2. **TODO** — Communicate June 6 rollout timeline to the team.

#### Data validation & account UX

1. **PARTIAL (2026-05-13)** — Strengthen validation for **email, state, and address** (invalid values currently accepted); complements §6a “hard-stop” / required-field work. **Done:** Add/Edit Patient now validates required **Home Phone** (10 digits, numeric/phone-format input only), required **Email** format, and optional **Physician Phone** (10 digits if entered, numeric/phone-format input only) with inline field messages and clickable error chips. Edit Patient modal workflow is now shared via `components/EditPatientInfoModal.tsx` across Dashboard, MAR, and Progress Notes. **Still open:** state/address validation rules.
2. **DONE (2026-05-13)** — **Forgot password** entry point below the read-only mode password prompt; links to existing `/auth/forgot-password` reset flow from the Exit Read-Only modal.
3. **TODO** — **Physician selection:** enforce required patient/context fields **before** physician entry is allowed (selection-order bug).

#### MAR layout & UI

1. **DONE (2026-05-12)** — **MAR grid:** show **~3 days of columns** at a time (wider day cells via `MAR_DAY_COL_WIDTH_PX` on MAR detail); **31** day columns unchanged; print layout unchanged.
2. **TODO** — **On-screen** small **color key** for MAR status colors (persistent key, not only hover); see also Navigation & UI Polish #4 for hover legend.
3. **TODO** — **ADA-compliant contrast** and branding fixes from automated UX test findings.
4. **PARTIAL (2026-05-13)** — **In-page patient edit (modal/pop-up):** shared `EditPatientInfoModal` now supports chip-driven step switching, scroll/focus, and temporary red field highlight for validation errors across Dashboard, MAR, and Progress Notes. **Still open:** product-specific auto-advance-to-step-2 edit affordance for non-error edit entry points.
5. **DONE (2026-05-13)** — Show **validation errors adjacent to inputs** (avoid scrolling to discover errors); top error summary uses clickable chips that scroll/focus/highlight the field.

#### PRN & MAR legend

1. **TODO** — Rename PRN control label to **Manage PRN** (or equivalent final copy).
2. **TODO** — **Simplify MAR legend** to agreed defaults (**DC**, **W** Withheld, **R** Refused); rename **Held → Withheld**; **require notes** for Withheld and Refused; remove erroneous **Not Given** legend entry if present.
3. **TODO** — **Refused** flows: ensure Progress Notes show an explicit **Refused** label (not only unstructured note text) where product expects it.
4. **TODO** — **PRN list** reflects add/edit/delete **in real time** without stale UI.
5. **TODO** — **PRN default time = 12:00** (still editable via time control); confirm with caregivers.
6. **TODO (product)** — Caregiver-facing **PRN/legend wording** pass (owner: finalize labels and removals/consolidations).

#### Past-month MARs & duplication (policy + build)

1. **TODO** — **Re-enable editing** of **prior months’** MARs (if currently restricted by policy/UX).
2. **TODO** — **Warn on past-month edits:** edits to historical months **do not** auto-populate future months.
3. **TODO** — **Back-dated documentation:** for applicable entries, Progress Notes record **date only** (no time), with **PRNs** as the agreed exception.
4. **TODO** — **Pre-duplication hygiene:** clean up misdocumented rows before copying a month.
5. **TODO** — **Define monthly MAR duplication rules** (what carries: PRNs, layout, legend, etc.) — pairs with §6a **MAR duplication** feature.

#### Deleted records / retention

1. **TODO** — **Configurable purge** for deleted patients (e.g. proposed **7-year** retention); legal/compliance sign-off.
2. **TODO** — **Search + sort** for deleted patients (parity with active list patterns).
3. **TODO** — **Strict delete/retention checks** for **custom legend** data before allowing deletion.

#### Testing & QA (team checklist)

1. **TODO** — Repro **missing-note** bug: medication with **3 administration times** × **NG / DC / H / R** dropdowns (document findings).
2. **TODO** — After **3-day column** change: re-check dropdown behavior and note overflow.
3. **TODO** — Standing: **2–3 hours/week** hands-on across meds / PRN / vitals; paired **break-test** of med + PRN flows; **consolidated bug/usability list** on a fixed cadence.
4. **NOTE** — Team doc excluded **print** and **duplicate-the-mark** from a short cycle; print remains in Navigation #2 + Critical above; duplication in §6a + Past-month section.

#### Open questions (product)

1. Should **status pop-ups** apply to **all** initials cells or **PRN-only**?
2. Should MAR support **one day per printed page** for readability?
3. Is **12:00 PRN default** acceptable to all caregivers?
4. Should **MAR search** include **vitals** or stay **medications-focused**?

---

## 6) Known/Observed Errors From Current Session (Reference)

These are from recent local/dev observations and prior troubleshooting. Treat as reference until confirmed on live.

### REF-001 (Previously fixed in local branch)
- **Area:** Progress Notes view (`/patients/[id]/progress-notes/view`)
- **Symptom:** Build parser error around `ProtectedRoute` / JSX parse (`Expected jsx identifier` and `Head has no closing tag`).
- **Impact:** Page compile failure.
- **State:** Reported fixed previously in working branch.

### REF-002 (Previously fixed in local branch)
- **Area:** Progress Notes view
- **Symptom:** Runtime error `Rendered more hooks than during the previous render`.
- **Likely cause:** `useEffect` placement after conditional returns.
- **Impact:** Page crash at runtime.
- **State:** Reported fixed previously in working branch.

### REF-003 (Seen in terminal logs)
- **Area:** Progress Notes view
- **Symptom:** `MODULE_NOT_FOUND` in compiled `.next/server/pages/patients/[id]/progress-notes/view.js` with 500 response on progress-notes route.
- **Impact:** Route returns 500.
- **State:** Needs confirmation against current `main` and live.
- **Evidence:** Recent terminal output showed 500 for `/patients/.../progress-notes/view?...` then subsequent recompiles succeeded after restart.

### REF-004 (Non-blocking warning)
- **Area:** Dev startup
- **Symptom:** `baseline-browser-mapping` data is over two months old.
- **Impact:** Warning only (not a live blocker).
- **State:** Optional maintenance task.

### REF-005 (Homepage content exposure from screenshots)
- **Area:** Homepage (`/`)
- **Symptom:** Internal editorial notes and draft instructions are publicly rendered (examples: `Remove:`, `Replace with:`, `Need a sentence here`, `replace existing quote with:`).
- **Impact:** Public-facing copy quality issue; exposes internal drafting notes to end users.
- **State:** Add to live hotfix scope and prioritize after any route-blocking production failures.
- **Evidence summary:**
  - Screenshot A: replacement instructions + unfinished sentence marker.
  - Screenshot B: raw draft blocks and unpolished section labels visible.
  - Screenshot C: quote replacement instruction shown directly on page.

---

## 6a) Lasso product & release checklist (intake 2026-04-18)

Sourced from partner notes / screenshots. Track here alongside §5 unless an item is duplicated—then keep one canonical row and cross-link.

### Critical bugs — fix first

- [ ] **Validation bypass:** Forms must **hard-stop** submit when required fields are incomplete (e.g. phone number missing a digit); no silent acceptance.
- [ ] **Pop-up layering (MAR):** Modals/dropdowns must always render **above** sticky bars and chart chrome (z-index / stacking contexts).
- [x] **Progress Notes date bug:** Notes saving or displaying the **wrong calendar day** (e.g. 4/13 → 4/12); audit default date handling and timezone. **Addressed in code** with same `lib/calendarDate` approach as MAR (local `YYYY-MM-DD` parsing + local “today” for defaults); reopen if live repro after deploy.

### Pre-release cleanup (before going public)

- [ ] **Remove temporary “original PRN records” table** used only for migration checking.
- [x] **Remove PRN from routine-meds dropdown** (cleanup missed earlier).
- [x] **Edit Patient Details** → **Patient Details** (sticky bar link; `PatientStickyBar` default + MAR + Progress Notes).
- [ ] **Relabel ambiguous fields — remaining:** Vitals **Notes** → **Parameter** or **Vital Name**; confirm **Substitute** vs **Secondary** caregiver wording everywhere.

### New features to build

- [ ] **PRN → Progress Notes:** Auto-log / sync when a PRN entry is completed (initials path). **Note:** Signed PRN → `progress_note_entries` work is tracked in §5 #6; this item covers any **remaining** gaps vs “initials = log” expectation.
- [ ] **MAR duplication (exact-value copy):** Copy a finalized MAR into the next month with all values preserved.
- [x] **MAR search:** Find medications in long MAR lists without scrolling. **Shipped** on MAR detail (`pages/patients/[id]/mar/[marId].tsx`): medication search (routine + PRN chart rows), autocomplete suggestions from existing names, **Show** chips still apply; Vitals auto-off while search active (see product notes in session).
- [ ] **UX design pass:** Engage UX for layout and labeling polish.

### Compliance & distribution

- [ ] **HIPAA review** if Lasso moves to **mobile / App Store** distribution (beyond browser).

### Fides follow-ups

- [ ] **Re-test on a laptop (not a phone)** — app not mobile-optimized yet; capture the exact inputs that failed and the failure mode.
- [ ] **Add her medication entries** to patient records and continue end-to-end testing.

### Open questions (captured answers — reopen if product changes)

1. **Downloadable app vs browser link?** — *Current:* browser-based web app; a wrapped mobile build is possible but triggers HIPAA review (see **Compliance** above).
2. **Will the MAR be very long for some patients?** — *Yes* — drives **MAR search**.
3. **Open a new April MAR without duplicating March — retype everything?** — *For now, yes* until **MAR duplication** ships and forms are finalized/approved.

### Confirmed design decisions (reference — no task unless regressed)

- Lasso remains a **browser-based web app** (Gmail / QuickBooks Online–style positioning).
- **No** automatic alphabetize on MAR; users reorder via drag handle; default order chronological by start date/hour.
- **No** visible late-entry timestamps on MAR (inspection-friendly posture).
- **Read-only inspection mode** is in place and requires a **password** to exit.
- **Monthly progress notes:** weight change vs previous month’s weight (green = gain, negative = loss).

---

## 7) Triage Checklist (Per Live Issue)

For each live incident, capture:

- Route:
- Exact error text/message:
- Browser console screenshot/log:
- Network response payload/status:
- User role/facility affected:
- Frequency (always/intermittent):
- Started after which deploy/version:

Then classify:

- **P0 critical:** blocks core workflow (log in, patient access, MAR, Progress Notes)
- **P1 high:** major function degraded but workaround exists
- **P2 medium:** non-critical defect

---

## 8) Reproduction & Fix Workflow

1. Reproduce on hotfix branch.
2. Add a short “before” note under issue row.
3. Implement smallest safe patch.
4. Validate locally:
   - route load
   - role/facility access paths
   - relevant save/print actions
5. Add “after” note + evidence (screenshots/log lines).
6. Mark issue `qa`, then `deployed`, then `closed` after monitoring.

---

## 9) Regression Checklist (Minimum)

Run after all hotfixes:

- Login/logout works
- Dashboard loads
- Patient binder opens
- MAR list and MAR detail open
- Progress Notes list and view open
- Print flows still work (where applicable)
- No new console/server errors on affected routes

---

## 10) Deployment + Monitoring

After deploy:

- Monitor error logs for 30–60 minutes
- Confirm previously failing routes return 200
- Spot-check with at least one facility account
- Update issue statuses to `monitoring` then `closed`

---

## 11) Resume Billing Work (After Stabilization)

Only after all P0/P1 live issues are closed:

1. Switch back to billing branch.
2. Rebase/merge latest `main` hotfix changes.
3. Re-test billing pages.
4. Continue Stripe integration work.

---

## 12) Session Notes

- Billing/e-commerce work is intentionally paused until live stability is restored.
- Live homepage incidents: **§3** tracker + **§4** line-by-line actions. Product work: **§5** (ordered 1–8 + extended backlog + **MAR & Patient Binder — team intake 2026-05-12**). Dev observations: **§6**. Partner checklist: **§6a** (2026-04-18).

