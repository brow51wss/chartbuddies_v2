# chartbuddies_v2 — Project Context (Sentinel)

> Read by Sentinel on every audit pass. Update this file when sensitive fields,
> roles, compliance requirements, or high-risk features change.
> Last updated: 2026-05-23

---

## SENSITIVE_FIELDS

- `patients.patient_name` — HEALTH/PII — never logged, never in analytics, never in URLs
- `patients.date_of_birth` — HEALTH/PII — never logged, never in analytics, never in URLs
- `patients.sex` — HEALTH/PII — never logged, never in analytics
- `patients.diagnosis` — HEALTH/PHI — never logged, never in analytics, never in URLs
- `patients.diet` — HEALTH/PHI — never logged
- `patients.allergies` — HEALTH/PHI — never logged
- `patients.physician_name` — HEALTH/PII — never logged
- `patients.physician_phone` — HEALTH/PII — never logged
- `patients.home_phone` — PII — never logged
- `patients.email` — PII — never logged
- `patients.street_address` — PII — never logged
- `patients.patient_photo` — HEALTH/PII — stored as URL/data URL, never in error reporters
- `mar_forms.*` — HEALTH/PHI — full MAR record, never logged, never in analytics
- `mar_administrations.*` — HEALTH/PHI — administration records, never logged
- `mar_prn_medications.*` — HEALTH/PHI — PRN med records, never logged
- `progress_notes.note` — HEALTH/PHI — clinical notes, never logged
- `users.email` — PII — never logged in plaintext
- `users.staff_signature` — credential/PII — never logged, never in analytics
- `supabase.url` — credential — env var only, never hardcoded
- `supabase.anon_key` — credential — env var only, never hardcoded

---

## USER_ROLES

- `superadmin` — full access across all hospitals/facilities; can view and manage all patients
- `head_nurse` — full access within their hospital; can add/edit/archive patients, manage MARs
- `nurse` — access to assigned patients only; can document MAR, progress notes, vitals
- `read_only` (context flag) — view-only mode; all write actions hidden; enforced client-side and via RLS

---

## COMPLIANCE_REQUIREMENTS

- HIPAA — handles Protected Health Information (PHI); all patient data must be encrypted at rest and in transit; access logs required; minimum necessary access enforced via RLS
- Supabase Row-Level Security (RLS) — hospital_id-scoped policies on patients, mar_forms, progress_notes tables
- AWS RDS (production) — PHI data stored in AWS RDS PostgreSQL with encryption at rest
- Supabase (demo/dev) — non-PHI demo environment only

---

## HIGH_RISK_FEATURES

- Patient photo upload — user-supplied image stored as data URL or public URL
- MAR administration logging — time-sensitive clinical records; incorrect writes have patient safety implications
- Soft-delete / archive — `deleted_at` column; RLS must prevent deleted records from leaking to unauthorized roles
- Progress notes — freeform clinical text; must never appear in error reporters or logs
- Role-based access control — `isReadOnly` context flag; must gate all write paths server-side via RLS, not just client-side
- Physician phone / contact data — PII embedded in MAR forms; sync between `patients` table and `mar_forms` must not expose data in transit logs
- Supabase auth — JWT-based session; tokens must not appear in URLs, logs, or error reporters

---

## AUDIT HISTORY

| Date | Trigger | Findings | Status |
|---|---|---|---|
| 2026-05-23 | initialized | _(pending first Sentinel scan)_ | _(pending verdict)_ |
