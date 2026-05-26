# Pre-Launch Manual Checks

These checks cannot be verified by static analysis (Sentinel) and must be performed manually before going live with real patient data.

Last updated: 2026-05-23 — added after Sentinel baseline audit (`audits/2026-05-23-baseline.md`).

---

## Check 1 — Row-Level Security (RLS) Active in Supabase

**Why:** Migration SQL files contain RLS policies, but a policy existing in code does not mean it is enabled in the live database. If RLS is off, any authenticated user can read all rows regardless of facility or role.

**Steps:**
1. Log in to your [Supabase dashboard](https://app.supabase.com)
2. Select your project → go to **Table Editor**
3. All tables verified from migration files (2026-05-23). Status:

| Table | RLS | Policies | Status |
|---|---|---|---|
| `patients` | ✅ | 14 | ✅ verified live |
| `user_profiles` | ✅ | 20 | ✅ verified live |
| `mar_forms` | ✅ | 4 | ✅ verified live |
| `mar_medications` | ✅ | 2 | ✅ verified live |
| `mar_administrations` | ✅ | 2 | ✅ confirmed in migrations |
| `mar_prn_records` | ✅ | 2 | ✅ confirmed in migrations |
| `mar_vital_signs` | ✅ | 2 | ✅ confirmed in migrations |
| `mar_prn_medications` | ✅ | 1 | ✅ confirmed in migrations |
| `mar_custom_legends` | ✅ | 4 | ✅ confirmed in migrations |
| `admissions` | ✅ | 2 | ✅ confirmed in migrations |
| `facility_invites` | ✅ | 3 | ✅ confirmed in migrations |
| `hospitals` | ✅ | 10 | ✅ confirmed in migrations |
| `progress_note_entries` | ✅ | 2 | ✅ confirmed in migrations |
| `progress_note_monthly_summaries` | ✅ | 2 | ✅ confirmed in migrations |
| `signature_setup_tokens` | ✅ | 1 | ✅ confirmed in migrations |
| `patient_photo_capture_tokens` | ✅ | 2 | ✅ confirmed in migrations |
| `nurse_patient_assignments` | ✅ | 0 → **FIXED** | ⚠️ migration `071` written — apply in Supabase SQL Editor |
| `audit_logs` | ✅ | 0 (intentional) | ✅ only accessed by DB triggers, not app code |
| `patient_photo_mobile_pickups` | ✅ | 0 (intentional) | ✅ only accessed via SECURITY DEFINER RPC, not directly |

**Note:** `mar_entries` does not exist in this database.

**Pass criteria:** Every table listed above has RLS enabled AND at least one active policy scoped to the user's facility (or is intentionally policy-free for service-role-only tables).

---

## Check 2 — No PHI in Vercel Function Logs

**Why:** Server-side `console.error` and `console.log` calls stream to Vercel logs. Any patient name, diagnosis, medication name, or email address appearing there would be a HIPAA-relevant exposure.

**Steps:**
1. Deploy the latest build to Vercel (or use your current staging deployment)
2. Perform at least one of each action:
   - Admit a new patient
   - Open a MAR and save a medication entry
   - Trigger an invite email send
3. Go to **Vercel dashboard → your project → Functions → Logs**
4. Search the log output for:
   - Any recognizable patient name
   - Any diagnosis string
   - Any medication name
   - Any email address (look for `@`)

**Pass criteria:** Logs contain only generic status strings (HTTP codes, error codes, non-PHI context like `[send-invite-email] Resend error: ResendError Failed to send`). No PHI visible.

**Note:** We fixed the 9 known `console.error` full-object leaks in the May 2026 Sentinel audit. This check confirms the fix held and no new leaks were introduced.

---

## Check 3 — HTTPS Enforced in Production

**Why:** Plain HTTP traffic is readable by anyone on the network path. PHI must never travel over unencrypted HTTP in production.

**Steps:**
1. Go to **Vercel dashboard → your project → Settings → Domains**
2. Confirm your custom domain shows a valid SSL certificate and force-redirect is active
3. Manual test: type `http://` (not `https://`) + your domain in a browser — it must redirect to `https://` automatically
4. Check that there are no mixed-content warnings in the browser console on any page

**Pass criteria:** All traffic served over HTTPS; HTTP requests redirect to HTTPS; no browser mixed-content warnings.

---

## Sign-Off

| Check | Date Performed | Result | Performed By |
|---|---|---|---|
| RLS Active in Supabase | | | |
| No PHI in Vercel Logs | | | |
| HTTPS Enforced | | | |

Fill in this table when each check is completed before go-live.
