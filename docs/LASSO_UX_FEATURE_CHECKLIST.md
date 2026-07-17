# Lasso UX & Feature Checklist
**Source:** Meeting — Lasso vs. Competitor Features (Mon, Jul 6, 2026)

---

## MAR — Simplified View & Interaction

- [ ] **Replace dropdown with a clean pop-up panel** when a caregiver clicks a MAR cell.
  - Pop-up shows: medication name, status options (Given / Refused / Not Given), note field.
  - Selecting any status **auto-applies the caregiver's initials/signature** — no extra step.
- [ ] **Color-code cell status** directly in the MAR grid cells:
  - Green = Given
  - Red = Refused
  - Yellow/Orange = Not Given
- [ ] **Hide medication detail columns by default** — show only medication name (+ start/stop date beneath it) in the left column.
  - Parameters, route, dosage, five rights, and ordering details appear **only when the cell/row is clicked**.
  - Eliminate the standalone start/stop-date column; place those dates under the medication name instead.
- [ ] **Preserve parameter logic** — when a caregiver clicks to administer, the pop-up must still display any parameters (e.g., "do not give if blood pressure > X").
- [ ] **Notes always available** regardless of administration condition — remove conditional note gating so caregivers can always leave a note.
- [ ] **Keep the legend** — inspectors require a visible color/abbreviation key on the MAR.

---

## MAR Calendar / Dashboard View

- [ ] **Missed-dose red-dot indicators** on the calendar — clicking a red dot scrolls directly to the exact missed dose entry (correct date + time slot).
- [ ] **3-day mobile view** — show only three days at a time on small screens; arrows to navigate forward/back.
- [ ] **Tabbed separation in calendar view**: Vitals | Medications | PRNs — avoid displaying all three simultaneously in the same grid.
- [ ] **Default calendar is bare-bones** — show icons/status only; all detail accessible via click or hover.

---

## Progress Notes

- [ ] **Make each progress note entry clickable/collapsible** — rows expand on click so the list view stays clean.
- [ ] **Remove doctor name from every individual row** — it is not required on each entry.
- [ ] **Keep signature/initials on every note entry** — this is a compliance requirement; do not remove it.
- [ ] **Break the Monthly Summary into step-based, collapsible sections**:
  - Step 1: Patient Info
  - Step 2: Medication
  - Step 3: Treatment / Other fields
  - User can hop between steps; steps are not sequentially locked.
- [ ] **Progress notes photo attachment** — caregivers should be able to upload/take a photo and attach it to a progress note entry (injuries, follow-up documentation, wound tracking).
  - No separate incident-report form required; caregiver uses discretion.

---

## Patient Finder (Patient Card View)

- [x] **Show only face photo + name on patient cards** — strip out DOB, phone, diagnosis, etc. from the card.
- [x] **All details (DOB, age, sex, physician, etc.) visible only after clicking** into the patient record.

---

## Signatures & Compliance

- [ ] **Keep initials/signature requirement on every MAR administration entry.**
- [ ] **Keep initials/signature requirement on every Progress Note entry.**
- [ ] Confirm with compliance stakeholder whether the legend must always be visible or is acceptable as click-to-view.

---

## Scheduling & Access Control (New Feature)

- [ ] **Design and implement a clock-in / clock-out workflow:**
  - Caregiver clocks in → administrator receives a notification and approves or denies.
  - Charting is only permitted while clocked in and approved.
- [ ] **Alternative / fallback: Wi-Fi / geolocation gate** — if caregiver is not connected to the facility Wi-Fi (or not within geofence), the app prevents charting.
- [ ] **Add a login system** that underpins the scheduling and access-control features.
- [ ] **Scheduling module** — administrator assigns shifts; system enforces charting only during assigned shifts. (Deprioritized behind clock-in flow due to scheduling complexity.)

---

## Scope Decisions (Confirmed Freeze)

- [ ] **Keep current modules only**: MAR + Progress Notes.
- [ ] **Postpone ADLs** — do not scope or build until team is explicitly ready.
- [ ] **No new features** beyond what is listed in this checklist for the current sprint.

---

## Business & Operations

- [ ] Connect **Stripe** for payments once UI changes are reviewed and approved.
- [ ] Check **developer availability/schedules** to determine when the team can resume implementation.
- [ ] Audit the **marketing website** for any existing sign-ups (no automated notifications currently in place).
- [ ] Begin **sales outreach** (ARCA events and direct) once UI changes are live.
- [ ] Send a **follow-up email** to meeting participants summarizing decisions and next steps.

---

*Last updated: Jul 17, 2026*
