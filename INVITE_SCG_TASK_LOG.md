# Invite & SCG Signup – Task Log

**Scope:** Send invites from the EHR, auto-register as SCG (unverified), PCG view of facility users, and signup page with locked fields + email-match validation.

---

## Phase 1: Send invite from the EHR

- [x] **1.1** Add UI on the invite-success screen: email input + “Send invite” (or “Email invite”) so the code can be sent from the app instead of copy/paste.
- [x] **1.2** Backend/API: create or use an endpoint/function that sends the invite email (with code + signup link). Decide: Supabase Edge Function, third-party email (Resend/SendGrid/etc.), or Supabase Auth email.
- [x] **1.3** When “Send invite” is used: record the **invited email** and **date invited** (e.g. new column or table: `invited_email`, `invited_at`) and optionally mark that this code was “sent” to that email.
- [x] **1.4** On send: **auto-register** the invitee as SCG for the facility (incomplete/unverified account) so they exist in the system and can be listed for the PCG. Ensure “verified” is false until they complete signup via the link.

---

## Phase 2: PCG view – facility users

- [x] **2.1** Add a route/page (e.g. “Facility users” or “Team” under a relevant nav) that only PCG (and allowed roles) can access.
- [x] **2.2** Load and display users for the PCG’s facility with columns:
  - First name  
  - Middle name  
  - Last name  
  - Email address  
  - Date invited  
  - Invite code (used for that user)  
  - Date account verified (when they completed signup via invite link)
- [x] **2.3** Backend: ensure data model supports “date invited” and “date verified” (and invite code per user) and that RLS allows PCG to read only their facility’s users.

---

## Phase 3: Invite email and signup link

- [x] **3.1** Invite email content: include the **signup link** that encodes (or references) the invite code so the SCG can open it and land on the special signup page.
- [x] **3.2** Signup link format: URL uses `code` and `email` (e.g. `/auth/signup?code=XXX&email=...`); send-invite API builds this link. Code validation on signup page is next (Phase 4).

---

## Phase 4: Signup page for invite (locked fields + validation)

- [x] **4.1** Signup page when opened via invite link: pre-fill and **lock** (read-only, not editable): email, invite code, facility name, designation.
- [x] **4.2** Validation: if the **email** (from form/pre-fill) **does not match** the email tied to the invite code → user cannot proceed (disable or block “Continue” and show clear message).
- [x] **4.3** If email matches: allow user to proceed to the rest of signup (e.g. password, name, etc.) and complete account setup.
- [x] **4.4** On successful completion: mark account as **verified** and set **date verified** so PCG view can show it.

---

## Phase 5: Data model and security

- [ ] **5.1** DB/schema: add or adjust tables/columns for: invited email per invite, date invited, date verified, and link invite code to user for “invite code” column in PCG view.
- [ ] **5.2** RLS: PCG can only see users in their facility; restrict who can send invites (e.g. PCG/masteradmin only as per current rules).
- [ ] **5.3** Ensure “auto-register as SCG” flow does not allow privilege escalation and that unverified accounts have limited access until verified.

---

## Notes / open decisions

- **Email provider:** Confirm how invite emails will be sent (Supabase, Resend, etc.) and any env vars (e.g. `RESEND_API_KEY`).
- **“Auto-register”:** Exact flow: create auth user with placeholder password + profile row with SCG + unverified, or create only profile row and auth user is created when they complete signup via link. Document choice here once decided.
- **Where to link “Facility users”:** Main nav, profile, or under a specific module (e.g. under “Invites” or “Team”).

---

*Last updated: task log created. Check off steps as they are completed.*
