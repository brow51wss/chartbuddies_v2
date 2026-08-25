# Sentinel Blind Spots — Security Issues Not Caught by Sentinel MCP

- **Date identified:** 2026-08-10
- **Identified by:** Manual code review (Cursor AI + human review)
- **Baseline audit this supplements:** `audits/2026-05-23-baseline.md`
- **Status of these items:** All open / unresolved as of 2026-08-10
- **Note:** Sentinel's baseline found 3 CRITICAL · 18 HIGH · 32 MEDIUM findings that are also still unresolved. This document covers only what Sentinel did NOT find.

---

## Why Sentinel Missed These — Root Causes

Before the issue list, understand the six structural reasons these were missed:

| Root Cause | Description |
|---|---|
| **Absence detection** | Sentinel finds bad patterns. It cannot flag the non-existence of something that should be there. |
| **Runtime scope blindness** | Sentinel reads lines individually. It cannot simulate how a value set in one file affects the entire running process. |
| **Pattern mismatch** | Sentinel matches known credential formats. Short arbitrary strings used as passwords don't match those patterns. |
| **Sampling gap** | Sentinel reviewed 6 of 30 API routes in depth. The other 24 were not evaluated. |
| **Business logic / access semantics** | Sentinel can detect whether an auth check exists. It cannot evaluate whether that check is sufficient for what the route does. |
| **Infrastructure / external systems** | Some security properties live in Vercel dashboards, AWS configs, or external system behavior — outside the codebase entirely. |

---

## Issues by Category

---

### CATEGORY 1 — Active Risks Exploitable on a Live Production URL Right Now

---

#### BLIND-001 — `debug-env.ts` is public, live, and completely unauthenticated
- **File:** `pages/api/debug-env.ts`
- **Severity:** HIGH
- **Why Sentinel missed it:** Sampling gap. This route was not in Sentinel's reviewed set.
- **Detail:** The route responds to any HTTP request with no auth check, no role check, and no gate of any kind. The response confirms which environment variables are set, their character lengths, and whether they resolve from `serverRuntimeConfig` vs `process.env`. This is a reconnaissance map: an attacker learns whether your Supabase service role key and RDS connection string are present, what length they are, and where they resolve from — without any credentials.
- **Code:**
  ```ts
  // pages/api/debug-env.ts — no auth check before this response
  res.status(200).json({
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey ? `SET (length: ${serviceRoleKey.length})` : 'NOT SET',
    RDS_CONNECTION_STRING: rdsConnString ? `SET (length: ${rdsConnString.length})` : 'NOT SET',
    ...
  })
  ```
- **Resolution:** Delete this file. It was a debugging tool and should not exist in production.

---

#### BLIND-002 — Hardcoded access code `LAX926` in `early-access-leads.ts`
- **File:** `pages/api/early-access-leads.ts` (line 4)
- **Severity:** HIGH
- **Why Sentinel missed it:** Pattern mismatch. Sentinel's secret detection matches known credential formats (JWTs, API keys, UUIDs). `LAX926` is six characters with no structural signature of a credential. Sentinel correctly reported "no hardcoded secrets matched known provider patterns" — because it wasn't looking for short arbitrary passwords.
- **Detail:** The access code is committed to version control. Anyone with read access to the git repo can read all leads (email, phone, facility name). Compounding this: the code is sent as a URL query param (`?code=LAX926`), which means it appears in plaintext in every Vercel access log. It is also a GET request, meaning the full URL including the secret is stored in browser history.
- **Code:**
  ```ts
  const ACCESS_CODE = 'LAX926'
  // ...
  if (req.query.code !== ACCESS_CODE) {
    return res.status(401).json({ error: 'Invalid access code' })
  }
  ```
- **Resolution:** Remove the hardcoded code. Require a proper Bearer token from Supabase auth, and restrict the route to `superadmin` role only. Move from GET to POST so the credential is in the body, not the URL.

---

#### BLIND-003 — `NODE_TLS_REJECT_UNAUTHORIZED = '0'` disables SSL validation globally
- **File:** `lib/rds.ts` (line 26)
- **Severity:** CRITICAL
- **Why Sentinel missed it:** Runtime scope blindness. Sentinel sees this line but cannot simulate that setting this Node.js environment variable affects every outbound HTTPS connection in the entire process — not just the RDS pool. Sentinel would need to understand Node.js TLS internals to assess the full blast radius.
- **Detail:** Setting `NODE_TLS_REJECT_UNAUTHORIZED = '0'` was intended to handle self-signed certificates on the AWS RDS instance. The unintended consequence is that it disables SSL certificate validation for every HTTPS call the server makes: Supabase, Resend, AWS S3, and any other outbound connection. An attacker positioned between the server and any of those services can present an invalid certificate, intercept the traffic, and read or modify it — including PHI data in transit to Supabase and RDS.
- **Code:**
  ```ts
  // lib/rds.ts — this affects the entire Node process, not just RDS
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  ```
- **Resolution:** Remove this line. Instead, configure the RDS pool's `ssl` option with the actual AWS RDS CA certificate bundle, or set `ssl: { rejectUnauthorized: true }` and provide the certificate. AWS RDS certificates are available at `https://truststore.pki.rds.amazonaws.com/`.

---

#### BLIND-004 — Read-only mode is client-side only and bypassed in seconds
- **File:** `contexts/ReadOnlyContext.tsx`
- **Severity:** HIGH
- **Why Sentinel missed it:** Absence detection + business logic. Sentinel can detect whether write-gating logic exists on API routes. It cannot infer that a React context value stored in `localStorage` is the only enforcement mechanism for a security-relevant feature. There is no server-side check to find because none exists.
- **Detail:** `isReadOnly` is a React state value initialized from `localStorage`. Any user can open browser DevTools and type `localStorage.removeItem('lasso_readonly_mode')` to exit read-only mode without providing a password. The `exitReadOnly` function does require a password re-entry via Supabase auth, but that only gates the React context update — not actual data writes. None of the `/api/rds/` write routes check for read-only status. A user in read-only mode can directly call the API and write data.
- **Code:**
  ```ts
  // contexts/ReadOnlyContext.tsx — read-only state stored in localStorage
  const [isReadOnly, setIsReadOnlyState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === '1'
  })
  ```
- **Resolution:** The write API routes (`PUT`, `POST`, `PATCH`, `DELETE` on `/api/rds/*`) need a server-side enforcement mechanism. Options: a `read_only` flag on the user profile in Supabase checked by `resolveCallerFromToken`, or a separate role that maps to read-only access.

---

### CATEGORY 2 — Broken Access Control

---

#### BLIND-005 — `patient-photo-upload-url.ts` does not verify `patientId` belongs to the caller's hospital
- **File:** `pages/api/patient-photo-upload-url.ts`
- **Severity:** HIGH
- **Why Sentinel missed it:** Sampling gap + business logic. The route was not in Sentinel's reviewed set. Even if it were, Sentinel can detect whether auth exists — not whether the authenticated user is authorized to act on the specific resource they supplied.
- **Detail:** The route verifies the caller is authenticated (valid Supabase JWT). It then uses the `patientId` from the request body to construct an S3 key without checking that the patient belongs to the caller's `hospital_id`. Any authenticated user from any facility can generate a presigned upload URL for any patient ID in the system.
- **Code:**
  ```ts
  const { patientId } = req.body as { patientId?: string }
  // No check: does this patientId belong to caller's hospital?
  const key = `patient-photos/${patientId}/${uniqueSuffix}.jpg`
  ```
- **Resolution:** Before generating the presigned URL, query RDS to confirm the patient's `hospital_id` matches `caller.hospitalId`. Superadmin with null `hospital_id` is exempt.

---

#### BLIND-006 — `early-access-signup.ts` uses the service role key unnecessarily
- **File:** `pages/api/early-access-signup.ts` (line 5, 25)
- **Severity:** MEDIUM
- **Why Sentinel missed it:** Sampling gap + business logic. Sentinel cannot reason about which Supabase key is appropriate for a given operation — only that the key is stored in an environment variable (which passes its check).
- **Detail:** The service role key bypasses all Supabase RLS policies. This route only inserts a row into `early_access_leads`, which requires no elevated privileges. Using the service role here unnecessarily means that if this route is exploited or the key is exposed, the attacker has a Supabase client that can bypass RLS on every table.
- **Resolution:** Replace the service role key with the anon key for this route. The anon key is sufficient for a public insert operation.

---

#### BLIND-007 — Superadmin with null `hospital_id` has unrestricted global access with no second factor or audit trail
- **File:** `lib/rds.ts` (`callerCanAccessHospital` function)
- **Severity:** HIGH
- **Why Sentinel missed it:** Business logic / access semantics. Sentinel sees a role check exists. It cannot evaluate whether a role granting global access to PHI across all facilities should require additional verification.
- **Detail:** A superadmin account with `hospital_id = null` can read, write, and delete every patient record across every facility. There is no MFA requirement for this role, no IP restriction, no additional confirmation step, and no audit log of what was accessed. A single compromised superadmin credential exposes all PHI.
- **Resolution:** At minimum: require MFA for superadmin login, log all superadmin data access to a separate audit table, and consider IP allowlisting for superadmin accounts.

---

### CATEGORY 3 — HIPAA Compliance Gaps

---

#### BLIND-008 — No PHI access audit log
- **Severity:** CRITICAL for HIPAA compliance
- **Why Sentinel missed it:** Absence detection. There is no logging system to scan. Sentinel cannot know a system should exist if no evidence of it is in the code.
- **Detail:** HIPAA Security Rule §164.312(b) requires audit controls — a mechanism to record and examine activity in systems containing PHI. No route in the `/api/rds/` layer logs read access to patient records. There is no audit table, no middleware logging access, and no external logging service receiving access events.
- **Resolution:** Add an `access_log` table to RDS. Log `user_id`, `action`, `resource_type`, `resource_id`, `hospital_id`, and `timestamp` for every read and write on PHI tables. This must be server-side, not client-side.

---

#### BLIND-009 — No automatic session timeout / inactivity logoff
- **Severity:** HIGH for HIPAA compliance
- **Why Sentinel missed it:** Absence detection. No timer code exists to scan.
- **Detail:** HIPAA requires automatic logoff after a period of inactivity to prevent unauthorized access to unattended sessions. There is no inactivity timer in the application. A nurse who walks away from a logged-in workstation leaves all patient data accessible to anyone who approaches.
- **Resolution:** Implement an inactivity timer (commonly 15–30 minutes for healthcare) that calls `supabase.auth.signOut()` and redirects to login. Reset the timer on user interaction events.

---

#### BLIND-010 — PHI may be reaching Vercel function logs
- **Severity:** HIGH for HIPAA compliance
- **Why Sentinel missed it:** Runtime behavior. Sentinel checks for explicit PHI field names in `console.error` calls. It cannot evaluate what error objects contain at runtime — a caught exception from an RDS query may have patient data serialized into its message.
- **Detail:** Several RDS routes catch errors and log them with `console.error('[route]', err)`. If the error object contains a serialized row or query fragment (which PostgreSQL errors sometimes do), patient data reaches Vercel's log storage. Vercel's log retention is outside your HIPAA BAA scope unless explicitly covered.
- **Resolution:** Wrap RDS errors before logging — log only `err.message` and `err.code`, never the full error object. Confirm with Vercel that your plan's log storage is covered under your BAA, or disable persistent log storage for PHI-adjacent routes.

---

#### BLIND-011 — No MFA
- **Severity:** HIGH for HIPAA compliance
- **Why Sentinel missed it:** Absence detection. No MFA code exists to scan.
- **Detail:** Multi-factor authentication is not implemented for any user role. HIPAA does not explicitly mandate MFA, but it is required by most cybersecurity frameworks (NIST, HITRUST) that HIPAA auditors reference, and is increasingly expected in breach liability assessments. Supabase supports TOTP-based MFA natively.
- **Resolution:** Enable Supabase MFA for all roles. Consider requiring it as mandatory for `superadmin` and `head_nurse`.

---

#### BLIND-012 — Email templates may contain PHI
- **File:** Resend email routes and `docs/supabase-email-templates.md`
- **Severity:** MEDIUM — requires manual verification
- **Why Sentinel missed it:** Absence detection + content analysis. Sentinel cannot read email template content and evaluate whether it constitutes PHI under HIPAA.
- **Detail:** The patient photo capture email flow references a patient context. If any email body or subject line includes a patient name, diagnosis, or record number, that PHI is transmitted through and stored by Resend. This is only compliant if Resend is listed as a Business Associate with a signed BAA. Check `docs/BUSINESS_ASSOCIATES_LIST.md` and the email template content.
- **Resolution:** Audit all email templates. Remove PHI from email bodies. Verify Resend BAA status.

---

### CATEGORY 4 — Security Headers (All Missing)

---

#### BLIND-013 — No Content-Security-Policy (CSP)
- **File:** `next.config.js` (missing)
- **Severity:** HIGH
- **Why Sentinel missed it:** Absence detection.
- **Detail:** CSP prevents the browser from executing injected scripts. Combined with the existing `dangerouslySetInnerHTML` findings (already flagged as CRITICAL by Sentinel), the absence of CSP means an XSS attack on the MAR page or progress notes page has no browser-level mitigation. Patient signatures, medication records, and clinical notes are on those pages.
- **Resolution:** Add a `headers()` function to `next.config.js`. CSP must be carefully written to allow Google Fonts, Supabase API calls, S3, and `data:` URIs for signatures without being so permissive it becomes ineffective.

---

#### BLIND-014 — No Strict-Transport-Security (HSTS)
- **Severity:** MEDIUM
- **Why Sentinel missed it:** Absence detection.
- **Detail:** Without HSTS, the browser does not enforce HTTPS on subsequent visits. An attacker performing a downgrade attack can redirect a user to HTTP, where traffic is unencrypted.
- **Resolution:** Add `Strict-Transport-Security: max-age=63072000; includeSubDomains` to response headers.

---

#### BLIND-015 — No X-Frame-Options
- **Severity:** MEDIUM
- **Why Sentinel missed it:** Absence detection.
- **Detail:** Without this header, your app can be embedded in an iframe on any domain. Clickjacking attacks use invisible iframes to trick users into clicking UI elements (e.g., signing a MAR form) while thinking they're interacting with a different page.
- **Resolution:** Add `X-Frame-Options: DENY` or `SAMEORIGIN`.

---

#### BLIND-016 — No X-Content-Type-Options
- **Severity:** LOW-MEDIUM
- **Why Sentinel missed it:** Absence detection.
- **Detail:** Without this header, browsers may MIME-sniff a response (e.g., treat a text file as JavaScript). This can enable content injection attacks.
- **Resolution:** Add `X-Content-Type-Options: nosniff`.

---

#### BLIND-017 — No Referrer-Policy
- **Severity:** MEDIUM
- **Why Sentinel missed it:** Absence detection.
- **Detail:** Patient pages have URLs containing patient IDs (e.g., `/patients/[id]/mar/[marId]`). Without a Referrer-Policy, when a user navigates from a patient page to an external link (e.g., a Google Fonts URL loaded in the page), the full patient page URL is sent as a `Referer` header to that external server.
- **Resolution:** Add `Referrer-Policy: strict-origin-when-cross-origin`.

---

#### BLIND-018 — No Permissions-Policy
- **Severity:** LOW
- **Why Sentinel missed it:** Absence detection.
- **Detail:** Without this header, browser features (camera, microphone, geolocation, payment) are unrestricted. For a healthcare app, limiting these to only what is needed is a defense-in-depth measure.
- **Resolution:** Add `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.

---

### CATEGORY 5 — Authentication Weaknesses

---

#### BLIND-019 — 6-character minimum password
- **File:** `pages/auth/signup.tsx` (line 115)
- **Severity:** HIGH for healthcare
- **Why Sentinel missed it:** Absence detection + domain knowledge. Sentinel scans for code patterns, not for whether a policy is strong enough. It cannot evaluate password strength requirements against HIPAA or NIST standards.
- **Detail:** `if (formData.password.length < 6)` enforces only 6 characters. NIST SP 800-63B recommends a minimum of 8 characters, and most HIPAA-aligned security frameworks require complexity rules or longer minimums. 6-character passwords are trivially brute-forced offline.
- **Resolution:** Increase minimum to 12 characters for a healthcare app. Add complexity requirements or use a password strength library. Consider Supabase's built-in password strength policies.

---

#### BLIND-020 — No account lockout after failed login attempts
- **Severity:** HIGH
- **Why Sentinel missed it:** Absence detection. No lockout code exists to scan.
- **Detail:** The login page has no lockout or progressive delay after repeated failed attempts. Supabase has some built-in rate limiting on its auth endpoints, but it is not configurable at the application layer and does not provide per-account lockout. A targeted brute force attack against a known user's email is possible.
- **Resolution:** Implement a failed-attempt counter (server-side, in Supabase or RDS). After 5 consecutive failures, lock the account for a time window and require email verification to unlock.

---

#### BLIND-021 — Password reset token appears in Vercel access logs
- **Severity:** MEDIUM
- **Why Sentinel missed it:** Infrastructure / external system behavior. The token is in the URL of the reset link Supabase generates. When the user clicks that link, the full URL is logged by Vercel as a GET request. This is not visible in the source code.
- **Detail:** Supabase's default password reset flow sends a link where the token is in the URL fragment (`#access_token=...`). URL fragments are not sent to servers, so this is somewhat mitigated — but some proxy or logging configurations capture fragments. Verify Supabase's exact reset URL format and confirm fragments are not being logged.
- **Resolution:** Audit Vercel log samples for the pattern of password reset URLs. If fragments are being captured, work with Supabase support to confirm the exact format.

---

### CATEGORY 6 — Supply Chain and Infrastructure

---

#### BLIND-022 — `npm audit` was never run
- **Severity:** UNKNOWN (could be CRITICAL depending on findings)
- **Why Sentinel missed it:** Requires execution. Sentinel's own report noted this as skipped. Checking for CVEs requires network access to the npm advisory database, which a static scanner cannot do at scan time without npm installed.
- **Detail:** The codebase has dependencies including `pg`, `@supabase/supabase-js`, `@aws-sdk/*`, `resend`, and Next.js itself. None of these have been audited for known vulnerabilities. A single high-severity CVE in `pg` (the PostgreSQL client handling PHI queries) would be critical.
- **Resolution:** Run `npm audit` now. Treat CRITICAL and HIGH findings as blockers before going live with real PHI.

---

#### BLIND-023 — No Subresource Integrity (SRI) on dynamically injected Google Fonts
- **Files:** `pages/patients/[id]/mar/[marId].tsx`, `pages/patients/[id]/progress-notes/view.tsx`
- **Severity:** LOW
- **Why Sentinel missed it:** Absence detection + browser security model knowledge. Sentinel sees the dynamic `<link>` injection but cannot evaluate whether SRI is appropriate for it.
- **Detail:** Both pages dynamically create a `<link>` tag and append it to `<head>` to load signature fonts from `fonts.googleapis.com`. Without SRI hashes, the browser loads whatever that URL returns. If Google's CDN were compromised or the request intercepted (see BLIND-003 for why TLS validation is currently off), a malicious stylesheet could be loaded on patient record pages.
- **Resolution:** Either use static font imports (Next.js `next/font` handles this correctly and safely) or add SRI hashes to the dynamic link tag. The `next/font` approach is recommended as it also eliminates the runtime network request.

---

#### BLIND-024 — Vercel preview deployments are publicly accessible by default
- **Severity:** MEDIUM
- **Why Sentinel missed it:** Infrastructure / outside codebase. This is a Vercel dashboard setting, not code.
- **Detail:** Every branch and PR on Vercel Pro gets a public deployment URL. If those preview environments connect to any real data source (even the Supabase demo database), they are accessible to anyone who finds the URL. Preview URLs follow a predictable naming pattern (`[project]-[hash]-[team].vercel.app`) that can be enumerated.
- **Resolution:** In Vercel project settings, enable deployment protection (password or Vercel authentication) for preview deployments. Confirm preview environments use only a local mock or isolated test database.

---

### CATEGORY 7 — Input Validation Gaps

---

#### BLIND-025 — No server-side input length limits on clinical text fields
- **Severity:** MEDIUM
- **Why Sentinel missed it:** Absence detection. There is no maximum-length validation to scan for.
- **Detail:** Fields like `diagnosis`, `allergies`, `note`, `reason`, and medication text in RDS routes accept arbitrary-length strings from the request body. A malformed request with a multi-megabyte string in any of these fields is passed directly to an RDS parameterized query. This can cause slow queries, connection timeouts, and excessive storage consumption.
- **Resolution:** Add server-side length validation in each RDS route handler for all free-text fields. Apply limits appropriate to the field (e.g., `diagnosis` ≤ 500 chars, `note` ≤ 10,000 chars).

---

#### BLIND-026 — No actual file type validation on S3 presigned uploads
- **File:** `pages/api/patient-photo-upload-url.ts`, `pages/api/signature-upload-url.ts`
- **Severity:** MEDIUM
- **Why Sentinel missed it:** Business logic. The routes set `ContentType: 'image/jpeg'` on the presigned URL command. Sentinel sees valid S3 configuration. It cannot know that the `ContentType` in a `PutObjectCommand` is a metadata field the client can override, not an enforcement mechanism.
- **Detail:** The presigned URL hardcodes `ContentType: 'image/jpeg'` in the command, but the client uploading to S3 can send any content with any Content-Type. S3 stores whatever is uploaded. An authenticated user can store arbitrary file types (including scripts or executables) in the patient-photos and signatures buckets.
- **Resolution:** Either validate the file server-side before generating the presigned URL (requires a two-step upload), or configure S3 bucket policies with `s3:PutObject` conditions that enforce `s3:x-amz-content-sha256` and content type restrictions.

---

#### BLIND-027 — No file size limit on S3 presigned upload URLs
- **File:** `pages/api/patient-photo-upload-url.ts`, `pages/api/signature-upload-url.ts`
- **Severity:** MEDIUM
- **Why Sentinel missed it:** Absence detection. There is no `ContentLengthRange` condition to scan for.
- **Detail:** AWS supports a `ContentLengthRange` condition in presigned POST policies that enforces a minimum and maximum file size. Neither presigned URL generation adds this condition. An authenticated user can upload arbitrarily large files to the S3 bucket, incurring AWS storage and transfer costs.
- **Resolution:** Add a `ContentLengthRange` condition: for patient photos, a reasonable limit is 10MB. For signatures, 1MB. Note: this requires switching from presigned PUT URLs to presigned POST policies, which support conditions.

---

### CATEGORY 8 — Operational Gaps

---

#### BLIND-028 — No CORS policy
- **Severity:** MEDIUM
- **Why Sentinel missed it:** Absence detection. No CORS configuration exists to scan.
- **Detail:** Without explicit CORS headers, Next.js API routes respond to cross-origin requests with the default browser behavior. Any website a logged-in user visits can make credentialed requests to your API routes and read the responses. For routes that return PHI, this is a data exfiltration vector.
- **Resolution:** Add CORS middleware to API routes. Restrict allowed origins to your known domains (`app.lasso-app.com` and `lasso-app.com`). For routes that must support mobile clients, enumerate allowed origins explicitly rather than using a wildcard.

---

#### BLIND-029 — `early-access-signup.ts` has no rate limiting or CAPTCHA
- **File:** `pages/api/early-access-signup.ts`
- **Severity:** MEDIUM
- **Why Sentinel missed it:** Absence detection.
- **Detail:** This is a public route (no auth required) that inserts rows into a Supabase table using the service role key. With no rate limiting and no CAPTCHA, automated tools can flood the `early_access_leads` table indefinitely, polluting your leads data and consuming Supabase row storage.
- **Resolution:** Add rate limiting (by IP, per minute) and optionally a CAPTCHA (hCaptcha or Cloudflare Turnstile) to this public form submission route.

---

#### BLIND-030 — Rate limiting absent on all email-sending routes
- **Files:** `pages/api/send-invite-email.ts`, `pages/api/send-signature-setup-email.ts`, `pages/api/send-patient-photo-capture-email.ts`
- **Severity:** HIGH
- **Why Sentinel missed it:** Absence detection.
- **Detail:** All three email routes are authenticated but have no per-user or per-recipient rate limiting. An authenticated user can trigger unlimited email sends to any address. This enables email bombing of staff or patients and will exhaust your Resend sending quota, causing legitimate transactional emails to fail.
- **Resolution:** Add rate limiting keyed on both the caller's `userId` and the recipient email address. A reasonable limit: 3 sends per recipient per hour.

---

## Summary

| ID | Issue | Severity | Category | Root Cause |
|---|---|---|---|---|
| BLIND-001 | `debug-env.ts` public and unauthed | HIGH | Active risk | Sampling gap |
| BLIND-002 | Hardcoded access code `LAX926` | HIGH | Active risk | Pattern mismatch |
| BLIND-003 | `NODE_TLS_REJECT_UNAUTHORIZED = '0'` global scope | CRITICAL | Active risk | Runtime scope blindness |
| BLIND-004 | Read-only mode client-side only | HIGH | Active risk | Absence detection + business logic |
| BLIND-005 | Patient photo upload missing ownership check | HIGH | Access control | Sampling gap + business logic |
| BLIND-006 | Service role key over-privilege in signup route | MEDIUM | Access control | Sampling gap + business logic |
| BLIND-007 | Superadmin global access with no second factor | HIGH | Access control | Business logic |
| BLIND-008 | No HIPAA PHI access audit log | CRITICAL | HIPAA | Absence detection |
| BLIND-009 | No session timeout | HIGH | HIPAA | Absence detection |
| BLIND-010 | PHI may reach Vercel function logs | HIGH | HIPAA | Runtime behavior |
| BLIND-011 | No MFA | HIGH | HIPAA | Absence detection |
| BLIND-012 | Email templates may contain PHI | MEDIUM | HIPAA | Content analysis |
| BLIND-013 | No Content-Security-Policy | HIGH | Headers | Absence detection |
| BLIND-014 | No HSTS | MEDIUM | Headers | Absence detection |
| BLIND-015 | No X-Frame-Options | MEDIUM | Headers | Absence detection |
| BLIND-016 | No X-Content-Type-Options | LOW-MEDIUM | Headers | Absence detection |
| BLIND-017 | No Referrer-Policy | MEDIUM | Headers | Absence detection |
| BLIND-018 | No Permissions-Policy | LOW | Headers | Absence detection |
| BLIND-019 | 6-character minimum password | HIGH | Auth | Absence detection + domain knowledge |
| BLIND-020 | No account lockout | HIGH | Auth | Absence detection |
| BLIND-021 | Reset token in Vercel logs | MEDIUM | Auth | Infrastructure |
| BLIND-022 | `npm audit` never run | UNKNOWN | Supply chain | Requires execution |
| BLIND-023 | No SRI on Google Fonts | LOW | Supply chain | Absence detection |
| BLIND-024 | Vercel previews publicly accessible | MEDIUM | Infrastructure | Outside codebase |
| BLIND-025 | No server-side input length limits | MEDIUM | Input validation | Absence detection |
| BLIND-026 | No actual file type validation on S3 uploads | MEDIUM | Input validation | Business logic |
| BLIND-027 | No file size limit on presigned URLs | MEDIUM | Input validation | Absence detection |
| BLIND-028 | No CORS policy | MEDIUM | Operational | Absence detection |
| BLIND-029 | No rate limiting on public signup route | MEDIUM | Operational | Absence detection |
| BLIND-030 | No rate limiting on email routes | HIGH | Operational | Absence detection |

---

*This document should be reviewed alongside `audits/2026-05-23-baseline.md` for a complete picture of open security issues.*
