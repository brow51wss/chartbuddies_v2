# Vercel Decommission Checklist

**When to execute:** After 48–72 hours of stable operation on AWS Amplify with no rollback needed.  
**Current status:** Vercel kept live as rollback option. Do NOT decommission yet.

---

## Environment Variables to Remove

These must be deleted from Vercel before the project is decommissioned to prevent credential exposure.

| Variable | Sensitivity | Action |
|----------|-------------|--------|
| `RESEND_API_KEY` | 🔴 **SECRET** — API key for Resend email service | Delete immediately when decommissioning |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 🟡 Public anon key (low risk, but remove anyway) | Delete |
| `NEXT_PUBLIC_SUPABASE_URL` | 🟢 Public URL (not sensitive) | Delete |
| `NEXT_PUBLIC_APP_URL` | 🟢 Public domain (not sensitive) | Delete |
| `RESEND_FROM_EMAIL` | 🟢 Email address (not sensitive) | Delete |

**Priority:** `RESEND_API_KEY` is the only true secret. Remove it first.

---

## Decommission Steps (execute in order)

- [ ] Confirm Amplify has been stable for 48–72 hours with no critical issues
- [ ] Confirm all DNS records point to Amplify (not Vercel)
- [ ] Delete all 5 environment variables from Vercel (Settings → Environment Variables)
- [ ] Redeploy or confirm Vercel can no longer serve the app without env vars
- [ ] Delete the Vercel project entirely (Settings → Advanced → Delete Project)
- [ ] Confirm `lasso-app.com` and `www.lasso-app.com` still resolve correctly (they use Vercel for the marketing one-pager — do NOT remove those DNS records)
- [ ] Confirm `app.lasso-app.com` still resolves to Amplify after Vercel project deletion
- [ ] Document decommission date for HIPAA compliance records

---

## ⚠️ Important Note

`lasso-app.com` (marketing site) is still hosted on Vercel. Deleting the **project** will take down the marketing site too unless you either:
1. Keep the Vercel project alive for the marketing one-pager (simplest), OR
2. Move the marketing one-pager to a separate Vercel project or static host first

**Recommended:** Keep the Vercel project alive for the marketing site. Only remove the secrets (`RESEND_API_KEY`) and any PHI-adjacent env vars. The marketing one-pager has no access to patient data.

---

*Created: May 30, 2026*
