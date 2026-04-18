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
4. **[PENDING]** Multiple administration times per day for a single **vital** row.
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
4. Multi-time vitals (same theme as task 4 above).
5. **DONE** — **Linear** PRN UX (MAR PRN Records table): columns ordered **Entry # → Date → Medication → Dosage → Reason/Indication → Time → Result → Initials → Signature** (on-screen + print; print keeps **Note** last). **Rule 1:** if **Time** is not set, **Result** is disabled with same UX as **Initials** / **Signature** prerequisites (`Set Time first`, non-clickable, muted). Further linear nudges (modal order, extra copy) remain optional.
6. **DONE** — **Prescription/start date** on PRN definitions shipped: `mar_prn_medications.start_date` (rename from `date_added`) and PRN record `start_date` support via migration **066**; MAR PRN flows read/write this field.
7. **Design change:** PRNs as **main MAR rows**, sortable like other rows.
8. **Add above/below** row insertion for PRNs like meds/vitals.
9. **Remove** separate PRN record section once integrated.
10. Auto PRN lines in Progress Notes (**done** — signed PRNs only; see §5 #6).
11. **INCOMPLETE** — **MAR view filters (chips):** **All** / **Routine meds** / **Vitals** shipped on MAR detail (`marTableViewFilter`; PRN Records section always visible). Still needed: **PRNs only** (or equivalent) filter — **intentionally not built yet**; owner will explain rationale before implementation.
12. **PRN refused** → document in Progress Notes, not as med admin.
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
- Live homepage incidents: **§3** tracker + **§4** line-by-line actions. Product work: **§5** (ordered 1–8 + extended backlog). Dev observations: **§6**. Partner checklist: **§6a** (2026-04-18).

