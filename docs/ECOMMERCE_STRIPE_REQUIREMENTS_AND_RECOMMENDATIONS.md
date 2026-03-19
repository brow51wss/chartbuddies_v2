# E-Commerce (Stripe) Requirements & Recommendations

**Purpose:** Add subscription-based access to EHR modules. Each **facility** (billing entity; `hospital` in current schema) pays per module. Only MAR and Progress Notes are available at launch.

**Scope:** This document describes what needs to be built, which pages to add, how to integrate with the app, and recommendations. **No codebase changes are specified here**—treat this as the product/technical spec for implementation.

---

## 1. Pricing & Products

| Module           | Price       | Stripe suggestion              |
|------------------|------------|--------------------------------|
| MAR              | $29.99/mo  | One Stripe Product, one Price (recurring monthly) |
| Progress Notes   | $19.99/mo  | One Stripe Product, one Price (recurring monthly) |

- **Trial:** 30 days for each module, with **card on file required** (Stripe supports `subscription_data.trial_period_days` and collecting payment method at signup).
- **Billing entity:** Facility (one subscription per facility per module). In your schema this is the **hospital** (`hospitals` table, `hospital_id` on users/patients).

---

## 2. Data Model (Recommendations)

### 2.1 Stripe

- **Customers:** One Stripe Customer per **facility** (not per user). Store `stripe_customer_id` on the facility/hospital record (e.g. `hospitals.stripe_customer_id`).
- **Subscriptions:** One Stripe Subscription per facility per product (MAR, Progress Notes). Option A: one subscription with multiple prices (multi-price subscription). Option B: one subscription per product. Option B is simpler for “cancel MAR but keep Progress Notes” and per-module trials.
- **Products/Prices:** Create in Stripe Dashboard (or via API once):
  - Product: “MAR” → Price: $29.99/month, recurring.
  - Product: “Progress Notes” → Price: $19.99/month, recurring.
- **Metadata:** On subscription (and optionally customer): store `hospital_id` (or your facility id) so webhooks and APIs can resolve to the correct facility.

### 2.2 Your Database

- **Facility/Hospital table:** Add (if not present):
  - `stripe_customer_id` (nullable, unique).
- **Subscription state (new table or equivalent):** You need a reliable source of “does this facility have access to MAR / Progress Notes?” that stays in sync with Stripe. Options:
  - **Option A – `facility_subscriptions` (recommended):**  
    `id`, `hospital_id`, `stripe_subscription_id`, `stripe_price_id`, `module_id` (e.g. `'mar'`, `'progress_notes'`), `status` (e.g. `trialing`, `active`, `past_due`, `canceled`, `incomplete`), `current_period_start`, `current_period_end`, `trial_end`, `created_at`, `updated_at`.  
    Keep this table updated via **Stripe webhooks** (e.g. `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`). Use it for access control and for “active subscribers” lists.
  - **Option B:** Rely only on Stripe API at runtime. Simpler schema but more API calls and harder to list “all facilities with MAR” in your admin.
- **Audit / billing history:** Optional but useful: store key events (subscription started, renewed, canceled, payment failed) in a `billing_events` or `invoice_log` table for PCG-facing billing history and support.

---

## 3. Access Control (Gating)

- **Who is gated:** Any route or UI that provides access to MAR or Progress Notes must check **facility-level** subscription (and optionally trial) before allowing access.
- **Where to gate:**
  - **Patient binder (module cards):** `pages/patients/[id]/index.tsx` – “Open” / link to MAR or Progress Notes should be allowed only if the **current user’s facility** (user’s `hospital_id`) has an active or trialing subscription for that module. Otherwise show “Subscribe” or “Start trial” (or disable the card and explain why).
  - **MAR routes:** e.g. `/patients/[id]/forms`, `/patients/[id]/mar/new`, `/patients/[id]/mar/[marId]` – same check: facility has active/trialing MAR subscription.
  - **Progress Notes routes:** e.g. `/patients/[id]/progress-notes`, `/patients/[id]/progress-notes/view` – facility has active/trialing Progress Notes subscription.
- **How to check:** Use the `facility_subscriptions` (or equivalent) table: e.g. `status IN ('trialing','active')` and `module_id = 'mar'` for MAR. Optionally cache per request/session to avoid repeated DB hits.
- **Superadmin / internal staff:** Decide if “you” (internal team) bypass gating (e.g. by role or by a special flag). If so, document the rule (e.g. “superadmin can access all modules regardless of subscription”) and implement it in the same place you do the subscription check.

---

## 4. Pages & Features to Add

### 4.1 For PCGs (Facility Users)

- **Billing / Subscription hub (per facility)**  
  - **Purpose:** One place for facility admins (e.g. superadmin with `hospital_id`) to see and manage subscriptions and billing.  
  - **Suggested URL:** e.g. `/billing` or `/settings/billing` (or under a “Settings” or “Facility” area).  
  - **Content:**
    - List of modules (MAR, Progress Notes) with status: **Subscribed**, **In trial**, **Not subscribed**, **Past due**, **Canceled**.
    - For each subscribed/trialing module: next billing date, amount, and link to “Manage” (see below).
    - **Start trial** for a module (if not subscribed): CTA → collect payment method (Stripe Checkout or Elements) → create subscription with 30-day trial.
    - **Manage subscription:** Update payment method, cancel at period end, or (if you support it) change plan. Prefer **Stripe Customer Portal** for “Manage” (update card, cancel, view invoices) to reduce custom code and stay PCI-friendly.
    - **Invoices:** Link to Stripe Customer Portal “View invoices” or a simple list of past invoices (you can list via Stripe API and show date, amount, status, PDF link).
  - **Access control:** Only users who belong to the facility (and optionally only facility “admins”, e.g. superadmin with that `hospital_id`) should see this page. Redirect or 403 others.

- **Upgrade / paywall surfaces**  
  - When a user hits a gated module (e.g. clicks MAR but facility has no subscription), show a clear **paywall** or **upgrade** screen instead of the module:
    - Short copy: “MAR is not active for your facility. Start a 30-day free trial (card required) or subscribe.”
    - CTAs: “Start 30-day trial” and/or “Subscribe” → same flow as “Start trial” from the billing hub (Checkout or Elements + 30-day trial).
  - Optionally show this from the patient binder when the user clicks an unavailable module (e.g. modal or dedicated page like `/billing/upgrade?module=mar`).

### 4.2 For You (Internal / Platform Admin)

- **Admin: Active subscribers and subscription management**  
  - **Purpose:** See who (which facilities) are active subscribers and perform basic operations.  
  - **Suggested URL:** e.g. `/admin/subscriptions` or `/admin/billing` (admin-only).  
  - **Content:**
    - **List of facilities** with subscription state:
      - Facility name, id (e.g. `hospital_id`), Stripe customer id.
      - Per module (MAR, Progress Notes): status (trialing, active, past_due, canceled, none), current period end, trial end (if any).
      - Optional: last payment date, amount.
    - **Filters:** e.g. by status (active only, trialing only, past_due), by module.
    - **Actions (recommended):**
      - **View in Stripe:** Link to Stripe Dashboard (customer or subscription).
      - **Impersonate / view as facility:** If you have a “view as” feature, link to the facility’s context (e.g. dashboard with that facility).
      - **Cancel subscription** (with confirmation): Call Stripe API to cancel at period end or immediately; webhook will update your DB.
      - **Refund / adjust billing:** Prefer doing this in Stripe Dashboard and documenting the process; optional “Refund last invoice” button if you need it in-app.
    - **Export:** CSV of active subscribers (facility id, name, modules, status, period end) for reporting.
  - **Access control:** Only for internal roles (e.g. superadmin without `hospital_id`, or a dedicated `platform_admin` role). Not visible to facility PCGs.

- **Admin: Billing events / audit log (optional)**  
  - If you store billing events, a simple `/admin/billing-events` list (filter by facility, date, event type) helps support and debugging.

### 4.3 Checkout & Trials

- **Flow:**  
  1. User (PCG) clicks “Start trial” or “Subscribe” for a module (from billing hub or paywall).  
  2. If facility has no Stripe customer, create one (Stripe API) and save `stripe_customer_id` on the facility.  
  3. Create a Stripe Checkout Session (or use Stripe Elements on your page) with:
     - **Mode:** `subscription`
     - **Line items:** The price id for that module (MAR or Progress Notes).
     - **Trial:** `subscription_data.trial_period_days: 30`
     - **Customer:** existing `stripe_customer_id` or create new and attach.
     - **Success/cancel URLs:** e.g. `/billing?success=1` and `/billing?canceled=1`
  4. After payment method is collected and subscription is created, Stripe sends webhooks; your backend updates `facility_subscriptions` (or equivalent).  
  5. User is redirected to success URL; next time they open the binder, the module is unlocked.

- **Card on file:** Requiring a card for trial is supported by Stripe (customer must add payment method; subscription starts in trial and auto-renews after 30 days unless canceled). Use Stripe’s built-in trial behavior and communicate clearly in UI (“Card required for 30-day trial; you’ll be charged $X on [date] unless you cancel”).

---

## 5. Stripe Integration (Technical Outline)

- **Backend:** Use Stripe on the server only (Node in Next.js API routes or your backend). Never expose secret key to the client.
- **Checkout:** Prefer **Stripe Checkout** (hosted page) for “Subscribe / Start trial” to minimize PCI surface; redirect back to your app with session id if you need to show a custom success page.
- **Customer Portal:** Use Stripe **Customer Portal** for “Manage subscription,” update payment method, cancel, view invoices. Redirect to Stripe’s portal URL (created via API with `return_url` back to your billing page).
- **Webhooks:**  
  - Endpoint: e.g. `POST /api/webhooks/stripe`.  
  - Events to handle (minimum): `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.  
  - In handlers: identify facility (e.g. via `metadata.hospital_id` or lookup by `stripe_customer_id`), then insert/update/delete rows in `facility_subscriptions` and optionally write to billing_events.  
  - Verify webhook signature (Stripe SDK) and return 200 quickly; do heavy work async if needed.
- **Idempotency:** Use Stripe idempotency keys for creating customers and subscriptions from your API to avoid duplicates on retries.

---

## 6. Seamless Integration with the Rest of the App

- **Single source of truth:** Use `facility_subscriptions` (or equivalent) as the single source for “can this facility use MAR / Progress Notes?” so that binder, MAR routes, and Progress Notes routes all use the same rule.
- **Consistent UX:** When a module is gated, show the same messaging and CTAs (e.g. “Start trial” / “Subscribe”) from the binder and from direct links to MAR/Progress Notes.
- **No breaking change for existing data:** Existing facilities have no subscription initially; after rollout they see “Subscribe” or “Start trial” until they complete checkout. Existing MAR and Progress Notes data stays as-is; gating only controls **access** to the UI/routes.
- **Role + subscription:** Keep existing role checks (e.g. superadmin, head_nurse, nurse). Add a **subscription check** on top: “user’s facility has active/trialing subscription for this module.” So: allowed = (role can access app) and (facility has module subscription).

---

## 7. Recommendations Summary

| Area | Recommendation |
|------|----------------|
| **Billing entity** | One Stripe Customer per facility (hospital). One subscription per facility per module (or one multi-price subscription if you prefer). |
| **DB** | Add `stripe_customer_id` to facility/hospital; add `facility_subscriptions` (or equivalent) updated by webhooks. |
| **Gating** | Gate by facility subscription (active/trialing) on binder and on every MAR and Progress Notes route. |
| **PCG pages** | Billing hub (subscription status, start trial, manage via Stripe Portal, invoices). Paywall when accessing a gated module. |
| **Admin pages** | Admin subscriptions list (facilities, status per module, links to Stripe, cancel, export). Optional billing events list. |
| **Checkout** | Stripe Checkout for subscribe/trial; 30-day trial with card required; Stripe Customer Portal for manage/update/cancel/invoices. |
| **Webhooks** | Mandatory: subscription and invoice events; update DB so app and admin views stay in sync. |
| **Internal access** | Define whether internal roles (e.g. superadmin without facility) bypass subscription checks; if so, implement in the same gating layer. |

---

## 8. Suggested Implementation Order

1. **Stripe setup:** Products/prices, webhook endpoint (verify signature, log payloads).  
2. **DB migrations:** `stripe_customer_id` on facility; `facility_subscriptions` table.  
3. **Webhook handlers:** Update `facility_subscriptions` (and optional billing_events) from subscription/invoice events.  
4. **Access control helper:** “Can facility X use module Y?” and use it in one place (e.g. middleware or a small auth/subscription service).  
5. **Billing hub (PCG):** Page to see status, start trial (Checkout), link to Customer Portal.  
6. **Gating:** Apply subscription check on binder and MAR/Progress Notes routes; add paywall/upgrade UI.  
7. **Admin subscriptions page:** List facilities, status, links to Stripe, basic actions.  
8. **Polish:** Invoices list (or rely on Portal), export, and any role-based bypass for internal team.

---

*Document version: 1.0. No codebase changes were made; this is a specification for implementation.*
