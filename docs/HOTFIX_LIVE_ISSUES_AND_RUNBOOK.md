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
| LIVE-004 | new | high | `/` (homepage) | Editorial placeholder copy is visible (`Remove:` / `Replace with:` instructions shown to users). | All homepage visitors | 2026-03-19 | TODO | Source: screenshot evidence provided by team |
| LIVE-005 | new | high | `/` (homepage) | Unfinished placeholder text visible (`Need a sentence here`). | All homepage visitors | 2026-03-19 | TODO | Content not production-ready |
| LIVE-006 | new | high | `/` (homepage) | Draft/internal content exposed (raw replacement bullets and headings like `replace existing quote with:`). | All homepage visitors | 2026-03-19 | TODO | Includes quote replacement note with attribution draft |

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
3. **[PENDING / MONITORING]** Medication date saves one day early — watch for repro.
4. **[PENDING]** Multiple administration times per day for a single **vital** row.
5. **[DONE]** PRN library + PRN records selection workflow (not free-typing every row).
6. **[DONE]** PRN activity feeds **Progress Notes** (signed PRNs only): linked `progress_note_entries` row, sync on save/update; migrations **064**/**065** for column + backfill; PRN **date** constrained to MAR month.
7. **[DONE]** Stepwise PRN completion guidance (time → result → initials → sign).
8. **[DONE]** Rename “Repair Order” → clearer label (e.g. **Repair Table View**).

---

### Extended backlog — MAR / Progress Notes / PRN (13 items, 2026-03-29)

Additional items from team notes. **Not** sequenced with §5 items 1–8 above; prioritize as agreed.

1. **DONE** — Standardize **Progress Notes** labels: tab buttons **Notes & Addendum** / **Monthly Summary** (no “Page 1/2”); Monthly Summary screen/print title **MONTHLY SUMMARY**. Shared **PatientStickyBar**: **Name**, **DOB**, **Sex** labels (same accent as Record No.).
2. **DONE** — Physician/APRN or Clinic: **+ Add** / **Add New** pattern; column + print use `physician_name` per note; **Existing notes** section has its own header row (Date / Physician/APRN or Clinic / Notes / Signature); TBD shows blank; debounced patient sync uses empty string (NOT NULL). PRN → Progress Notes: new sync omits **Initials** / **Documentation** lines (signature column is enough); UI strips legacy tail for `source_mar_prn_record_id` rows.
3. Re-test MAR date-edit bug + cache hypothesis; second tester.
4. Multi-time vitals (same theme as task 4 above).
5. **DONE** — **Linear** PRN UX (MAR PRN Records table): columns ordered **Entry # → Date → Medication → Dosage → Reason/Indication → Time → Result → Initials → Signature** (on-screen + print; print keeps **Note** last). **Rule 1:** if **Time** is not set, **Result** is disabled with same UX as **Initials** / **Signature** prerequisites (`Set Time first`, non-clickable, muted). Further linear nudges (modal order, extra copy) remain optional.
6. **Prescription/start date** on PRN definitions.
7. **Design change:** PRNs as **main MAR rows**, sortable like other rows.
8. **Add above/below** row insertion for PRNs like meds/vitals.
9. **Remove** separate PRN record section once integrated.
10. Auto PRN lines in Progress Notes (**done** — signed PRNs only; see §5 #6).
11. **INCOMPLETE** — **MAR view filters (chips):** **All** / **Routine meds** / **Vitals** shipped on MAR detail (`marTableViewFilter`; PRN Records section always visible). Still needed: **PRNs only** (or equivalent) filter — **intentionally not built yet**; owner will explain rationale before implementation.
12. **PRN refused** → document in Progress Notes, not as med admin.
13. **Decide** how PRN auto-entries sort vs. full note timeline.

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
- Live homepage incidents: **§3** tracker + **§4** line-by-line actions. Product work: **§5** (ordered 1–8 + extended backlog). Dev observations: **§6**.

