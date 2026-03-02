# Custom Domain (Cloudflare) + Vercel + Resend Setup

Use this guide when your domain is **registered via GoDaddy (or reseller)** and **nameservers are managed in Cloudflare**, and you want to:

1. Point that domain to your Vercel-hosted app.
2. Use the same domain for sending emails via Resend (invites, etc.).

**Project domain:** `lasso-app.com` (use this instead of `yourdomain.com` below).

---

## Next: Do this first (lasso-app.com)

1. **Vercel:** Add the domain so you get the target values.
   - [Vercel](https://vercel.com/dashboard) → your project → **Settings** → **Domains** → **Add** → `lasso-app.com` and `www.lasso-app.com`.
   - Note the DNS instructions Vercel shows (they may match the table below).

2. **Cloudflare:** Add DNS so the domain points to Vercel.
   - In Cloudflare, click **DNS** in the left sidebar (for the zone **lasso-app.com**).
   - Under **Records**, click **Add record** and add:

     | Type  | Name | Target / Content        | Proxy      |
     |-------|------|--------------------------|------------|
     | CNAME | `@`  | `cname.vercel-dns.com`   | DNS only or Proxied |
     | CNAME | `www` | `cname.vercel-dns.com` | DNS only or Proxied |

   - If Cloudflare does not allow CNAME on `@`, use an **A** record: Name `@`, IPv4 `76.76.21.21`.
   - Save, then in Vercel click **Refresh** next to the domain. SSL will be issued automatically.

3. **Vercel env:** Set `NEXT_PUBLIC_APP_URL` = `https://lasso-app.com` (Settings → Environment Variables), then redeploy.

4. **Resend (after site works):** Add domain `send.lasso-app.com` in Resend, add the MX/TXT records they give you in Cloudflare DNS, verify, then set `RESEND_FROM_EMAIL` = `noreply@send.lasso-app.com`.

---

## Part 1: Point Your Domain to Vercel

### 1.1 Add the domain in Vercel

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → your **chartbuddies_v2** project.
2. Go to **Settings** → **Domains**.
3. Click **Add** and enter:
   - `lasso-app.com` (root/apex)
   - `www.lasso-app.com` (optional but recommended)
4. Vercel will show the **exact DNS records** you need. Keep that tab open.

### 1.2 Add DNS records in Cloudflare

1. Log in to [Cloudflare](https://dash.cloudflare.com) and select the zone for **lasso-app.com**.
2. Click **DNS** in the left sidebar → **Records**.
3. Add the records Vercel shows. Typically:

   **For the root domain (`yourdomain.com`):**

   - **Option A (recommended on Cloudflare):**  
     - Type: **CNAME**  
     - Name: `@` (or leave blank for root)  
     - Target: `cname.vercel-dns.com`  
     - Proxy status: **DNS only** (grey cloud) or **Proxied** (orange) — both work; Proxied adds Cloudflare proxy.
   - **Option B:**  
     - Type: **A**  
     - Name: `@`  
     - IPv4: `76.76.21.21`  
     - (Use the value Vercel shows if different.)

   **For `www`:**

   - Type: **CNAME**  
   - Name: `www`  
   - Target: `cname.vercel-dns.com`  
   - Proxy: your choice (DNS only or Proxied).

4. **Save**. If you had existing A/CNAME for `@` or `www`, remove or update them so only the Vercel records remain.
5. In Vercel, click **Refresh** next to the domain; verification can take a few minutes up to 48 hours. SSL will be issued automatically.

### 1.3 Set env and app URL

- In **Vercel** → Project → **Settings** → **Environment Variables**, set:
  - `NEXT_PUBLIC_APP_URL` = `https://yourdomain.com` (or `https://www.yourdomain.com` if you use www as canonical).
- Redeploy if needed so the app uses the new URL (e.g. for invite links).

---

## Part 2: Resend with Your Domain

Resend recommends using a **subdomain** for sending (e.g. `send.yourdomain.com`) so the root domain stays clean. You’ll send from addresses like `noreply@send.yourdomain.com` or `invites@send.yourdomain.com`.

### 2.1 Add domain in Resend

1. Log in to [Resend](https://resend.com) → **Domains** → **Add Domain**.
2. Enter the **subdomain** you want for sending, e.g.:
   - `send.yourdomain.com`  
   (Resend will show this as “send” in the DNS name column; the full host is `send.yourdomain.com`.)
3. Resend will show the DNS records you need (MX, TXT for SPF, TXT for DKIM). Keep this page open.

**Optional:** Resend can “Sign in to Cloudflare” and add records for you (Domain Connect). If you prefer that, use it and skip to 2.3.

### 2.2 Add Resend DNS records in Cloudflare

In **Cloudflare** → **DNS** → **Records** for `yourdomain.com`, add **exactly** what Resend shows. Names should be **relative to your domain** (e.g. only `send`, not `send.yourdomain.com`).

**MX (for Resend sending):**

- Type: **MX**
- Name: `send`
- Mail server: *(copy from Resend — e.g. `feedback-smtp.us-east-1.amazonses.com`)*
- Priority: `10`
- TTL: Auto

**TXT (SPF):**

- Type: **TXT**
- Name: `send`
- Content: *(copy from Resend — e.g. `v=spf1 include:amazonses.com ~all`)*
- TTL: Auto

**TXT (DKIM):**

- Type: **TXT**
- Name: `resend._domainkey.send` (or exactly what Resend shows; sometimes `resend._domainkey` for the subdomain)
- Content: *(copy from Resend — long DKIM value)*
- TTL: Auto  
- **Proxy: DNS only (grey cloud)** — required for DKIM.

If Resend shows a different DKIM name (e.g. for subdomain), use that. Do not duplicate priority for MX; if `10` is taken, use `20` or `30`.

### 2.3 Verify in Resend

1. In Resend → **Domains** → your domain → **Verify DNS Records**.
2. Wait a few minutes (up to 72 hours in rare cases). Once verified, the domain status will show as verified.

### 2.4 Create sender and set env

1. In Resend, use the verified domain to send. The “from” address will be something like:
   - `noreply@send.yourdomain.com` or  
   - `invites@send.yourdomain.com`
2. In **Vercel** (and locally if you use invite emails in dev), set:
   - `RESEND_FROM_EMAIL` = `noreply@send.yourdomain.com` (or the address you chose).
3. Redeploy so the app uses the new from address.

---

## Checklist

- [ ] Domain added in Vercel (apex + www if desired).
- [ ] DNS in Cloudflare points to Vercel (CNAME or A as per Vercel).
- [ ] Vercel shows domain as verified; SSL works.
- [ ] `NEXT_PUBLIC_APP_URL` set to `https://yourdomain.com` (or www).
- [ ] Subdomain (e.g. `send.yourdomain.com`) added and verified in Resend.
- [ ] MX, SPF, DKIM for Resend added in Cloudflare; DKIM is DNS only.
- [ ] Resend domain shows as verified.
- [ ] `RESEND_FROM_EMAIL` set to `…@send.yourdomain.com` (or your chosen address).
- [ ] Redeploy app; test invite email to a real address.

---

## Quick reference

| Where        | What to set |
|-------------|-------------|
| **Cloudflare DNS** | A/CNAME for `@` and `www` → Vercel; MX + TXT for `send` → Resend. |
| **Vercel env**     | `NEXT_PUBLIC_APP_URL=https://yourdomain.com` |
| **Vercel env**     | `RESEND_FROM_EMAIL=noreply@send.yourdomain.com` |
| **Resend**         | Domain = `send.yourdomain.com`; verify; then send from that domain. |

If something doesn’t verify, double-check names in Cloudflare (no trailing dot; use `send` not `send.yourdomain.com` for the Name field) and that DKIM is **DNS only**.
