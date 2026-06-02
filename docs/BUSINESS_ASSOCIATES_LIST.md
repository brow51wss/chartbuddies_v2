# Business Associates List (BAA Tracker)

**Application:** Lasso EHR  
**Last updated:** May 30, 2026  
**HIPAA Requirement:** 45 CFR §164.308(b) — covered entities must maintain a list of all business associates and ensure BAAs are in place.

---

## Active Business Associates

| Vendor | Service | PHI Exposure | BAA Status | BAA Date | Review Due |
|--------|---------|-------------|------------|----------|------------|
| **Amazon Web Services (AWS)** | Hosting (Amplify), CDN (CloudFront), Email (SES), Audit logging (CloudTrail), Firewall (WAF), Storage (S3) | Yes — infrastructure handles PHI in transit | ✅ Signed via AWS Artifact | May 2026 | May 2027 |
| **Supabase** | Authentication, non-PHI application data (demo environment only) | No — auth only; no real PHI stored | ⚠️ No BAA (Team plan) | N/A | Review at Enterprise upgrade |
| **Cloudflare** | DNS management, proxy | No — DNS only; no PHI in transit through Cloudflare | ✅ Cloudflare BAA available on Business/Enterprise | Review needed | June 2026 |
| **Vercel** | Marketing site hosting (lasso-app.com) | No — marketing one-pager only; no PHI | ⚠️ No BAA | N/A | Keep monitoring |
| **GitHub** | Source code repository | No — code only; no PHI in repo | ⚠️ No BAA needed (code repo) | N/A | Annual review |

---

## Notes

### AWS
- BAA accepted via AWS Artifact → Agreements → "AWS Business Associate Addendum"
- Covers: EC2, S3, RDS, CloudTrail, CloudWatch, CloudFront, ACM, Amplify, SES, WAF
- Account ID: 148018683560
- Review annually — set calendar reminder for May 2027

### Supabase
- Currently used for authentication and non-PHI app data in the demo environment
- Real PHI will be stored in AWS RDS (not Supabase)
- If Supabase ever stores real PHI, must upgrade to Enterprise plan and sign Supabase BAA
- Monitor: https://supabase.com/security

### Cloudflare
- DNS proxy is active for lasso-app.com and app.lasso-app.com
- Traffic passes through Cloudflare's network — evaluate whether this constitutes PHI exposure
- Cloudflare BAA is available on Business plan ($200/month) or Enterprise
- **Action required:** Confirm with legal/compliance whether current Cloudflare plan requires a BAA

### Vercel
- Hosts the marketing one-pager at lasso-app.com only
- No patient data, no authentication, no PHI
- No BAA required for marketing content

---

## Annual Review Checklist

Each year, confirm:
- [ ] AWS BAA is still current and covers all services in use
- [ ] No new AWS services added that aren't covered by the BAA
- [ ] Supabase role has not expanded to include PHI
- [ ] Cloudflare BAA decision has been made and documented
- [ ] Any new third-party vendors assessed for PHI exposure and BAA requirement
- [ ] This document updated to reflect any changes

---

## How to Add a New Vendor

Before using any new third-party service, answer these questions:
1. Will it ever receive, transmit, or store PHI? (even indirectly)
2. If yes — does the vendor offer a BAA?
3. If yes — sign the BAA before going live
4. If no BAA available — do not use the service for anything PHI-related
5. Add vendor to this list with BAA status and date

---

*Created: May 30, 2026 | Next review: May 2027*
