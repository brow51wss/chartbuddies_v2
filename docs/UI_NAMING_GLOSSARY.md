# UI Naming Glossary

Canonical names for UI elements across the app. Use these consistently in conversations, code comments, and documentation.

---

## Patient Card (a.k.a. Patient Summary Card)

**Component:** `components/PatientSummaryCard.tsx`

The compact card showing a patient's photo/avatar, name, DOB, and date added. Reusable across pages via props.

| Prop | Default | Notes |
|---|---|---|
| `showPatientName` | `true` | Toggle name display |
| `showDob` | `true` | Toggle DOB row |
| `showDateAdded` | `true` | Toggle date added row |
| `showDiagnosis` | `true` | Toggle diagnosis row |
| `showSex` | `false` | Off by default |
| `showPhone` | `false` | Off by default |
| `footer` | — | JSX slot for action buttons |

**Used on:**
- Binder page (`pages/patients/[id]/index.tsx`) — sticky left column

---

## Binder

**Route:** `/patients/[id]`  
**Page heading:** "Binder"

The patient-specific hub page. Lists all modules (MAR, Progress Notes, etc.) available for that patient. Previously headed "{Patient Name}'s Binder" — renamed to just "Binder" on **2026-07-24**.

---

## Month Picker Button

**Component:** `components/MonthPickerButton.tsx`

A ghost button (border, no fill) showing the current month/year with a down chevron. On click, opens a modal listing all available months for the current module. Selecting a month navigates to that month's data.

| Prop | Notes |
|---|---|
| `currentLabel` | Text shown on the button (e.g. "July 2026") |
| `loadMonths` | Async function returning the list of navigable months |
| `size` | `'md'` (default, MAR) or `'sm'` (smaller contexts) |
| `key` | Must be set to active month/ID to reset internal cache on navigation |

**Used on:**
- MAR page (`pages/patients/[id]/mar/[marId].tsx`) — navigates between MAR form months
- Progress Notes view (`pages/patients/[id]/progress-notes/view.tsx`) — navigates between Progress Notes months

---

## Module Header

**Component:** `components/ModuleHeader.tsx`

The white card (`bg-white rounded-lg shadow-lg p-6 mb-6`) that sits directly below the page `h1` and above the main content.

| Prop | Notes |
|---|---|
| `monthPicker` | `<MonthPickerButton>` — shown left of the top row |
| `rightSlot` | Optional JSX right of the month picker (e.g. Facility Name in MAR) |
| `children` | View / tab toggle — rendered below the `border-b-2` divider |
| `className` | Extra classes on the root div |

**Used on:**
- MAR page (`pages/patients/[id]/mar/[marId].tsx`) — month picker + facility name + view toggle
- Progress Notes view (`pages/patients/[id]/progress-notes/view.tsx`) — month picker + tab toggle

**Extracted as shared component: 2026-07-24**

---

## View Toggle

The pill-style tab switcher (`inline-flex bg-gray-100 rounded-xl`) that switches between named views within a module.

Active state: `bg-lasso-navy text-white shadow-sm`  
Inactive state: plain text with hover

**Instances:**
- MAR: "Today's Med Pass" / "Monthly Grid (Audit View)"
- Progress Notes: "Notes & Addendum" / "Monthly Summary"

---

*Last updated: 2026-07-24*
